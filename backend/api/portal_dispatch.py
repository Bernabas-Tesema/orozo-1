"""Dispatch / session helpers for the portal API."""

from __future__ import annotations

import re
import secrets
from datetime import timedelta
from typing import Any, Optional

from django.utils import timezone

from .models import (
    Account,
    Assignment,
    InterpretationRequest,
    InterpretationSession,
    Interpreter,
    PlatformSettings,
)


def account_for_interpreter(interp: Interpreter) -> Optional[Account]:
    return Account.objects.filter(email__iexact=interp.email).first()


def assignment_timeout_seconds() -> int:
    row = PlatformSettings.objects.filter(pk=1).first()
    # Keep ring window long enough for poll + ringtone UI (min 60s).
    raw = row.assignment_timeout_seconds if row else 60
    return max(60, int(raw or 60))


def low_bandwidth_preset() -> bool:
    row = PlatformSettings.objects.filter(pk=1).first()
    return row.telecom_low_bandwidth_preset if row else True


def create_ringing_session(req: InterpretationRequest) -> InterpretationSession:
    """Session shell while free interpreters are ringing (no assignee yet)."""
    authorized = [req.requester_id]
    session = InterpretationSession.objects.filter(request_reference=req.reference).first()
    if not session:
        session = InterpretationSession(
            id=f"SES-{secrets.token_hex(3).upper()}",
            request_reference=req.reference,
            session_token=f"SES-TOKEN-{secrets.token_hex(4)}",
            status="awaiting_acceptance",
            communication_mode=req.modality or "audio",
            low_bandwidth_mode=low_bandwidth_preset(),
            recording_enabled=False,
            duration_seconds=0,
            interpreter_id=None,
            interpreter_name="",
            client_id=req.requester_id,
            client_name=req.requester_name,
            organization_name=req.organization_name or "",
            source_language=req.source_language,
            target_language=req.target_language,
            service_category=req.service_category,
            connection_health="optimal",
            authorized_participant_ids=authorized,
        )
        session.save()
    else:
        session.status = "awaiting_acceptance"
        session.interpreter_id = None
        session.interpreter_name = ""
        session.authorized_participant_ids = authorized
        session.client_id = req.requester_id
        session.client_name = req.requester_name
        session.communication_mode = req.modality or session.communication_mode or "audio"
        session.source_language = req.source_language
        session.target_language = req.target_language
        session.service_category = req.service_category
        session.save()

    req.active_session_id = session.id
    req.assigned_interpreter_id = None
    req.assigned_interpreter_name = None
    req.status = "matching"
    req.updated_at = timezone.now()
    req.save(
        update_fields=[
            "active_session_id",
            "assigned_interpreter_id",
            "assigned_interpreter_name",
            "status",
            "updated_at",
        ]
    )
    return session


def create_or_update_session(req: InterpretationRequest, interp: Interpreter) -> InterpretationSession:
    linked = account_for_interpreter(interp)
    authorized = [req.requester_id]
    if linked:
        authorized.append(linked.id)

    session = InterpretationSession.objects.filter(request_reference=req.reference).first()
    if not session:
        session = InterpretationSession(
            id=f"SES-{secrets.token_hex(3).upper()}",
            request_reference=req.reference,
            session_token=f"SES-TOKEN-{secrets.token_hex(4)}",
            status="awaiting_acceptance",
            communication_mode=req.modality or "audio",
            low_bandwidth_mode=low_bandwidth_preset(),
            recording_enabled=False,
            duration_seconds=0,
            interpreter_id=interp.id,
            interpreter_name=interp.full_name,
            client_id=req.requester_id,
            client_name=req.requester_name,
            organization_name=req.organization_name or "",
            source_language=req.source_language,
            target_language=req.target_language,
            service_category=req.service_category,
            connection_health="optimal",
            authorized_participant_ids=authorized,
        )
        session.save()
    else:
        session.interpreter_id = interp.id
        session.interpreter_name = interp.full_name
        session.status = "awaiting_acceptance"
        session.authorized_participant_ids = authorized
        session.client_id = req.requester_id
        session.client_name = req.requester_name
        session.save()

    req.assigned_interpreter_id = interp.id
    req.assigned_interpreter_name = interp.full_name
    req.active_session_id = session.id
    req.status = "assigned"
    req.updated_at = timezone.now()
    req.save(
        update_fields=[
            "assigned_interpreter_id",
            "assigned_interpreter_name",
            "active_session_id",
            "status",
            "updated_at",
        ]
    )
    return session


def cancel_other_pending_assignments(request_reference: str, keep_assignment_id: str) -> int:
    now = timezone.now()
    return Assignment.objects.filter(
        request_reference=request_reference,
        outcome="pending",
    ).exclude(pk=keep_assignment_id).update(outcome="expired", responded_at=now)


def pending_ring_count(request_reference: str) -> int:
    return Assignment.objects.filter(request_reference=request_reference, outcome="pending").count()


def max_auto_retries() -> int:
    row = PlatformSettings.objects.filter(pk=1).first()
    return int(row.max_auto_retries) if row else 3


def ring_wave_count(request_reference: str) -> int:
    """Count distinct ring waves by assigned_at second buckets (DB-agnostic)."""
    stamps = Assignment.objects.filter(request_reference=request_reference).values_list(
        "assigned_at", flat=True
    )
    buckets: set[str] = set()
    for stamp in stamps:
        if not stamp:
            continue
        buckets.add(stamp.replace(microsecond=0).isoformat())
    return len(buckets)


def hold_unanswered(req: InterpretationRequest, reason: str) -> None:
    """No coordinator assignment queue — keep request open for another direct ring or support."""
    req.status = "unresolved"
    req.escalation_reason = reason
    req.updated_at = timezone.now()
    req.save(update_fields=["status", "escalation_reason", "updated_at"])
    InterpretationSession.objects.filter(request_reference=req.reference).exclude(
        status__in=("completed", "cancelled", "active", "ready_to_join")
    ).update(status="awaiting_acceptance")


def create_assignment(
    req: InterpretationRequest,
    interp: Interpreter,
    *,
    reason: str = "",
    manual: bool = False,
) -> Assignment:
    now = timezone.now()
    timeout = assignment_timeout_seconds()
    prefix = "asg-manual" if manual else "asg"
    assignment = Assignment.objects.create(
        id=f"{prefix}-{secrets.token_hex(4)}",
        request_reference=req.reference,
        interpreter_id=interp.id,
        interpreter_name=interp.full_name,
        assigned_at=now,
        expires_at=now + timedelta(seconds=timeout if not manual else max(timeout, 120)),
        outcome="pending",
        reason=reason or "",
    )
    return assignment


def _lang_codes(raw) -> set[str]:
    codes: set[str] = set()
    for item in raw or []:
        if isinstance(item, dict):
            code = item.get("languageCode") or item.get("code") or item.get("name")
            if code:
                codes.add(str(code).lower())
        else:
            text = str(item or "").strip().lower()
            if text:
                codes.add(text)
    return codes


def _category_codes(raw) -> set[str]:
    cats: set[str] = set()
    for item in raw or []:
        if isinstance(item, dict):
            code = item.get("category") or item.get("code") or item.get("name")
            if code:
                cats.add(str(code).lower())
        else:
            text = str(item or "").strip().lower()
            if text:
                cats.add(text)
    return cats


def language_match(interp: Interpreter, source: str, target: str) -> bool:
    codes = _lang_codes(interp.languages)
    if not codes:
        return True
    src = (source or "").lower()
    tgt = (target or "").lower()
    if src in ("unknown", ""):
        return True
    return src in codes or tgt in codes


def category_match(interp: Interpreter, category: str) -> bool:
    cats = _category_codes(interp.categories)
    if not cats:
        return True
    return (category or "").lower() in cats


def find_candidates(
    req: InterpretationRequest,
    *,
    loose: bool = False,
    include_offline: bool = False,
) -> list[Interpreter]:
    """Interpreters to ring. Busy (on a call) are never included."""
    qs = Interpreter.objects.exclude(verification_state__in=("rejected", "suspended")).exclude(
        availability="busy"
    )
    if not include_offline:
        qs = qs.filter(availability="available")

    scored: list[tuple[int, Interpreter]] = []
    for interp in qs:
        if not loose:
            if not language_match(interp, req.source_language, req.target_language):
                continue
            if not category_match(interp, req.service_category):
                continue
        score = 50
        if interp.availability == "available":
            score += 25
        if interp.verification_state == "verified":
            score += 20
        score += int(interp.rating or 0) * 5
        if language_match(interp, req.source_language, req.target_language):
            score += 15
        if category_match(interp, req.service_category):
            score += 10
        scored.append((score, interp))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    # One ring per person even if duplicate Interpreter rows share an email.
    deduped: list[Interpreter] = []
    seen_emails: set[str] = set()
    for interp in (interp for _, interp in scored):
        key = (interp.email or "").strip().lower() or interp.id
        if key in seen_emails:
            continue
        seen_emails.add(key)
        deduped.append(interp)
    return deduped


def try_auto_dispatch(req: InterpretationRequest) -> Optional[dict[str, Any]]:
    """Ring free interpreters directly — no coordinator assignment step."""
    if req.schedule_type == "scheduled":
        req.status = "submitted"
        req.save(update_fields=["status"])
        return None

    # Fresh ring wave: clear stale pendings for this request first.
    Assignment.objects.filter(request_reference=req.reference, outcome="pending").update(
        outcome="expired",
        responded_at=timezone.now(),
    )

    # 1) available + language/category
    # 2) available any language
    # 3) offline + language/category (still ring desks that forgot to toggle Available)
    # 4) offline any language
    candidates = find_candidates(req, loose=False, include_offline=False)
    if not candidates:
        candidates = find_candidates(req, loose=True, include_offline=False)
    if not candidates:
        candidates = find_candidates(req, loose=False, include_offline=True)
    if not candidates:
        candidates = find_candidates(req, loose=True, include_offline=True)
    if not candidates:
        # All matching interpreters may be on an active call. Keep the request
        # waiting and automatically dispatch it as soon as an interpreter frees.
        session = create_ringing_session(req)
        return {
            "status": "queued",
            "sessionId": session.id,
            "reason": "Matching interpreters are busy",
        }

    # Skip interpreters who already rejected this request in prior waves.
    rejected_ids = set(
        Assignment.objects.filter(
            request_reference=req.reference, outcome="rejected"
        ).values_list("interpreter_id", flat=True)
    )
    fresh = [c for c in candidates if c.id not in rejected_ids] or candidates

    session = create_ringing_session(req)
    assignments = [create_assignment(req, interp) for interp in fresh]
    return {
        "status": "ringing",
        "sessionId": session.id,
        "session": {
            "id": session.id,
            "requestReference": session.request_reference,
            "sessionToken": session.session_token,
            "status": session.status,
            "communicationMode": session.communication_mode,
            "callRoom": resolve_call_room(session),
        },
        "assignmentIds": [a.id for a in assignments],
        "interpreters": [{"id": interp.id, "name": interp.full_name} for interp in fresh],
        "candidateCount": len(fresh),
    }


def on_ring_exhausted(req: InterpretationRequest) -> Optional[dict[str, Any]]:
    """When nobody answers: re-ring available interpreters (no coordinator assign)."""
    waves = ring_wave_count(req.reference)
    retries = max(1, max_auto_retries())
    if waves < retries:
        return try_auto_dispatch(req)
    hold_unanswered(req, "No interpreter answered after direct ring attempts")
    return {"status": "unresolved", "reason": req.escalation_reason}


def reroute_waiting_requests() -> int:
    """Ring matching queued calls as soon as any interpreter becomes available."""
    routed = 0
    waiting = InterpretationRequest.objects.filter(status="matching").order_by("created_at")
    for req in waiting:
        if try_auto_dispatch(req).get("status") == "ringing":
            routed += 1
    return routed


def report_window_ms(range_key: str) -> int:
    mapping = {
        "day": 24 * 60 * 60 * 1000,
        "week": 7 * 24 * 60 * 60 * 1000,
        "month": 30 * 24 * 60 * 60 * 1000,
        "quarter": 90 * 24 * 60 * 60 * 1000,
        "year": 365 * 24 * 60 * 60 * 1000,
    }
    return mapping.get(range_key, mapping["month"])


def minutes_for_request(reference: str) -> int:
    session = InterpretationSession.objects.filter(request_reference=reference).first()
    if not session:
        return 0
    return max(0, int(round(session.duration_seconds / 60)))


def sanitize_room_id(value: str) -> str:
    cleaned = re.sub(r"[^\w.-]+", "-", str(value or "")).strip("-")
    cleaned = re.sub(r"-+", "-", cleaned)
    return cleaned or "room"


def resolve_call_room(session: InterpretationSession) -> str:
    """
    Stable LiveKit room shared by client + interpreter for one request.

    Mirrors Eliotel's gcall-<classId> pattern: both parties must land in the
    same room even if they join from different session id lookups.
    """
    key = session.request_reference or session.id
    return f"orzo-{sanitize_room_id(key)}"
