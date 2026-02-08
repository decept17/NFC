from db.database import sessionLocal, engine, Base
from db.models import User, Account, Merchant
from auth import get_password_hash
import uuid

# 1. Reset Tables (Optional - enables clean slate)
# Base.metadata.drop_all(bind=engine)
# Base.metadata.create_all(bind=engine)

db = sessionLocal()

def seed():
    print("🌱 Seeding data...")

    # 1. Create Parent
    parent_email = "parent@test.com"
    existing_parent = db.query(User).filter(User.email == parent_email).first()
    
    if not existing_parent:
        parent = User(
            user_id=uuid.uuid4(),
            role="parent",
            email=parent_email,
            password_hash=get_password_hash("pass-123"), # Hashed!
            is_active=True
        )
        db.add(parent)
        db.commit()
        print(f"✅ Created Parent: {parent_email} / pass-123")
    else:
        parent = existing_parent
        print("ℹ️ Parent already exists")

    # 2. Create Child
    child = User(
        user_id=uuid.uuid4(),
        role="child",
        parent_id=parent.user_id,
        is_active=True
    )
    db.add(child)
    db.commit()

    # 3. Create Account for Child
    account = Account(
        account_id=uuid.uuid4(),
        owner_id=child.user_id,
        balance=15.50,
        status="Active",
        nfc_token_id="WRISTBAND_001"
    )
    db.add(account)
    db.commit()
    print(f"✅ Created Child Account. NFC Token: WRISTBAND_001")

    # 4. Create Merchant (School Canteen)
    merchant = Merchant(
        merchant_id=uuid.uuid4(),
        name="Springfield High Canteen",
        category="Food",
        api_key="sk_merchant_123",
        stripe_account_id="acct_123456789" # Replace with your REAL Connect ID if you have it
    )
    db.add(merchant)
    db.commit()
    print(f"✅ Created Merchant: {merchant.name}")

    db.close()

if __name__ == "__main__":
    seed()