from fastapi import FastAPI, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from db.database import get_db
from services.services import PaymentService
from db.models import Account

app = FastAPI(title="NFC API Backend")

@app.get("/")
def read_root():
    return {"message": "NFC Python API is running!"}

# ------ Account Routes ------
@app.get("/api/accounts/{account_id}/balance")
def get_balance(account_id: str, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.account_id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail = "Account not found")
    return {"balance": float(account.balance)}

@app.post("/api/accounts/{account_id}/topup")
def top_up(account_id: str, amount: float = Body(..., embed=True), db:Session = Depends(get_db)):
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    
    result = PaymentService.top_up(db, account_id, amount)
    if not result:
        raise HTTPException(status_code=404, detail="Account not found")
    return result

# ----- Transaction Routes -----
@app.post("/api/transactions/pay")
def process_payment(
    nfcTokenId: str = Body(...),
    amount: float = Body(...),
    merchantId: str = Body(...),
    category: str = Body(...),
    db: Session = Depends(get_db)
):
    result = PaymentService.process_nfc_transaction(db, nfcTokenId, amount, merchantId, category)
    if result["success"]:
        return {"status": "approved", "balance": result["new_balance"]}
    else:
        raise HTTPException(status_code=403, detail=result["message"])