import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker
from unittest.mock import MagicMock, patch

# IMPORTS FROM YOUR CODEBASE
# Assumes this file is in api/tests/ and you run pytest from api/
from db.database import Base, get_db
from db.models import Account, Merchant
from routes.main import app

# ---------------------------------------------------------
# 1. SETUP TEST DATABASE
# ---------------------------------------------------------
# We use an in-memory SQLite DB for speed, or you can use the 
# Postgres service defined in your CI/CD if you prefer. 
# For CI/CD consistency with your Postgres container, we will assume 
# the environment variables match, but here is a fail-safe implementation.

# Setup a temporary in-memory database for testing logic purely
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}, 
    poolclass=StaticPool 
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ---------------------------------------------------------
# 2. TEST FIXTURES (Setup & Teardown)
# ---------------------------------------------------------

@pytest.fixture(scope="function")
def db_session():
    """Creates a fresh database for every single test function."""
    # Create tables
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        # Drop tables to cleanup
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db_session):
    """Override the app's get_db dependency to use our test db."""
    def override_get_db():
        try:
            yield db_session
        finally:
            db_session.close()
    
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    # Clear overrides after test
    app.dependency_overrides.clear()

@pytest.fixture
def mock_stripe():
    """Fakes Stripe so we don't actually charge credit cards."""
    with patch("services.services.stripe") as mock:
        # Mock the PaymentIntent.create response
        mock.PaymentIntent.create.return_value = MagicMock(
            id="pi_test_123", 
            client_secret="secret_123"
        )
        # Mock the Transfer.create response
        mock.Transfer.create.return_value = MagicMock(
            id="tr_test_456"
        )
        yield mock

# ---------------------------------------------------------
# 3. UNIT & INTEGRATION TESTS
# ---------------------------------------------------------

def test_health_check(client):
    """Test that the API is running."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "NFC Python API is running!"}

def test_top_up_success(client, db_session, mock_stripe):
    """
    Test that a parent can top up.
    Should:
    1. Create a PaymentIntent via Stripe (Mocked).
    2. Update Account Balance in DB.
    3. Log a Transaction.
    """
    # 1. Seed an account
    account = Account(balance=0.00, status="Active", nfc_token_id="wristband_123")
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)

    # 2. Call API
    payload = {
        "amount": 50.00,
        "paymentMethodId": "pm_card_visa"
    }
    response = client.post(f"/api/accounts/{account.account_id}/topup", json=payload)

    # 3. Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["new_balance"] == 50.00

    # Verify DB state
    updated_account = db_session.query(Account).filter_by(account_id=account.account_id).first()
    assert float(updated_account.balance) == 50.00
    
    # Verify Stripe was called
    mock_stripe.PaymentIntent.create.assert_called_once()

def test_payment_failure_insufficient_funds(client, db_session):
    """Test that payment is rejected if balance is too low."""
    # 1. Seed Account (Low balance)
    account = Account(balance=5.00, status="Active", nfc_token_id="wristband_low_funds")
    # 2. Seed Merchant
    merchant = Merchant(
        name="Test Canteen", 
        category="Food", 
        stripe_account_id="acct_test_school", 
        api_key="key_123"
    )
    db_session.add_all([account, merchant])
    db_session.commit()

    # 3. Attempt to spend 10.00
    payload = {
        "nfcTokenId": "wristband_low_funds",
        "amount": 10.00,
        "merchantId": str(merchant.merchant_id),
        "category": "Food"
    }
    response = client.post("/api/transactions/pay", json=payload)

    # 4. Expect 403 Forbidden
    assert response.status_code == 403
    assert "Insufficient funds" in response.json()["detail"]

def test_payment_success_with_stripe_transfer(client, db_session, mock_stripe):
    """
    Test the full 'Child Taps Wristband' flow.
    Should:
    1. Check balance & Limits.
    2. Transfer funds to Merchant Stripe Account (Mocked).
    3. Deduct balance.
    """
    # 1. Seed Account ($20 balance)
    account = Account(balance=20.00, status="Active", nfc_token_id="wristband_rich")
    
    # 2. Seed Merchant
    merchant = Merchant(
        name="School Shop", 
        category="Stationery", 
        stripe_account_id="acct_real_school" 
    )
    db_session.add_all([account, merchant])
    db_session.commit()

    # 3. Call API (Spend $5)
    payload = {
        "nfcTokenId": "wristband_rich",
        "amount": 5.00,
        "merchantId": str(merchant.merchant_id),
        "category": "Stationery"
    }
    response = client.post("/api/transactions/pay", json=payload)

    # 4. Assertions
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["status"] == "approved"
    assert data["balance"] == 15.00

    # 5. Verify Stripe Transfer
    # Ensure we transferred to the correct school ID ('destination')
    mock_stripe.Transfer.create.assert_called_once()
    call_kwargs = mock_stripe.Transfer.create.call_args[1]
    assert call_kwargs["destination"] == "acct_real_school"
    assert call_kwargs["amount"] == 500 # 5.00 * 100 cents