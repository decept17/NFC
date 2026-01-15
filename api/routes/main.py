from fastapi import FastAPI, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from db.database import get_db
from services.services import PaymentService
from db.models import Account, Merchant
from uuid import UUID

app = FastAPI(title="NFC API Backend")

@app.get("/")
def read_root():
    return {"message": "NFC Python API is running!"}

# ------ Account Routes ------
@app.get("/api/accounts/{account_id}/balance")
def get_balance(account_id: UUID, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.account_id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail = "Account not found")
    return {"balance": float(account.balance)}

@app.post("/api/accounts/{account_id}/topup")
def top_up(account_id: UUID, amount: float = Body(..., embed=True), paymentMethodId: str =Body(..., embed=True) , db:Session = Depends(get_db)):
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    
    result = PaymentService.top_up(db, account_id, amount, paymentMethodId)

    if not result:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if "success" in result and result["success"] is False:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result

# ----- Transaction Routes -----
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