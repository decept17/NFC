"""
tests/test_password_reset.py — Unit tests for the password reset flow.

Uses MagicMock DB sessions (same pattern as test_main.py) to avoid
SQLite's inability to handle PostgreSQL ARRAY types.
No Docker required.

Run with:
    pytest tests/test_password_reset.py -v
"""
import sys
import os
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

# Set env vars BEFORE any app imports so database.py doesn't try to connect
os.environ["DB_HOST"] = "localhost"
os.environ["DB_PORT"] = "5432"
os.environ["DB_NAME"] = "test_db"
os.environ["DB_USER"] = "user"
os.environ["DB_PASSWORD"] = "password"
os.environ["JWT_SECRET"] = "test_secret_for_unit_tests"
os.environ["PAYMENT_GATEWAY_SECRET_KEY"] = "sk_test_placeholder"
os.environ["ADMIN_PROVISION_KEY"] = "admin-test-key"

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient

from db.models import User, PasswordResetToken
from auth import get_password_hash
from db.database import get_db
from main import app

client = TestClient(app)


# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #

def _make_parent(email="parent@example.com") -> User:
    u = MagicMock(spec=User)
    u.user_id = uuid.uuid4()
    u.email = email
    u.role = "parent"
    u.password_hash = get_password_hash("oldpassword")
    u.is_active = True
    return u


def _make_token_entry(user_id, raw_token, minutes_valid=30, used=False) -> PasswordResetToken:
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    entry = MagicMock(spec=PasswordResetToken)
    entry.user_id = user_id
    entry.token_hash = token_hash
    entry.expires_at = datetime.now(timezone.utc) + timedelta(minutes=minutes_valid)
    entry.used = used
    return entry


def _override_db(db):
    def _get():
        yield db
    app.dependency_overrides[get_db] = _get


def _clear():
    app.dependency_overrides.clear()


# --------------------------------------------------------------------------- #
# POST /api/auth/forgot-password                                               #
# --------------------------------------------------------------------------- #

class TestForgotPassword:

    def test_registered_email_returns_200(self):
        """API must return 200 for a registered email."""
        parent = _make_parent()
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = parent
        db.query.return_value.filter.return_value.delete.return_value = None
        _override_db(db)

        with patch("main.send_password_reset_email"):  # don't actually send email
            response = client.post(
                "/api/auth/forgot-password",
                json={"email": "parent@example.com"},
            )
        _clear()

        assert response.status_code == 200
        assert "message" in response.json()

    def test_unknown_email_also_returns_200(self):
        """API must return 200 even for an unregistered email (anti-enumeration)."""
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        _override_db(db)

        response = client.post(
            "/api/auth/forgot-password",
            json={"email": "ghost@nowhere.com"},
        )
        _clear()

        assert response.status_code == 200
        assert "message" in response.json()

    def test_child_account_email_treated_as_not_found(self):
        """A child account email (role='child') should not trigger a reset email."""
        child = MagicMock(spec=User)
        child.role = "child"
        child.email = "child@example.com"

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = child
        _override_db(db)

        with patch("main.send_password_reset_email") as mock_email:
            response = client.post(
                "/api/auth/forgot-password",
                json={"email": "child@example.com"},
            )
        _clear()

        assert response.status_code == 200
        mock_email.assert_not_called()  # Email must NOT be sent for child accounts

    def test_email_service_called_for_valid_parent(self):
        """For a valid parent email, the email service should be invoked once."""
        parent = _make_parent()
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = parent
        db.query.return_value.filter.return_value.delete.return_value = None
        _override_db(db)

        with patch("main.send_password_reset_email") as mock_email:
            client.post(
                "/api/auth/forgot-password",
                json={"email": "parent@example.com"},
            )
        _clear()

        mock_email.assert_called_once()
        call_kwargs = mock_email.call_args
        assert "parent@example.com" in str(call_kwargs)

    def test_invalid_email_format_returns_422(self):
        """Pydantic should reject a malformed email with 422."""
        response = client.post(
            "/api/auth/forgot-password",
            json={"email": "not-an-email"},
        )
        assert response.status_code == 422


# --------------------------------------------------------------------------- #
# POST /api/auth/reset-password                                                #
# --------------------------------------------------------------------------- #

class TestResetPassword:

    def _db_with_token(self, parent, raw_token, minutes_valid=30, used=False):
        """Build a mock DB that returns the right user and token entry."""
        entry = _make_token_entry(parent.user_id, raw_token, minutes_valid, used)
        db = MagicMock()

        def query_side(model):
            q = MagicMock()
            if model is PasswordResetToken:
                q.filter.return_value.first.return_value = entry
            elif model is User:
                q.filter.return_value.first.return_value = parent
            return q

        db.query.side_effect = query_side
        return db, entry

    def test_valid_token_returns_200(self):
        """A valid token + new password should return 200."""
        parent = _make_parent()
        raw_token = secrets.token_urlsafe(32)
        db, _ = self._db_with_token(parent, raw_token)
        _override_db(db)

        response = client.post(
            "/api/auth/reset-password",
            json={"token": raw_token, "new_password": "newpassword123"},
        )
        _clear()

        assert response.status_code == 200
        assert "message" in response.json()

    def test_valid_token_updates_password_hash(self):
        """A valid token should cause the user's password_hash to be updated."""
        parent = _make_parent()
        raw_token = secrets.token_urlsafe(32)
        db, _ = self._db_with_token(parent, raw_token)
        _override_db(db)

        client.post(
            "/api/auth/reset-password",
            json={"token": raw_token, "new_password": "brandnewpassword"},
        )
        _clear()

        from auth import verify_password
        # The mock user's password_hash attribute should have been set to the new hash
        assert verify_password("brandnewpassword", parent.password_hash)

    def test_valid_token_is_marked_used(self):
        """After a successful reset, the token entry's `used` flag should be True."""
        parent = _make_parent()
        raw_token = secrets.token_urlsafe(32)
        db, entry = self._db_with_token(parent, raw_token)
        _override_db(db)

        client.post(
            "/api/auth/reset-password",
            json={"token": raw_token, "new_password": "newpassword123"},
        )
        _clear()

        assert entry.used is True

    def test_used_token_returns_400(self):
        """Attempting to reuse a consumed token should return 400."""
        parent = _make_parent()
        raw_token = secrets.token_urlsafe(32)
        db, _ = self._db_with_token(parent, raw_token, used=True)
        _override_db(db)

        response = client.post(
            "/api/auth/reset-password",
            json={"token": raw_token, "new_password": "anotherpassword"},
        )
        _clear()

        assert response.status_code == 400

    def test_expired_token_returns_400(self):
        """An expired token should return 400."""
        parent = _make_parent()
        raw_token = secrets.token_urlsafe(32)
        db, _ = self._db_with_token(parent, raw_token, minutes_valid=-1)
        _override_db(db)

        response = client.post(
            "/api/auth/reset-password",
            json={"token": raw_token, "new_password": "anotherpassword"},
        )
        _clear()

        assert response.status_code == 400

    def test_unknown_token_returns_400(self):
        """A completely made-up token should return 400."""
        db = MagicMock()

        def query_side(model):
            q = MagicMock()
            if model is PasswordResetToken:
                q.filter.return_value.first.return_value = None
            return q

        db.query.side_effect = query_side
        _override_db(db)

        response = client.post(
            "/api/auth/reset-password",
            json={"token": "completelyfaketoken1234567890abcdef", "new_password": "anypassword"},
        )
        _clear()

        assert response.status_code == 400

    def test_password_too_short_returns_422(self):
        """A new_password shorter than 6 characters should fail Pydantic validation."""
        parent = _make_parent()
        raw_token = secrets.token_urlsafe(32)
        db, _ = self._db_with_token(parent, raw_token)
        _override_db(db)

        response = client.post(
            "/api/auth/reset-password",
            json={"token": raw_token, "new_password": "abc"},
        )
        _clear()

        assert response.status_code == 422
