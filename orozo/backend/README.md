# ORZO Django API

Client backend for the Flutter app. It serves `/api/v1` for languages, categories, requests, sessions, and feedback.

The web portal in the repository root keeps its own console server so interpreter, supervisor, and admin screens continue to run.

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

The default caller is the Tikur Anbessa triage terminal (`usr-client-common-1`). Send `X-Account-Id` to act as another seeded account.
