"""
Phase 1 (continued): Service Layer Unit Tests
=============================================
Tools: pytest, unittest.mock (no real DB, no real Stripe)

Tests the business logic inside services/services.py in total isolation.
All SQLAlchemy DB sessions and Stripe SDK calls are mocked.
Covers FR-06, FR-07, FR-08, FR-11, FR-13.
"""

import pytest
import uuid
import os
from unittest.mock import MagicMock, patch, PropertyMock

os.environ.setdefault("PAYMENT_GATEWAY_SECRET_KEY", "sk_test_placeholder")
os.environ.setdefault("ENVIRONMENT", "development")

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.services import PaymentService
from db.models import Account, NFCTag, User, Transaction, Limit, Merchant


# ---------------------------------------------------------------------------
# HELPERS — build lightweight mock ORM objects
# ---------------------------------------------------------------------------

def _mock_tag(status="active", last_counter=0, auth_key="00" * 16, user=None):
    tag = MagicMock(spec=NFCTag)
    tag.status = status
    tag.last_counter = last_counter
    tag.auth_key = auth_key
    tag.user = user
    return tag


def _mock_user(user_id=None):
    user = MagicMock(spec=User)
    user.user_id = user_id or uuid.uuid4()
    return user


def _mock_account(balance=50.0, account_id=None, account_type="wallet"):
    account = MagicMock(spec=Account)
    account.account_id = account_id or uuid.uuid4()
    account.balance = balance
    account.account_type = account_type
    return account


def _mock_db(tag=None, account=None, limits=None, today_spend=0):
    """
    Build a mock SQLAlchemy Session that returns pre-set objects.
    This avoids real DB connections entirely.
    """
    db = MagicMock()

    # tag lookup: db.query(NFCTag).filter(...).first()
    tag_query = MagicMock()
    tag_query.filter.return_value.first.return_value = tag
    
    # limits lookup
    limits_query = MagicMock()
    limits_query.filter.return_value.first.return_value = limits

    # today_spend query: db.query(func.sum(Transaction.amount)).filter(...all conditions in ONE call...).scalar()
    # NOTE: services.py passes ALL 4 filter conditions to a SINGLE .filter() call.
    # The chain is: .filter(cond1, cond2, cond3, cond4).scalar()  ← NOT chained filters
    spend_query = MagicMock()
    spend_query.filter.return_value.scalar.return_value = today_spend

    def query_side_effect(model):
        if model is NFCTag:
            return tag_query
        if model is Limit:
            return limits_query
        # Catch-all: covers func.sum(Transaction.amount) and any other expressions
        return spend_query

    db.query.side_effect = query_side_effect

    # db.execute (for SELECT with with_for_update)
    scalar_result = MagicMock()
    scalar_result.scalar_one_or_none.return_value = account
    db.execute.return_value = scalar_result

    return db


# ===========================================================================
# SVC-01: Insufficient funds
# ===========================================================================

class TestProcessNFCTransaction:

    def _run(self, db, nfc_uid="UID_TEST", amount=10.0, category="food"):
        merchant_id = uuid.uuid4()
        return PaymentService.process_nfc_transaction(
            db, nfc_uid, amount, merchant_id, category,
            school_stripe_id="acct_test", merchant_name="Test Canteen"
        )

    def test_svc01_insufficient_funds(self):
        """SVC-01: Balance < amount → failure with 'Insufficient funds'. Covers FR-06."""
        user = _mock_user()
        tag = _mock_tag(user=user)
        account = _mock_account(balance=5.0)  # less than £10 attempt
        db = _mock_db(tag=tag, account=account)

        result = self._run(db, amount=10.0)

        assert result["success"] is False
        assert "Insufficient funds" in result["message"]

    def test_svc02_frozen_tag_blocked(self):
        """SVC-02: Tag with status 'frozen' → decline immediately. Covers FR-13."""
        tag = _mock_tag(status="frozen")
        db = _mock_db(tag=tag)

        result = self._run(db)

        assert result["success"] is False
        assert "Frozen" in result["message"]

    def test_svc03_lost_tag_blocked(self):
        """SVC-03: Tag with status 'lost' → decline immediately. Covers FR-13."""
        tag = _mock_tag(status="lost")
        db = _mock_db(tag=tag)

        result = self._run(db)

        assert result["success"] is False
        assert "Lost" in result["message"]

    def test_svc04_daily_limit_exceeded(self):
        """SVC-04: Today's spend + new amount > daily_limit → decline. Covers FR-11."""
        user = _mock_user()
        tag = _mock_tag(user=user)
        account = _mock_account(balance=100.0)

        limits = MagicMock(spec=Limit)
        limits.single_transaction_max = 0      # no single-tx limit
        limits.blocked_categories = []
        limits.daily_spending_limit = 20.0     # £20 daily cap

        # Today they've already spent £15, attempting £10 more → total £25 > £20
        db = _mock_db(tag=tag, account=account, limits=limits, today_spend=15.0)

        result = self._run(db, amount=10.0)

        assert result["success"] is False
        assert "daily" in result["message"].lower()

    def test_svc05_category_blocked(self):
        """SVC-05: Merchant category is in parent's blocked list → decline. Covers FR-11."""
        user = _mock_user()
        tag = _mock_tag(user=user)
        account = _mock_account(balance=100.0)

        limits = MagicMock(spec=Limit)
        limits.single_transaction_max = 0
        limits.blocked_categories = ["gaming", "candy"]
        limits.daily_spending_limit = 0       # no daily cap

        db = _mock_db(tag=tag, account=account, limits=limits)

        result = self._run(db, amount=5.0, category="gaming")

        assert result["success"] is False
        assert "blocked" in result["message"].lower()

    def test_svc06_single_tx_limit_exceeded(self):
        """SVC-06: Amount > single_transaction_max → decline. Covers FR-11."""
        user = _mock_user()
        tag = _mock_tag(user=user)
        account = _mock_account(balance=100.0)

        limits = MagicMock(spec=Limit)
        limits.single_transaction_max = 5.0   # max £5 per tap
        limits.blocked_categories = []
        limits.daily_spending_limit = 0

        db = _mock_db(tag=tag, account=account, limits=limits)

        result = self._run(db, amount=10.0)

        assert result["success"] is False
        assert "single transaction" in result["message"].lower()

    def test_svc07_dev_mode_skips_stripe(self):
        """
        SVC-07: In ENVIRONMENT=development, Stripe Transfer is NOT called.
        Balance is still deducted and transaction logged as success.
        """
        user = _mock_user()
        tag = _mock_tag(user=user)
        account = _mock_account(balance=50.0)
        db = _mock_db(tag=tag, account=account, limits=None)

        with patch.dict(os.environ, {"ENVIRONMENT": "development"}), \
             patch("stripe.Transfer.create") as mock_transfer:
            result = self._run(db, amount=10.0)

        # Stripe should NOT have been called
        mock_transfer.assert_not_called()
        assert result["success"] is True
        # Balance should be reduced
        assert result["new_balance"] == pytest.approx(40.0)

    def test_svc_tag_not_found(self):
        """NFC UID not in DB → failure with 'not recognized'."""
        db = _mock_db(tag=None)  # No tag found
        result = self._run(db)
        assert result["success"] is False
        assert "not recognized" in result["message"].lower()


# ===========================================================================
# Withdrawal Tests (SVC-08, SVC-09)
# ===========================================================================

@pytest.mark.skip(reason="Withdrawal flow not yet implemented in the application")
class TestWithdrawService:

    def _build_withdraw_db(self, account, last_top_up=None):
        """Helper: build a simple mock DB for withdraw tests."""
        db = MagicMock()

        account_query = MagicMock()
        account_query.filter.return_value.first.return_value = account

        last_top_up_query = MagicMock()
        last_top_up_q = MagicMock()
        last_top_up_q.order_by.return_value.first.return_value = last_top_up
        last_top_up_query.filter.return_value.filter.return_value = last_top_up_q

        def query_side_effect(model):
            if model is Account:
                return account_query
            if model is Transaction:
                return last_top_up_query
            return MagicMock()

        db.query.side_effect = query_side_effect
        return db

    def test_svc08_withdraw_insufficient_funds(self):
        """SVC-08: Attempting to withdraw more than the balance → failure. Covers FR-08."""
        account = _mock_account(balance=10.0)
        db = self._build_withdraw_db(account=account)

        result = PaymentService.withdraw(db, str(account.account_id), amount_to_withdraw=50.0)

        assert result["success"] is False
        assert "insufficient" in result["message"].lower()

    def test_svc09_withdraw_no_top_up_charge_id(self):
        """
        SVC-09: Withdraw is attempted but there is no prior TopUp with a stripe_charge_id.
        System should return an error rather than crashing. Covers FR-08.
        """
        account = _mock_account(balance=100.0)
        # last_top_up has no stripe_charge_id
        top_up = MagicMock(spec=Transaction)
        top_up.stripe_charge_id = None
        db = self._build_withdraw_db(account=account, last_top_up=top_up)

        result = PaymentService.withdraw(db, str(account.account_id), amount_to_withdraw=20.0)

        assert result["success"] is False
        assert "no original transaction" in result["message"].lower()


# ===========================================================================
# Top-Up Intent Tests (SVC-10)
# ===========================================================================

class TestTopUpIntentService:

    def test_svc10_create_top_up_intent_success(self):
        """
        SVC-10: PaymentService.create_top_up_intent → mocked Stripe creates intent
        and returns a clientSecret. Covers FR-07.
        """
        mock_intent = MagicMock()
        mock_intent.client_secret = "pi_test_secret_xyz"

        with patch("stripe.PaymentIntent.create", return_value=mock_intent) as mock_create:
            result = PaymentService.create_top_up_intent(
                amount=20.0, account_id=str(uuid.uuid4())
            )

        assert result["success"] is True
        assert result["clientSecret"] == "pi_test_secret_xyz"
        mock_create.assert_called_once()
        call_kwargs = mock_create.call_args.kwargs
        assert call_kwargs["amount"] == 2000  # £20 → 2000 pence
        assert call_kwargs["currency"] == "gbp"

    def test_svc10_create_top_up_intent_stripe_error(self):
        """SVC-10b: Stripe SDK raises exception → service returns {success: False}."""
        import stripe
        with patch("stripe.PaymentIntent.create", side_effect=stripe.error.StripeError("Card declined")):
            result = PaymentService.create_top_up_intent(amount=20.0, account_id="acc123")

        assert result["success"] is False
        assert "Card declined" in result["message"]
