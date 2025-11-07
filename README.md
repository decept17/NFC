# NFC-App
## The Ecosystem of Accountability: NFC Wearable Payment System

This repository contains the source code, documentation, and infrastructure scripts for the NFC-Enabled Payment System, developed as part of my final project.

The system's core function is to provide a secure, controlled, and wearable payment solution, primarily targeted at schools and family financial management.

## Project Status (Sprint 1: Infrastructure & Core Security)

Target Completion: [Date 4 weeks from now]

Key Objectives for this Phase:

1. Version Control & Repository Setup: Completed.

2. Payment Gateway Integration: Selection and sandbox key acquisition in progress.

3. Initial Data Model Definition: Core Parent-Child schema designed.

4. Authentication Scaffolding: Initial secure login/registration implemented.

Technology Stack (TBD/Initial Selection) 
| Component | Proposed Technology | Rationale |
| --- | --- | --- | 
| Mobile App (Frontend) | React Native / Flutter (TBD) | Cross-platform development speed for pilot. |
| API (Backend/Logic)| Node.js (Express) | High performance, non-blocking I/O for high transaction throughput.|
| Database | PostgreSQL / Firestore | Scalable storage for pseudonymised transaction data. |
| Version Control |  Git / GitHub | Mandatory for continuous integration and collaboration. |

## Getting Started

To clone this repository and begin development:

1. Clone the Repository:

> git clone [YOUR_GITHUB_REPO_URL] NFC-Ecosystem-of-Accountability 
> cd NFC-Ecosystem-of-Accountability


2. Environment Setup:

> Create .env files in both the api/ and mobile-app/ directories by copying the respective .env.example templates.

> CRITICAL SECURITY STEP: Fill the .env files with your non-production API keys (e.g., Payment Gateway Sandbox Key). Do NOT commit these files.

3. Install Dependencies:

> Navigate to the api/ and mobile-app/ folders and run the appropriate installation commands (e.g., npm install or pip install -r requirements.txt).