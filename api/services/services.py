import os
import stripe 
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from datetime import date
from db.models import Account, Transaction, Limit

stripe.api_key = os.getenv("PAYMENT_GATEWAY_SECRET_KEY")

class PaymentService:
    @staticmethod
    def process_nfc_transaction(db: Session, nfc_token_id: str, amount: float, merchant_id: str, category: str):
        try:
            # 1. Start transaction and lock the account row (FOR UPDATE)
            stmt = select(Account).where(Account.nfc_token_id == nfc_token_id).with_for_update()
            account = db.execute(stmt).scalar_one_or_none()

            if not account:
                return {"success": False, "message": "NFC Token not recognized"}

            # Fetch limits
            limits = db.query(Limit).filter(Limit.child_account_id == account.account_id).first()
            failure_reason = None

            # 2. Logic Checks
            if account.status != "Active":
                failure_reason = f"Account is {account.status}"
            elif float(account.balance) < amount:
                failure_reason = "Insufficient funds"
            elif limits:
                if limits.single_transaction_max > 0 and amount > float(limits.single_transaction_max):
                    failure_reason = "Exceeds single transaction limit"
                elif limits.blocked_categories and category in limits.blocked_categories:
                    failure_reason = f"Category '{category}' is blocked"
                elif limits.daily_spending_limit > 0:
                    # Calculate today's spend
                    today_spend = db.query(func.sum(Transaction.amount)).filter(
                        Transaction.account_id == account.account_id,
                        Transaction.type == 'Payment',
                        Transaction.status == 'Success',
                        func.date(Transaction.created_at) == date.today()
                    ).scalar() or 0
                    
                    if (float(today_spend) + amount) > float(limits.daily_spending_limit):
                        failure_reason = "Exceeds daily spending limit"

            # 3. Execute Decision
            status = "Failed" if failure_reason else "Success"
            
            # Record Transaction
            new_tx = Transaction(
                account_id=account.account_id,
                amount=amount,
                type="Payment",
                status=status,
                merchant_id=merchant_id,
                merchant_name=failure_reason if failure_reason else None
            )
            db.add(new_tx)

            if failure_reason:
                db.commit()
                return {"success": False, "message": failure_reason}

            # Update Balance
            account.balance = float(account.balance) - amount
            db.commit()
            return {"success": True, "new_balance": float(account.balance)}

        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def top_up(db: Session, account_id: str, amount: float):
        try:
            intent = stripe.PaymentIntent.create(
                amount=int(amount * 100),
                currency="gbp",
                metadata={"accountId": str(account_id)}
            )
            
            account = db.query(Account).filter(Account.account_id == account_id).first()
            if not account: return None
            
            account.balance = float(account.balance) + amount
            db.commit()
            
            return {
                "success": True, 
                "new_balance": float(account.balance), 
                "client_secret": intent.client_secret
            }
        except Exception as e:
            db.rollback()
            return {"success": False, "message": str(e)}