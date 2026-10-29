# ORZO Translation & Interpretation (የኦርዞ የትርጉም እና አስተርጓሚ መድረክ)

An institutional-grade Ethiopian Language Interpretation & Call Dispatch Platform designed for healthcare, legal courtrooms, immigration, and civil public service triage.

The work is split into three products:

1. **Field client** — Flutter app in `orozo/app`. This is the phone used at the desk.
2. **Backend** — Django API in `orozo/backend` (`/api/v1`). This is what the Flutter app calls.
3. **Web portal** — this React console (`src/`). Interpreters, supervisors, organization admins, and platform admins stay here.

Service categories each have a folder in `orozo/categories/`: healthcare, legal court, immigration, public services, humanitarian, education, and business. See `orozo/README.md`.

---

## 🌟 Key Features

1. **Role-Based Access Control & Portals**:
   - **Organization Admin Account**: Triage management, historical requests, and organization-wide usage.
   - **Common Staff Terminal Account**: Shared emergency ward and front-desk triage terminal ("everybody knows" account).
   - **Interpreter Workstation**: Live assignment alerts, availability toggle, terminology glossaries, and session room.
   - **Supervisor Hub**: Dialect assessment for unknown languages, manual dispatch override, and flagged session resolution.
   - **Platform Admin**: National Ethiopian language catalog, interpreter accreditation registry, and immutable security audit trail.

2. **Separate clients**:
   - **Web portal**: Desktop console for hospital desks, court clerks, interpreters, and administrators.
   - **Field app**: Flutter client in `orozo/app`, with its own intro and intake. It is not embedded in the web portal.

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

If port `3000` is already in use on Windows PowerShell, run the web app on another port:
```powershell
$env:PORT=3001; npm run dev
```
Then open `http://localhost:3001`.

## Deploy the web portal to Vercel

Run these commands from the repository root (`C:\Users\berna\oroz-1`):

```powershell
npm install
npm run lint
npm run build
npx vercel login
npx vercel
```

In the Vercel prompts, use the repository root as the project directory, keep the detected Vite settings, and deploy. For the production deployment:

```powershell
npx vercel --prod
```

Add these environment variables in the Vercel project settings if the corresponding services are enabled:

- `GEMINI_API_KEY` — optional Gemini fallback for ORZO Support.
- `HASAB_API_KEY` — optional Hasab AI support integration.

The web portal's built-in TypeScript API is served by `api/index.js`. The separate Django service in `orozo/backend` cannot run inside the Vercel deployment; deploy it separately and configure the web client to use that service when those Django-backed admin screens are needed.

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
