from sqlalchemy import Column, String, Numeric, ForeignKey, DateTime, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from .database import Base

class Account(Base):
    __tablename__ = "accounts"
    account_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True))
    balance = Column(Numeric(12,2), default=0.00)
    status = Column(String(20), default="Active")
    nfc_token_id = Column(String(100), unique=True)

class Transaction(Base):
    __tablename__ = "transactions"
    transaction_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.account_id"))
    amount = Column(Numeric(12,2))
    type = Column(String(50)) # payment, top up
    status = Column(String(20)) # Success, Failed
    merchant_id = Column(String(100))
    merchant_name = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

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