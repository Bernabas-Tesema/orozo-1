import json
import random
import secrets
from pathlib import Path

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Account, InterpretationRequest, InterpretationSession, Interpreter, Language, SessionFeedback

DEFAULT_ACCOUNT_ID = "usr-client-common-1"
CATEGORIES_DIR = Path(__file__).resolve().parents[2] / "categories"
VALID_CATEGORIES = {
    "healthcare",
    "legal_court",
    "immigration",
    "public_services",
    "ngo_humanitarian",
    "education",
    "business",
}


def _error(message, status):
    return JsonResponse({"error": message}, status=status)


def _body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return None


def _account(request):
    account_id = request.headers.get("X-Account-Id") or DEFAULT_ACCOUNT_ID
    account = Account.objects.filter(pk=account_id).first()
    if account is None:
        account = Account.objects.filter(pk=DEFAULT_ACCOUNT_ID).first()
    return account


def _match_interpreter(category, source_language, target_language):
    best = None
    best_score = 0
    for interpreter in Interpreter.objects.filter(availability="available", verification_state="verified"):
        if category not in (interpreter.categories or []):
            continue
        languages = interpreter.languages or []
        score = 10
        if source_language in languages:
            score += 40
        if target_language in languages:
            score += 40
        if score <= 10:
            continue
        score += int((interpreter.rating or 0) * 2)
        if score > best_score:
            best = interpreter
            best_score = score
    return best


def _open_session(request_row, interpreter):
    session_id = f"SES-{random.randint(10000, 99999)}"
    session = InterpretationSession.objects.create(
        id=session_id,
        request_reference=request_row.reference,
        session_token=secrets.token_hex(8),
        status="ready_to_join",
        communication_mode=request_row.modality,
        low_bandwidth_mode=True,
        recording_enabled=False,
        interpreter_name=interpreter.full_name,
        client_name=request_row.requester_name,
        organization_name=request_row.organization_name,
        source_language=request_row.source_language,
        target_language=request_row.target_language,
        service_category=request_row.service_category,
        connection_health="optimal",
    )
    interpreter.availability = "busy"
    interpreter.save(update_fields=["availability"])
    request_row.assigned_interpreter_id = interpreter.id
    request_row.assigned_interpreter_name = interpreter.full_name
    request_row.active_session_id = session.id
    request_row.status = "assigned"
    return session


def _dispatch(request_row):
    if request_row.is_unknown_language:
        request_row.status = "pending_coordinator"
        request_row.escalation_reason = (
            "Unknown language flagged. A coordinator reviews it. The platform does not guess the dialect."
        )
        request_row.save()
        return {"outcome": "escalated", "reason": request_row.escalation_reason}

    if request_row.schedule_type == "scheduled":
        request_row.status = "submitted"
        request_row.save()
        return {"outcome": "scheduled"}

    interpreter = _match_interpreter(
        request_row.service_category,
        request_row.source_language,
        request_row.target_language,
    )
    if interpreter is None:
        request_row.status = "matching"
        request_row.save()
        return {"outcome": "matching", "reason": "No accredited interpreter is free for this pair."}

    session = _open_session(request_row, interpreter)
    request_row.save()
    return {
        "outcome": "assigned",
        "interpreter": interpreter.to_api(),
        "sessionId": session.id,
    }


@require_http_methods(["GET"])
def home(request):
    return JsonResponse(
        {
            "service": "ORZO API",
            "status": "running",
            "base": "/api/v1",
            "endpoints": [
                "/api/v1/languages",
                "/api/v1/categories",
                "/api/v1/auth/login",
                "/api/v1/organizations",
                "/api/v1/interpreters",
                "/api/v1/requests",
            ],
        }
    )


@require_http_methods(["GET"])
def languages(request):
    rows = Language.objects.all().order_by("name")
    if request.GET.get("activeOnly") == "true":
        rows = rows.filter(is_active=True)
    return JsonResponse({"languages": [row.to_api() for row in rows]})


@require_http_methods(["GET"])
def categories(request):
    items = []
    if CATEGORIES_DIR.is_dir():
        for folder in sorted(path for path in CATEGORIES_DIR.iterdir() if path.is_dir()):
            profile_path = folder / "profile.json"
            if not profile_path.exists():
                continue
            profile = json.loads(profile_path.read_text(encoding="utf-8"))
            profile["folder"] = f"orozo/categories/{folder.name}"
            items.append(profile)
    return JsonResponse({"categories": items})


@csrf_exempt
@require_http_methods(["POST"])
def login(request):
    payload = _body(request)
    if payload is None:
        return _error("Request body must be JSON.", 400)
    email = (payload.get("email") or "").strip().lower()
    account_id = payload.get("userId")
    account = None
    if account_id:
        account = Account.objects.filter(pk=account_id).first()
    elif email:
        account = Account.objects.filter(email__iexact=email).first()
    password = payload.get("password") or ""
    if account is None or not account.password_hash or not check_password(password, account.password_hash):
        return _error("Invalid credentials.", 401)
    return JsonResponse({"success": True, "user": account.to_api(), "message": f"Logged in as {account.full_name}"})


def _platform_admin(request):
    account_id = request.headers.get("X-Account-Id")
    if not account_id:
        return None
    account = Account.objects.filter(pk=account_id, role="platform_admin", status="active").first()
    return account


def _send_credentials(organization_name, email, password):
    send_mail(
        subject="Your ORZO organization account",
        message=(
            f"An ORZO administrator registered {organization_name}.\n\n"
            "Sign in on the field app with these credentials:\n"
            f"Email: {email}\n"
            f"Password: {password}\n"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )


@csrf_exempt
@require_http_methods(["GET", "POST"])
def organizations(request):
    admin = _platform_admin(request)
    if admin is None:
        return _error("A platform admin account is required.", 403)

    if request.method == "GET":
        rows = Account.objects.filter(client_account_type="organization_admin").order_by("organization_name")
        return JsonResponse({"organizations": [row.to_api() for row in rows]})

    payload = _body(request)
    if payload is None:
        return _error("Request body must be JSON.", 400)
    organization_name = (payload.get("organizationName") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    contact_name = (payload.get("contactName") or "").strip() or f"{organization_name} Admin"
    if not organization_name or not email or len(password) < 6:
        return _error("Organization name, email, and a password of at least 6 characters are required.", 400)
    if Account.objects.filter(email__iexact=email).exists():
        return _error("An account with this email already exists.", 409)
    if Account.objects.filter(organization_name__iexact=organization_name, client_account_type="organization_admin").exists():
        return _error("This organization is already registered.", 409)

    account = Account.objects.create(
        id=f"usr-org-{secrets.token_hex(4)}",
        email=email,
        full_name=contact_name,
        role="client",
        client_account_type="organization_admin",
        phone=(payload.get("phone") or "").strip(),
        organization_name=organization_name,
        status="active",
        password_hash=make_password(password),
    )
    try:
        _send_credentials(organization_name, email, password)
    except Exception:
        account.delete()
        return _error("The account was not saved because the credential email could not be sent.", 502)
    return JsonResponse(
        {
            "success": True,
            "organization": account.to_api(),
            "message": f"Credentials were sent to {email}.",
        },
        status=201,
    )


@csrf_exempt
@require_http_methods(["GET", "POST"])
def interpreters(request):
    if request.method == "GET":
        rows = Interpreter.objects.all().order_by("full_name")
        return JsonResponse({"interpreters": [row.to_api() for row in rows]})

    admin = _platform_admin(request)
    if admin is None:
        return _error("A platform admin account is required.", 403)
    payload = _body(request)
    if payload is None:
        return _error("Request body must be JSON.", 400)
    full_name = (payload.get("fullName") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    if not full_name or not email:
        return _error("Interpreter name and email are required.", 400)
    if Interpreter.objects.filter(email__iexact=email).exists():
        return _error("An interpreter with this email is already stored.", 409)
    languages = payload.get("languages") or []
    categories = payload.get("categories") or []
    if isinstance(languages, str):
        languages = [part.strip() for part in languages.split(",") if part.strip()]
    if isinstance(categories, str):
        categories = [part.strip() for part in categories.split(",") if part.strip()]
    unknown = [item for item in categories if item not in VALID_CATEGORIES]
    if unknown:
        return _error("Unknown service category.", 400)
    interpreter = Interpreter.objects.create(
        id=f"int-{secrets.token_hex(4)}",
        full_name=full_name,
        phone=(payload.get("phone") or "").strip(),
        email=email,
        languages=languages,
        categories=categories,
        availability="available",
        verification_state="verified",
        rating=float(payload.get("rating") or 4.8),
    )
    return JsonResponse({"success": True, "interpreter": interpreter.to_api()}, status=201)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def requests_collection(request):
    account = _account(request)
    if account is None:
        return _error("No client account is seeded. Run python manage.py seed.", 503)

    if request.method == "GET":
        rows = InterpretationRequest.objects.all()
        if account.role == "client":
            rows = rows.filter(requester_id=account.id)
        status = request.GET.get("status")
        urgency = request.GET.get("urgency")
        category = request.GET.get("category")
        if status:
            rows = rows.filter(status=status)
        if urgency:
            rows = rows.filter(urgency=urgency)
        if category:
            rows = rows.filter(service_category=category)
        return JsonResponse({"requests": [row.to_api() for row in rows]})

    payload = _body(request)
    if payload is None:
        return _error("Request body must be JSON.", 400)

    category = payload.get("serviceCategory")
    if category not in VALID_CATEGORIES:
        return _error("Service category is required.", 400)
    is_unknown = bool(payload.get("isUnknownLanguage"))
    source = payload.get("sourceLanguage")
    if not is_unknown and not source:
        return _error("Source language is required or flag as unknown language.", 400)
    context = (payload.get("minRoutingContext") or "").strip()
    if len(context) < 5:
        return _error("Minimum context is required (purpose of interpretation).", 400)

    now = timezone.now()
    reference = f"REQ-2026-{random.randint(10000, 99999)}"
    while InterpretationRequest.objects.filter(pk=reference).exists():
        reference = f"REQ-2026-{random.randint(10000, 99999)}"

    row = InterpretationRequest.objects.create(
        reference=reference,
        requester_id=account.id,
        requester_name=account.full_name,
        requester_phone=account.phone,
        organization_name=account.organization_name,
        source_language="unknown" if is_unknown else source,
        target_language=payload.get("targetLanguage") or "amh",
        is_unknown_language=is_unknown,
        unknown_language_notes=payload.get("unknownLanguageNotes") or "",
        service_category=category,
        urgency=payload.get("urgency") or "standard",
        modality=payload.get("modality") or "audio",
        schedule_type=payload.get("scheduleType") or "immediate",
        scheduled_time=payload.get("scheduledTime"),
        status="matching",
        min_routing_context=context,
        created_at=now,
        updated_at=now,
    )
    dispatch = _dispatch(row)
    row.refresh_from_db()
    return JsonResponse({"request": row.to_api(), "dispatch": dispatch}, status=201)


@csrf_exempt
@require_http_methods(["POST"])
def cancel_request(request, reference):
    account = _account(request)
    row = InterpretationRequest.objects.filter(pk=reference).first()
    if row is None:
        return _error("Request not found.", 404)
    if row.status in {"completed", "cancelled"}:
        return _error(f"Cannot cancel request in status: {row.status}", 400)
    payload = _body(request) or {}
    row.status = "cancelled"
    row.cancellation_reason = payload.get("reason") or "Cancelled by requester"
    row.updated_at = timezone.now()
    if row.active_session_id:
        InterpretationSession.objects.filter(pk=row.active_session_id).update(status="cancelled")
    if row.assigned_interpreter_id:
        Interpreter.objects.filter(pk=row.assigned_interpreter_id).update(availability="available")
    row.save()
    if account is None:
        pass
    return JsonResponse({"success": True, "request": row.to_api(), "message": "Request cancelled successfully"})


@require_http_methods(["GET"])
def session_detail(request, session_id):
    session = InterpretationSession.objects.filter(pk=session_id).first()
    if session is None:
        return _error("Session not found.", 404)
    return JsonResponse({"session": session.to_api()})


@csrf_exempt
@require_http_methods(["POST"])
def end_session(request, session_id):
    session = InterpretationSession.objects.filter(pk=session_id).first()
    if session is None:
        return _error("Session not found.", 404)
    session.status = "completed"
    session.save(update_fields=["status"])
    request_row = InterpretationRequest.objects.filter(pk=session.request_reference).first()
    if request_row is not None:
        request_row.status = "completed"
        request_row.updated_at = timezone.now()
        request_row.save(update_fields=["status", "updated_at"])
        if request_row.assigned_interpreter_id:
            Interpreter.objects.filter(pk=request_row.assigned_interpreter_id).update(availability="available")
    return JsonResponse({"success": True, "session": session.to_api()})


@csrf_exempt
@require_http_methods(["POST"])
def feedback(request):
    payload = _body(request)
    if payload is None:
        return _error("Request body must be JSON.", 400)
    session_id = payload.get("sessionId")
    if not session_id or not InterpretationSession.objects.filter(pk=session_id).exists():
        return _error("Session not found.", 404)
    rating = int(payload.get("rating") or 0)
    if rating < 1 or rating > 5:
        return _error("Rating must be between 1 and 5.", 400)
    note = SessionFeedback.objects.create(
        session_id=session_id,
        rating=rating,
        comment=(payload.get("comment") or "").strip(),
    )
    return JsonResponse({"success": True, "feedbackId": note.id})
