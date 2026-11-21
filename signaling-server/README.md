# ORZO signaling server (Node.js + `ws`)

In-memory WebSocket relay for ORZO interpretation call rooms.  
Same protocol shape as Eliotel’s `signaling-server` (join / roster / offer-answer / peer-left).

**Media note:** the Django portal uses **LiveKit** for audio/video SFU. This Node service is the Eliotel-style **signaling / data plane** (mesh WebRTC fallback, presence, chat, session-ended). You can run it next to LiveKit or use it for mesh-only deployments.

No database, no Redis — room-based JSON forwarding only.

## Protocol

| Item | Value |
|------|--------|
| Connect URL | `ws(s)://<host>/ws/call/<roomId>/` |
| Room id | Prefer Orzo shared rooms: `orzo-<requestReference>` |
| Client → server | `join`, `here`, `offer`, `answer`, `candidate`, `media-state`, `chat`, `session-ended`, `ping` |
| Roles | `client`, `interpreter`, `supervisor`, `platform_admin`, `host` |
| On disconnect | `{ "type": "peer-left", "peerId": "..." }` |
| Room cap | `MAX_PER_ROOM` (default 8) |

## Local development

```bash
cd signaling-server
npm install
npm start
# listens on http://0.0.0.0:3001
# health:  GET http://localhost:3001/health
# ws:      ws://localhost:3001/ws/call/orzo-REQ-2026-ABC/
```

Optional frontend env (when wiring a mesh client):

```bash
VITE_SIGNALING_URL=ws://localhost:3001
```

The client should append `/ws/call/<room>/` itself (origin only in env).

## Deploy on cPanel — Setup Node.js App

1. Upload the **`signaling-server/`** folder  
   (e.g. `/home/USER/signaling-server`).
2. cPanel → **Setup Node.js App** → **Create Application**:
   - **Node.js version:** 18+
   - **Application mode:** Production
   - **Application root:** `signaling-server` (folder with `server.js` + `package.json`)
   - **Application URL:** prefer a subdomain, e.g. `signal.your-orzo-domain.com`
   - **Application startup file:** `server.js`
3. **Run NPM Install**, then set env:
   - `PORT` — usually injected by cPanel
   - `ALLOWED_ORIGINS=https://your-orzo-domain.com,https://www.your-orzo-domain.com`
   - `MAX_PER_ROOM=8`
4. Restart the app and verify:
   ```bash
   curl -s https://signal.your-orzo-domain.com/health
   ```
   Expect `{ "ok": true, "service": "orzo-signaling", ... }`.

After extract you can also run:

```bash
bash cpanel_post_extract.sh
```

## Relationship to LiveKit

| Concern | Service |
|---------|---------|
| Audio / video SFU | Django + LiveKit (`LIVEKIT_*` in backend `.env`) |
| Shared room name | `orzo-<requestReference>` (portal + LiveKit token) |
| Mesh signaling / presence / chat | This Node `signaling-server` |
