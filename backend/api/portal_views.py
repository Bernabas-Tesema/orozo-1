"""Portal JSON API under /api/v1 — powers the React SPA without Node.js."""

from __future__ import annotations

import json
import secrets
from typing import Any, Optional

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.http import HttpRequest, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import (
    Account,
    InterpretationRequest,
    InterpretationSession,
    Interpreter,
    Language,
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
            for code in (interp.languages or [])
        ],
        "serviceCategories": interp.categories or [],
        "qualifications": [],
        "verificationState": interp.verification_state,
        "availability": interp.availability,
        "rating": interp.rating,
        "totalSessionsCompleted": 0,
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
        "interpreterName": session.interpreter_name,
        "clientName": session.client_name,
        "organizationName": session.organization_name,
        "sourceLanguage": session.source_language,
        "targetLanguage": session.target_language,
        "serviceCategory": session.service_category,
        "connectionHealth": session.connection_health,
        "authorizedParticipantIds": [],
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
    interp = Interpreter.objects.filter(email__iexact=account.email).first()
    if not interp:
        return None
    return _interpreter_json(interp, user_id=account.id)


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
        payload = [
            {
                "code": lang.code,
                "name": lang.name,
                "nativeName": lang.native_name,
                "script": lang.script,
                "variants": lang.variants,
                "isActive": lang.is_active,
            }
            for lang in qs
        ]
        return JsonResponse({"languages": payload})

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
    return JsonResponse(
        {
            "language": {
                "code": lang.code,
                "name": lang.name,
                "nativeName": lang.native_name,
                "script": lang.script,
                "variants": lang.variants,
                "isActive": lang.is_active,
            }
        },
        status=201,
    )


@csrf_exempt
@require_http_methods(["GET", "POST"])
def interpreters(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        items = [_interpreter_json(i) for i in Interpreter.objects.all().order_by("full_name")]
        return JsonResponse({"interpreters": items})
    account = _account_from_request(request)
    if not account or account.role not in ("platform_admin", "supervisor"):
        return _error("Not authorized", 403)
    data = _body(request)
    interp_id = f"int-{secrets.token_hex(3)}"
    email = str(data.get("email") or "").strip().lower()
    full_name = str(data.get("fullName") or "").strip()
    password = str(data.get("password") or "orzo")
    interp = Interpreter.objects.create(
        id=interp_id,
        full_name=full_name,
        phone=str(data.get("phone") or ""),
        email=email,
        languages=data.get("languages") or data.get("supportedLanguages") or [],
        categories=data.get("categories") or data.get("serviceCategories") or [],
        availability="offline",
        verification_state=data.get("verificationState") or "pending",
        rating=0,
    )
    user_id = f"usr-interp-{secrets.token_hex(3)}"
    Account.objects.create(
        id=user_id,
        email=email,
        full_name=full_name,
        role="interpreter",
        phone=str(data.get("phone") or ""),
        organization_name="ORZO Interpreters",
        status="active",
        password_hash=make_password(password),
        must_change_password=True,
    )
    return JsonResponse({"interpreter": _interpreter_json(interp, user_id=user_id)}, status=201)


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
    interp.save()
    return JsonResponse({"interpreter": _interpreter_json(interp)})


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
    return JsonResponse({"success": True, "availability": value})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def requests_collection(request: HttpRequest) -> JsonResponse:
    account = _account_from_request(request)
    if request.method == "GET":
        qs = InterpretationRequest.objects.all().order_by("-created_at")
        if account and account.role == "client":
            qs = qs.filter(requester_id=account.id)
        return JsonResponse({"requests": [_request_json(r) for r in qs]})

    if not account:
        return _error("Sign in required", 401)
    data = _body(request)
    now = timezone.now()
    item = InterpretationRequest.objects.create(
        reference=f"REQ-{now.year}-{secrets.token_hex(3).upper()}",
        requester_id=account.id,
        requester_name=account.full_name,
        requester_phone=account.phone,
        organization_name=account.organization_name,
        source_language=data.get("sourceLanguage") or "unknown",
        target_language=data.get("targetLanguage") or "amh",
        is_unknown_language=bool(data.get("isUnknownLanguage")),
        unknown_language_notes=data.get("unknownLanguageNotes") or "",
        service_category=data.get("serviceCategory") or "healthcare",
        urgency=data.get("urgency") or "standard",
        modality=data.get("modality") or "audio",
        schedule_type=data.get("scheduleType") or "immediate",
        scheduled_time=data.get("scheduledTime"),
        status="submitted",
        min_routing_context=data.get("minRoutingContext") or "",
        created_at=now,
        updated_at=now,
    )
    return JsonResponse({"request": _request_json(item), "dispatch": None}, status=201)


@csrf_exempt
@require_http_methods(["GET"])
def request_detail(request: HttpRequest, reference: str) -> JsonResponse:
    item = InterpretationRequest.objects.filter(pk=reference).first()
    if not item:
        return _error("Request not found", 404)
    return JsonResponse({"request": _request_json(item)})


@csrf_exempt
@require_http_methods(["POST"])
def cancel_request(request: HttpRequest, reference: str) -> JsonResponse:
    item = InterpretationRequest.objects.filter(pk=reference).first()
    if not item:
        return _error("Request not found", 404)
    account = _account_from_request(request)
    if account and account.role == "client" and item.requester_id != account.id:
        return _error("Request not found", 404)
    item.status = "cancelled"
    item.cancellation_reason = str(_body(request).get("reason") or "")
    item.updated_at = timezone.now()
    item.save(update_fields=["status", "cancellation_reason", "updated_at"])
    return JsonResponse({"success": True, "request": _request_json(item), "message": "Cancelled"})


@csrf_exempt
@require_http_methods(["GET"])
def assignments(_request: HttpRequest) -> JsonResponse:
    return JsonResponse({"assignments": []})


@csrf_exempt
@require_http_methods(["GET"])
def session_detail(request: HttpRequest, session_id: str) -> JsonResponse:
    session = InterpretationSession.objects.filter(pk=session_id).first()
    if not session:
        return _error("Session not found", 404)
    return JsonResponse({"session": _session_json(session)})


@csrf_exempt
@require_http_methods(["POST"])
def session_join(request: HttpRequest, session_id: str) -> JsonResponse:
    account = _account_from_request(request)
    if not account:
        return _error("Authentication required", 401)
    session = InterpretationSession.objects.filter(pk=session_id).first()
    if not session:
        return _error("Session not found", 404)
    if session.status in ("created", "ready_to_join", "awaiting_acceptance"):
        session.status = "active"
        session.save(update_fields=["status"])
    InterpretationRequest.objects.filter(active_session_id=session_id).update(
        status="in_session", updated_at=timezone.now()
    )
    return JsonResponse({"success": True, "session": _session_json(session)})


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
    return JsonResponse({"success": True, "session": _session_json(session), "message": "Session ended"})


@csrf_exempt
@require_http_methods(["POST"])
def livekit_token(request: HttpRequest, session_id: str) -> JsonResponse:
    """Issue LiveKit JWT; prefers communications TokenService when session exists there."""
    account = _account_from_request(request)
    if not account:
        return _error("Authentication required", 401)

    has_secret = bool(getattr(settings, "LIVEKIT_API_SECRET", "") or "")
    url = getattr(settings, "LIVEKIT_URL", "") or "wss://orozo-translation-8nvelq7r.livekit.cloud"

    try:
        from communications.models import CommunicationSession
        from communications.services.token_service import TokenSecurityException, TokenService

        comm = CommunicationSession.objects.filter(session_id=session_id).first()
        if comm:
            payload = TokenService().generate_participant_token(
                session=comm,
                user_id=account.id,
                user_name=account.full_name,
                user_role=account.role,
            )
            payload["hasSecret"] = has_secret
            return JsonResponse(payload)
    except Exception as exc:  # noqa: BLE001 — fall through to api session
        from communications.services.token_service import TokenSecurityException

        if isinstance(exc, TokenSecurityException):
            return _error(exc.message, exc.status_code)

    session = InterpretationSession.objects.filter(pk=session_id).first()
    if not session:
        return _error("Session not found", 404)

    from communications.services.livekit_service import LiveKitTokenBuilder

    room = f"orzo-{session_id}"
    token = LiveKitTokenBuilder().create_token(
        identity=account.id,
        name=account.full_name,
        room_name=room,
        communication_mode=session.communication_mode or "audio",
        participant_role=account.role,
        metadata={"sessionId": session_id},
    )
    return JsonResponse(
        {
            "token": token,
            "url": url,
            "room": room,
            "identity": account.id,
            "communicationMode": session.communication_mode,
            "hasSecret": has_secret,
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
        return JsonResponse({"completions": []})
    return JsonResponse({"success": True, "completion": _body(request)})


@csrf_exempt
@require_http_methods(["POST"])
def feedback(_request: HttpRequest) -> JsonResponse:
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
def supervisor_queue(_request: HttpRequest) -> JsonResponse:
    sessions = [
        _session_json(s)
        for s in InterpretationSession.objects.exclude(status__in=("completed", "cancelled")).order_by("-id")[:50]
    ]
    return JsonResponse(
        {
            "activeSessions": sessions,
            "flaggedCompletions": [],
            "pendingUnknown": [],
            "openRequests": [_request_json(r) for r in InterpretationRequest.objects.exclude(status="completed")[:50]],
        }
    )


@csrf_exempt
@require_http_methods(["GET"])
def organizations(_request: HttpRequest) -> JsonResponse:
    orgs: dict[str, Any] = {}
    for account in Account.objects.filter(role="client"):
        name = account.organization_name or "Unknown"
        bucket = orgs.setdefault(name, {"name": name, "accounts": []})
        bucket["accounts"].append(_account_json(account))
    return JsonResponse({"organizations": list(orgs.values())})


@csrf_exempt
@require_http_methods(["GET"])
def supervisors(_request: HttpRequest) -> JsonResponse:
    users = [_account_json(a) for a in Account.objects.filter(role="supervisor")]
    return JsonResponse({"supervisors": users})


@csrf_exempt
@require_http_methods(["GET"])
def reports(_request: HttpRequest) -> JsonResponse:
    return JsonResponse(
        {
            "summary": {
                "totalRequests": InterpretationRequest.objects.count(),
                "activeSessions": InterpretationSession.objects.exclude(
                    status__in=("completed", "cancelled")
                ).count(),
                "interpretersOnline": Interpreter.objects.filter(availability="available").count(),
            }
        }
    )


@csrf_exempt
@require_http_methods(["GET"])
def organization_report(_request: HttpRequest) -> JsonResponse:
    return JsonResponse({"summary": {"totalRequests": InterpretationRequest.objects.count()}})


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
def support_identify(_request: HttpRequest) -> JsonResponse:
    return JsonResponse({"languageCode": "und", "confidence": 0, "message": "Audio identification is not configured."})
