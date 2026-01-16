import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from uuid import uuid4
import uuid
from unittest.mock import patch
from db.database import Base, get_db
from main import app
from db.models import Account, Merchant, User
from auth import get_current_user
import os
# FORCE tests to use SQLite or Localhost, ignoring the .env file
os.environ["DB_HOST"] = "localhost" 
os.environ["DB_NAME"] = "test_db"
os.environ["DB_USER"] = "user"
os.environ["DB_PASSWORD"] = "password"

# --- TEST DATABASE SETUP ---
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module")
def test_db():
    Base.metadata.create_all(bind=engine)
    yield TestingSessionLocal()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="module")
def client():
    return TestClient(app)

# --- AUTH HELPER ---
# This creates a Fake Parent User that we can "inject" into the app
# so the app thinks we are logged in.
fake_parent_id = uuid.uuid4()
fake_parent_user = User(
    user_id=fake_parent_id,
    role="parent",
    email="test_parent@example.com",
    is_active=True
)

def mock_get_current_user():
    return fake_parent_user

# --- TESTS ---

def test_read_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "NFC Python API is running!"}

def test_top_up_success(client, test_db):
    # 1. SETUP: Create the Family Tree in the DB
    test_db.add(fake_parent_user) 
    
    child_id = uuid.uuid4()
    child_user = User(
        user_id=child_id,
        role="child",
        parent_id=fake_parent_id,
        is_active=True
    )
    test_db.add(child_user)

    account_id = uuid.uuid4()
    account = Account(
        account_id=account_id, 
        owner_id=child_id, 
        balance=10.0, 
        status="Active",
        nfc_token_id="TEST_NFC_123"
    )
    test_db.add(account)
    test_db.commit()

    # 2. OVERRIDE AUTH
    app.dependency_overrides[get_current_user] = mock_get_current_user

    # 3. MOCK THE SERVICE (The Fix)
    # This prevents the test from hitting real Stripe.
    # We force the service to return a successful response.
    with patch("services.services.PaymentService.top_up") as mock_payment:
        mock_payment.return_value = {"success": True, "new_balance": 30.0}

        # 4. EXECUTE
        payload = {
            "amount": 20.0,
            "paymentMethodId": "pm_card_visa" 
        }
        
        # Pass account_id as string
        response = client.post(f"/api/accounts/{account_id}/topup", json=payload)

        # 5. ASSERT
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["new_balance"] == 30.0
    
    # Clean up
    app.dependency_overrides = {}