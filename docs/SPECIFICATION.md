# System Specification & Test Plan

## 1. Functional Requirements
| ID | User Source | Requirement | Status |
|----|-------------|-------------|--------|
| FR-01 | US-01 | The system shall support user login via secure PIN or device-native biometrics | Partial |
| FR-02 | US-04 | The system shall render different dashboard UIs based on user role | Implemented |
| FR-03 | US-05 & US-14 | Users must be able to link a physical NFC wristband's unique ID to a specific user profile within the app | Implemented |
| FR-04 | US-03 | The system shall allow Parent users to securely link bank card for top-ups | Implemented |
| FR-05 | US-02 | Users must be able to reset their pin | Implemented |
| FR-06 | US-08 | Users must be able to view their current wallet balance | Implemented |
| FR-07 | US-11 | Parent accounts must be able to securely top up child accounts | Implemented |
| FR-08 | US-13 | Child users can trigger notification to Parent users requesting funds. | Implemented |
| FR-09 | US-08 | The system shall provide a searchable history of all transactions | Implemented |
| FR-10 | US-09 | Parents receive push notifications when a child transaction occurs | Implemented |
| FR-11 | US-18 & US-23 | Users can toggle a frozen status on wristband which immediately blocks all transaction attempts | Implemented |
| FR-12 | US-21 | The physical wristband shall transmit only a generic UID, no financial data shall be stored on the chip | Implemented |
| FR-13 | US-20 | The database shall not store raw credit card numbers, will be handled via third party | Implemented |
| FR-14 | US-22 | The app must display visual indicators of wristband health (Active, Frozen) | Implemented |

## 2. Non-Functional Requirements
* **Security:** Passwords must be salted and hashed (Bcrypt).
* **Latency:** Transaction processing < 500ms.
* **Availability:** System must auto-restart on crash (handled by Docker `restart: always`).
* * **Authentication:** Multi-factor authentication and biometric login.
* * **Secure Payments:** Only 1 payment should be processed at a time per band
* * **Accuracy:** Absolute consistency in transaction processing and data integrity 
* * **Compliance:** Adheres to all compliance laws and off-shores to third party 

## 3. Test Plan
This plan covers Unit, Integration and System testing.

### Phase 1: Backend Unit Testing (Logic Verification)
Tools: `pytest`, `unittest.mock`, FastAPI `TestClient`
Files: `api/tests/test_main.py`, `api/tests/test_services.py`, `api/tests/test_crypto.py`, `api/tests/test_password_reset.py`

**A. Authentication & RBAC** (`test_main.py`)
| Test ID | Description | Expected Result |
| :--- | :--- | :--- |
| AUTH-01 | Valid email/password combination. | 200 OK + JWT token + correct role returned. |
| AUTH-02 | Valid email but wrong password. | 401 Unauthorized. |
| AUTH-03 | Email not in DB. | 404 Not Found. |
| AUTH-04 | JWT with a past expiry date. | 401 Unauthorized. |
| AUTH-05 | Parent A attempts to view balance of Parent B's child account. | 403 Forbidden. |

**B. Account Management** (`test_main.py`)
| Test ID | Description | Expected Result |
| :--- | :--- | :--- |
| ACCT-01 | Parent links a provisioned, unlinked NFC tag to a child account. | 200 OK; DB updates `nfc_token_id` and `tag.user_id`. |
| ACCT-02 | Attempt to link an NFC UID already assigned to another user. | 400 Bad Request. |
| ACCT-03 | Parent toggles freeze on a child account (two consecutive calls). | Status cycles Active → Frozen → Active. |
| ACCT-04 | NFC payment attempted with a frozen wristband. | 403 Forbidden; "Frozen" in response detail. |

**C. Payment Service Logic** (`test_services.py`)
| Test ID | Description | Expected Result |
| :--- | :--- | :--- |
| SVC-01 | Balance less than payment amount. | `success: false`; "Insufficient funds". |
| SVC-02 | Tag status is `frozen`. | `success: false`; "Frozen" in message. |
| SVC-03 | Tag status is `lost`. | `success: false`; "Lost" in message. |
| SVC-04 | Cumulative daily spend + new amount exceeds daily limit. | `success: false`; "daily" in message. |
| SVC-05 | Merchant category is in parent's blocked list. | `success: false`; "blocked" in message. |
| SVC-06 | Amount exceeds single transaction maximum. | `success: false`; "single transaction" in message. |
| SVC-07 | Payment processed in `ENVIRONMENT=development` mode. | `success: true`; Stripe Transfer NOT called; balance deducted correctly. |
| SVC-TAG | NFC UID not found in DB. | `success: false`; "not recognized" in message. |
| SVC-10 | `create_top_up_intent` — Stripe PaymentIntent succeeds. | `success: true`; `clientSecret` returned; amount converted to pence. |
| SVC-10b | `create_top_up_intent` — Stripe SDK raises exception. | `success: false`; error message propagated. |

**D. NFC Cryptography** (`test_crypto.py`)
| Test ID | Description | Expected Result |
| :--- | :--- | :--- |
| CRYPTO-01 | Correctly generated AES-CMAC SUN MAC submitted. | `verify_sun_mac` returns `True`. |
| CRYPTO-02 | Tampered or wrong MAC value. | Returns `False`. |
| CRYPTO-03 | Correct MAC computed with a different AES key. | Returns `False`. |
| CRYPTO-04 | Correct MAC but different UID. | Returns `False`. |
| CRYPTO-05 | Correct MAC but different counter value. | Returns `False`. |
| CRYPTO-06 | Malformed hex in UID field. | Returns `False` without raising an exception. |
| CRYPTO-07 | Malformed hex in CMAC field. | Returns `False` without raising an exception. |
| CRYPTO-08 | Key length is not a valid AES size. | Returns `False`. |
| CRYPTO-09 | `counter_hex_to_int` with zero, tap 1, tap 21, and max counter. | Correct integer value returned in all cases. |

**E. Password Reset Flow** (`test_password_reset.py`)
| Test ID | Description | Expected Result |
| :--- | :--- | :--- |
| PWR-01 | `POST /forgot-password` with a registered parent email. | 200 OK; email service invoked exactly once. |
| PWR-02 | `POST /forgot-password` with an unregistered email (anti-enumeration). | 200 OK; no email dispatched. |
| PWR-03 | `POST /forgot-password` with a child account email. | 200 OK; email service NOT called. |
| PWR-04 | `POST /forgot-password` with malformed email format. | 422 Unprocessable Entity. |
| PWR-05 | `POST /reset-password` with valid token and new password. | 200 OK; password hash updated; token marked as used. |
| PWR-06 | `POST /reset-password` reusing an already-consumed token. | 400 Bad Request. |
| PWR-07 | `POST /reset-password` with an expired token. | 400 Bad Request. |
| PWR-08 | `POST /reset-password` with a completely unknown token. | 400 Bad Request. |
| PWR-09 | `POST /reset-password` with a password shorter than 6 characters. | 422 Unprocessable Entity. |

---

### Phase 2: Integration Testing (Database & Concurrency)
Tools: `pytest`, real PostgreSQL via Docker (`test_db` service, port 5433)
File: `api/tests/test_integration.py`
> Requires Docker test DB. Run with: `pytest tests/test_integration.py -v -m integration`

**A. Concurrency — Double-Spend Prevention**
| Test ID | Description | Expected Result |
| :--- | :--- | :--- |
| CONC-01 | Two threads fire simultaneous £10 payments on a £15 balance account. | Exactly 1 success, 1 failure; balance ends at £5.00; never goes negative. |
| CONC-02 | 5 sequential £4 payments on a £15 balance. | 3 succeed (3x£4=£12); 2 fail with insufficient funds; final balance £3.00. |

**B. Data Integrity**
| Test ID | Description | Expected Result |
| :--- | :--- | :--- |
| INT-01 | Create a `Transaction` row with a non-existent `account_id`. | `IntegrityError` raised — FK constraint enforced by DB. |
| INT-02 | NFC tap with a counter value equal to or below the last accepted counter (replay). | 403 Forbidden; "Replay" in response detail. |
| INT-03 | Delete a `User` who has no financial transactions. | User and associated account removed cleanly (cascade works). |

---

### Phase 3: Stripe Payment Integration Testing
Tools: `unittest.mock` — all Stripe SDK calls are intercepted; no real network requests
File: `api/tests/test_stripe.py`

**A. Top-Up Flow**
| Test ID | Description | Expected Result |
| :--- | :--- | :--- |
| STR-01 | `create_top_up_intent` — PaymentIntent created successfully. | `success: true`; `clientSecret` returned; amount in pence; currency GBP; correct metadata. |
| STR-02 | `create_checkout_session` — Stripe hosted URL returned. | `success: true`; URL contains `checkout.stripe.com`; mode=payment; correct metadata. |
| STR-03 | `create_top_up_intent` — Stripe raises `StripeError`. | `success: false`; error message propagated; DB balance unchanged. |
| STR-03b | `create_checkout_session` — Stripe raises `StripeError`. | `success: false`; error message propagated. |

**B. NFC Transaction to Stripe Transfer**
| Test ID | Description | Expected Result |
| :--- | :--- | :--- |
| STR-04 | Successful NFC payment in production mode triggers `stripe.Transfer.create`. | Transfer ID saved to transaction record; correct amount in pence; destination is merchant Connect account. |
| STR-05 | `stripe.Transfer.create` raises `StripeError` after all checks pass. | `success: false`; DB rolls back; user balance unchanged. |
| STR-06 | Merchant in DB has no `stripe_account_id`. | API returns 500; Stripe is never called. |

---

### Phase 4: Mobile App (Frontend) Testing
Tools: `Jest`, `React Native Testing Library`
Files: `mobile-app/__tests__/auth.test.tsx`, `topup.test.tsx`, `nfc.test.tsx`

**A. Authentication** (`auth.test.tsx`)
| Test ID | Description | Expected Result |
| :--- | :--- | :--- |
| MOB-01 | App renders login form on launch with no stored session token. | Email input, password input, and Login button all visible. |
| MOB-02 | Submitting valid credentials calls the login API and stores session. | `fetchApi` called with `POST /auth/login`; token stored in SecureStore. |
| MOB-02b | Submitting invalid credentials. | `alert()` called with an error message. |

**B. Top-Up Input Validation & Balance Sync** (`topup.test.tsx`)
| Test ID | Description | Expected Result |
| :--- | :--- | :--- |
| MOB-03 | Alphabetic characters entered in the top-up amount field. | Input value stays empty; error message shown. |
| MOB-03b | Special characters (e.g. `£25!`) entered. | Only numeric portion survives sanitisation (`25`). |
| MOB-04 | Valid decimal amount (e.g. `20.50`) entered. | Value displayed as-is; no error shown. |
| MOB-04b | Valid integer amount (e.g. `10`) entered. | Value accepted without error or change. |
| MOB-05 | Top-up completes; balance re-fetched from server. | Displayed balance updates from £10.00 to £30.00. |

**C. NFC Interaction & Wristband Health** (`nfc.test.tsx`)
| Test ID | Description | Expected Result |
| :--- | :--- | :--- |
| MOB-06 | Mock NFC inject button fires `processNFCPayment` with correct payload. | API called with correct UID, counter, CMAC, amount, merchant ID, and category. |
| MOB-06b | Payment API returns approved response. | Status shows "approved"; updated balance displayed. |
| MOB-06c | Payment API returns declined response. | Status shows "declined". |
| MOB-07a | Wristband status is `Active`. | Active badge displayed; no frozen warning rendered. |
| MOB-07b | Wristband status is `Frozen`. | Frozen badge and warning message both visible. |

