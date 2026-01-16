from fastapi import FastAPI, Depends, HTTPException, Body, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from db.database import get_db
from services.services import PaymentService
from db.models import Account, Merchant, User
from uuid import UUID
from auth import create_access_token, verify_password, get_current_user

app = FastAPI(title="NFC API Backend")

@app.get("/")
def read_root():
    return {"message": "NFC Python API is running!"}

# ------- Authentication routes -------
@app.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Exchanges Email/Password for a JWT token
    Front-end sends: username (email) & password
    """
    # find the user email
    user = db.query(User).filter(User.email == form_data.username).first()

    # Verify Password
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code= status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generate Token
    access_token = create_access_token(data={"sub": str(user.user_id)})
    return {"access_token": access_token, "token_type": "bearer"}

# ------ Account Routes ------
@app.get("/api/accounts/my-family")
def get_my_family(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Fetch all child accounts belonging to the logged-in parent.
    Used by the Mobile App Dashboard.
    """
    if current_user.role != 'parent':
         raise HTTPException(status_code=403, detail="Only parents can view family accounts")
         
    # 1. Find all children linked to this parent
    children = db.query(User).filter(User.parent_id == current_user.user_id).all()
    
    # 2. Get the financial account for each child
    family_data = []
    for child in children:
        account = db.query(Account).filter(Account.owner_id == child.user_id).first()
        if account:
            family_data.append({
                "child_name": "Child Account", # You can add a 'name' field to User later
                "balance": float(account.balance),
                "account_id": account.account_id,
                "nfc_status": account.status
            })
            
    return family_data

@app.get("/api/accounts/{account_id}/balance")
def get_balance(account_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Get balance for a specific amount.
    ---- In future, add check: does current_user actually own this account
    """
    account = db.query(Account).filter(Account.account_id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail = "Account not found")
    
    # --- SECURITY CHECK ---
    
    # Case A: User is the Child (Owner)
    if current_user.role == 'child':
        if account.owner_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="You can only view your own account")

    # Case B: User is the Parent
    elif current_user.role == 'parent':
        # Find the owner of this account (the child)
        child_owner = db.query(User).filter(User.user_id == account.owner_id).first()
        
        # Verify this child belongs to this parent
        if not child_owner or child_owner.parent_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="You can only view accounts for your own children")
    
    # ----------------------
    
    return {"balance": float(account.balance)}

@app.post("/api/accounts/{account_id}/topup")
def top_up(
    account_id: UUID, 
    amount: float = Body(..., embed=True), 
    paymentMethodId: str =Body(..., embed=True) ,
    current_user: User = Depends(get_current_user) ,
    db:Session = Depends(get_db)):

    # Parent loads money onto a childs band
    
    # 1. Role Check
    if current_user.role != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can top up accounts")

    # 2. Fetch Account & Verify Ownership
    account = db.query(Account).filter(Account.account_id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Find who owns this account
    child_owner = db.query(User).filter(User.user_id == account.owner_id).first()
    
    # Security Check: Is this MY child?
    if not child_owner or child_owner.parent_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="You can only top up your own children's accounts")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    
    result = PaymentService.top_up(db, account_id, amount, paymentMethodId)

    if not result:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if "success" in result and result["success"] is False:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result

# ----- Transaction Routes -----
# *** This isnt protected by current_user because the school terminal calls it not parent
# In next spring use an API key for the terminal
@app.post("/api/transactions/pay")
def process_payment(
    nfcTokenId: str = Body(...),
    amount: float = Body(...),
    merchantId: UUID = Body(...),
    category: str = Body(...),
    db: Session = Depends(get_db)
):
    # Validate merchant and get their stripe connect ID
    # Dont trust client to send the stripe ID, look it up
    merchant = db.query(Merchant).filter(Merchant.merchant_id == merchantId).first()

    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    if not merchant.stripe_account_id:
        raise HTTPException(status_code=500, detail="Merchant has no linked Stripe account")
    
    result = PaymentService.process_nfc_transaction(
        db,
        nfcTokenId,
        amount,
        merchantId,
        category,
        merchant.stripe_account_id # passing the trusted ID from DB
    )
    
    if result["success"]:
        return {"status": "approved", "balance": result["new_balance"]}
    else:
        raise HTTPException(status_code=403, detail=result["message"])