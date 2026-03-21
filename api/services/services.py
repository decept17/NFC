import os
import stripe 
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from datetime import date
from db.models import Account, Transaction, Limit, NFCTag

stripe.api_key = os.getenv("PAYMENT_GATEWAY_SECRET_KEY")

class PaymentService:
    
    # ---------------------------------------------------------
    #  PARENT TOPS UP (Money In) - Step 1: Create Intent
    # ---------------------------------------------------------
    # The backend only creates the PaymentIntent and returns the client_secret.
    # The mobile Stripe SDK uses the secret to confirm the payment (with 3DS if needed).
    # The DB balance is updated ONLY via the secure Stripe webhook (see main.py /webhook).
    @staticmethod
    def create_top_up_intent(amount: float, account_id: str):
        try:
            # Create the Intent but DO NOT confirm it yet.
            # We attach account_id to metadata so our webhook knows who to credit.
            intent = stripe.PaymentIntent.create(
                amount=int(amount * 100),
                currency="gbp",
                metadata={"account_id": account_id}
            )
            # Return the client_secret to the mobile app so it can confirm the payment
            return {"success": True, "clientSecret": intent.client_secret}

        except Exception as e:
            return {"success": False, "message": str(e)}

    # ---------------------------------------------------------
    #  PARENT TOPS UP (Money In) - Via Stripe Checkout Link
    # ---------------------------------------------------------
    # Creates a Stripe Checkout Session and returns a hosted URL.
    # The parent is redirected to this URL via an in-app browser.
    # On success, the existing webhook (payment_intent.succeeded)
    # credits the balance — no changes needed there.
    @staticmethod
    def create_checkout_session(amount: float, account_id: str, base_url: str, success_url: str | None = None, cancel_url: str | None = None):
        try:
            from urllib.parse import quote
            
            # Use deep links if provided by the app, otherwise fallback to our HTML pages
            # Stripe requires http/https for success_url and cancel_url, so if they are deep links (e.g. exp://), 
            # we must route them through a backend redirect endpoint.
            if success_url and not success_url.startswith("http"):
                final_success_url = f"{base_url}/checkout/redirect?to={quote(success_url)}"
            else:
                final_success_url = success_url if success_url else f"{base_url}/checkout/success"
                
            if cancel_url and not cancel_url.startswith("http"):
                final_cancel_url = f"{base_url}/checkout/redirect?to={quote(cancel_url)}"
            else:
                final_cancel_url = cancel_url if cancel_url else f"{base_url}/checkout/cancel"

            session = stripe.checkout.Session.create(
                payment_method_types=["card", "link"],
                mode="payment",
                line_items=[{
                    "price_data": {
                        "currency": "gbp",
                        "unit_amount": int(amount * 100),
                        "product_data": {
                            "name": "Account Top-Up",
                        },
                    },
                    "quantity": 1,
                }],
                payment_intent_data={
                    "metadata": {"account_id": account_id},
                },
                success_url=final_success_url,
                cancel_url=final_cancel_url,
            )
            return {"success": True, "url": session.url}

        except Exception as e:
            return {"success": False, "message": str(e)}

    # ---------------------------------------------------------
    #  CHILD TAPS WRISTBAND (The Core Transaction)
    # ---------------------------------------------------------
    @staticmethod
    def process_nfc_transaction(db: Session, nfc_token_id: str, amount: float, merchant_id: str, category: str, school_stripe_id: str):
        try:

            # Find the physical tag first 
            tag = db.query(NFCTag).filter(NFCTag.nfc_uid == nfc_token_id).first()

            if not tag:
                return {"success": False, "message": "NFC Token not recognized"}
            
            # check the wristband status 
            if tag.status == 'frozen':
                return {"success": False, "message": "Transaction declined: Wristband is Frozen"}
            if tag.status == 'lost':
                return {"success": False, "message": "Transaction declined: Wristband reported Lost"}
            
            # Get the account, traversing from Tag -> User -> Account
            # Lock the account row to prevent double spending 
            user = tag.user
            stmt = select(Account).filter(
                Account.owner_id == user.user_id,
                Account.account_type == 'wallet'
                ).with_for_update()
            
            account = db.execute(stmt).scalar_one_or_none()

            if not account:
                return {"success": False, "message": "No active wallet found for this user"}

            # FETCH LIMITS
            limits = db.query(Limit).filter(Limit.child_account_id == account.account_id).first()
            failure_reason = None

            # RUN LOGIC CHECKS (Status, Balance, Limits)
            if account.balance < amount:
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
                    merchant_id=str(merchant_id),
                    merchant_name=failure_reason if failure_reason else None
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
                merchant_id=str(merchant_id),
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

    # FOR MVP - Logic only refunds the most recent top-up not the actual full amount in account
    # When going in production this areas logic needs to change 
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