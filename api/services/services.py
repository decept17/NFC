import os
import stripe 
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from datetime import date
from db.models import Account, Transaction, Limit

stripe.api_key = os.getenv("PAYMENT_GATEWAY_SECRET_KEY")

class PaymentService:
    
    # ---------------------------------------------------------
    #  PARENT TOPS UP (Money In)
    # ---------------------------------------------------------
    @staticmethod
    def top_up(db: Session, account_id: str, amount: float, payment_method_id: str):
        try:
            # Charge the parent. Money sits in my Platform account.
            intent = stripe.PaymentIntent.create(
                amount=int(amount * 100),
                currency="gbp",
                payment_method=payment_method_id,
                confirm=True,
                metadata={"account_id": account_id}
            )
            
            # Update DB balance
            account = db.query(Account).filter(Account.account_id == account_id).first()
            if not account: return None
            
            account.balance = float(account.balance) + amount

            # Log it, saving the charge ID so we can refund it later if needed
            tx = Transaction(
                account_id=account_id,
                amount=amount,
                type='TopUp',
                status='Success',
                stripe_charge_id=intent.id 
            )
            db.add(tx)
            db.commit()
            return {"new_balance": account.balance}

        except Exception as e:
            db.rollback()
            return {"success": False, "message": str(e)}

    # ---------------------------------------------------------
    #  CHILD TAPS WRISTBAND (The Core Transaction)
    # ---------------------------------------------------------
    @staticmethod
    def process_nfc_transaction(db: Session, nfc_token_id: str, amount: float, merchant_id: str, category: str, school_stripe_id: str):
        try:
            # LOCK THE ROW (Prevent double-spending)
            stmt = select(Account).where(Account.nfc_token_id == nfc_token_id).with_for_update()
            account = db.execute(stmt).scalar_one_or_none()

            if not account:
                return {"success": False, "message": "NFC Token not recognized"}

            # FETCH LIMITS
            limits = db.query(Limit).filter(Limit.child_account_id == account.account_id).first()
            failure_reason = None

            # RUN LOGIC CHECKS (Status, Balance, Limits)
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
                    # Calculate today's existing spend
                    today_spend = db.query(func.sum(Transaction.amount)).filter(
                        Transaction.account_id == account.account_id,
                        Transaction.type == 'Payment',
                        Transaction.status == 'Success',
                        func.date(Transaction.created_at) == date.today()
                    ).scalar() or 0
                    
                    if (float(today_spend) + amount) > float(limits.daily_spending_limit):
                        failure_reason = "Exceeds daily spending limit"

            # HANDLE FAILURE
            if failure_reason:
                failure_tx = Transaction(
                    account_id=account.account_id,
                    amount=amount,
                    type="Payment",
                    status="Failed",
                    merchant_id=merchant_id,
                    merchant_name=failure_reason
                )
                db.add(failure_tx)
                db.commit()
                return {"success": False, "message": failure_reason}

            #  EXECUTE STRIPE TRANSFER
            # This money will go to merchant stripe account
            try:
                transfer = stripe.Transfer.create(
                    amount=int(amount * 100),
                    currency='gbp',
                    destination=school_stripe_id,
                    description=f"Payment from {account.account_id}"
                )
            except Exception as e:
                return {"success": False, "message": f"Stripe Transfer failed: {str(e)}"}

            # SUCCESS: UPDATE DB & LOG
            account.balance = float(account.balance) - amount
            
            success_tx = Transaction(
                account_id=account.account_id,
                amount=amount,
                type="Payment",
                status="Success",
                merchant_id=merchant_id,
                stripe_transfer_id=transfer.id # Save proof of payment
            )
            db.add(success_tx)
            db.commit()
            return {"success": True, "new_balance": float(account.balance)}

        except Exception as e:
            db.rollback()
            raise e

    # ---------------------------------------------------------
    # PARENT WITHDRAWS (Money Out)
    # ---------------------------------------------------------
    @staticmethod
    def withdraw(db: Session, account_id: str, amount_to_withdraw: float):
        try:
            account = db.query(Account).filter(Account.account_id == account_id).first()
            
            if not account or float(account.balance) < amount_to_withdraw:
                return {"success": False, "message": "Insufficient withdrawable funds"}

            # Find the original Top-Up to refund against
            last_top_up = db.query(Transaction).filter(
                Transaction.account_id == account_id,
                Transaction.type == 'TopUp'
            ).order_by(Transaction.created_at.desc()).first()

            if not last_top_up or not last_top_up.stripe_charge_id:
                return {"success": False, "message": "No original transaction found to refund"}

            # Trigger Stripe Refund
            stripe.Refund.create(
                payment_intent=last_top_up.stripe_charge_id,
                amount=int(amount_to_withdraw * 100)
            )

            # Update DB
            account.balance = float(account.balance) - amount_to_withdraw
            
            tx = Transaction(
                account_id=account_id, 
                amount=-amount_to_withdraw, 
                type='Withdrawal', 
                status='Success'
            )
            db.add(tx)
            db.commit()
            return {"success": True, "new_balance": float(account.balance)}

        except Exception as e:
            db.rollback()
            return {"success": False, "message": str(e)}