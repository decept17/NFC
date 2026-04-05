"""
Phase 3: Stripe Payment Integration Tests (Fully Mocked)
=========================================================
All Stripe SDK calls are intercepted with unittest.mock.patch.
No real network requests are made. Test keys are not required.

To switch to real Stripe sandbox calls before production:
  - Remove all `patch("stripe.XYZ.create")` decorators
  - Set PAYMENT_GATEWAY_SECRET_KEY to a real Stripe test key in .env
  - Use real Stripe test card numbers (e.g. 4242 4242 4242 4242)

Covers: FR-07 (top-up), FR-08 (withdrawal), and the NFC payment → Transfer flow.
"""

import pytest
import uuid
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

os.environ.setdefault("PAYMENT_GATEWAY_SECRET_KEY", "sk_test_placeholder")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("JWT_SECRET", "test_secret_for_stripe_tests")
os.environ.setdefault("DB_HOST", "localhost")
os.environ.setdefault("DB_PORT", "5432")
os.environ.setdefault("DB_NAME", "test_db")
os.environ.setdefault("DB_USER", "user")
os.environ.setdefault("DB_PASSWORD", "password")

from unittest.mock import MagicMock, patch, call
from services.services import PaymentService
from db.models import Account, NFCTag, User, Transaction, Limit, Merchant
import stripe


# ---------------------------------------------------------------------------
# Helpers (reuse mock DB pattern from test_services.py)
# ---------------------------------------------------------------------------

def _mock_account(balance=100.0, account_id=None):
    a = MagicMock(spec=Account)
    a.account_id = account_id or uuid.uuid4()
    a.balance = balance
    return a


def _mock_top_up_tx(stripe_charge_id="pi_test_abc123"):
    tx = MagicMock(spec=Transaction)
    tx.stripe_charge_id = stripe_charge_id
    return tx


def _mock_withdraw_db(account, last_top_up):
    db = MagicMock()
    account_q = MagicMock()
    account_q.filter.return_value.first.return_value = account

    top_up_inner = MagicMock()
    top_up_inner.order_by.return_value.first.return_value = last_top_up
    tx_q = MagicMock()
    tx_q.filter.return_value.filter.return_value = top_up_inner

    def qs(model):
        if model is Account:
            return account_q
        if model is Transaction:
            return tx_q
        return MagicMock()
    db.query.side_effect = qs
    return db


# ===========================================================================
# CLASS A: Top-Up Flow  (Spec §3 Phase 3-A)
# ===========================================================================

class TestTopUpFlow:

    def test_str01_payment_intent_created_successfully(self):
        """
        STR-01: create_top_up_intent calls stripe.PaymentIntent.create with correct
        amount in pence and currency=gbp. Returns clientSecret to mobile app.
        The DB balance is NOT updated here — that only happens via the /webhook.
        Covers FR-07.
        """
        mock_intent = MagicMock()
        mock_intent.client_secret = "pi_test_secret_UNIT"

        with patch("stripe.PaymentIntent.create", return_value=mock_intent) as mock_create:
            result = PaymentService.create_top_up_intent(
                amount=25.00,
                account_id="acc_test_001"
            )

        assert result["success"] is True
        assert result["clientSecret"] == "pi_test_secret_UNIT"

        # Verify Stripe was called with the right parameters
        mock_create.assert_called_once_with(
            amount=2500,           # £25.00 → 2500 pence
            currency="gbp",
            metadata={"account_id": "acc_test_001"}
        )

    def test_str02_checkout_session_created_successfully(self):
        """
        STR-02: create_checkout_session returns a Stripe hosted URL.
        Mobile app opens this in an in-app browser.
        Covers FR-07.
        """
        mock_session = MagicMock()
        mock_session.url = "https://checkout.stripe.com/pay/cs_test_abc"

        with patch("stripe.checkout.Session.create", return_value=mock_session) as mock_create:
            result = PaymentService.create_checkout_session(
                amount=10.0,
                account_id="acc_test_002",
                base_url="http://localhost:8000",
                success_url="http://localhost:8000/checkout/success",
                cancel_url="http://localhost:8000/checkout/cancel",
            )

        assert result["success"] is True
        assert "checkout.stripe.com" in result["url"]
        mock_create.assert_called_once()

        call_kwargs = mock_create.call_args.kwargs
        assert call_kwargs["mode"] == "payment"
        assert call_kwargs["line_items"][0]["price_data"]["unit_amount"] == 1000  # £10 → 1000p
        assert call_kwargs["line_items"][0]["price_data"]["currency"] == "gbp"
        assert call_kwargs["payment_intent_data"]["metadata"]["account_id"] == "acc_test_002"

    def test_str03_top_up_stripe_exception_returns_failure(self):
        """
        STR-03: If Stripe raises any exception during PaymentIntent.create,
        the service returns {success: False} and must NOT mutate the DB balance.
        Covers FR-07 (error resilience).
        """
        with patch("stripe.PaymentIntent.create",
                   side_effect=stripe.error.StripeError("Your card was declined")):
            result = PaymentService.create_top_up_intent(
                amount=20.0, account_id="acc_test_003"
            )

        assert result["success"] is False
        assert "declined" in result["message"].lower()

    def test_str03b_checkout_session_stripe_exception(self):
        """STR-03b: Checkout session creation failure propagates correctly."""
        with patch("stripe.checkout.Session.create",
                   side_effect=stripe.error.StripeError("Session error")):
            result = PaymentService.create_checkout_session(
                amount=10.0, account_id="acc_003b",
                base_url="http://localhost:8000"
            )

        assert result["success"] is False
        assert "Session error" in result["message"]


# ===========================================================================
# CLASS B: NFC Transaction → Stripe Transfer  (Spec §3 Phase 3-B)
# ===========================================================================

class TestNFCTransferFlow:

    def _build_db_for_payment(self, balance=100.0, tag_status="active"):
        """Build a fully mocked DB session for NFC payment tests."""
        user = MagicMock(spec=User)
        user.user_id = uuid.uuid4()

        tag = MagicMock(spec=NFCTag)
        tag.status = tag_status
        tag.user = user

        account = _mock_account(balance=balance)

        db = MagicMock()

        tag_q = MagicMock()
        tag_q.filter.return_value.first.return_value = tag

        limits_q = MagicMock()
        limits_q.filter.return_value.first.return_value = None  # no limits

        execute_result = MagicMock()
        execute_result.scalar_one_or_none.return_value = account

        def qs(model):
            if model is NFCTag:
                return tag_q
            if model is Limit:
                return limits_q
            return MagicMock()

        db.query.side_effect = qs
        db.execute.return_value = execute_result

        return db, account

    def test_str04_stripe_transfer_id_saved_on_success(self):
        """
        STR-04: In production mode a successful payment calls stripe.Transfer.create
        and saves the returned transfer.id on the transaction record.
        Covers the NFC Transaction Flow (Spec §3 Phase 3-B).
        """
        db, account = self._build_db_for_payment(balance=50.0)

        mock_transfer = MagicMock()
        mock_transfer.id = "tr_test_ABC123"

        with patch.dict(os.environ, {"ENVIRONMENT": "production"}), \
             patch("stripe.Transfer.create", return_value=mock_transfer) as mock_create:
            result = PaymentService.process_nfc_transaction(
                db, "UID_TEST", 10.0,
                uuid.uuid4(), "food",
                "acct_merchant_123", "Test Canteen"
            )

        assert result["success"] is True
        mock_create.assert_called_once()
        call_kwargs = mock_create.call_args.kwargs
        assert call_kwargs["amount"] == 1000          # £10 → 1000 pence
        assert call_kwargs["currency"] == "gbp"
        assert call_kwargs["destination"] == "acct_merchant_123"

        # Verify transfer ID was written to the transaction record
        added_tx = db.add.call_args[0][0]
        assert added_tx.stripe_transfer_id == "tr_test_ABC123"

    def test_str05_stripe_transfer_failure_rolls_back_balance(self):
        """
        STR-05: If stripe.Transfer.create fails AFTER the MAC/balance checks pass,
        the DB transaction rolls back and the user balance is NOT deducted.
        Covers FR-07 (financial atomicity).
        """
        db, account = self._build_db_for_payment(balance=50.0)
        original_balance = account.balance

        with patch.dict(os.environ, {"ENVIRONMENT": "production"}), \
             patch("stripe.Transfer.create",
                   side_effect=stripe.error.StripeError("Stripe API down")):
            result = PaymentService.process_nfc_transaction(
                db, "UID_TEST", 10.0,
                uuid.uuid4(), "food",
                "acct_merchant_123", "Test Canteen"
            )

        assert result["success"] is False
        assert "Stripe Transfer failed" in result["message"]
        # Balance should NOT have been mutated since we return before touching it
        assert account.balance == original_balance

    def test_str06_merchant_missing_stripe_id_blocks_payment(self):
        """
        STR-06: A merchant with no stripe_account_id in the DB should be
        blocked by the API *before* calling Stripe. The service receives
        the stripe_id from the route; passing an empty string simulates absence.
        """
        # This is tested at the API level: the route checks merchant.stripe_account_id
        # before calling PaymentService. We verify the API raises 500.
        from fastapi.testclient import TestClient
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from db.database import Base, get_db
        from main import app
        from auth import get_current_user
        import uuid as _uuid

        SQLITE_URL = "sqlite:///./test_stripe_merchant.db"
        eng = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})

        # SQLite doesn't support ARRAY — patch Limit.blocked_categories to Text temporarily
        from sqlalchemy import Text as _Text
        _orig_type = Limit.blocked_categories.property.columns[0].type
        Limit.blocked_categories.property.columns[0].type = _Text()
        Base.metadata.create_all(bind=eng)
        Limit.blocked_categories.property.columns[0].type = _orig_type

        Session = sessionmaker(bind=eng)

        db_local = Session()

        # Create a merchant WITHOUT a stripe_account_id
        merchant = Merchant(
            merchant_id=_uuid.uuid4(),
            name="Unlinked Merchant",
            category="food",
            api_key="key",
            stripe_account_id=None,  # <-- missing
        )
        parent = User(user_id=_uuid.uuid4(), role="parent",
                      email=f"p_{_uuid.uuid4().hex[:6]}@test.com",
                      password_hash="x", is_active=True)
        child = User(user_id=_uuid.uuid4(), role="child",
                     username=f"c_{_uuid.uuid4().hex[:6]}",
                     password_hash="x", parent_id=parent.user_id,
                     is_active=True, name="Child")
        account = Account(account_id=_uuid.uuid4(), owner_id=child.user_id,
                          balance=100.0, account_type="wallet", status="Active")
        nfc_uid = f"STR06-{_uuid.uuid4().hex[:8].upper()}"
        tag = NFCTag(nfc_uid=nfc_uid, user_id=child.user_id, status="active",
                     auth_key="00" * 16, last_counter=0)
        db_local.add_all([parent, child, account, tag, merchant])
        db_local.commit()
        # Read the generated IDs before closing the session to avoid DetachedInstanceError
        merchant_id_str = str(merchant.merchant_id)
        nfc_uid_str = nfc_uid
        db_local.close()

        def override_db():
            s = Session()
            try:
                yield s
            finally:
                s.close()

        app.dependency_overrides[get_db] = override_db

        with patch("main.verify_sun_mac", return_value=True), \
             patch("main.counter_hex_to_int", return_value=1):
            client = TestClient(app)
            response = client.post(
                "/api/transactions/pay",
                json={
                    "uid": nfc_uid_str,
                    "counter": "000001",
                    "cmac": "aabbccddeeff0011",
                    "amount": 5.0,
                    "merchantId": merchant_id_str,
                    "category": "food",
                },
            )

        app.dependency_overrides.clear()

        # Clean up
        import os as _os
        Base.metadata.drop_all(bind=eng)
        eng.dispose()
        if _os.path.exists("./test_stripe_merchant.db"):
            _os.remove("./test_stripe_merchant.db")

        assert response.status_code == 500
        assert "Stripe" in response.json()["detail"] or "no linked" in response.json()["detail"].lower()


# ===========================================================================
# CLASS C: Withdrawal Flow  (Spec §3 Phase 3-C)
# ===========================================================================

@pytest.mark.skip(reason="Withdrawal flow not yet implemented in the application")
class TestWithdrawalFlow:

    def test_str07_partial_refund_issued_against_original_charge(self):
        """
        STR-07: withdraw() finds the most recent TopUp's stripe_charge_id and calls
        stripe.Refund.create with the correct payment_intent and amount.
        Covers FR-08.
        """
        account = _mock_account(balance=50.0)
        top_up_tx = _mock_top_up_tx(stripe_charge_id="pi_original_abc")
        db = _mock_withdraw_db(account, top_up_tx)

        with patch("stripe.Refund.create") as mock_refund:
            result = PaymentService.withdraw(db, str(account.account_id), 20.0)

        assert result["success"] is True
        mock_refund.assert_called_once_with(
            payment_intent="pi_original_abc",
            amount=2000  # £20 → 2000 pence
        )
        assert result["new_balance"] == pytest.approx(30.0)

    def test_str08_refund_stripe_failure_rolls_back_balance(self):
        """
        STR-08: If stripe.Refund.create raises an exception, the DB transaction
        rolls back — the user's balance must remain unchanged.
        Covers FR-08 (financial atomicity on withdrawal).
        """
        account = _mock_account(balance=50.0)
        top_up_tx = _mock_top_up_tx(stripe_charge_id="pi_original_xyz")
        db = _mock_withdraw_db(account, top_up_tx)

        with patch("stripe.Refund.create",
                   side_effect=stripe.error.StripeError("Refund failed")):
            result = PaymentService.withdraw(db, str(account.account_id), 20.0)

        assert result["success"] is False
        # Rollback should have been called
        db.rollback.assert_called_once()
        # Balance must not have changed (account mock still holds 50.0)
        assert account.balance == pytest.approx(50.0)
