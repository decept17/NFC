"""
Phase 1: Backend Unit Tests — Auth/RBAC & Account Management
============================================================
Tools: pytest, FastAPI TestClient, unittest.mock, SQLite in-memory DB

Strategy:
  - Auth tests (login/token) use the real login endpoint — no auth mock needed.
  - Account management tests bypass auth entirely via dependency_overrides and
    use MagicMock DB sessions, avoiding all PostgreSQL-specific type issues
    (UUID, ARRAY) that SQLite cannot handle.

Spec coverage:
  - FR-01  Login via email/password → JWT
  - FR-02  Role-based dashboard isolation (RBAC)
  - FR-03  NFC wristband linking
  - FR-13  Freeze / unfreeze account
"""

import pytest
import uuid
import os
import sys

# Set env vars BEFORE any app imports so database.py doesn't try to connect
os.environ["DB_HOST"] = "localhost"
os.environ["DB_PORT"] = "5432"
os.environ["DB_NAME"] = "test_db"
os.environ["DB_USER"] = "user"
os.environ["DB_PASSWORD"] = "password"
os.environ["JWT_SECRET"] = "test_secret_for_unit_tests"
os.environ["PAYMENT_GATEWAY_SECRET_KEY"] = "sk_test_placeholder"
os.environ["ADMIN_PROVISION_KEY"] = "admin-test-key"
os.environ["ENVIRONMENT"] = "development"

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone, timedelta
from jose import jwt

from db.models import User, Account, NFCTag, Merchant
from auth import get_current_user, get_password_hash, create_access_token
from db.database import get_db
from main import app

# ---------------------------------------------------------------------------
# Shared TestClient
# ---------------------------------------------------------------------------
client = TestClient(app)


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def _make_user(role="parent", user_id=None, parent_id=None, name=None) -> User:
    u = MagicMock(spec=User)
    u.user_id = user_id or uuid.uuid4()
    u.role = role
    u.is_active = True
    u.parent_id = parent_id
    u.name = name
    u.email = f"{uuid.uuid4().hex[:6]}@test.com"
    u.username = None
    u.password_hash = get_password_hash("password123")
    return u


def _make_account(owner_id, balance=50.0, status="Active", account_id=None) -> Account:
    a = MagicMock(spec=Account)
    a.account_id = account_id or uuid.uuid4()
    a.owner_id = owner_id
    a.balance = balance
    a.status = status
    a.nfc_token_id = None
    return a


def _auth_headers(user: User) -> dict:
    token = create_access_token({"sub": str(user.user_id)})
    return {"Authorization": f"Bearer {token}"}


def _override_auth(current_user: User):
    """Inject a pre-built user into every request that calls get_current_user."""
    app.dependency_overrides[get_current_user] = lambda: current_user


def _override_db(db):
    """Inject a mock DB session into every request that calls get_db."""
    def _get():
        yield db
    app.dependency_overrides[get_db] = _get


def _clear_overrides():
    app.dependency_overrides.clear()


# ===========================================================================
# CLASS A: Authentication & RBAC  (Spec §3 Phase 1-A)
# ===========================================================================

class TestAuthAndRBAC:
    """
    These tests drive the real /api/auth/login endpoint.
    We mock the DB session to return our pre-built User objects.
    No real DB or SQLite needed.
    """

    def _make_db_for_login(self, user: User | None):
        """Mock DB that returns `user` for any .first() call on a User query."""
        db = MagicMock()
        user_q = MagicMock()
        user_q.filter.return_value.first.return_value = user
        db.query.return_value = user_q
        return db

    # AUTH-01 -----------------------------------------------------------------
    def test_login_success(self):
        """AUTH-01: Valid email/password → 200 OK with JWT and role."""
        user = _make_user(role="parent")
        db = self._make_db_for_login(user)
        _override_db(db)

        response = client.post(
            "/api/auth/login",
            data={"username": user.email, "password": "password123"},
        )
        _clear_overrides()

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["role"] == "parent"

    # AUTH-02 -----------------------------------------------------------------
    def test_login_invalid_password(self):
        """AUTH-02: Valid email but wrong password → 401 Unauthorized."""
        user = _make_user(role="parent")
        db = self._make_db_for_login(user)
        _override_db(db)

        response = client.post(
            "/api/auth/login",
            data={"username": user.email, "password": "wrongpassword"},
        )
        _clear_overrides()

        assert response.status_code == 401

    # AUTH-03 -----------------------------------------------------------------
    def test_login_nonexistent_email(self):
        """AUTH-03: Email not in DB → 404 Not Found."""
        db = self._make_db_for_login(None)  # No user found
        _override_db(db)

        response = client.post(
            "/api/auth/login",
            data={"username": "nobody@nowhere.com", "password": "password123"},
        )
        _clear_overrides()

        assert response.status_code == 404

    # AUTH-04 -----------------------------------------------------------------
    def test_expired_token_returns_401(self):
        """AUTH-04: A JWT with a past expiry date must be rejected."""
        user_id = uuid.uuid4()
        expired_token = jwt.encode(
            {"sub": str(user_id), "exp": datetime.now(timezone.utc) - timedelta(hours=2)},
            os.environ["JWT_SECRET"],
            algorithm="HS256",
        )
        response = client.get(
            "/api/accounts/my-family",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401

    # AUTH-05 -----------------------------------------------------------------
    def test_data_isolation_parent_cannot_see_other_family(self):
        """
        AUTH-05: Parent A cannot view balance of an account belonging to Parent B's child.
        The /balance route must return 403.
        """
        parent_a = _make_user(role="parent")
        parent_b_id = uuid.uuid4()
        child_b = _make_user(role="child", parent_id=parent_b_id)
        account_b_id = uuid.uuid4()
        account_b = _make_account(owner_id=child_b.user_id, account_id=account_b_id)

        db = MagicMock()

        def query_side(model):
            q = MagicMock()
            if model is Account:
                q.filter.return_value.first.return_value = account_b
            elif model is User:
                # get_current_user lookup → parent_a; ownership check → child_b
                q.filter.return_value.first.side_effect = [parent_a, child_b]
            else:
                q.filter.return_value.first.return_value = None
            return q

        db.query.side_effect = query_side
        _override_db(db)
        _override_auth(parent_a)

        response = client.get(f"/api/accounts/{account_b_id}/balance")
        _clear_overrides()

        assert response.status_code == 403


# ===========================================================================
# CLASS B: Account Management  (Spec §3 Phase 1-B)
# ===========================================================================

class TestAccountManagement:

    # ACCT-01 -----------------------------------------------------------------
    def test_link_nfc_tag_success(self):
        """
        ACCT-01: Parent links a provisioned (unlinked) NFC tag to their child's account.
        The DB must update nfc_token_id and tag.user_id.
        Covers FR-03.
        """
        parent = _make_user(role="parent")
        child = _make_user(role="child", parent_id=parent.user_id, name="Alice")
        account = _make_account(owner_id=child.user_id)

        nfc_uid = f"TEST-NFC-{uuid.uuid4().hex[:8].upper()}"
        tag = MagicMock(spec=NFCTag)
        tag.nfc_uid = nfc_uid
        tag.user_id = None          # unlinked
        tag.auth_key = "00" * 16   # provisioned
        tag.status = "active"

        db = MagicMock()

        def query_side(model):
            q = MagicMock()
            if model is Account:
                q.filter.return_value.first.return_value = account
            elif model is User:
                q.filter.return_value.first.return_value = child
            elif model is NFCTag:
                q.filter.return_value.first.return_value = tag
            else:
                q.filter.return_value.first.return_value = None
            return q

        db.query.side_effect = query_side
        _override_db(db)
        _override_auth(parent)

        response = client.post(
            f"/api/accounts/{account.account_id}/link-nfc",
            json={"nfc_uid": nfc_uid},
        )
        _clear_overrides()

        assert response.status_code == 200
        assert response.json()["success"] is True
        # The tag was mutated — user_id should now be set
        assert tag.user_id == child.user_id

    # ACCT-02 -----------------------------------------------------------------
    def test_link_duplicate_nfc_raises_400(self):
        """
        ACCT-02: Attempt to link an NFC UID already assigned to another user → 400.
        Covers FR-03 (duplicate prevention).
        """
        parent = _make_user(role="parent")
        other_child_id = uuid.uuid4()
        child = _make_user(role="child", parent_id=parent.user_id, name="Bob")
        account = _make_account(owner_id=child.user_id)

        nfc_uid = f"DUPE-NFC-{uuid.uuid4().hex[:8].upper()}"
        tag = MagicMock(spec=NFCTag)
        tag.nfc_uid = nfc_uid
        tag.user_id = other_child_id  # already linked to someone else
        tag.auth_key = "00" * 16
        tag.status = "active"

        db = MagicMock()

        def query_side(model):
            q = MagicMock()
            if model is Account:
                q.filter.return_value.first.return_value = account
            elif model is User:
                q.filter.return_value.first.return_value = child
            elif model is NFCTag:
                q.filter.return_value.first.return_value = tag
            return q

        db.query.side_effect = query_side
        _override_db(db)
        _override_auth(parent)

        response = client.post(
            f"/api/accounts/{account.account_id}/link-nfc",
            json={"nfc_uid": nfc_uid},
        )
        _clear_overrides()

        assert response.status_code == 400

    # ACCT-03 -----------------------------------------------------------------
    def test_freeze_account_toggles_status(self):
        """
        ACCT-03: Parent calls /freeze → Active → Frozen → Active.
        Covers FR-13.
        """
        parent = _make_user(role="parent")
        child = _make_user(role="child", parent_id=parent.user_id)
        account = _make_account(owner_id=child.user_id, status="Active")

        def make_db():
            db = MagicMock()
            def query_side(model):
                q = MagicMock()
                if model is Account:
                    q.filter.return_value.first.return_value = account
                elif model is User:
                    q.filter.return_value.first.return_value = child
                return q
            db.query.side_effect = query_side
            return db

        # First call: Active → Frozen
        _override_db(make_db())
        _override_auth(parent)
        response1 = client.post(f"/api/accounts/{account.account_id}/freeze")
        _clear_overrides()

        assert response1.status_code == 200
        assert response1.json()["status"] == "Frozen"

        # Second call: Frozen → Active
        _override_db(make_db())
        _override_auth(parent)
        response2 = client.post(f"/api/accounts/{account.account_id}/freeze")
        _clear_overrides()

        assert response2.status_code == 200
        assert response2.json()["status"] == "Active"

    # ACCT-04 -----------------------------------------------------------------
    def test_frozen_wristband_blocks_nfc_payment(self):
        """
        ACCT-04: An NFC payment with a frozen wristband must be declined with 403.
        Covers FR-13.
        We mock the SUN crypto checks and give the tag a 'frozen' status.
        """
        child = _make_user(role="child")
        account = _make_account(owner_id=child.user_id, balance=100.0)

        nfc_uid = f"FROZEN-{uuid.uuid4().hex[:8].upper()}"
        tag = MagicMock(spec=NFCTag)
        tag.nfc_uid = nfc_uid
        tag.user_id = child.user_id
        tag.status = "frozen"
        tag.auth_key = "00" * 16
        tag.last_counter = 0
        tag.user = child

        merchant = MagicMock(spec=Merchant)
        merchant.merchant_id = uuid.uuid4()
        merchant.stripe_account_id = "acct_test_123"
        merchant.name = "Canteen"

        db = MagicMock()

        def query_side(model):
            q = MagicMock()
            if model is NFCTag:
                q.filter.return_value.first.return_value = tag
            elif model is Merchant:
                q.filter.return_value.first.return_value = merchant
            else:
                q.filter.return_value.first.return_value = None
            return q

        db.query.side_effect = query_side
        _override_db(db)

        with patch("main.counter_hex_to_int", return_value=1), \
             patch("main.verify_sun_mac", return_value=True):
            response = client.post(
                "/api/transactions/pay",
                json={
                    "uid": nfc_uid,
                    "counter": "000001",
                    "cmac": "aabbccddeeff0011",
                    "amount": 5.00,
                    "merchantId": str(merchant.merchant_id),
                    "category": "food",
                },
            )
        _clear_overrides()

        assert response.status_code == 403
        assert "Frozen" in response.json()["detail"]