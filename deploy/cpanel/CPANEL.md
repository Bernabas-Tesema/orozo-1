# Deploy ORZO on cPanel (Django only — no Node.js)

One **Setup Python App** serves both:

- React portal (auth page for all roles) at `https://yourdomain.com/`
- JSON API at `https://yourdomain.com/api/v1/`
- Django admin at `https://yourdomain.com/admin/`

Node.js is **not** required on the server. Build the frontend on your PC, then upload.

## 1. Build frontend locally

From the repo root (needs Node only on your machine):

```bash
npm install
npm run build:web
```

This writes the SPA into `backend/frontend_dist/`.

## 2. MySQL (or SQLite)

1. Create a database and user in **MySQL Databases** (recommended), or use SQLite for low traffic.
2. Note the full names (often `cpaneluser_orzo`).

## 3. Upload backend

Upload the entire `backend/` folder (including `frontend_dist/`) via File Manager / Git / ZIP.

## 4. Setup Python App

| Field | Value |
| --- | --- |
| Python version | 3.11+ (or newest available) |
| Application root | path to `backend` |
| Application URL | `yourdomain.com` (main domain — not only `/admin`) |
| Application startup file | `passenger_wsgi.py` |
| Application Entry point | `application` |

Do **not** create a separate Node.js app for the portal.

## 5. Environment

Create / edit `backend/.env` from `backend/.env.example`.

Important for a single-domain deploy:

```env
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
CSRF_TRUSTED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
PORTAL_URL=https://yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
DB_ENGINE=mysql
DB_NAME=cpaneluser_orzo
DB_USER=cpaneluser_orzo
DB_PASSWORD=...
LIVEKIT_URL=wss://...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

## 6. Install & migrate

In the Python app terminal (or SSH):

```bash
cd ~/path/to/backend
source ~/virtualenv/path/to/backend/3.x/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
```

Restart the Python app.

## 7. Verify

| URL | Expected |
| --- | --- |
| `https://yourdomain.com/` | ORZO **auth / login** page (all roles) |
| `https://yourdomain.com/api/v1/auth/me` | `{"user":null,...}` JSON |
| `https://yourdomain.com/admin/` | Django admin only |

Demo seed password (if DB was empty on first migrate): `orzo`

## After-deploy checklist

- [ ] `DEBUG=False` and a strong `SECRET_KEY`
- [ ] `frontend_dist/index.html` exists on the server
- [ ] LiveKit keys set if calls are required
- [ ] SSL enabled for the domain
- [ ] No Node.js application pointed at the same domain

## Local smoke test (Django serves portal)

```bash
# from repo root
npm run build:web

cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Open `http://127.0.0.1:8000/` — you should see the login page, not admin.
