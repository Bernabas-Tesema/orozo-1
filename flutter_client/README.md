# Ethiopian Language Interpretation Platform (ELIP)

The field client now lives in [`orozo/app`](../orozo/app). This folder is the earlier draft. Use `orozo/app` with the Django API in `orozo/backend`.

## Flutter Android Client for Organizations (Hospitals, Courts, Public Agencies)

Compliant with **SRS v1.0 Section 4.2** and **AI Development Prompt Pack (Prompt 5)**.

---

### Key Capabilities
- **Direct REST Integration**: Connects via versioned REST APIs (`/api/v1/requests`, `/api/v1/languages`, `/api/v1/sessions`).
- **Urgency Classification**: Emergency Triage (bypasses unnecessary latency), High Urgency, and Standard intake.
- **Safety Protocol for Unknown Languages (SRS FR-016 & FR-017)**:
  - Checkbox for unknown or uncertain dialects.
  - Automatically routes to the human supervisor coordinator queue instead of relying on AI guesswork for clinical or judicial proceedings.
- **Staff-Assisted Speakerphone Mode (SRS 8.6)**:
  - Supports institutional speakerphone communication for patients and witnesses without personal smartphones.
- **Privacy & Security Constraints (SRS FR-027 & 7.4)**:
  - Form strictly collects minimum routing context and excludes full medical histories or national ID numbers.
  - Session recording is disabled by default.

---

### Prerequisites
- Flutter SDK `>= 3.0.0`
- Android Studio / Android SDK (API level 26+ recommended)
- Java 17+

---

### Setup & Run Commands

1. **Install Dependencies**:
   ```bash
   cd flutter_client
   flutter pub get
   ```

2. **Configure API Endpoint**:
   - For Android Emulator: `http://10.0.2.2:3000/api/v1`
   - For Physical Device on local Wi-Fi: `http://<YOUR_LOCAL_IP>:3000/api/v1`
   - Pass custom URL at build time:
     ```bash
     flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
     ```

3. **Run on Connected Emulator or Device**:
   ```bash
   flutter run
   ```

4. **Build Release APK**:
   ```bash
   flutter build apk --release
   ```
