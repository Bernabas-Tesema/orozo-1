# ORZO Translation & Interpretation (የኦርዞ የትርጉም እና አስተርጓሚ መድረክ)

An institutional-grade Ethiopian Language Interpretation & Call Dispatch Platform designed for healthcare, legal courtrooms, immigration, and civil public service triage.

---

## 🌟 Key Features

1. **Role-Based Access Control & Portals**:
   - **Organization Admin Account**: Triage management, historical requests, and organization-wide usage.
   - **Common Staff Terminal Account**: Shared emergency ward and front-desk triage terminal ("everybody knows" account).
   - **Interpreter Workstation**: Live assignment alerts, availability toggle, terminology glossaries, and session room.
   - **Supervisor Hub**: Dialect assessment for unknown languages, manual dispatch override, and flagged session resolution.
   - **Platform Admin**: National Ethiopian language catalog, interpreter accreditation registry, and immutable security audit trail.

2. **Dual Client Interfaces**:
   - **Web Platform Console**: Full-featured desktop portal for hospital triage desks, court clerks, and administrative coordinators.
   - **Android Mobile Terminal App**: Interactive field device view with low-bandwidth 16kbps resilience, emergency dispatch, and staff-assisted speakerphone.

3. **ORZO Customer Support & Audio Dialect Identifier**:
   - Spoken audio recorder that captures patient speech and detects dialect characteristics across Amharic, Afaan Oromoo, Tigrinya, Somali, Sidama, Wolaytta, etc.
   - Conversational assistant powered by the custom ORZO knowledge base for clinical triage rules, court workflows, and dispatch instructions.

4. **Security & Confidentiality Standards**:
   - No patient recording by default to protect high-stakes medical and judicial confidentiality.
   - Human-in-the-loop coordinator escalation without automated guessing for unknown dialects.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```
Provide your Gemini / Hasab AI credentials if desired.

### 3. Start Development Server
```bash
npm run dev
```
The server will boot on port `3000` with Express backend and Vite frontend mounted concurrently.

---

## 📂 Project Structure

```
ORZO Translation & Interpretation/
├── server/
│   ├── db.ts                      # In-memory institutional database & initial seed users
│   ├── routes.ts                  # REST API endpoints (/api/v1/*)
│   ├── orzoSupportService.ts       # Customer support & dialect identification engine
│   └── types.ts                   # Backend type definitions
├── src/
│   ├── components/
│   │   ├── LoginPage.tsx          # 1-click role-based login portal
│   │   ├── Header.tsx             # Global blue-themed navigation with web/android switcher
│   │   ├── ClientPortal.tsx       # Web intake console for organization admin and common terminal
│   │   ├── AndroidClientApp.tsx   # Android mobile terminal for field institutions
│   │   ├── InterpreterPortal.tsx  # Workstation for accredited interpreters
│   │   ├── SupervisorWorkspace.tsx# Coordinator hub for unknown languages & dispatch
│   │   ├── PlatformAdminPortal.tsx# Governance, language catalog & audit logs
│   │   ├── LiveSessionRoom.tsx    # Audio/video session room with speakerphone assist
│   │   ├── OrzoSupportModal.tsx   # Customer support & audio voice identifier modal
│   │   └── ...
│   ├── api.ts                     # Strongly typed API client
│   ├── App.tsx                    # Top-level application controller
│   └── types.ts                   # Unified TypeScript definitions
├── server.ts                      # Express server entry point mounting Vite
├── package.json
└── vite.config.ts
```
