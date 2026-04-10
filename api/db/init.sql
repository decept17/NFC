-- File: api/db/init.sql
-- This script is executed automatically by the PostgreSQL Docker container on startup.
-- It sets up the core database schema for the NFC Ecosystem of Accountability.
-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
----------------------------------------------------
-- 1. USERS TABLE (Identity and Authentication)
----------------------------------------------------
-- Stores parent and child identity (pseudonymised for children where possible)
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- 'parent' is the primary account holder; 'child' is the dependent
    role TEXT NOT NULL CHECK (role IN ('parent', 'child')),
    email TEXT UNIQUE,
    -- Parent email used for login (NULL for children)
    username TEXT UNIQUE,
    -- Child username used for login (NULL for parents)
    password_hash TEXT,
    -- Hashed password for login (parent uses email+password, child uses username+password)
    -- Child linking data (only relevant if role = 'child')
    parent_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    name TEXT,
    -- Display name for child accounts
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    -- Can be frozen by system/parent
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Index for quickly finding all children belonging to a parent
CREATE INDEX idx_parent_id ON users(parent_id);
----------------------------------------------------
-- 2. ACCOUNTS TABLE (Financial Wallet and Balance)
----------------------------------------------------
-- Stores the actual financial balance and status of the wallet.
CREATE TABLE accounts (
    account_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Links to the user (identity) in the users table
    owner_id UUID REFERENCES users(user_id) ON DELETE RESTRICT,
    balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'GBP',
    account_type TEXT NOT NULL DEFAULT 'WALLET',
    -- Status reflects Active, Frozen (by parent/system), or Closed
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Frozen', 'Closed')),
    -- Unique ID representing the NFC wristband token
    nfc_token_id TEXT UNIQUE,
    daily_limit NUMERIC(10, 2),
    stripe_customer_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Index for quick lookups using the NFC token at a POS terminal
CREATE UNIQUE INDEX idx_nfc_token ON accounts(nfc_token_id);
----------------------------------------------------
-- 3. LIMITS TABLE (Parental Control Layer)
----------------------------------------------------
-- Stores all spending restrictions set by the parent for a child's account.
CREATE TABLE limits (
    limit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    child_account_id UUID UNIQUE REFERENCES accounts(account_id) ON DELETE CASCADE,
    -- Spending Rules
    daily_spending_limit NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    single_transaction_max NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    -- Restriction Rules
    blocked_categories TEXT [],
    -- E.g., ['Vaping', 'Gambling']
    allow_online BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
----------------------------------------------------
-- 4. MERCHANTS TABLE (Assignment of merchants)
----------------------------------------------------
-- Allowing for merchant names and id to change and assignment of categories
CREATE TABLE merchants (
    merchant_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    -- e.g, 'Canteen', 'Stationary', 'Vapes'
    api_key TEXT,
    -- For the POS terminal to authenticate
    -- CRITICAL: The School's unique Stripe Connect ID (starts with 'acct_...')
    stripe_account_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
----------------------------------------------------
-- 4. TRANSACTIONS TABLE (Audit and History)
----------------------------------------------------
-- Records all movement of funds. Essential for auditing and parent monitoring.
CREATE TABLE transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts(account_id) ON DELETE RESTRICT,
    amount NUMERIC(10, 2) NOT NULL,
    -- Payment, TopUp, Fee, Withdrawal
    type TEXT NOT NULL CHECK (
        type IN ('Payment', 'TopUp', 'Withdrawal', 'Fee')
    ),
    -- Status reflects the result: Success, Failed (due to insufficient funds/limit), Frozen (rejected by parental lock)
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (
        status IN (
            'Pending',
            'Success',
            'Failed',
            'Frozen',
            'Reversed'
        )
    ),
    merchant_id TEXT,
    -- ID of the merchant/school canteen
    merchant_name TEXT,
    stripe_charge_id TEXT,
    -- Stores the 'ch_...' from the Top-Up
    stripe_transfer_id TEXT,
    -- Stores the 'tr_...' from the Meal Payment
    -- Metadata
    ip_address TEXT,
    -- For security/fraud logging
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TYPE tag_status AS ENUM ('active', 'frozen', 'lost');
CREATE TABLE nfc_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nfc_uid VARCHAR UNIQUE NOT NULL,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    status tag_status DEFAULT 'active',
    label VARCHAR,
    -- NTAG 424 DNA SUN (Secure Unique NFC) fields
    auth_key VARCHAR,                          -- AES-128 key as hex (provisioned into chip, secret)
    last_counter INTEGER NOT NULL DEFAULT 0,   -- Monotonic tap counter; rejects replayed taps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP
);

-- Migration helper: run this if upgrading an existing database
-- ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS auth_key VARCHAR;
-- ALTER TABLE nfc_tags ADD COLUMN IF NOT EXISTS last_counter INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

----------------------------------------------------
-- 6. NOTIFICATIONS TABLE (Child-to-Parent Requests)
----------------------------------------------------
-- Stores "ping for money" requests from children to parents.
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    child_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    message TEXT NOT NULL DEFAULT 'Can I have some money?',
    status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_notifications_parent ON notifications(parent_id);

----------------------------------------------------
-- 7. PASSWORD RESET TOKENS (Forgot Password Flow)
----------------------------------------------------
-- Stores short-lived, single-use tokens for parent account password resets.
-- IMPORTANT: only the SHA-256 hash of the raw token is stored here.
-- The raw token exists only in the email link sent to the user.
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,   -- SHA-256 hash of the raw URL-safe token
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_prt_user_id ON password_reset_tokens(user_id);

-- Migration helper: run this on any existing database that pre-dates this table
-- CREATE TABLE IF NOT EXISTS password_reset_tokens (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
--     token_hash TEXT NOT NULL UNIQUE,
--     expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
--     used BOOLEAN NOT NULL DEFAULT FALSE,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );