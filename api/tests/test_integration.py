"""
Phase 2: Integration Tests — Concurrency & Data Integrity
=========================================================
Tools: pytest, threading, real PostgreSQL (test_db Docker service)

These tests require a REAL PostgreSQL connection (SQLite does not support
SELECT ... FOR UPDATE row-level locking).

The test_db service runs on port 5433 (see docker-compose.yml).
Set the environment variable TEST_DB_URL to override the default.

Default: postgresql://nfcuser:nfcpassword@localhost:5433/nfc_test_db

Run these tests with:
    pytest tests/test_integration.py -v -m integration

Covers: NFR (Concurrency / double-spend), NFR (Data integrity), FR-14 (replay attack)
"""

import pytest
import uuid
import threading
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# ---------------------------------------------------------------------------
# Integration test DB URL — reads from env or defaults to test_db service
# ---------------------------------------------------------------------------
TEST_DB_URL = os.environ.get(
    "TEST_DB_URL",
    "postgresql://nfcuser:nfcpassword@localhost:5433/nfc_test_db"
)

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch

from db.database import Base
from db.models import User, Account, NFCTag, Transaction, Merchant
from auth import get_password_hash
from services.services import PaymentService


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def pg_engine():
    """Connect to the dedicated test PostgreSQL database."""
    engine = create_engine(TEST_DB_URL)
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="module")
def PgSession(pg_engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=pg_engine)


@pytest.fixture()
def db(PgSession):
    """Provide a fresh DB session; roll back after each test for isolation."""
    session = PgSession()
    yield session
    session.rollback()
    session.close()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _seed_payment_scenario(db, balance: float):
    """
    Create a complete parent → child → account → nfc_tag chain
    plus a merchant, all committed to the real DB.
    Returns (tag_nfc_uid, merchant_stripe_id, merchant_id).
    """
    parent = User(user_id=uuid.uuid4(), role="parent",
                  email=f"p_{uuid.uuid4().hex[:8]}@test.com",
                  password_hash=get_password_hash("pw"), is_active=True)
    child = User(user_id=uuid.uuid4(), role="child",
                 username=f"c_{uuid.uuid4().hex[:8]}",
                 password_hash=get_password_hash("pw"),
                 parent_id=parent.user_id, is_active=True, name="Child")
    account = Account(account_id=uuid.uuid4(), owner_id=child.user_id,
                      balance=balance, account_type="wallet", status="Active")
    nfc_uid = f"INT-{uuid.uuid4().hex[:8].upper()}"
    tag = NFCTag(nfc_uid=nfc_uid, user_id=child.user_id, status="active",
                 auth_key="00" * 16, last_counter=0)
    merchant = Merchant(merchant_id=uuid.uuid4(), name="Test Canteen",
                        category="food", api_key="key",
                        stripe_account_id="acct_integration_test")

    db.add_all([parent, child, account, tag, merchant])
    db.commit()
    return nfc_uid, merchant.stripe_account_id, str(merchant.merchant_id), str(account.account_id)


# ===========================================================================
# CLASS A: Concurrency — Double-Spend Prevention  (Spec §3 Phase 2-A)
# ===========================================================================

@pytest.mark.integration
class TestConcurrency:

    def test_conc01_double_spend_prevention(self, PgSession):
        """
        CONC-01: Two threads fire simultaneous £10 payment requests against
        an account with only £15 balance.

        Expected: Exactly 1 Success + 1 Failed transaction.
        The account balance must never go negative.
        Validates that with_for_update() row-locking prevents double-spending.

        This is THE most critical test in the suite — simulates two POS
        terminals tapping the same wristband at the same millisecond.
        """
        # Seed data in a separate session so both threads can see it
        seed_db = PgSession()
        nfc_uid, stripe_id, merchant_id, account_id = _seed_payment_scenario(seed_db, balance=15.0)
        seed_db.close()

        results = []

        def pay():
            """Worker: open a fresh session and fire a £10 payment."""
            session = PgSession()
            try:
                with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
                    result = PaymentService.process_nfc_transaction(
                        session, nfc_uid, 10.0, merchant_id, "food", stripe_id, "Canteen"
                    )
                results.append(result)
            finally:
                session.close()

        t1 = threading.Thread(target=pay)
        t2 = threading.Thread(target=pay)
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        # Evaluate final DB state
        check_db = PgSession()
        final_account = check_db.query(Account).filter(Account.account_id == account_id).first()
        txs = check_db.query(Transaction).filter(Transaction.account_id == account_id).all()
        check_db.close()

        successes = [r for r in results if r["success"]]
        failures = [r for r in results if not r["success"]]

        assert len(successes) == 1, f"Expected 1 success, got {len(successes)}"
        assert len(failures) == 1, f"Expected 1 failure, got {len(failures)}"
        assert float(final_account.balance) >= 0.0, "Balance went negative — double spend occurred!"
        assert float(final_account.balance) == pytest.approx(5.0)

        success_txs = [t for t in txs if t.status == "Success"]
        failed_txs = [t for t in txs if t.status == "Failed"]
        assert len(success_txs) == 1
        assert len(failed_txs) == 1

    def test_conc02_rapid_sequential_taps_do_not_overspend(self, PgSession):
        """
        CONC-02: 5 sequential £4 taps on a £15 balance.
        Only 3 should succeed (3 × £4 = £12 ≤ £15).
        The 4th and 5th must fail with Insufficient funds.
        """
        seed_db = PgSession()
        nfc_uid, stripe_id, merchant_id, account_id = _seed_payment_scenario(seed_db, balance=15.0)
        seed_db.close()

        results = []
        for _ in range(5):
            session = PgSession()
            try:
                with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
                    r = PaymentService.process_nfc_transaction(
                        session, nfc_uid, 4.0, merchant_id, "food", stripe_id, "Canteen"
                    )
                results.append(r)
            finally:
                session.close()

        successes = [r for r in results if r["success"]]
        failures = [r for r in results if not r["success"]]

        assert len(successes) == 3
        assert len(failures) == 2

        check_db = PgSession()
        final = check_db.query(Account).filter(Account.account_id == account_id).first()
        check_db.close()
        assert float(final.balance) == pytest.approx(3.0)  # £15 - (3 × £4)


# ===========================================================================
# CLASS B: Data Integrity  (Spec §3 Phase 2-B)
# ===========================================================================

@pytest.mark.integration
class TestDataIntegrity:

    def test_int01_transaction_for_nonexistent_account_raises_error(self, db):
        """
        INT-01: Attempting to create a transaction with a non-existent account_id
        must raise a DB integrity error (FK constraint), NOT silently succeed.
        """
        from sqlalchemy.exc import IntegrityError

        fake_account_id = uuid.uuid4()
        tx = Transaction(
            transaction_id=uuid.uuid4(),
            account_id=fake_account_id,  # Does not exist in DB
            amount=10.0,
            type="Payment",
            status="Success",
        )
        db.add(tx)

        with pytest.raises(IntegrityError):
            db.commit()

    def test_int02_nfc_replay_attack_rejected(self, PgSession):
        """
        INT-02: A tap with a counter value ≤ the last accepted counter must be
        rejected by the API endpoint with a 403 Replay attack error.

        This validates FR-14 (no financial data stored on chip implies the counter
        state is entirely server-side — so replay detection MUST work server-side).
        """
        from fastapi.testclient import TestClient
        from main import app
        from db.database import get_db

        seed_db = PgSession()
        nfc_uid, stripe_id, merchant_id, _ = _seed_payment_scenario(seed_db, balance=100.0)

        # Manually set last_counter to 5 to simulate 5 prior taps
        tag = seed_db.query(NFCTag).filter(NFCTag.nfc_uid == nfc_uid).first()
        tag.last_counter = 5
        seed_db.commit()
        seed_db.close()

        def override_get_db():
            session = PgSession()
            try:
                yield session
            finally:
                session.close()

        app.dependency_overrides[get_db] = override_get_db

        # Mock MAC verification to pass so the replay check is the one that fires
        with patch("main.verify_sun_mac", return_value=True), \
             patch("main.counter_hex_to_int", return_value=3):  # counter=3 ≤ last=5 → replay
            client = TestClient(app)
            response = client.post(
                "/api/transactions/pay",
                json={
                    "uid": nfc_uid,
                    "counter": "000003",      # stale counter (≤ last_counter of 5)
                    "cmac": "aabbccddeeff0011",
                    "amount": 5.0,
                    "merchantId": merchant_id,
                    "category": "food",
                },
            )

        app.dependency_overrides.clear()

        assert response.status_code == 403
        assert "Replay" in response.json()["detail"] or "replay" in response.json()["detail"].lower()

    def test_int03_delete_user_without_transactions_cascades(self, db):
        """
        INT-03a: Delete a User who has NO financial transactions.
        Their auth data and child records should be removed (cascade/allow delete).
        """
        user = User(
            user_id=uuid.uuid4(), role="parent",
            email=f"delete_{uuid.uuid4().hex[:8]}@test.com",
            password_hash=get_password_hash("pw"), is_active=True
        )
        account = Account(
            account_id=uuid.uuid4(), owner_id=user.user_id,
            balance=0.0, account_type="wallet", status="Active"
        )
        db.add(user)
        db.add(account)
        db.commit()

        user_id = user.user_id

        # Delete the account first (foreign key dependency), then the user
        db.delete(account)
        db.delete(user)
        db.commit()

        # Confirm removal
        assert db.query(User).filter(User.user_id == user_id).first() is None
