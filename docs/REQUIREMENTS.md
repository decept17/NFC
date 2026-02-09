# Business Requirements Document (BRD)
## Project: Secure NFC Wearable for Controlled Financial Management

## Vision Statement:
For parents who care about their childrens finiacial growth. N3XO is a wearable NFC band with a customary app allowing parents to add funds, withdraw and monitor their childrens spending. Unlike other NFC technology, we give the parents full control and an alternative to the traditional tap to pay systems requiring both phones and bank cards. 


## 1. Business Context & Motivation
**Why this project exists:**
There is a growing need for digital financial tools tailored for children that allow parents to monitor and influence child spending. Traditional banking often lacks real parental controls, and carrying cash is insecure and difficult to track. This app will provide as a great alternative to those who want to track, control and monitor thier children without the need to get them bank accounts.

This system provides a "Closed-Loop" or "Managed" Cashless Payment Solution where:

PArents maintain full oversight of funds.

Children gain financial independence via a wearable NFC token (wristband) without needing a smartphone at the point of sale.

Institutions (schools) can offer a transparent transaction environment.

Primary Goal: To design, develop, and validate a secure system that combines a mobile application for management with an NFC wearable for payments.

## 2. Scope & Limitations

**2.1 In-Scope (The "MVP")**
Wearable Token: Integration with a durable, waterproof NFC wristband for contactless payments.

Mobile Application: A front-end interface for Parents (management) and Children (view-only/request).

Parent-Child Account Model: Hierarchical account structure allowing one parent to manage multiple child wallets.

Financial Controls:

Instant top-ups and scheduled "allowance" automation.

Category-based blocking (e.g., blocking alcohol or gambling merchants).

Daily/Weekly spending limits.

Security:

Biometric authentication for app access.

Remote "Freeze" to instantly deactivate a lost wristband.

**2.2 Out-of-Scope (for this phase)**

Physical POS Hardware: The project assumes integration with existing NFC readers or a specific test merchant app, rather than manufacturing payment terminals.   

Further security: Inital MVP will not use NTAG 424 DNA's ability to generate a new unique signature upon every scan.

Customizable app: Wont be able to customize backgrounds or features.

Withdrawl: Withdrawls of exact amounts will not be able on inital release.

Replacement Worflow: The ability to unlink and relink a new band is out of scope.