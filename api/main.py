from fastapi import FastAPI, Depends, HTTPException, Body, status, Request, Header
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from db.database import get_db
from services.services import PaymentService
from db.models import Account, Merchant, User, Transaction, NFCTag, Notification, Limit
from typing import List
from pydantic import BaseModel, Field
from uuid import UUID
from auth import create_access_token, verify_password, get_current_user
from datetime import datetime
from auth import get_password_hash
from fastapi.responses import RedirectResponse
from utils.crypto import verify_sun_mac, counter_hex_to_int
from pydantic import EmailStr
import os
import stripe

stripe.api_key = os.getenv("PAYMENT_GATEWAY_SECRET_KEY")
ADMIN_PROVISION_KEY = os.getenv("ADMIN_PROVISION_KEY", "changeme-set-in-env")

app = FastAPI(title="NFC API Backend")

@app.get("/")
def read_root():
    return {"message": "NFC Python API is running!"}

# --- Pydantic Models For data request validation
class LinkNFCRequest(BaseModel):
    nfc_uid: str = Field(..., description="NFC tag UID (from the chip's SUN URL uid= param)")

# ensures we only send safe data back to the app (filtering out internal IDs)
class TransactionResponse(BaseModel):
    id: str = Field(..., description="Transaction ID")
    amount: float = Field(..., description="amount of money")
    description: str = Field(..., description="what has been bought")
    timestamp: datetime = Field(..., description="Time of transaction")
    category: str | None = Field(None, description="What category of item is it in? if any")
    type: str = Field(..., description="Payment, TopUp, Withdrawal, etc.")
    status: str = Field(..., description="Success, Failed, etc.")

# ---- Account management routes -------
@app.post("/api/accounts/{account_id}/link-nfc")
def link_nfc_tag(
    account_id: UUID, 
    request: LinkNFCRequest,
    # Security: We need to know WHO is asking (the parent)
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Links a physical NFC tag UID to a child's account.
    """
    # 1. Ownership Check (Parent Only)
    account = db.query(Account).filter(Account.account_id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    #Is the parent actually a parent to child who owns the account
    child = db.query(User).filter(User.user_id == account.owner_id).first()
    if not child or child.parent_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # 2. Find the pre-provisioned tag (created by the desktop burner script)
    existing_tag = db.query(NFCTag).filter(NFCTag.nfc_uid == request.nfc_uid).first()
    if not existing_tag:
        raise HTTPException(status_code=404, detail="This NFC tag has not been provisioned. Run the burner script first.")
    if existing_tag.user_id is not None:
        raise HTTPException(status_code=400, detail="This NFC tag is already linked to a child")
    if not existing_tag.auth_key:
        raise HTTPException(status_code=500, detail="Provisioned tag is missing its auth key — re-provision the chip")

    # 3. Assign the tag to the child and activate it
    existing_tag.user_id = account.owner_id
    existing_tag.status = 'active'
    existing_tag.label = f"{child.name}'s Wristband" if child.name else "Wristband"
    existing_tag.last_counter = 0
    account.nfc_token_id = request.nfc_uid
    db.commit()

    return {"success": True, "message": "Wristband linked successfully"}

@app.post("/api/accounts/{account_id}/freeze")
def freeze_account(
    account_id: UUID, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Emergency Stop: Locks the account so the NFC tag stops working.
    """
    account = db.query(Account).filter(Account.account_id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Verify: Parent of the child, OR the child themselves
    child = db.query(User).filter(User.user_id == account.owner_id).first()
    is_parent = child and child.parent_id == current_user.user_id
    is_self = account.owner_id == current_user.user_id
    if not is_parent and not is_self:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Toggle Status if active go to frozen otherwise vice versa
    new_status = "Active" if account.status == "Frozen" else "Frozen"
    account.status = new_status
    db.commit()
    
    return {"status": new_status}

@app.get("/api/accounts/{account_id}/history", response_model=List[TransactionResponse])
def get_history(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns list of recent transactions.
    """
    # Ownership checks
    account = db.query(Account).filter(Account.account_id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Verify: Parent of the child, OR the child themselves
    child = db.query(User).filter(User.user_id == account.owner_id).first()
    is_parent = child and child.parent_id == current_user.user_id
    is_self = account.owner_id == current_user.user_id
    if not is_parent and not is_self:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    transactions = db.query(Transaction)\
        .filter(Transaction.account_id == account_id)\
        .order_by(Transaction.created_at.desc())\
        .limit(20)\
        .all()

    # Map DB model fields → mobile app field names
    result = []
    for tx in transactions:
        # Build a human-readable description
        if tx.type == "Payment":
            desc = tx.merchant_name or "Payment"
        elif tx.type == "TopUp":
            desc = "Top Up"
        elif tx.type == "Withdrawal":
            desc = "Withdrawal"
        else:
            desc = tx.type or "Transaction"

        result.append(TransactionResponse(
            id=str(tx.transaction_id),
            amount=float(tx.amount),
            description=desc,
            timestamp=tx.created_at,
            category=tx.merchant_name,
            type=tx.type,
            status=tx.status,
        ))

    return result

# ------- Authentication routes -------
@app.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Exchanges credentials for a JWT token.
    Parents log in with email, children log in with username.
    The 'username' field of the OAuth2 form carries either the email or the child username.
    """
    identifier = form_data.username  # could be email or child username

    # Try to find by email first (parent flow)
    user = db.query(User).filter(User.email == identifier).first()

    # If not found by email, try by username (child flow)
    if not user:
        user = db.query(User).filter(User.username == identifier).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found. Would you like to register?",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": str(user.user_id)})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "user_id": str(user.user_id),
    }

class RegisterRequest(BaseModel):
    email: Emailstr
    password: str = Field(..., min_length=6)

@app.post("/api/auth/register")
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Registers a new user and returns a JWT token immediately
    """
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Hash password
    hashed_password = get_password_hash(request.password)

    # Create new user
    new_user = User(
        email=request.email,
        password_hash=hashed_password,
        role="parent" # Defaulting to parent for registration flow
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Generate Token
    access_token = create_access_token(data={"sub": str(new_user.user_id)})
    return {"access_token": access_token, "token_type": "bearer"}

class AddChildRequest(BaseModel):
    name: str
    username: str
    password: str

@app.post("/api/accounts/add-child")
def add_child(
    request: AddChildRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates a child user (with login credentials) and their wallet account,
    linked to the logged-in parent.
    """
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can add children")

    # Check if username is already taken
    existing = db.query(User).filter(User.username == request.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    # Create the child User with login credentials
    child = User(
        role="child",
        name=request.name,
        username=request.username,
        password_hash=get_password_hash(request.password),
        parent_id=current_user.user_id,
    )
    db.add(child)
    db.flush()

    # Create a wallet Account for the child
    child_account = Account(
        owner_id=child.user_id,
        balance=0.00,
    )
    db.add(child_account)
    db.commit()
    db.refresh(child_account)

    return {
        "child_name": request.name,
        "balance": float(child_account.balance),
        "account_id": str(child_account.account_id),
        "nfc_status": "Active"
    }

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
                "child_name": child.name or "Child Account",
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

@app.post("/api/accounts/{account_id}/create-checkout-session")
def create_checkout_session(
    account_id: UUID,
    request: Request,
    amount: float = Body(..., embed=True),
    success_url: str = Body(None, embed=True),
    cancel_url: str = Body(None, embed=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Step 1 of the top-up flow.
    Creates a Stripe Checkout Session and returns the hosted URL.
    The mobile app opens this URL in an in-app browser where the
    parent completes payment via Stripe Link, card, etc.
    The DB balance is updated ONLY by the /webhook route below.
    """
    # 1. Role Check
    if current_user.role != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can top up accounts")

    # 2. Fetch Account & Verify Ownership
    account = db.query(Account).filter(Account.account_id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    child_owner = db.query(User).filter(User.user_id == account.owner_id).first()
    if not child_owner or child_owner.parent_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="You can only top up your own children's accounts")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    # Build the base URL from the incoming request so redirect URLs point to our API
    base_url = str(request.base_url).rstrip("/")
    result = PaymentService.create_checkout_session(amount, str(account_id), base_url, success_url, cancel_url)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))

    return {"url": result["url"]}


# --- Checkout redirect pages (shown inside the in-app browser after Stripe) ---

@app.get("/checkout/success", response_class=HTMLResponse)
def checkout_success():
    return """
    <html>
    <head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="display:flex;justify-content:center;align-items:center;height:100vh;
                 font-family:system-ui,sans-serif;background:#e6f4fe;margin:0;">
      <div style="text-align:center;padding:40px;">
        <h1 style="color:#1a7f37;font-size:28px;">✅ Payment Successful!</h1>
        <p style="color:#333;font-size:18px;">Your top-up is being processed.<br>You can close this page and return to the app.</p>
      </div>
    </body>
    </html>
    """

@app.get("/checkout/redirect")
def checkout_redirect(to: str):
    """
    Redirects to a deep link. This is used as the Stripe success/cancel URL because
    Stripe requires HTTP/HTTPS URLs, but we want to return the user to the app via a deep link.
    """
    return RedirectResponse(url=to)

@app.get("/checkout/cancel", response_class=HTMLResponse)
def checkout_cancel():
    return """
    <html>
    <head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="display:flex;justify-content:center;align-items:center;height:100vh;
                 font-family:system-ui,sans-serif;background:#fef2e6;margin:0;">
      <div style="text-align:center;padding:40px;">
        <h1 style="color:#c44;font-size:28px;">❌ Payment Cancelled</h1>
        <p style="color:#333;font-size:18px;">No charge was made.<br>You can close this page and return to the app.</p>
      </div>
    </body>
    </html>
    """


@app.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Stripe calls this endpoint after a payment is confirmed on the user's device.
    This is the ONLY place the DB balance is updated — making it tamper-proof.
    Set STRIPE_WEBHOOK_SECRET in your .env from the Stripe Dashboard.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    print(f"[WEBHOOK] Received webhook request")
    print(f"[WEBHOOK] Signature header present: {bool(sig_header)}")
    print(f"[WEBHOOK] Webhook secret (first 10 chars): {webhook_secret[:10] if webhook_secret else 'NONE'}...")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        print(f"[WEBHOOK] ✅ Signature verified. Event type: {event['type']}")
    except Exception as e:
        print(f"[WEBHOOK] ❌ Signature verification FAILED: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    # Only act on successful payments
    if event["type"] == "payment_intent.succeeded":
        intent = event["data"]["object"]
        account_id = intent.get("metadata", {}).get("account_id")
        amount_gbp = intent["amount"] / 100.0

        print(f"[WEBHOOK] PaymentIntent succeeded: account_id={account_id}, amount=£{amount_gbp}")

        if account_id:
            account = db.query(Account).filter(Account.account_id == account_id).first()
            if account:
                old_balance = float(account.balance)
                account.balance = float(account.balance) + amount_gbp

                tx = Transaction(
                    account_id=account_id,
                    amount=amount_gbp,
                    type="TopUp",
                    status="Success",
                    stripe_charge_id=intent["id"],
                )
                db.add(tx)
                db.commit()
                print(f"[WEBHOOK] ✅ Balance updated: £{old_balance} → £{float(account.balance)}")
            else:
                print(f"[WEBHOOK] ⚠️ Account {account_id} not found in DB!")
        else:
            print(f"[WEBHOOK] ⚠️ No account_id in PaymentIntent metadata!")
    else:
        print(f"[WEBHOOK] Ignoring event type: {event['type']}")

    return {"status": "success"}

# ----- Transaction Routes -----
# *** This isnt protected by current_user because the school terminal calls it not parent
# In next sprint use an API key for the terminal

class NFCPayRequest(BaseModel):
    uid: str = Field(..., description="Chip UID from the SUN URL uid= parameter")
    counter: str = Field(..., description="Tap counter from SUN URL c= parameter (hex, e.g. '000015')")
    cmac: str = Field(..., description="SUN MAC from URL m= parameter (16 hex chars = 8 bytes)")
    amount: float = Field(..., description="Transaction amount in GBP")
    merchantId: UUID = Field(..., description="Merchant UUID")
    category: str = Field(..., description="Purchase category")

@app.post("/api/transactions/pay")
def process_payment(
    request: NFCPayRequest,
    db: Session = Depends(get_db)
):
    # --- SUN Security Checks ---

    # 1. Look up the tag by UID
    tag = db.query(NFCTag).filter(NFCTag.nfc_uid == request.uid).first()
    if not tag:
        raise HTTPException(status_code=404, detail="NFC tag not recognised")

    if not tag.auth_key:
        raise HTTPException(status_code=500, detail="Tag has no auth key configured — please re-link the wristband")

    # 2. Replay attack check: counter must be strictly greater than the last accepted one
    incoming_counter = counter_hex_to_int(request.counter)
    if incoming_counter <= tag.last_counter:
        raise HTTPException(status_code=403, detail="Replay attack detected: counter not fresh")

    # 3. Cryptographic MAC verification
    if not verify_sun_mac(
        uid_hex=request.uid,
        counter_hex=request.counter,
        cmac_hex=request.cmac,
        auth_key_hex=tag.auth_key,
    ):
        raise HTTPException(status_code=403, detail="Invalid MAC — tap not authenticated")

    # 4. Update the counter immediately (even before the payment goes through)
    #    This prevents any window for replay even on payment failure.
    tag.last_counter = incoming_counter
    db.flush()  # Write counter update without committing yet

    # --- Validate merchant and get their stripe connect ID ---
    merchant = db.query(Merchant).filter(Merchant.merchant_id == request.merchantId).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    if not merchant.stripe_account_id:
        raise HTTPException(status_code=500, detail="Merchant has no linked Stripe account")
    
    result = PaymentService.process_nfc_transaction(
        db,
        request.uid,       # pass the UID; PaymentService looks up the tag by nfc_uid
        request.amount,
        request.merchantId,
        request.category,
        merchant.stripe_account_id,
        merchant.name               # e.g. "School Canteen" — stored on the transaction for history
    )
    
    if result["success"]:
        return {"status": "approved", "balance": result["new_balance"]}
    else:
        raise HTTPException(status_code=403, detail=result["message"])


# ----- Admin: Chip Provisioning -----
class ProvisionTagRequest(BaseModel):
    nfc_uid: str = Field(..., description="UID read from the chip after provisioning")
    auth_key: str = Field(..., description="32-char hex AES-128 key written to the chip")

@app.post("/api/admin/provision-tag")
def provision_tag(
    request: ProvisionTagRequest,
    x_admin_key: str = Header(..., alias="X-Admin-Key"),
    db: Session = Depends(get_db)
):
    """
    Called by the in-app provisioning screen after it has successfully configured
    an NTAG 424 DNA chip. Stores the uid + auth_key in the database so the chip
    can be used for SUN-authenticated payments.

    Protected by a secret admin key (X-Admin-Key header), NOT a parent JWT.
    """
    if x_admin_key != ADMIN_PROVISION_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin key")

    if len(request.auth_key) != 32:
        raise HTTPException(status_code=400, detail="auth_key must be 32 hex characters (AES-128)")

    # Check if tag already exists (re-provisioning flow)
    existing = db.query(NFCTag).filter(NFCTag.nfc_uid == request.nfc_uid).first()
    if existing:
        existing.auth_key = request.auth_key
        existing.last_counter = 0
        db.commit()
        return {"success": True, "message": "Tag re-provisioned", "uid": request.nfc_uid}

    # New tag — store in DB as unlinked inventory (user_id=None)
    # Will be assigned to a child when parent uses the Link Wristband screen
    new_tag = NFCTag(
        nfc_uid=request.nfc_uid,
        user_id=None,
        status='active',
        auth_key=request.auth_key,
        last_counter=0,
    )
    db.add(new_tag)
    db.commit()

    return {
        "success": True,
        "message": "Tag provisioned and stored. Use the Link Wristband screen to assign it to a child.",
        "uid": request.nfc_uid,
    }


# ----- Spending Limits Routes -----

class LimitsRequest(BaseModel):
    daily_spending_limit: float = Field(0, description="Max daily spend in GBP (0 = no limit)")
    single_transaction_max: float = Field(0, description="Max per-transaction in GBP (0 = no limit)")
    blocked_categories: list[str] = Field(default_factory=list, description="List of blocked category names")

@app.get("/api/accounts/{account_id}/limits")
def get_limits(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch spending limits for a child account."""
    from db.models import Limit

    account = db.query(Account).filter(Account.account_id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Verify parent owns this child
    child = db.query(User).filter(User.user_id == account.owner_id).first()
    if not child or child.parent_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    limits = db.query(Limit).filter(Limit.child_account_id == account_id).first()

    if not limits:
        return {
            "daily_spending_limit": 0,
            "single_transaction_max": 0,
            "blocked_categories": [],
        }

    return {
        "daily_spending_limit": float(limits.daily_spending_limit),
        "single_transaction_max": float(limits.single_transaction_max),
        "blocked_categories": limits.blocked_categories or [],
    }


@app.put("/api/accounts/{account_id}/limits")
def update_limits(
    account_id: UUID,
    request: LimitsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create or update spending limits for a child account."""
    from db.models import Limit

    account = db.query(Account).filter(Account.account_id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    child = db.query(User).filter(User.user_id == account.owner_id).first()
    if not child or child.parent_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    limits = db.query(Limit).filter(Limit.child_account_id == account_id).first()

    if limits:
        limits.daily_spending_limit = request.daily_spending_limit
        limits.single_transaction_max = request.single_transaction_max
        limits.blocked_categories = request.blocked_categories
    else:
        limits = Limit(
            child_account_id=account_id,
            daily_spending_limit=request.daily_spending_limit,
            single_transaction_max=request.single_transaction_max,
            blocked_categories=request.blocked_categories,
        )
        db.add(limits)

    db.commit()

    return {
        "success": True,
        "daily_spending_limit": float(limits.daily_spending_limit),
        "single_transaction_max": float(limits.single_transaction_max),
        "blocked_categories": limits.blocked_categories or [],
    }


# ----- Child-Specific Routes -----

@app.get("/api/child/my-account")
def get_child_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns the logged-in child's own account details (balance, status, name).
    """
    if current_user.role != "child":
        raise HTTPException(status_code=403, detail="This endpoint is for child accounts only")

    account = db.query(Account).filter(Account.owner_id == current_user.user_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="No account found for this child")

    return {
        "child_name": current_user.name or "Child",
        "balance": float(account.balance),
        "account_id": str(account.account_id),
        "status": account.status,
    }


# ----- Notification Routes -----

class PingRequest(BaseModel):
    message: str = "Can I have some money?"

@app.post("/api/notifications/ping")
def ping_parent(
    request: PingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Child sends a 'ping for money' notification to their parent.
    """
    if current_user.role != "child":
        raise HTTPException(status_code=403, detail="Only children can ping their parent")

    if not current_user.parent_id:
        raise HTTPException(status_code=400, detail="No linked parent found")

    notification = Notification(
        child_id=current_user.user_id,
        parent_id=current_user.parent_id,
        message=request.message,
    )
    db.add(notification)
    db.commit()

    return {"success": True, "message": "Your parent has been notified!"}


@app.get("/api/notifications")
def get_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Parent fetches their unread notifications from children.
    """
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can view notifications")

    notifications = db.query(Notification)\
        .filter(Notification.parent_id == current_user.user_id)\
        .order_by(Notification.created_at.desc())\
        .limit(50)\
        .all()

    result = []
    for n in notifications:
        child = db.query(User).filter(User.user_id == n.child_id).first()
        result.append({
            "notification_id": str(n.notification_id),
            "child_name": child.name if child else "Child",
            "message": n.message,
            "status": n.status,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        })
    return result


@app.patch("/api/notifications/{notification_id}/dismiss")
def dismiss_notification(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a notification as dismissed."""
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can dismiss notifications")

    notification = db.query(Notification).filter(
        Notification.notification_id == notification_id,
        Notification.parent_id == current_user.user_id
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.status = "dismissed"
    db.commit()

    return {"success": True}