"""Portal JSON API under /api/v1 — powers the React SPA without Node.js."""

from __future__ import annotations

import json
import logging
import secrets
from typing import Any, Optional

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, OperationalError, transaction
from django.http import HttpRequest, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

logger = logging.getLogger(__name__)

from . import portal_dispatch as dispatch
from .models import (
    Account,
    Assignment,
    CompletionReport,
    Feedback,
    InterpretationRequest,
    InterpretationSession,
    Interpreter,
    Language,
    Meeting,
    MeetingParticipant,
    PlatformSettings,
    WebSession,
)

DEFAULT_SETTINGS = {
    "assignmentTimeoutSeconds": 45,
    "maxAutoRetries": 3,
    "emergencyPriorityBypass": True,
    "allowDirectRecording": False,
    "maintenanceMode": False,
    "telecomLowBandwidthPreset": True,
    "systemBannerNotice": "",
}


def _body(request: HttpRequest) -> dict:
    if not request.body:
        return {}
    try:
        data = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def _error(message: str, status: int = 400) -> JsonResponse:
    return JsonResponse({"error": message}, status=status)


def _clip(value: Any, limit: int) -> str:
    return str(value or "")[:limit]


def _normalize_code_list(raw: Any) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, str):
        return [part.strip() for part in raw.split(",") if part.strip()]
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        if isinstance(item, dict):
            code = item.get("languageCode") or item.get("code") or item.get("name")
            if code:
                out.append(str(code).strip())
        else:
            text = str(item or "").strip()
            if text:
                out.append(text)
    return out


def _require_email(value: str) -> Optional[str]:
    email = str(value or "").strip().lower()
    if not email:
        return "Email is required."
    try:
        validate_email(email)
    except ValidationError:
        return "Enter a valid email address."
    return None


def _db_create_error(exc: Exception) -> JsonResponse:
    message = str(exc)
    logger.exception("Account create failed: %s", message)
    lowered = message.lower()
    if "must_change_password" in lowered or "no such column" in lowered or "unknown column" in lowered:
        return _error(
            "Database is missing portal account columns. Run: python manage.py migrate",
            500,
        )
    if "unique" in lowered or "duplicate" in lowered:
        return _error("That email is already registered. Use a different email.", 400)
    return _error("Could not create the account. Please try again.", 500)


def _account_json(account: Account) -> dict:
    return {
        "id": account.id,
        "email": account.email,
        "fullName": account.full_name,
        "role": account.role,
        "clientAccountType": account.client_account_type or None,
        "phone": account.phone or "",
        "organizationName": account.organization_name or "",
        "status": account.status,
        "createdAt": account.created_at.isoformat() if account.created_at else timezone.now().isoformat(),
        "mustChangePassword": bool(account.must_change_password),
    }


def _interpreter_json(interp: Interpreter, user_id: Optional[str] = None) -> dict:
    linked = user_id
    if not linked:
        account = Account.objects.filter(email__iexact=interp.email).first()
        linked = account.id if account else interp.id
    live = (
        InterpretationSession.objects.filter(interpreter_id=interp.id)
        .exclude(status__in=("completed", "cancelled", "expired"))
        .order_by("-id")
        .first()
    )
    completed = InterpretationSession.objects.filter(
        interpreter_id=interp.id, status="completed"
    ).count()
    lang_codes = sorted(dispatch._lang_codes(interp.languages))
    categories = sorted(dispatch._category_codes(interp.categories)) or list(interp.categories or [])
    return {
        "id": interp.id,
        "userId": linked,
        "fullName": interp.full_name,
        "phone": interp.phone or "",
        "email": interp.email,
        "supportedLanguages": [
            {
                "languageCode": code,
                "proficiency": "professional",
                "pairDirection": "bidirectional",
            }
            for code in lang_codes
        ],
        "serviceCategories": categories,
        "qualifications": [],
        "verificationState": interp.verification_state,
        "availability": interp.availability,
        "rating": interp.rating,
        "totalSessionsCompleted": completed,
        "activeSessionId": live.id if live else None,
    }


def _request_json(item: InterpretationRequest) -> dict:
    return {
        "reference": item.reference,
        "requesterId": item.requester_id,
        "requesterName": item.requester_name,
        "organizationName": item.organization_name,
        "sourceLanguage": item.source_language,
        "targetLanguage": item.target_language,
        "isUnknownLanguage": item.is_unknown_language,
        "unknownLanguageNotes": item.unknown_language_notes,
        "serviceCategory": item.service_category,
        "urgency": item.urgency,
        "modality": item.modality,
        "scheduleType": item.schedule_type,
        "scheduledTime": item.scheduled_time,
        "status": item.status,
        "minRoutingContext": item.min_routing_context,
        "createdAt": item.created_at.isoformat() if item.created_at else None,
        "assignedInterpreterName": item.assigned_interpreter_name,
        "assignedInterpreterId": item.assigned_interpreter_id,
        "activeSessionId": item.active_session_id,
        "escalationReason": item.escalation_reason,
    }


def _session_json(session: InterpretationSession) -> dict:
    return {
        "id": session.id,
        "requestReference": session.request_reference,
        "sessionToken": session.session_token,
        "status": session.status,
        "communicationMode": session.communication_mode,
        "lowBandwidthMode": session.low_bandwidth_mode,
        "recordingEnabled": session.recording_enabled,
        "durationSeconds": session.duration_seconds,
        "interpreterId": session.interpreter_id,
        "interpreterName": session.interpreter_name,
        "clientId": session.client_id,
        "clientName": session.client_name,
        "organizationName": session.organization_name,
        "sourceLanguage": session.source_language,
        "targetLanguage": session.target_language,
        "serviceCategory": session.service_category,
        "connectionHealth": session.connection_health,
        "authorizedParticipantIds": session.authorized_participant_ids or [],
        "callRoom": dispatch.resolve_call_room(session),
    }


def _language_json(lang: Language) -> dict:
    return {
        "code": lang.code,
        "name": lang.name,
        "nativeName": lang.native_name,
        "script": lang.script,
        "variants": lang.variants,
        "isActive": lang.is_active,
    }


def _bearer_token(request: HttpRequest) -> Optional[str]:
    auth = request.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        return auth[7:].strip() or None
    return None


def _account_from_request(request: HttpRequest) -> Optional[Account]:
    token = _bearer_token(request)
    if not token:
        return None
    session = WebSession.objects.select_related("account").filter(token=token).first()
    if not session or session.account.status != "active":
        return None
    WebSession.objects.filter(pk=token).update(last_seen_at=timezone.now())
    return session.account


def _open_session(account: Account) -> str:
    token = secrets.token_urlsafe(32)
    WebSession.objects.create(token=token, account=account)
    return token


def _settings_payload() -> dict:
    row = PlatformSettings.objects.filter(pk=1).first()
    return row.to_api() if row else dict(DEFAULT_SETTINGS)


def _profile_for_account(account: Account) -> Optional[dict]:
    if account.role != "interpreter":
        return None
    # Prefer an available profile when duplicates exist for the same email.
    interps = list(Interpreter.objects.filter(email__iexact=account.email))
    if not interps:
        return None
    interps.sort(
        key=lambda row: (
            0 if row.availability == "available" else 1 if row.availability != "busy" else 2,
            -(row.rating or 0),
        )
    )
    return _interpreter_json(interps[0], user_id=account.id)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


@csrf_exempt
@require_http_methods(["GET"])
def auth_me(request: HttpRequest) -> JsonResponse:
    account = _account_from_request(request)
    if not account:
        return JsonResponse({"user": None, "interpreterProfile": None})
    return JsonResponse({"user": _account_json(account), "interpreterProfile": _profile_for_account(account)})


@csrf_exempt
@require_http_methods(["GET"])
def users_list(_request: HttpRequest) -> JsonResponse:
    users = [_account_json(a) for a in Account.objects.order_by("full_name")]
    return JsonResponse({"users": users})


@csrf_exempt
@require_http_methods(["POST"])
def auth_login(request: HttpRequest) -> JsonResponse:
    data = _body(request)
    email = str(data.get("email") or "").strip().lower()
    user_id = str(data.get("userId") or "").strip()
    password = str(data.get("password") or "")

    account = None
    if email:
        account = Account.objects.filter(email__iexact=email).first()
    elif user_id:
        account = Account.objects.filter(pk=user_id).first()

    if account is None or account.status != "active" or not check_password(password, account.password_hash):
        return _error("Invalid email or password.", 401)

    # Interpreters logging in become available so they can receive direct rings.
    # Update every profile row for this email (duplicates exist in some installs).
    # Do NOT exclude "busy" — a previous call may have ended without resetting
    # availability, leaving the interpreter permanently stuck.
    if account.role == "interpreter":
        Interpreter.objects.filter(email__iexact=account.email).update(availability="available")

    token = _open_session(account)
    return JsonResponse(
        {
            "success": True,
            "token": token,
            "user": _account_json(account),
            "interpreterProfile": _profile_for_account(account),
            "message": f"Logged in as {account.full_name}",
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def auth_logout(request: HttpRequest) -> JsonResponse:
    token = _bearer_token(request)
    if token:
        WebSession.objects.filter(pk=token).delete()
    return JsonResponse({"success": True, "message": "Signed out"})


@csrf_exempt
@require_http_methods(["POST"])
def auth_change_password(request: HttpRequest) -> JsonResponse:
    account = _account_from_request(request)
    if not account:
        return _error("Authentication required", 401)
    data = _body(request)
    current_password = str(data.get("currentPassword") or "")
    next_password = str(data.get("nextPassword") or "")
    if not check_password(current_password, account.password_hash):
        return _error("Current password is incorrect.", 401)
    if len(next_password) < 8:
        return _error("New password must be at least 8 characters.", 400)
    account.password_hash = make_password(next_password)
    account.must_change_password = False
    account.save(update_fields=["password_hash", "must_change_password"])
    return JsonResponse(
        {
            "success": True,
            "user": _account_json(account),
            "message": "Password updated",
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def auth_setup_password(request: HttpRequest) -> JsonResponse:
    data = _body(request)
    email = str(data.get("email") or "").strip().lower()
    current_password = str(data.get("currentPassword") or "")
    next_password = str(data.get("nextPassword") or "")
    account = Account.objects.filter(email__iexact=email).first()
    if account is None or not check_password(current_password, account.password_hash):
        return _error("The email or temporary password is not correct.", 401)
    if len(next_password) < 8:
        return _error("New password must be at least 8 characters.", 400)
    account.password_hash = make_password(next_password)
    account.must_change_password = False
    account.save(update_fields=["password_hash", "must_change_password"])
    token = _open_session(account)
    return JsonResponse(
        {
            "success": True,
            "token": token,
            "user": _account_json(account),
            "interpreterProfile": _profile_for_account(account),
            "message": "Password set",
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def auth_switch_role(request: HttpRequest) -> JsonResponse:
    """Dev/admin helper: switch to another account (platform admin only)."""
    actor = _account_from_request(request)
    if not actor or actor.role != "platform_admin":
        return _error("Only platform admins can switch roles.", 403)
    user_id = str(_body(request).get("userId") or "")
    account = Account.objects.filter(pk=user_id).first()
    if not account:
        return _error("User not found", 404)
    token = _open_session(account)
    # Replace actor session
    old = _bearer_token(request)
    if old:
        WebSession.objects.filter(pk=old).delete()
    return JsonResponse(
        {
            "success": True,
            "token": token,
            "user": _account_json(account),
            "interpreterProfile": _profile_for_account(account),
            "message": f"Switched to {account.full_name}",
        }
    )


# ---------------------------------------------------------------------------
# Catalog / workspace data
# ---------------------------------------------------------------------------


@csrf_exempt
@require_http_methods(["GET", "POST"])
def languages(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        active_only = request.GET.get("activeOnly") == "true"
        qs = Language.objects.all().order_by("name")
        if active_only:
            qs = qs.filter(is_active=True)
        return JsonResponse({"languages": [_language_json(lang) for lang in qs]})

    account = _account_from_request(request)
    if not account or account.role != "platform_admin":
        return _error("Platform admin required", 403)
    data = _body(request)
    code = str(data.get("code") or "").strip()
    if not code:
        return _error("code is required")
    lang, _ = Language.objects.update_or_create(
        code=code,
        defaults={
            "name": data.get("name") or code,
            "native_name": data.get("nativeName") or data.get("name") or code,
            "script": data.get("script") or "Latin",
            "variants": data.get("variants") or [],
            "is_active": bool(data.get("isActive", True)),
        },
    )
    return JsonResponse({"language": _language_json(lang)}, status=201)


@csrf_exempt
@require_http_methods(["PATCH"])
def language_detail(request: HttpRequest, code: str) -> JsonResponse:
    account = _account_from_request(request)
    if not account or account.role != "platform_admin":
        return _error("Platform admin required", 403)
    lang = Language.objects.filter(pk=code).first()
    if not lang:
        return _error("Language not found", 404)
    data = _body(request)
    if "name" in data:
        lang.name = data["name"]
    if "nativeName" in data:
        lang.native_name = data["nativeName"]
    if "script" in data:
        lang.script = data["script"]
    if "variants" in data:
        lang.variants = data["variants"] or []
    if "isActive" in data:
        lang.is_active = bool(data["isActive"])
    lang.save()
    return JsonResponse({"language": _language_json(lang)})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def interpreters(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        qs = Interpreter.objects.all().order_by("full_name")
        category = request.GET.get("category")
        language = request.GET.get("language")
        availability = request.GET.get("availability")
        verification = request.GET.get("verification")
        items = []
        for interp in qs:
            if category and category not in (interp.categories or []):
                continue
            if language and language not in (interp.languages or []):
                continue
            if availability and interp.availability != availability:
                continue
            if verification and interp.verification_state != verification:
                continue
            items.append(_interpreter_json(interp))
        return JsonResponse({"interpreters": items})
    account = _account_from_request(request)
    if not account or account.role not in ("platform_admin", "supervisor"):
        return _error("Not authorized", 403)
    data = _body(request)
    email = str(data.get("email") or "").strip().lower()
    full_name = _clip(data.get("fullName"), 160).strip()
    password = str(data.get("password") or "")
    phone = _clip(data.get("phone") or data.get("extension") or "", 32)
    email_error = _require_email(email)
    if email_error:
        return _error(email_error)
    if not full_name:
        return _error("Full name is required.")
    if len(password) < 6:
        return _error("Password must be at least 6 characters.")
    if Account.objects.filter(email__iexact=email).exists():
        return _error("That email is already registered. Use a different email.", 400)

    langs = _normalize_code_list(data.get("languages") or data.get("supportedLanguages"))
    categories = _normalize_code_list(data.get("categories") or data.get("serviceCategories"))
    interp_id = f"int-{secrets.token_hex(3)}"
    user_id = f"usr-interp-{secrets.token_hex(3)}"
    try:
        with transaction.atomic():
            interp = Interpreter.objects.create(
                id=interp_id,
                full_name=full_name,
                phone=phone,
                email=email,
                languages=langs,
                categories=categories,
                availability="available",
                verification_state=data.get("verificationState") or "verified",
                rating=0,
            )
            Account.objects.create(
                id=user_id,
                email=email,
                full_name=full_name,
                role="interpreter",
                phone=phone,
                organization_name="ORZO Interpreters",
                status="active",
                password_hash=make_password(password),
                must_change_password=True,
            )
    except (IntegrityError, OperationalError, ValidationError) as exc:
        return _db_create_error(exc)
    return JsonResponse(
        {
            "interpreter": _interpreter_json(interp, user_id=user_id),
            "message": f"Interpreter {full_name} created",
        },
        status=201,
    )


@csrf_exempt
@require_http_methods(["GET", "PATCH"])
def interpreter_detail(request: HttpRequest, interpreter_id: str) -> JsonResponse:
    interp = Interpreter.objects.filter(pk=interpreter_id).first()
    if not interp:
        return _error("Interpreter not found", 404)
    if request.method == "GET":
        return JsonResponse({"interpreter": _interpreter_json(interp)})
    account = _account_from_request(request)
    if not account:
        return _error("Authentication required", 401)
    data = _body(request)
    if "availability" in data:
        interp.availability = data["availability"]
    if "verificationState" in data:
        interp.verification_state = data["verificationState"]
    if "fullName" in data:
        interp.full_name = data["fullName"]
    if "phone" in data:
        interp.phone = data["phone"]
    if "languages" in data:
        langs = data["languages"] or []
        if langs and isinstance(langs[0], dict):
            langs = [row.get("languageCode") or row.get("code") for row in langs]
        interp.languages = langs
    if "categories" in data or "serviceCategories" in data:
        interp.categories = data.get("categories") or data.get("serviceCategories") or []
    interp.save()
    return JsonResponse({"interpreter": _interpreter_json(interp)})


@csrf_exempt
@require_http_methods(["PATCH"])
def interpreter_verification(request: HttpRequest, interpreter_id: str) -> JsonResponse:
    account = _account_from_request(request)
    if not account or account.role not in ("platform_admin", "supervisor"):
        return _error("Not authorized", 403)
    interp = Interpreter.objects.filter(pk=interpreter_id).first()
    if not interp:
        return _error("Interpreter not found", 404)
    state = str(_body(request).get("verificationState") or "").strip()
    if not state:
        return _error("verificationState is required")
    interp.verification_state = state
    interp.save(update_fields=["verification_state"])
    return JsonResponse(
        {
            "interpreter": _interpreter_json(interp),
            "message": f"Verification set to {state}",
        }
    )


@csrf_exempt
@require_http_methods(["GET"])
def interpreter_reviews(request: HttpRequest, interpreter_id: str) -> JsonResponse:
    interp = Interpreter.objects.filter(pk=interpreter_id).first()
    if not interp:
        return _error("Interpreter not found", 404)
    comments = [
        {
            "rating": fb.rating,
            "comment": fb.comment,
            "submittedAt": fb.submitted_at.isoformat() if fb.submitted_at else None,
            "requestReference": fb.request_reference,
        }
        for fb in Feedback.objects.filter(interpreter_id=interpreter_id).order_by("-submitted_at")[:50]
    ]
    return JsonResponse({"rating": interp.rating, "comments": comments})


@csrf_exempt
@require_http_methods(["PATCH"])
def availability(request: HttpRequest) -> JsonResponse:
    account = _account_from_request(request)
    if not account or account.role != "interpreter":
        return _error("Interpreter authentication required", 401)
    value = str(_body(request).get("availability") or "")
    if value not in ("available", "busy", "offline"):
        return _error("Invalid availability")
    Interpreter.objects.filter(email__iexact=account.email).update(availability=value)
    if value == "available":
        dispatch.reroute_waiting_requests()
    return JsonResponse({"success": True, "availability": value})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def requests_collection(request: HttpRequest) -> JsonResponse:
    account = _account_from_request(request)
    if request.method == "GET":
        qs = InterpretationRequest.objects.all().order_by("-created_at")
        if account and account.role == "client":
            qs = qs.filter(requester_id=account.id)
        status = request.GET.get("status")
        urgency = request.GET.get("urgency")
        category = request.GET.get("category")
        if status:
            qs = qs.filter(status=status)
        if urgency:
            qs = qs.filter(urgency=urgency)
        if category:
            qs = qs.filter(service_category=category)
        return JsonResponse({"requests": [_request_json(r) for r in qs]})

    if not account:
        return _error("Sign in required", 401)
    data = _body(request)
    if not data.get("serviceCategory"):
        return _error("Service category is required")
    if not data.get("isUnknownLanguage") and not data.get("sourceLanguage"):
        return _error("Source language is required or flag as unknown language")
    context = str(data.get("minRoutingContext") or "").strip()
    if len(context) < 5:
        return _error("Minimum context is required (purpose of interpretation)")

    now = timezone.now()
    schedule_type = data.get("scheduleType") or "immediate"
    item = InterpretationRequest.objects.create(
        reference=f"REQ-{now.year}-{secrets.token_hex(3).upper()}",
        requester_id=account.id,
        requester_name=account.full_name,
        requester_phone=account.phone,
        organization_name=account.organization_name,
        source_language=("unknown" if data.get("isUnknownLanguage") else (data.get("sourceLanguage") or "unknown")),
        target_language=data.get("targetLanguage") or "amh",
        is_unknown_language=bool(data.get("isUnknownLanguage")),
        unknown_language_notes=data.get("unknownLanguageNotes") or "",
        service_category=data.get("serviceCategory") or "healthcare",
        urgency=data.get("urgency") or "standard",
        modality=data.get("modality") or "audio",
        schedule_type=schedule_type,
        scheduled_time=data.get("scheduledTime"),
        status="matching" if schedule_type == "immediate" else "submitted",
        min_routing_context=context,
        created_at=now,
        updated_at=now,
    )
    dispatch_result = None
    if schedule_type == "immediate":
        dispatch_result = dispatch.try_auto_dispatch(item)
        item.refresh_from_db()
    return JsonResponse({"request": _request_json(item), "dispatch": dispatch_result}, status=201)


@csrf_exempt
@require_http_methods(["GET"])
def request_detail(request: HttpRequest, reference: str) -> JsonResponse:
    item = InterpretationRequest.objects.filter(pk=reference).first()
    if not item:
        return _error("Request not found", 404)
    session = InterpretationSession.objects.filter(request_reference=reference).first()
    assignments = [a.to_api() for a in Assignment.objects.filter(request_reference=reference).order_by("-assigned_at")]
    candidates = []
    for idx, interp in enumerate(dispatch.find_candidates(item)[:8]):
        candidates.append(
            {
                "id": interp.id,
                "name": interp.full_name,
                "score": 100 - idx * 5,
                "reasons": ["language", "availability"],
                "availability": interp.availability,
            }
        )
    return JsonResponse(
        {
            "request": _request_json(item),
            "session": _session_json(session) if session else None,
            "assignments": assignments,
            "eligibleCandidates": candidates,
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def cancel_request(request: HttpRequest, reference: str) -> JsonResponse:
    item = InterpretationRequest.objects.filter(pk=reference).first()
    if not item:
        return _error("Request not found", 404)
    account = _account_from_request(request)
    if account and account.role == "client" and item.requester_id != account.id:
        return _error("Request not found", 404)
    if item.status in ("completed", "cancelled"):
        return _error(f"Cannot cancel request in status: {item.status}")
    item.status = "cancelled"
    item.cancellation_reason = str(_body(request).get("reason") or "Cancelled by requester")
    item.updated_at = timezone.now()
    item.save(update_fields=["status", "cancellation_reason", "updated_at"])
    InterpretationSession.objects.filter(request_reference=reference).exclude(
        status__in=("completed", "cancelled")
    ).update(status="cancelled")
    Assignment.objects.filter(request_reference=reference, outcome="pending").update(
        outcome="expired", responded_at=timezone.now()
    )
    return JsonResponse({"success": True, "request": _request_json(item), "message": "Cancelled"})


@csrf_exempt
@require_http_methods(["GET"])
def assignments(request: HttpRequest) -> JsonResponse:
    account = _account_from_request(request)
    if not account:
        return _error("Sign in required", 401)
    qs = Assignment.objects.all().order_by("-assigned_at")
    if account.role == "interpreter":
        # One account may have multiple Interpreter rows — include all ids.
        interp_ids = list(
            Interpreter.objects.filter(email__iexact=account.email).values_list("id", flat=True)
        )
        if interp_ids:
            qs = qs.filter(interpreter_id__in=interp_ids)
            pending_only = str(request.GET.get("pending") or "").lower() in ("1", "true", "yes")
            if pending_only:
                qs = qs.filter(outcome="pending")
        else:
            qs = qs.none()
    # Cap payload so supervisors don't choke on huge history.
    qs = qs[:200]
    try:
        payload = [a.to_api() for a in qs]
    except Exception:
        logger.exception("assignments serialization failed")
        return _error("Could not load assignments", 500)
    return JsonResponse({"assignments": payload})


@csrf_exempt
@require_http_methods(["POST"])
def assignment_respond(request: HttpRequest, assignment_id: str) -> JsonResponse:
    account = _account_from_request(request)
    if not account or account.role != "interpreter":
        return _error("Only registered interpreters can respond to assignments", 403)
    interp_rows = list(Interpreter.objects.filter(email__iexact=account.email))
    interp_ids = {row.id for row in interp_rows}
    if not interp_ids:
        return _error("Only registered interpreters can respond to assignments", 403)
    data = _body(request)
    response = str(data.get("response") or "")
    if response not in ("accepted", "rejected"):
        return _error("Response must be accepted or rejected")

    with transaction.atomic():
        assignment = (
            Assignment.objects.select_for_update()
            .filter(pk=assignment_id)
            .first()
        )
        if not assignment or assignment.interpreter_id not in interp_ids:
            return _error("Assignment not found", 404)
        interp = next((row for row in interp_rows if row.id == assignment.interpreter_id), interp_rows[0])
        if assignment.outcome != "pending":
            return _error(f"Assignment already {assignment.outcome}")

        req_item = (
            InterpretationRequest.objects.select_for_update()
            .filter(pk=assignment.request_reference)
            .first()
        )
        # Another interpreter may have already taken this ring wave.
        if (
            response == "accepted"
            and req_item
            and req_item.status == "assigned"
            and req_item.assigned_interpreter_id
            and req_item.assigned_interpreter_id != interp.id
        ):
            assignment.outcome = "expired"
            assignment.responded_at = timezone.now()
            assignment.reason = "Taken by another interpreter"
            assignment.save(update_fields=["outcome", "responded_at", "reason"])
            return _error("This call was already taken by another interpreter", 409)

        assignment.outcome = response
        assignment.responded_at = timezone.now()
        assignment.reason = str(data.get("reason") or assignment.reason or "")
        assignment.save(update_fields=["outcome", "responded_at", "reason"])

        session = None
        if response == "accepted" and req_item:
            # First answer wins — stop ringing everyone else.
            dispatch.cancel_other_pending_assignments(req_item.reference, assignment.id)
            session = dispatch.create_or_update_session(req_item, interp)
            session.status = "ready_to_join"
            session.save(update_fields=["status"])
            interp.availability = "busy"
            interp.save(update_fields=["availability"])
            req_item.status = "assigned"
            req_item.updated_at = timezone.now()
            req_item.save(update_fields=["status", "updated_at"])
            return JsonResponse(
                {
                    "success": True,
                    "message": "Assignment accepted",
                    "session": _session_json(session),
                }
            )

        if req_item and dispatch.pending_ring_count(req_item.reference) == 0:
            dispatch.on_ring_exhausted(req_item)
    return JsonResponse({"success": True, "message": "Assignment rejected"})


@csrf_exempt
@require_http_methods(["POST"])
def assignment_expire(request: HttpRequest, assignment_id: str) -> JsonResponse:
    account = _account_from_request(request)
    assignment = Assignment.objects.filter(pk=assignment_id).first()
    if not assignment:
        return _error("Assignment not found", 404)
    req_item = InterpretationRequest.objects.filter(pk=assignment.request_reference).first()
    interp_ids = set(
        Interpreter.objects.filter(email__iexact=account.email).values_list("id", flat=True)
    ) if account else set()
    is_interpreter = bool(assignment.interpreter_id in interp_ids)
    is_requester = bool(account and req_item and req_item.requester_id == account.id)
    if not is_interpreter and not is_requester:
        return _error("Assignment not found", 404)
    if is_requester and assignment.expires_at and (assignment.expires_at - timezone.now()).total_seconds() > 2:
        return _error("The interpreter still has time to answer.")
    if assignment.outcome == "pending":
        assignment.outcome = "expired"
        assignment.responded_at = timezone.now()
        assignment.save(update_fields=["outcome", "responded_at"])
        if req_item and dispatch.pending_ring_count(req_item.reference) == 0:
            # Whole ring wave timed out — re-ring free interpreters (no coordinator assign).
            dispatch.on_ring_exhausted(req_item)
            req_item.refresh_from_db()
    return JsonResponse(
        {
            "success": True,
            "assignment": assignment.to_api(),
            "request": _request_json(req_item) if req_item else None,
        }
    )


@csrf_exempt
@require_http_methods(["GET"])
def session_detail(request: HttpRequest, session_id: str) -> JsonResponse:
    session = InterpretationSession.objects.filter(pk=session_id).first()
    if not session:
        return _error("Session not found", 404)
    completion = CompletionReport.objects.filter(session_id=session_id).first()
    return JsonResponse(
        {
            "session": _session_json(session),
            "participants": [],
            "completion": completion.to_api() if completion else None,
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def session_join(request: HttpRequest, session_id: str) -> JsonResponse:
    account = _account_from_request(request)
    if not account:
        return _error("Authentication required", 401)
    session = InterpretationSession.objects.filter(pk=session_id).first()
    if not session:
        return _error("Session not found", 404)

    interp = Interpreter.objects.filter(email__iexact=account.email).first() if account.role == "interpreter" else None
    authorized_ids = session.authorized_participant_ids or []
    is_authorized = (
        account.id in authorized_ids
        or session.client_id == account.id
        or (interp and session.interpreter_id == interp.id)
        or account.role in ("supervisor", "platform_admin")
    )
    if not is_authorized:
        return _error("Unauthorized: You are not an assigned participant in this session", 403)

    data = _body(request)
    session_token = data.get("sessionToken")
    if session_token and session_token != session.session_token:
        return _error("Invalid or expired session credentials", 401)

    if session.status in ("created", "ready_to_join", "awaiting_acceptance"):
        session.status = "active"
        session.save(update_fields=["status"])
    InterpretationRequest.objects.filter(active_session_id=session_id).update(
        status="in_session", updated_at=timezone.now()
    )
    session.refresh_from_db()
    return JsonResponse(
        {
            "success": True,
            "session": _session_json(session),
            "roomCredentials": {
                "sessionToken": session.session_token,
                "lowBandwidthMode": session.low_bandwidth_mode,
                "recordingEnabled": session.recording_enabled,
                "expiresInMinutes": 60,
            },
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def session_heartbeat(request: HttpRequest, session_id: str) -> JsonResponse:
    session = InterpretationSession.objects.filter(pk=session_id).first()
    if not session:
        return _error("Session not found", 404)
    data = _body(request)
    if "connectionHealth" in data:
        session.connection_health = data["connectionHealth"]
    if "durationSeconds" in data:
        try:
            session.duration_seconds = int(data["durationSeconds"])
        except (TypeError, ValueError):
            pass
    session.save()
    return JsonResponse({"success": True, "status": session.status})


@csrf_exempt
@require_http_methods(["POST"])
def session_end(request: HttpRequest, session_id: str) -> JsonResponse:
    session = InterpretationSession.objects.filter(pk=session_id).first()
    if not session:
        return _error("Session not found", 404)
    session.status = "completed"
    session.save(update_fields=["status"])
    InterpretationRequest.objects.filter(active_session_id=session_id).update(
        status="completed", updated_at=timezone.now()
    )
    # Free the interpreter so they can receive new rings.
    if session.interpreter_id:
        Interpreter.objects.filter(pk=session.interpreter_id).update(availability="available")
        dispatch.reroute_waiting_requests()
    # Expire any lingering pending assignments for this request.
    Assignment.objects.filter(
        request_reference=session.request_reference, outcome="pending"
    ).update(outcome="expired", responded_at=timezone.now())
    return JsonResponse({"success": True, "session": _session_json(session), "message": "Session ended"})


@csrf_exempt
@require_http_methods(["POST"])
def livekit_token(request: HttpRequest, session_id: str) -> JsonResponse:
    """Issue LiveKit JWT for the shared interpretation call room."""
    account = _account_from_request(request)
    if not account:
        return _error("Authentication required", 401)

    has_secret = bool(getattr(settings, "LIVEKIT_API_SECRET", "") or "")
    url = getattr(settings, "LIVEKIT_URL", "") or "wss://orozo-translation-8nvelq7r.livekit.cloud"

    session = InterpretationSession.objects.filter(pk=session_id).first()
    if not session:
        return _error("Session not found", 404)

    interp = Interpreter.objects.filter(email__iexact=account.email).first() if account.role == "interpreter" else None
    authorized_ids = session.authorized_participant_ids or []
    is_authorized = (
        account.id in authorized_ids
        or session.client_id == account.id
        or (interp and session.interpreter_id == interp.id)
        or account.role in ("supervisor", "platform_admin")
    )
    if not is_authorized:
        return _error("Unauthorized: You are not an assigned participant in this session", 403)

    if not has_secret:
        return _error(
            "LiveKit is not configured. Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET on the server.",
            503,
        )

    from communications.services.livekit_service import LiveKitTokenBuilder

    room = dispatch.resolve_call_room(session)
    api_key = getattr(settings, "LIVEKIT_API_KEY", "") or ""
    api_secret = getattr(settings, "LIVEKIT_API_SECRET", "") or ""
    ttl = int(getattr(settings, "LIVEKIT_TOKEN_TTL_SECONDS", 1800) or 1800)
    if not api_key or not api_secret:
        return _error(
            "LiveKit is not configured. Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET on the server.",
            503,
        )
    try:
        token = LiveKitTokenBuilder(
            api_key=api_key,
            api_secret=api_secret,
            ttl_seconds=ttl,
        ).create_token(
            identity=account.id,
            name=account.full_name,
            room_name=room,
            communication_mode=session.communication_mode or "audio",
            participant_role=account.role,
            metadata={
                "sessionId": session_id,
                "requestReference": session.request_reference,
                "role": account.role,
                "callRoom": room,
            },
        )
    except Exception as exc:  # noqa: BLE001
        return _error(f"Could not issue LiveKit token: {exc}", 500)
    return JsonResponse(
        {
            "token": token,
            "url": url,
            "room": room,
            "identity": account.id,
            "communicationMode": session.communication_mode,
            "hasSecret": has_secret,
            "session": _session_json(session),
        }
    )


@csrf_exempt
@require_http_methods(["GET", "POST"])
def livekit_config(request: HttpRequest) -> JsonResponse:
    url = getattr(settings, "LIVEKIT_URL", "") or ""
    api_key = getattr(settings, "LIVEKIT_API_KEY", "") or ""
    has_secret = bool(getattr(settings, "LIVEKIT_API_SECRET", "") or "")
    if request.method == "GET":
        return JsonResponse({"url": url, "apiKey": api_key, "hasSecret": has_secret})
    account = _account_from_request(request)
    if not account or account.role != "platform_admin":
        return _error("Platform admin required", 403)
    # Runtime updates are not persisted to .env; report current values.
    return JsonResponse({"success": True, "url": url, "apiKey": api_key, "hasSecret": has_secret})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def completions(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        rows = [c.to_api() for c in CompletionReport.objects.order_by("-created_at")[:100]]
        return JsonResponse({"completions": rows})
    account = _account_from_request(request)
    if not account:
        return _error("Sign in required", 401)
    data = _body(request)
    session_id = str(data.get("sessionId") or "")
    request_reference = str(data.get("requestReference") or "")
    session = InterpretationSession.objects.filter(pk=session_id).first()
    if not session and request_reference:
        session = InterpretationSession.objects.filter(request_reference=request_reference).first()
    if session:
        session.status = "completed"
        try:
            session.duration_seconds = max(session.duration_seconds, int(data.get("durationMinutes") or 0) * 60)
        except (TypeError, ValueError):
            pass
        session.save()
        InterpretationRequest.objects.filter(pk=session.request_reference).update(
            status="completed", updated_at=timezone.now()
        )
        if session.interpreter_id:
            Interpreter.objects.filter(pk=session.interpreter_id).update(availability="available")
    report = CompletionReport.objects.create(
        id=f"cmp-{secrets.token_hex(4)}",
        session_id=session_id or (session.id if session else ""),
        request_reference=request_reference or (session.request_reference if session else ""),
        interpreter_id=(session.interpreter_id if session else "") or "",
        outcome=str(data.get("outcome") or "completed"),
        duration_minutes=int(data.get("durationMinutes") or 0),
        issue_code=str(data.get("issueCode") or ""),
        notes=str(data.get("notes") or ""),
        review_status="flagged_for_review" if data.get("issueCode") else "closed",
    )
    return JsonResponse({"completionReport": report.to_api()})


@csrf_exempt
@require_http_methods(["POST"])
def feedback(request: HttpRequest) -> JsonResponse:
    account = _account_from_request(request)
    if not account:
        return _error("Sign in required", 401)
    data = _body(request)
    session_id = str(data.get("sessionId") or "")
    session = InterpretationSession.objects.filter(pk=session_id).first()
    rating = int(data.get("rating") or 0)
    Feedback.objects.create(
        id=f"fb-{secrets.token_hex(4)}",
        session_id=session_id,
        rating=max(0, min(5, rating)),
        comment=str(data.get("comment") or ""),
        request_reference=session.request_reference if session else "",
        interpreter_id=(session.interpreter_id or "") if session else "",
    )
    if session and session.interpreter_id and rating > 0:
        interp = Interpreter.objects.filter(pk=session.interpreter_id).first()
        if interp:
            prior = list(
                Feedback.objects.filter(interpreter_id=interp.id).values_list("rating", flat=True)
            )
            if prior:
                interp.rating = round(sum(prior) / len(prior), 2)
                interp.save(update_fields=["rating"])
    return JsonResponse({"success": True})


@csrf_exempt
@require_http_methods(["GET"])
def notifications(request: HttpRequest) -> JsonResponse:
    return JsonResponse({"notifications": []})


@csrf_exempt
@require_http_methods(["PATCH"])
def notification_read(_request: HttpRequest, notification_id: str) -> JsonResponse:
    return JsonResponse({"success": True})


@csrf_exempt
@require_http_methods(["GET", "PATCH"])
def platform_settings(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        return JsonResponse({"settings": _settings_payload()})
    account = _account_from_request(request)
    if not account or account.role != "platform_admin":
        return _error("Platform admin required", 403)
    data = _body(request)
    row, _ = PlatformSettings.objects.get_or_create(pk=1)
    mapping = {
        "assignmentTimeoutSeconds": "assignment_timeout_seconds",
        "maxAutoRetries": "max_auto_retries",
        "emergencyPriorityBypass": "emergency_priority_bypass",
        "allowDirectRecording": "allow_direct_recording",
        "maintenanceMode": "maintenance_mode",
        "telecomLowBandwidthPreset": "telecom_low_bandwidth_preset",
        "systemBannerNotice": "system_banner_notice",
    }
    for api_key, field in mapping.items():
        if api_key in data:
            setattr(row, field, data[api_key])
    row.save()
    return JsonResponse({"settings": row.to_api(), "message": "Settings updated"})


@csrf_exempt
@require_http_methods(["GET"])
def audit_logs(_request: HttpRequest) -> JsonResponse:
    return JsonResponse({"auditLogs": []})


@csrf_exempt
@require_http_methods(["GET"])
def supervisor_queue(request: HttpRequest) -> JsonResponse:
    account = _account_from_request(request)
    if not account or account.role not in ("supervisor", "platform_admin"):
        return _error("Restricted: Coordinator workspace requires supervisor role", 403)
    pending_matching = [
        _request_json(r)
        for r in InterpretationRequest.objects.filter(status__in=("submitted", "matching")).order_by("-created_at")[:100]
    ]
    unknown = [
        _request_json(r)
        for r in InterpretationRequest.objects.filter(status="pending_coordinator", is_unknown_language=True)[:100]
    ]
    no_match = [
        _request_json(r)
        for r in InterpretationRequest.objects.filter(status="pending_coordinator", is_unknown_language=False)[:100]
    ]
    active_sessions = [
        _session_json(s)
        for s in InterpretationSession.objects.filter(status__in=("ready_to_join", "active", "awaiting_acceptance")).order_by("-id")[:100]
    ]
    flagged = [
        c.to_api()
        for c in CompletionReport.objects.filter(review_status="flagged_for_review").order_by("-created_at")[:100]
    ]
    return JsonResponse(
        {
            "pendingMatching": pending_matching,
            "unknownLanguageEscalations": unknown,
            "noMatchEscalations": no_match,
            "activeSessions": active_sessions,
            "flaggedCompletions": flagged,
            "totalQueued": len(pending_matching) + len(unknown) + len(no_match),
        }
    )


@csrf_exempt
@require_http_methods(["GET"])
def supervisor_interpreter_ratings(request: HttpRequest) -> JsonResponse:
    account = _account_from_request(request)
    if not account or account.role not in ("supervisor", "platform_admin"):
        return _error("Only a supervisor can see interpreter comments", 403)
    rows = []
    for interp in Interpreter.objects.all().order_by("-rating", "full_name"):
        comments = [
            {
                "rating": fb.rating,
                "comment": fb.comment,
                "submittedAt": fb.submitted_at.isoformat() if fb.submitted_at else None,
                "requestReference": fb.request_reference,
            }
            for fb in Feedback.objects.filter(interpreter_id=interp.id).order_by("-submitted_at")[:20]
        ]
        completed = CompletionReport.objects.filter(interpreter_id=interp.id).count()
        rows.append(
            {
                "id": interp.id,
                "fullName": interp.full_name,
                "rating": interp.rating,
                "totalSessionsCompleted": completed,
                "comments": comments,
            }
        )
    return JsonResponse({"interpreters": rows})


@csrf_exempt
@require_http_methods(["POST"])
def supervisor_assign(request: HttpRequest) -> JsonResponse:
    """Legacy endpoint — now rings free interpreters directly (no manual pick required)."""
    return supervisor_ring(request)


@csrf_exempt
@require_http_methods(["POST"])
def supervisor_ring(request: HttpRequest) -> JsonResponse:
    """Re-ring all available interpreters for a request — no coordinator pick."""
    account = _account_from_request(request)
    if not account or account.role not in ("supervisor", "platform_admin"):
        return _error("Restricted to supervisor role", 403)
    data = _body(request)
    request_reference = str(data.get("requestReference") or "")
    req_item = InterpretationRequest.objects.filter(pk=request_reference).first()
    if not req_item:
        return _error("Request not found", 404)
    if req_item.status in ("completed", "cancelled", "in_session"):
        return _error(f"Cannot ring interpreters for status: {req_item.status}")
    req_item.status = "matching"
    req_item.is_unknown_language = False if data.get("clearUnknown") else req_item.is_unknown_language
    req_item.updated_at = timezone.now()
    req_item.save(update_fields=["status", "is_unknown_language", "updated_at"])
    result = dispatch.try_auto_dispatch(req_item)
    req_item.refresh_from_db()
    return JsonResponse(
        {
            "success": True,
            "message": "Ringing available interpreters",
            "request": _request_json(req_item),
            "dispatch": result,
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def supervisor_resolve_unknown(request: HttpRequest) -> JsonResponse:
    account = _account_from_request(request)
    if not account or account.role not in ("supervisor", "platform_admin"):
        return _error("Restricted to supervisor role", 403)
    data = _body(request)
    request_reference = str(data.get("requestReference") or "")
    identified = str(data.get("identifiedLanguageCode") or "").strip()
    notes = str(data.get("coordinatorNotes") or "")
    req_item = InterpretationRequest.objects.filter(pk=request_reference).first()
    if not req_item:
        return _error("Request not found", 404)
    if not identified:
        return _error("identifiedLanguageCode is required")
    prior = req_item.unknown_language_notes or ""
    req_item.source_language = identified
    req_item.is_unknown_language = False
    req_item.unknown_language_notes = (
        f"{prior + ' | ' if prior else ''}Identified by coordinator: {notes or 'Confirmed'}"
    )
    req_item.status = "matching"
    req_item.updated_at = timezone.now()
    req_item.save()
    dispatch_result = dispatch.try_auto_dispatch(req_item)
    req_item.refresh_from_db()
    return JsonResponse(
        {
            "success": True,
            "message": f"Language confirmed as {identified.upper()}. Ringing available interpreters.",
            "request": _request_json(req_item),
            "dispatch": dispatch_result,
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def supervisor_resolve_issue(request: HttpRequest) -> JsonResponse:
    account = _account_from_request(request)
    if not account or account.role not in ("supervisor", "platform_admin"):
        return _error("Restricted to supervisor role", 403)
    data = _body(request)
    completion_id = str(data.get("completionId") or "")
    note = str(data.get("resolutionNote") or "Reviewed and closed by coordinator.")
    completion = CompletionReport.objects.filter(pk=completion_id).first()
    if not completion:
        return _error("Completion record not found", 404)
    completion.review_status = "resolved_by_supervisor"
    completion.supervisor_resolution_note = note
    completion.save(update_fields=["review_status", "supervisor_resolution_note"])
    return JsonResponse({"success": True, "completion": completion.to_api()})



def _grouped_organizations() -> list[dict[str, Any]]:
    orgs: dict[str, Any] = {}
    for account in Account.objects.filter(role="client").order_by("organization_name", "full_name"):
        name = account.organization_name or "Unknown"
        bucket = orgs.setdefault(
            name,
            {"organizationName": name, "name": name, "accounts": []},
        )
        bucket["accounts"].append(
            {
                "id": account.id,
                "fullName": account.full_name,
                "email": account.email,
                "clientAccountType": account.client_account_type or None,
                "phone": account.phone or "",
                "status": account.status,
            }
        )
    return list(orgs.values())


@csrf_exempt
@require_http_methods(["GET", "POST"])
def organizations(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        return JsonResponse({"organizations": _grouped_organizations()})

    actor = _account_from_request(request)
    if not actor:
        return _error("Sign in required", 401)
    if actor.role not in ("platform_admin", "supervisor"):
        return _error("Only platform administrators and supervisors can create organization accounts", 403)

    data = _body(request)
    organization_name = _clip(data.get("organizationName"), 200).strip()
    admin_name = _clip(data.get("adminName"), 160).strip()
    admin_email = str(data.get("adminEmail") or "").strip().lower()
    admin_password = str(data.get("adminPassword") or "")
    desk_name = _clip(data.get("deskName") or f"{organization_name} triage desk", 160).strip()
    desk_email = str(data.get("deskEmail") or "").strip().lower()
    desk_password = str(data.get("deskPassword") or "")
    phone = _clip(data.get("phone") or "", 32)
    workplace = _clip(data.get("workplace") or "", 64)

    if not organization_name or not admin_name or not admin_email or not desk_email:
        return _error(
            "The organization name, admin email, and triage desk email are all required.",
            400,
        )
    for label, email in (("admin", admin_email), ("desk", desk_email)):
        email_error = _require_email(email)
        if email_error:
            return _error(f"{label.title()} {email_error.lower()}")
    if admin_email == desk_email:
        return _error(
            "The organization admin and the triage desk need two different email addresses.",
            400,
        )
    if len(admin_password) < 6 or len(desk_password) < 6:
        return _error("Each account needs a password of at least 6 characters.", 400)
    if Account.objects.filter(email__iexact=admin_email).exists() or Account.objects.filter(
        email__iexact=desk_email
    ).exists():
        return _error(
            "That email is already registered. Use a different email for the new account.",
            400,
        )

    # Keep workplace in organization name note only when provided (no schema change).
    org_label = organization_name if not workplace else f"{organization_name}"

    try:
        with transaction.atomic():
            admin = Account.objects.create(
                id=f"usr-org-admin-{secrets.token_hex(4)}",
                email=admin_email,
                full_name=admin_name,
                role="client",
                client_account_type="organization_admin",
                phone=phone,
                organization_name=org_label,
                status="active",
                password_hash=make_password(admin_password),
                must_change_password=True,
            )
            desk = Account.objects.create(
                id=f"usr-org-desk-{secrets.token_hex(4)}",
                email=desk_email,
                full_name=desk_name,
                role="client",
                client_account_type="common_terminal",
                phone=phone,
                organization_name=org_label,
                status="active",
                password_hash=make_password(desk_password),
                must_change_password=True,
            )
    except (IntegrityError, OperationalError, ValidationError) as exc:
        return _db_create_error(exc)

    message = f"Saved in the database. Share both temporary passwords with {admin.email}."
    return JsonResponse(
        {
            "organizationName": org_label,
            "message": message,
            "accounts": [
                {
                    "id": admin.id,
                    "fullName": admin.full_name,
                    "email": admin.email,
                    "clientAccountType": admin.client_account_type,
                },
                {
                    "id": desk.id,
                    "fullName": desk.full_name,
                    "email": desk.email,
                    "clientAccountType": desk.client_account_type,
                },
            ],
        },
        status=201,
    )


@csrf_exempt
@require_http_methods(["GET", "POST"])
def supervisors(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        users = [_account_json(a) for a in Account.objects.filter(role="supervisor").order_by("full_name")]
        return JsonResponse({"supervisors": users})

    actor = _account_from_request(request)
    if not actor:
        return _error("Sign in required", 401)
    if actor.role != "platform_admin":
        return _error("Only platform administrators can create supervisors", 403)

    data = _body(request)
    full_name = _clip(data.get("fullName"), 160).strip()
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    phone = _clip(data.get("phone") or "", 32)

    if not full_name:
        return _error("Full name and email are required.", 400)
    email_error = _require_email(email)
    if email_error:
        return _error(email_error)
    if len(password) < 6:
        return _error("Password must be at least 6 characters.", 400)
    if Account.objects.filter(email__iexact=email).exists():
        return _error("That email is already registered.", 400)

    try:
        supervisor = Account.objects.create(
            id=f"usr-super-{secrets.token_hex(4)}",
            email=email,
            full_name=full_name,
            role="supervisor",
            phone=phone,
            organization_name="ORZO Coordination Desk",
            status="active",
            password_hash=make_password(password),
            must_change_password=True,
        )
    except (IntegrityError, OperationalError, ValidationError) as exc:
        return _db_create_error(exc)
    return JsonResponse(
        {
            "supervisor": {
                "id": supervisor.id,
                "fullName": supervisor.full_name,
                "email": supervisor.email,
                "phone": supervisor.phone,
                "status": supervisor.status,
            },
            "message": f"Supervisor {supervisor.full_name} created.",
        },
        status=201,
    )


@csrf_exempt
@require_http_methods(["GET"])
def reports(request: HttpRequest) -> JsonResponse:
    account = _account_from_request(request)
    if not account:
        return _error("Sign in required", 401)
    if account.role not in ("supervisor", "platform_admin"):
        return _error("Operational reports require supervisor or platform admin role", 403)

    range_key = str(request.GET.get("range") or "month")
    window_ms = dispatch.report_window_ms(range_key)
    now_ms = int(timezone.now().timestamp() * 1000)
    requests = []
    for item in InterpretationRequest.objects.all():
        created = item.created_at or timezone.now()
        created_ms = int(created.timestamp() * 1000)
        if now_ms - created_ms <= window_ms:
            requests.append(item)
    references = {r.reference for r in requests}

    total_requests = len(requests)
    completed_requests = sum(1 for r in requests if r.status == "completed")
    active_sessions_count = InterpretationSession.objects.filter(
        request_reference__in=references,
        status__in=("active", "ready_to_join", "awaiting_acceptance"),
    ).count()
    unknown_language_count = sum(1 for r in requests if r.is_unknown_language)
    unmatched_requests = sum(
        1 for r in requests if r.status in ("matching", "pending_coordinator", "unresolved", "submitted")
    )

    language_demand: dict[str, dict] = {}
    for r in requests:
        code = r.source_language or "unknown"
        lang = Language.objects.filter(pk=code).first()
        name = lang.name if lang else code.upper()
        bucket = language_demand.setdefault(code, {"name": name, "count": 0})
        bucket["count"] += 1

    category_demand: dict[str, int] = {}
    for r in requests:
        category_demand[r.service_category] = category_demand.get(r.service_category, 0) + 1

    available = Interpreter.objects.filter(availability="available").count()
    busy = Interpreter.objects.filter(availability="busy").count()
    offline = Interpreter.objects.filter(availability="offline").count()
    verified = Interpreter.objects.filter(verification_state="verified").count()

    answer_times = []
    for assignment in Assignment.objects.filter(
        request_reference__in=references, outcome="accepted"
    ).exclude(responded_at=None):
        if not assignment.assigned_at or not assignment.responded_at:
            continue
        seconds = (assignment.responded_at - assignment.assigned_at).total_seconds()
        if 0 <= seconds < 3600:
            answer_times.append(seconds)
    avg_response = round(sum(answer_times) / len(answer_times)) if answer_times else None
    completion_rate = round((completed_requests / total_requests) * 100) if total_requests else 0

    return JsonResponse(
        {
            "summary": {
                "totalRequests": total_requests,
                "completedRequests": completed_requests,
                "activeSessionsCount": active_sessions_count,
                "unknownLanguageCount": unknown_language_count,
                "unmatchedRequests": unmatched_requests,
                "completionRatePercent": completion_rate,
                "avgResponseTimeSeconds": avg_response,
                "availableInterpreters": available,
                "busyInterpreters": busy,
                "offlineInterpreters": offline,
                "verifiedInterpreters": verified,
            },
            "languageDemand": language_demand,
            "categoryDemand": category_demand,
            "range": range_key,
        }
    )


@csrf_exempt
@require_http_methods(["GET"])
def organization_report(request: HttpRequest) -> JsonResponse:
    account = _account_from_request(request)
    if not account:
        return _error("Sign in required", 401)
    if account.role != "client" or account.client_account_type != "organization_admin":
        return _error("Organization reports are available to the organization admin only", 403)

    range_key = str(request.GET.get("range") or "month")
    window_ms = dispatch.report_window_ms(range_key)
    now_ms = int(timezone.now().timestamp() * 1000)
    org = account.organization_name or ""
    requests = []
    for item in InterpretationRequest.objects.filter(organization_name=org):
        created = item.created_at or timezone.now()
        if now_ms - int(created.timestamp() * 1000) <= window_ms:
            requests.append(item)

    by_language: dict[str, dict] = {}
    by_category: dict[str, dict] = {}
    total_minutes = 0
    for item in requests:
        minutes = dispatch.minutes_for_request(item.reference)
        total_minutes += minutes
        lang = Language.objects.filter(pk=item.source_language).first()
        label = "Unknown language" if item.is_unknown_language else (lang.name if lang else item.source_language)
        bucket = by_language.setdefault(label, {"requests": 0, "minutes": 0})
        bucket["requests"] += 1
        bucket["minutes"] += minutes
        cat = by_category.setdefault(item.service_category, {"requests": 0, "minutes": 0})
        cat["requests"] += 1
        cat["minutes"] += minutes

    accounts = Account.objects.filter(role="client", organization_name=org)
    by_account = []
    for person in accounts:
        own = [r for r in requests if r.requester_id == person.id]
        minutes = sum(dispatch.minutes_for_request(r.reference) for r in own)
        by_account.append(
            {
                "id": person.id,
                "fullName": person.full_name,
                "email": person.email,
                "clientAccountType": person.client_account_type or None,
                "requests": len(own),
                "minutes": minutes,
            }
        )

    recent = sorted(requests, key=lambda r: r.created_at or timezone.now(), reverse=True)[:25]
    return JsonResponse(
        {
            "organizationName": org,
            "summary": {
                "totalMinutes": total_minutes,
                "totalRequests": len(requests),
                "completedRequests": sum(1 for r in requests if r.status == "completed"),
                "activeRequests": sum(
                    1
                    for r in requests
                    if r.status in ("assigned", "in_session", "matching", "pending_coordinator", "submitted")
                ),
                "cancelledRequests": sum(1 for r in requests if r.status == "cancelled"),
                "emergencyRequests": sum(1 for r in requests if r.urgency == "emergency"),
            },
            "byLanguage": by_language,
            "byCategory": by_category,
            "byAccount": by_account,
            "range": range_key,
            "recent": [
                {
                    "reference": item.reference,
                    "status": item.status,
                    "serviceCategory": item.service_category,
                    "sourceLanguage": item.source_language,
                    "requesterName": item.requester_name,
                    "createdAt": item.created_at.isoformat() if item.created_at else None,
                    "minutes": dispatch.minutes_for_request(item.reference),
                }
                for item in recent
            ],
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def support_chat(_request: HttpRequest) -> JsonResponse:
    return JsonResponse(
        {
            "response": (
                "ORZO support is available. For live assistance, contact your coordinator. "
                "Use the request form for interpretation dispatch."
            )
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def support_voice(_request: HttpRequest) -> JsonResponse:
    return JsonResponse({"transcript": "", "response": "Voice support is not configured on this server."})


@csrf_exempt
@require_http_methods(["POST"])
def support_identify(request: HttpRequest) -> JsonResponse:
    data = _body(request)
    notes = str(data.get("clientNotes") or "").lower()
    guessed = Language.objects.filter(is_active=True).first()
    for lang in Language.objects.filter(is_active=True):
        if lang.name.lower() in notes or lang.code.lower() in notes or (lang.native_name or "").lower() in notes:
            guessed = lang
            break
    code = guessed.code if guessed else "und"
    name = guessed.name if guessed else "Unknown"
    native = guessed.native_name if guessed else "Unknown"
    script = guessed.script if guessed else "Latin"
    return JsonResponse(
        {
            "result": {
                "identifiedLanguageCode": code,
                "languageName": name,
                "nativeName": native,
                "script": script,
                "dialectVariant": "",
                "confidencePercent": 35 if guessed else 0,
                "transcriptSnippet": "",
                "linguisticCharacteristics": "Heuristic match from notes; configure AI language ID for production.",
                "highStakesWarning": True,
                "recommendedAction": "Confirm with the client or escalate to a coordinator before dispatch.",
                "engine": "heuristic",
            }
        }
    )


# ---------------------------------------------------------------------------
# Waiting Calls — interpreters in a call can see and take queued requests
# ---------------------------------------------------------------------------


@csrf_exempt
@require_http_methods(["GET"])
def waiting_calls(request: HttpRequest) -> JsonResponse:
    """Requests that currently have at least one live (non-expired) pending assignment
    still within their countdown window. Never returns unresolved/old unanswered calls."""
    account = _account_from_request(request)
    if not account:
        return _error("Sign in required", 401)

    now = timezone.now()
    # Only assignments that are pending AND not yet expired
    live_assignments = Assignment.objects.filter(
        outcome="pending",
        expires_at__gt=now,
    )
    live_refs = set(live_assignments.values_list("request_reference", flat=True))
    queued_refs = set(
        InterpretationRequest.objects.filter(status="matching").values_list("reference", flat=True)
    )
    live_refs.update(queued_refs)
    if not live_refs:
        return JsonResponse({"waitingCalls": []})

    qs = InterpretationRequest.objects.filter(
        reference__in=live_refs,
        status__in=["matching", "assigned"],
    ).order_by("created_at")

    results = []
    for req in qs:
        # Find the assignment with the latest expires_at for this request
        asg = (
            Assignment.objects.filter(
                request_reference=req.reference,
                outcome="pending",
                expires_at__gt=now,
            )
            .order_by("-expires_at")
            .first()
        )
        if not asg:
            # No available interpreter accepted yet: show as a queued call.
            data = _request_json(req)
            data["assignmentExpiresAt"] = None
            data["assignmentId"] = None
            data["queued"] = True
            results.append(data)
            continue
        data = _request_json(req)
        data["assignmentExpiresAt"] = asg.expires_at.isoformat()
        data["assignmentId"] = asg.id
        results.append(data)

    return JsonResponse({"waitingCalls": results})


@csrf_exempt
@require_http_methods(["POST"])
def take_waiting_call(request: HttpRequest, reference: str) -> JsonResponse:
    """Interpreter takes a waiting call — ends their current session first."""
    account = _account_from_request(request)
    if not account or account.role != "interpreter":
        return _error("Interpreter access required", 403)

    req_item = InterpretationRequest.objects.filter(pk=reference).first()
    if not req_item:
        return _error("Request not found", 404)
    if req_item.status in ("completed", "cancelled", "in_session"):
        return _error(f"Cannot take request in status: {req_item.status}")

    interp = Interpreter.objects.filter(email__iexact=account.email).first()
    if not interp:
        return _error("Interpreter profile not found", 404)

    # End interpreter's current session if any
    current_sessions = InterpretationSession.objects.filter(
        interpreter_id=interp.id
    ).exclude(status__in=["completed", "cancelled"])
    for sess in current_sessions:
        sess.status = "completed"
        sess.save(update_fields=["status"])
        InterpretationRequest.objects.filter(active_session_id=sess.id).update(
            status="completed", updated_at=timezone.now()
        )

    # Free the interpreter
    Interpreter.objects.filter(email__iexact=account.email).update(availability="available")
    interp.refresh_from_db()

    # Expire any old pending assignments for this request
    Assignment.objects.filter(request_reference=reference, outcome="pending").update(
        outcome="expired", responded_at=timezone.now()
    )

    # Assign to this interpreter
    req_item.status = "assigned"
    req_item.updated_at = timezone.now()
    req_item.save(update_fields=["status", "updated_at"])

    assignment = dispatch.create_assignment(req_item, interp, reason="Taken from waiting queue", manual=True)
    session = dispatch.create_or_update_session(req_item, interp)
    session.status = "ready_to_join"
    session.save(update_fields=["status"])

    interp.availability = "busy"
    interp.save(update_fields=["availability"])

    return JsonResponse(
        {
            "success": True,
            "session": _session_json(session),
            "assignment": assignment.to_api(),
            "message": f"Taken call {reference}",
        }
    )


# ---------------------------------------------------------------------------
# Staff listing for meeting creation
# ---------------------------------------------------------------------------


@csrf_exempt
@require_http_methods(["GET"])
def staff_list(request: HttpRequest) -> JsonResponse:
    """List all active staff (supervisors, interpreters, platform admins)."""
    account = _account_from_request(request)
    if not account:
        return _error("Sign in required", 401)
    if account.role not in ("platform_admin", "supervisor"):
        return _error("Staff listing requires admin access", 403)

    staff = Account.objects.filter(
        role__in=["supervisor", "interpreter", "platform_admin"],
        status="active",
    ).order_by("full_name")
    return JsonResponse({"staff": [_account_json(a) for a in staff]})


# ---------------------------------------------------------------------------
# Group Meetings — admin creates audio/video meetings with selected staff
# ---------------------------------------------------------------------------


def _meeting_json(m: Meeting) -> dict:
    return m.to_api()


@csrf_exempt
@require_http_methods(["GET", "POST"])
def meetings(request: HttpRequest) -> JsonResponse:
    account = _account_from_request(request)
    if not account:
        return _error("Sign in required", 401)

    try:
        if request.method == "GET":
            participant_meeting_ids = list(
                MeetingParticipant.objects.filter(account_id=account.id).values_list("meeting_id", flat=True)
            )
            created_ids = list(
                Meeting.objects.filter(creator_id=account.id, status="active").values_list("id", flat=True)
            )
            all_ids = set(participant_meeting_ids + created_ids)
            qs = Meeting.objects.filter(id__in=all_ids, status="active").order_by("-created_at")[:30]
            return JsonResponse({"meetings": [_meeting_json(m) for m in qs]})

        # POST — create meeting
        if account.role != "platform_admin":
            return _error("Only platform admins can create meetings", 403)

        data = _body(request)
        title = str(data.get("title") or "").strip()
        if not title:
            return _error("Meeting title is required")
        communication_mode = str(data.get("communicationMode") or "video")
        participant_ids = data.get("participantIds") or []
        if not isinstance(participant_ids, list):
            participant_ids = [participant_ids]

        meeting_id_val = f"mtg-{secrets.token_hex(3)}"
        meeting = Meeting.objects.create(
            id=meeting_id_val,
            title=title,
            creator_id=account.id,
            creator_name=account.full_name,
            communication_mode=communication_mode,
            status="active",
        )

        # Creator is always host
        MeetingParticipant.objects.create(
            id=f"mtp-{secrets.token_hex(3)}",
            meeting=meeting,
            account_id=account.id,
            account_name=account.full_name,
            account_role=account.role,
            role="host",
            status="joined",
            joined_at=timezone.now(),
        )

        for pid in participant_ids:
            participant = Account.objects.filter(pk=str(pid)).first()
            if not participant:
                continue
            MeetingParticipant.objects.create(
                id=f"mtp-{secrets.token_hex(3)}",
                meeting=meeting,
                account_id=str(pid),
                account_name=participant.full_name,
                account_role=participant.role,
                role="participant",
                status="invited",
            )

        return JsonResponse({"meeting": _meeting_json(meeting)}, status=201)

    except Exception as exc:
        logger.exception("meetings endpoint error: %s", exc)
        return _error("Meeting service error — the meetings table may need migration. Run: python manage.py migrate", 500)


@csrf_exempt
@require_http_methods(["GET"])
def meeting_detail(request: HttpRequest, meeting_id: str) -> JsonResponse:
    account = _account_from_request(request)
    if not account:
        return _error("Sign in required", 401)
    try:
        meeting = Meeting.objects.filter(pk=meeting_id).first()
        if not meeting:
            return _error("Meeting not found", 404)
        return JsonResponse({"meeting": _meeting_json(meeting)})
    except Exception as exc:
        logger.exception("meeting_detail error: %s", exc)
        return _error("Meeting service error", 500)


@csrf_exempt
@require_http_methods(["POST"])
def meeting_join(request: HttpRequest, meeting_id: str) -> JsonResponse:
    """Join a meeting — returns a LiveKit token for the meeting room."""
    account = _account_from_request(request)
    if not account:
        return _error("Authentication required", 401)
    try:
        meeting = Meeting.objects.filter(pk=meeting_id).first()
        if not meeting:
            return _error("Meeting not found", 404)
        if meeting.status != "active":
            return _error("Meeting has ended", 400)

        participant = MeetingParticipant.objects.filter(meeting=meeting, account_id=account.id).first()
        if not participant:
            participant = MeetingParticipant.objects.create(
                id=f"mtp-{secrets.token_hex(3)}",
                meeting=meeting,
                account_id=account.id,
                account_name=account.full_name,
                account_role=account.role,
                role="participant",
                status="joined",
                joined_at=timezone.now(),
            )
        else:
            participant.status = "joined"
            participant.joined_at = timezone.now()
            participant.save(update_fields=["status", "joined_at"])

        has_secret = bool(getattr(settings, "LIVEKIT_API_SECRET", "") or "")
        if not has_secret:
            return _error("LiveKit is not configured on the server.", 503)

        from communications.services.livekit_service import LiveKitTokenBuilder

        room = f"orzo-meeting-{meeting.id}"
        api_key = getattr(settings, "LIVEKIT_API_KEY", "") or ""
        api_secret = getattr(settings, "LIVEKIT_API_SECRET", "") or ""
        ttl = int(getattr(settings, "LIVEKIT_TOKEN_TTL_SECONDS", 1800) or 1800)

        token = LiveKitTokenBuilder(
            api_key=api_key,
            api_secret=api_secret,
            ttl_seconds=ttl,
        ).create_token(
            identity=account.id,
            name=account.full_name,
            room_name=room,
            communication_mode=meeting.communication_mode,
            participant_role=account.role,
            metadata={"meetingId": meeting_id, "title": meeting.title},
        )

        url = getattr(settings, "LIVEKIT_URL", "")
        return JsonResponse(
            {
                "token": token,
                "url": url,
                "room": room,
                "identity": account.id,
                "communicationMode": meeting.communication_mode,
                "meeting": _meeting_json(meeting),
            }
        )
    except Exception as exc:
        logger.exception("meeting_join error: %s", exc)
        return _error("Meeting service error", 500)


@csrf_exempt
@require_http_methods(["POST"])
def meeting_end(request: HttpRequest, meeting_id: str) -> JsonResponse:
    account = _account_from_request(request)
    if not account:
        return _error("Authentication required", 401)
    try:
        meeting = Meeting.objects.filter(pk=meeting_id).first()
        if not meeting:
            return _error("Meeting not found", 404)
        is_participant = MeetingParticipant.objects.filter(
            meeting=meeting,
            account_id=account.id,
        ).exists()
        if meeting.creator_id != account.id and not is_participant and account.role != "platform_admin":
            return _error("You are not a participant in this meeting", 403)
        meeting.status = "ended"
        meeting.ended_at = timezone.now()
        meeting.save(update_fields=["status", "ended_at"])
        MeetingParticipant.objects.filter(meeting=meeting, status="joined").update(status="left")
        return JsonResponse({"success": True, "message": "Meeting ended"})
    except Exception as exc:
        logger.exception("meeting_end error: %s", exc)
        return _error("Meeting service error", 500)
