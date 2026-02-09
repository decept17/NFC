# System Specification & Test Plan

## 1. Functional Requirements
| ID | Requirement | Implemented In |
|----|-------------|----------------|
| FR-01 | The system shall support user login via secure PIN or device-native biometrics | partial - `api/auth.py` |
| FR-02 | The system shall render different dashboard UIs based on user role | pending Frontend Logic |
| FR-03 | Users must be able to link a physical NFC wristband's unique ID to a specific user profile within the app | `api/db/models.py` |
| FR-04 | The system shall allow Parent users to securely link bank card for top-ups| Pending Payment Gateway Intergration |
| FR-05 | Users must be able to reset their pin | Pending |
| FR-06 | Users must be able to view their current wallet balance | Core logic in `TransactionService` |
| FR-07 | Parent accounts must be able to securely top up child accounts | Pending |
| FR-08 | Parent accounts must be able to reclaim unused funds in child account back to main source | Pending |
| FR-09 | Child users can trigger notification to Parent users requesting funds. | Pending |
| FR-10 | The system shall provide a searchable history of all transactions | `Database Schema` |
| FR-11 | Parents can blacklist specific merchant categories | Pending |
| FR-12 | Parents recieve push notifications when a child transaction occurs | Pending |
| FR-13 | Users can toggle a frozen status on wristband which immediatel blocks all transaction attempts | Pending |
| FR-14 | The physical wristband shall transmit only a genric UID, no finicial data shall be stored on the chip | Pending |
| FR-15 | The database shall not store raw credit card numbers, will be handled via third party | `Stripe Connect` |
| FR-16 | The app must display visual indicators of wristband health (Active, Frozen) | Frontend Logic Pending |
| FR-17 | Users must be able to unlink a lost band and link a new band while retaining account balance and history | Pending |

## 2. Non-Functional Requirements
* **Security:** Passwords must be salted and hashed (Bcrypt).
* **Latency:** Transaction processing < 500ms.
* **Availability:** System must auto-restart on crash (handled by Docker `restart: always`).
* * **Authentication:** Multi-factor authentication and biometric login.
* * **Secure Payments:** Only 1 payment should be processed at a time per band
* * **Accuracy:** Absolute consistency in transaction processing and data integrity 
* * **Compliance:** Adheres to all compliance laws and off-shores to third party 

## 3. Test Plan
This plan covers Unit, Intergration and System testing.

### Phase 1: Backend Unit Testing (Logic Verification)
Tools: pytest, unittest.mock

**A. Authentication & RBAC**
| Test Case | Description | Expected Result |
| :--- | :--- | :--- |
| Login Success | Valid email/password combination. | Return 200 OK + JWT Token. |
| Login Failure | Invalid password or non-existent email. | Return 401 Unauthorized. |
| Token Expiry | Use a manipulated token with an old exp date. | Return 401 Unauthorized. |
| Data Isolation | Parent A attempts to view Parent B's family accounts. | Return 403 or empty list. |

**B. Account Management**
| Test Case | Description | Expected Result |
| :--- | :--- | :--- |
| Link NFC Tag | Parent links a new unique NFC UID to a child. | Success, DB updates nfc_token_id. |
| Duplicate NFC | Attempt to link an NFC UID already assigned to another user. | Return 400 Bad Request. |
| Freeze Account | Parent toggles status on a child's account. | Status changes Active ↔ Frozen. |

### Phase 2: Integration Testing (Database & Concurrency)
Tools: pytest, Docker Test Database

**A. Concurrency (Double-Spend Prevention)**
Critical for financial apps.

Simultaneous Taps: Simulate two POS terminals sending a payment request for the same NFC tag at the exact same millisecond.

Test: Spawn 2 threads calling process_nfc_transaction for £10 on an account with only £15 balance.

Goal: Ensure with_for_update() locks the row correctly. Only one transaction should succeed; the other must fail with "Insufficient funds".

**B. Data Integrity**

Foreign Key Constraints: Attempt to create a transaction for a non-existent account_id. Database should raise an integrity error.

Orphaned Records: Delete a User and ensure CASCADE delete removes their auth data but restricts deletion if financial transactions exist (as per schema definition).

### Phase 3: Stripe Payment Integration Testing
Tools: Stripe Sandbox Mode, Postman

*As this feature is In Progress these tests verify the interaction between your API and Stripe's servers.*

A. Top-Up Flow (Money In)
| Component | Test Action | Verification |
| :--- | :--- | :--- |
| Stripe Intent | Call /topup with valid test card (e.g., Stripe 4242). | Verify stripe.PaymentIntent.create succeeds. Verify stripe_charge_id is saved in DB. |
| Card Declined | Call /topup with Stripe generic decline card. | API catches exception, rolls back DB transaction (Balance does not change). |

B. NFC Transaction Flow (Money Movement)
| Component | Test Action | Verification |
| :--- | :--- | :--- |
| Merchant Link | Ensure the Merchant in DB has a valid stripe_account_id (Connect ID). | System identifies destination account. |
| Transfer | Process a valid NFC payment. | Verify stripe.Transfer.create moves funds from Platform -> Merchant Connect Account. |
| Transfer Fail | Simulate Stripe API downtime/error during transfer. | DB transaction rolls back; User balance is not deducted. |

C. Withdrawal Flow (Money Out)
| Component | Test Action | Verification |
| :--- | :--- | :--- |
| Refund | Parent withdraws unused funds. | System locates the original stripe_charge_id from the Top-Up history and issues a Partial Refund. |

### Phase 4: Mobile App (Frontend) Testing
Tools: Jest, React Native Testing Library

Navigation Smoke Test: Verify app launches and navigates from Login -> Dashboard.

Input Validation: Ensure the Top-Up input field rejects non-numeric characters.

State Sync:

Perform a Top-Up on the backend/API.

Refresh the Mobile App Dashboard.

Verify the displayed balance updates to match the server.

NFC Interaction (Mocked):

Since physical NFC scanning is hard to automate, should create a button that injects a specific nfc_token_id to the API to simulate a physical tap.
