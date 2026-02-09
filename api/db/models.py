from sqlalchemy import Column, String, Numeric, ForeignKey, DateTime, JSON, Boolean
from sqlalchemy import Enum as SQLAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import uuid
from .database import Base

class TagStatus(str, enum.Enum):
    ACTIVE = "active"
    FROZEN = "frozen"   # User temporarily locks card
    LOST = "lost"       # Permanent deactivation

class NFCTag(Base):
    __tablename__ = 'nfc_tags'

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    nfc_uid = Column(String, unique=True, nullable=False) # The physical chip ID
    user_id = Column(String, ForeignKey('users.id'), nullable=False)
    status = Column(SQLAEnum(TagStatus), default=TagStatus.ACTIVE)
    label = Column(String, nullable=True) # e.g., "Blue Wristband"
    created_at = Column(DateTime, default= datetime.now)
    
    # Link back to User
    user = relationship("User", back_populates="nfc_tags")

class AccountType(str, enum.Enum):
    WALLET = "wallet" # Internal digital money
    BANK_LINK = "bank_link" # Tokenized reference to external bank

class Account(Base):
    __tablename__ = "accounts"
    account_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    balance = Column(Numeric(12,2), default=0.00)
    account_type = Column(SQLAEnum(AccountType), default=AccountType.WALLET)

    daily_limit = Column(Numeric(10, 2), nullable=True)
    
    # process transactions via a trusted third-party gateway and not store sensitive details
    stripe_customer_id = Column(String, nullable=True) 

    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.utcnow)
   

    # relationship to transaction - allows sql to see transaction history
    transactions = relationship("Transaction", back_populates="account")

    # Relationship to User
    user = relationship("User", back_populates="accounts")

class Transaction(Base):
    __tablename__ = "transactions"
    transaction_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.account_id"))
    amount = Column(Numeric(12,2))
    type = Column(String(50)) # payment, top up
    status = Column(String(20)) # Success, Failed
    merchant_id = Column(String(100))
    merchant_name = Column(String(255))

    stripe_charge_id = Column(String(255), nullable=True)
    stripe_transfer_id = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    account = relationship("Account", back_populates="transactions")

class Limit(Base):
    __tablename__ = "limits"
    child_account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.account_id"), primary_key=True)
    daily_spending_limit = Column(Numeric(12,2), default=0.00)
    single_transaction_max = Column(Numeric(12,2), default=0.00)
    blocked_categories = Column(JSON) # List of strings

class Merchant(Base):
    __tablename__ = "merchants"
    merchant_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String)
    category = Column(String)
    api_key = Column(String)
    stripe_account_id = Column(String) # The destination for the funds

class User(Base):
    __tablename__ = "users"
    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role = Column(String, nullable=False, default="user") # Parent or Child
    #Nullable because children dont have them
    email = Column(String, unique=True, nullable=True)
    password_hash = Column(String, nullable=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True) # parent doesnt need id
    is_active = Column(Boolean, default=True)

    nfc_tags = relationship("NFCTag", back_populates="user")

    # Link to the financial accounts 
    accounts = relationship("Account", back_populates="user")