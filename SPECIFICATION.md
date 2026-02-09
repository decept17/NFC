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

## 3. Test Plan
### Manual Tests
1.  **Provisioning:** Manually insert a user into DB with balance $100.
2.  **Spending:** Call API with Postman to spend $50. Check DB balance is $50.
3.  **Overdraft:** Call API to spend $60. Expect HTTP 400 Error.

### Automated Tests (Future Scope)
* Jest unit tests for `TransactionService`.
* Supertest for Express Routes.