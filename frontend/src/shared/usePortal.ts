import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../shared/api';
import type {
  Assignment,
  AuditLog,
  CommunicationMode,
  CompletionOutcome,
  CompletionReport,
  InterpretationRequest,
  InterpretationSession,
  InterpreterProfile,
  IssueCode,
  Meeting,
  PlatformNotification,
  PlatformSettings,
  ScheduleType,
  ServiceCategory,
  SupportedLanguage,
  UrgencyLevel,
  User,
} from '../shared/types';

export function usePortal() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [interpreterProfile, setInterpreterProfile] = useState<InterpreterProfile | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [languages, setLanguages] = useState<SupportedLanguage[]>([]);
  const [interpreters, setInterpreters] = useState<InterpreterProfile[]>([]);
  const [requests, setRequests] = useState<InterpretationRequest[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sessions, setSessions] = useState<InterpretationSession[]>([]);
  const [completions, setCompletions] = useState<CompletionReport[]>([]);
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState('am');
  const [supportVoice, setSupportVoice] = useState(false);
  const [supportExpanded, setSupportExpanded] = useState(false);

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [activeSessionRoomId, setActiveSessionRoomId] = useState<string | null>(null);
  const [completionModalSessionId, setCompletionModalSessionId] = useState<string | null>(null);
  const [feedbackModalSessionId, setFeedbackModalSessionId] = useState<string | null>(null);
  const [isOrzoSupportOpen, setIsOrzoSupportOpen] = useState(false);
  const [preselectedSourceLanguage, setPreselectedSourceLanguage] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      const [meRes, usersRes] = await Promise.all([api.getMe(), api.getUsers()]);
      setAllUsers(usersRes.users);
      setError(null);

      const signedIn = sessionStorage.getItem('orzo-web-session') === '1' && !!meRes.user;
      if (!signedIn) {
        if (!meRes.user) sessionStorage.removeItem('orzo-web-session');
        setCurrentUser(null);
        setInterpreterProfile(null);
        return;
      }

      // Keep the signed-in shell up even if one secondary endpoint fails
      // (e.g. assignments historically 500'd and blanked the whole app).
      const [langsRes, interpsRes, reqsRes, asgRes, notifsRes, settingsRes] = await Promise.all([
        api.getLanguages().catch(() => ({ languages: [] as SupportedLanguage[] })),
        api.getInterpreters().catch(() => ({ interpreters: [] as InterpreterProfile[] })),
        api.getRequests().catch(() => ({ requests: [] as InterpretationRequest[] })),
        api.getAssignments().catch(() => ({ assignments: [] as Assignment[] })),
        api.getNotifications().catch(() => ({ notifications: [] as PlatformNotification[] })),
        api.getPlatformSettings().catch(() => ({ settings: null as PlatformSettings | null })),
      ]);

      setCurrentUser(meRes.user);
      setInterpreterProfile(meRes.interpreterProfile);
      setLanguages(langsRes.languages);
      setInterpreters(interpsRes.interpreters);
      setRequests(reqsRes.requests);
      setAssignments(asgRes.assignments);
      setNotifications(notifsRes.notifications);
      if (settingsRes.settings) setSettings(settingsRes.settings);

      // Load live sessions for client/interpreter so the call room has real session metadata
      // (shared callRoom = orzo-<requestReference>, like Eliotel's gcall-<classId>).
      if (meRes.user?.role === 'client' || meRes.user?.role === 'interpreter') {
        const liveIds = Array.from(
          new Set(
            reqsRes.requests
              .map((request) => request.activeSessionId)
              .filter((id): id is string => Boolean(id))
          )
        );
        if (liveIds.length) {
          const loaded = await Promise.all(
            liveIds.map((id) => api.getSession(id).then((res) => res.session).catch(() => null))
          );
          setSessions(loaded.filter((row): row is NonNullable<typeof row> => Boolean(row)));
        } else {
          setSessions([]);
        }
      }

      if (meRes.user?.role === 'supervisor' || meRes.user?.role === 'platform_admin') {
        const queueRes = await api.getSupervisorQueue().catch(() => null);
        if (queueRes) {
          setSessions(queueRes.activeSessions);
          setCompletions(queueRes.flaggedCompletions);
        }
      }

      if (meRes.user?.role === 'platform_admin') {
        const auditRes = await api.getAuditLogs().catch(() => null);
        if (auditRes) setAuditLogs(auditRes.auditLogs);
      }

      // Load meetings for platform_admin only (staff get invited — no need for all to poll heavily)
      if (meRes.user?.role === 'platform_admin') {
        api.getMeetings().then((res) => setMeetings(res.meetings || [])).catch(() => {});
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load platform data';
      console.error('Error fetching data:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    // Interpreters need a fast poll so simultaneous rings show up immediately.
    const milliseconds =
      currentUser?.role === 'interpreter' ? 1200 : currentUser?.role === 'client' ? 2500 : 15000;
    const timer = setInterval(refreshData, milliseconds);
    return () => clearInterval(timer);
  }, [refreshData, currentUser?.role]);

  // Extra lightweight pending-assignment poll for interpreters (incoming ring).
  useEffect(() => {
    if (currentUser?.role !== 'interpreter') return;
    let stopped = false;
    const tick = async () => {
      try {
        const asgRes = await api.getAssignments();
        if (stopped) return;
        const pending = asgRes.assignments.filter((item) => item.outcome === 'pending');
        if (!pending.length) return;
        setAssignments((prev) => {
          const others = prev.filter((item) => item.outcome !== 'pending');
          const byId = new Map<string, Assignment>();
          [...others, ...asgRes.assignments].forEach((item) => byId.set(item.id, item));
          return Array.from(byId.values()).sort(
            (a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime(),
          );
        });
      } catch {
        // ignore transient poll errors
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [currentUser?.role]);

  // Poll for new meeting invitations (staff only, platform_admin hosted)
  useEffect(() => {
    if (!currentUser || !['supervisor', 'interpreter', 'platform_admin'].includes(currentUser.role)) return;
    let stopped = false;
    const tick = async () => {
      try {
        const res = await api.getMeetings();
        if (stopped) return;
        const newMeetings = res.meetings || [];
        setMeetings((prev) => {
          const prevById = new Map(prev.map((m) => [m.id, m]));
          for (const m of newMeetings) {
            if (
              m.status === 'active' &&
              !prevById.has(m.id) &&
              m.participants.some(
                (p: { accountId: string; status: string }) =>
                  p.accountId === currentUser.id && p.status === 'invited',
              )
            ) {
              // Show an invitation notification instead of auto-opening the room.
              // The user must click "Join" in the pending invitation UI.
              setPendingMeetingInviteId(m.id);
            }
          }
          return newMeetings;
        });
      } catch {
        // ignore — meeting table may not exist yet
      }
    };
    tick();
    const timer = window.setInterval(tick, 5000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [currentUser?.role, currentUser?.id]);

  const supportOpened = useRef(new Set<string>());
  const knownCompleted = useRef(new Set<string>());
  const completionReadyFor = useRef<string | null>(null);

  // Client must start from the intake form; do not auto-open the call room.
  // Join is explicit via the Join button once an interpreter accepts.

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'client') return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      for (const request of requests) {
        if (feedbackModalSessionId) continue;
        if (request.requesterId !== currentUser.id || !['matching', 'assigned'].includes(request.status)) continue;
        if (supportOpened.current.has(request.reference)) continue;
        const liveSession = sessions.find(
          (item) => item.id === request.activeSessionId || item.requestReference === request.reference,
        );
        if (liveSession && !['awaiting_acceptance', 'searching', 'created'].includes(liveSession.status)) continue;
        const pendingForRequest = assignments.filter(
          (item) => item.requestReference === request.reference && item.outcome === 'pending',
        );
        if (!pendingForRequest.length) continue;
        // Wait until the whole simultaneous ring wave has timed out.
        // Ignore bogus immediate-expiry from clock skew (need at least 5s since assign).
        const stillLive = pendingForRequest.some((item) => {
          const exp = new Date(item.expiresAt).getTime();
          const assigned = new Date(item.assignedAt).getTime();
          if (Number.isFinite(assigned) && now - assigned < 5000) return true;
          return Number.isFinite(exp) && exp > now;
        });
        if (stillLive) continue;
        supportOpened.current.add(request.reference);
        setActiveSessionRoomId(null);
        setSupportVoice(false);
        setSupportExpanded(true);
        setIsOrzoSupportOpen(true);
        Promise.all(pendingForRequest.map((item) => api.expireAssignment(item.id).catch(() => undefined)))
          .then(() => refreshData())
          .catch(() => undefined);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [assignments, requests, sessions, currentUser, refreshData, feedbackModalSessionId]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'client') {
      completionReadyFor.current = null;
      return;
    }
    if (completionReadyFor.current !== currentUser.id) {
      if (loading) return;
      knownCompleted.current = new Set(
        requests
          .filter((request) => request.requesterId === currentUser.id && request.status === 'completed')
          .map((request) => request.reference),
      );
      completionReadyFor.current = currentUser.id;
      setFeedbackModalSessionId(null);
      return;
    }
    for (const request of requests) {
      if (request.requesterId !== currentUser.id || request.status !== 'completed' || !request.activeSessionId) continue;
      if (knownCompleted.current.has(request.reference)) continue;
      knownCompleted.current.add(request.reference);
      setActiveSessionRoomId(null);
      setSupportVoice(false);
      setSupportExpanded(false);
      setIsOrzoSupportOpen(false);
      setFeedbackModalSessionId(request.activeSessionId);
    }
  }, [requests, currentUser, loading]);

  const handleSwitchUser = async (userId: string) => {
    try {
      setLoading(true);
      const res = await api.switchRole(userId);
      setCurrentUser(res.user);
      setInterpreterProfile(res.interpreterProfile);
      await refreshData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not switch user';
      alert(`Could not switch user: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.login({ email, password });
      sessionStorage.setItem('orzo-session-token', res.token);
      sessionStorage.setItem('orzo-web-session', '1');
      setCurrentUser(res.user);
      setInterpreterProfile(res.interpreterProfile);
      await refreshData();
    } catch (err: unknown) {
      sessionStorage.removeItem('orzo-session-token');
      sessionStorage.removeItem('orzo-web-session');
      setLoading(false);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const completePasswordChange = (user: User) => {
    setCurrentUser({ ...user, mustChangePassword: false });
  };

  const acceptPasswordSetup = async (result: { token: string; user: User; interpreterProfile: InterpreterProfile | null }) => {
    sessionStorage.setItem('orzo-session-token', result.token);
    sessionStorage.setItem('orzo-web-session', '1');
    window.history.replaceState({}, '', window.location.pathname);
    setLoading(true);
    setCurrentUser({ ...result.user, mustChangePassword: false });
    setInterpreterProfile(result.interpreterProfile);
    await refreshData();
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // The local session is already cleared.
    }
    sessionStorage.removeItem('orzo-session-token');
    sessionStorage.removeItem('orzo-web-session');
    setCurrentUser(null);
    setInterpreterProfile(null);
    setNotifications([]);
    setFeedbackModalSessionId(null);
    setActiveSessionRoomId(null);
  };

  const handleCreateRequest = async (data: {
    sourceLanguage?: string;
    targetLanguage: string;
    isUnknownLanguage?: boolean;
    unknownLanguageNotes?: string;
    serviceCategory: ServiceCategory;
    urgency: UrgencyLevel;
    modality: CommunicationMode;
    scheduleType: ScheduleType;
    scheduledTime?: string;
    minRoutingContext: string;
  }) => {
    const res = await api.createRequest(data);
    await refreshData();
    const dispatchStatus = String(res.dispatch?.status || '');
    // Never auto-join the LiveKit room from create — desk waits while interpreters ring.
    if (
      dispatchStatus === 'ringing' ||
      res.request.status === 'matching' ||
      res.request.status === 'assigned'
    ) {
      return 'waiting';
    }
    return undefined;
  };

  const handleCancelRequest = async (reference: string, reason?: string) => {
    await api.cancelRequest(reference, reason);
    await refreshData();
  };

  const handleToggleAvailability = async (availability: 'available' | 'busy' | 'offline') => {
    await api.updateAvailability(availability);
    await refreshData();
  };

  const handleRespondAssignment = async (
    assignmentId: string,
    response: 'accepted' | 'rejected',
    reason?: string
  ) => {
    const res = await api.respondToAssignment(assignmentId, response, reason);
    await refreshData();
    if (response === 'accepted' && res.session?.id) setActiveSessionRoomId(res.session.id);
  };

  const handleManualAssign = async (requestReference: string, _interpreterId?: string, _reason?: string) => {
    // Direct ring — no coordinator pick of a single interpreter.
    await api.supervisorRing(requestReference);
    await refreshData();
  };

  const handleResolveUnknownLanguage = async (requestReference: string, languageCode: string, notes?: string) => {
    await api.supervisorResolveUnknown(requestReference, languageCode, notes);
    await refreshData();
  };

  const handleResolveIssue = async (completionId: string, resolutionNote: string) => {
    await api.supervisorResolveIssue(completionId, resolutionNote);
    await refreshData();
  };

  const handleUpdateLanguage = async (code: string, data: Partial<SupportedLanguage>) => {
    await api.updateLanguage(code, data);
    await refreshData();
  };

  const handleAddLanguage = async (data: Partial<SupportedLanguage>) => {
    await api.addLanguage(data);
    await refreshData();
  };

  const handleVerifyInterpreter = async (id: string, verificationState: string, note?: string) => {
    await api.updateInterpreterVerification(id, verificationState, note);
    await refreshData();
  };

  const handleUpdateSettings = async (newSettings: Partial<PlatformSettings>) => {
    await api.updatePlatformSettings(newSettings);
    await refreshData();
  };

  const handleEndSession = async (sessionId: string) => {
    await api.endSession(sessionId);
    await refreshData();
  };

  const handleSubmitCompletion = async (data: {
    sessionId: string;
    requestReference: string;
    outcome: CompletionOutcome;
    durationMinutes: number;
    issueCode: IssueCode;
    notes: string;
  }) => {
    await api.submitCompletion(data);
    setCompletionModalSessionId(null);
    setActiveSessionRoomId(null);
    await refreshData();
  };

  const handleSubmitFeedback = async (data: { sessionId: string; rating: number; comment?: string }) => {
    await api.submitFeedback(data);
    setFeedbackModalSessionId(null);
    setSupportVoice(false);
    setSupportExpanded(false);
    setIsOrzoSupportOpen(false);
    await refreshData();
  };

  const handleMarkNotificationRead = async (id: string) => {
    await api.markNotificationRead(id);
    await refreshData();
  };

  // ── Waiting calls ──
  const handleTakeWaitingCall = async (reference: string) => {
    const res = await api.takeWaitingCall(reference);
    setSessions((prev) => {
      const others = prev.filter((s) => s.id !== res.session.id);
      return [res.session, ...others];
    });
    setActiveSessionRoomId(res.session.id);
    await refreshData();
  };

  // ── Group meetings ──
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
  // Pending invitation — set when a new active meeting arrives; cleared when user joins or dismisses.
  const [pendingMeetingInviteId, setPendingMeetingInviteId] = useState<string | null>(null);

  const refreshMeetings = useCallback(async () => {
    try {
      const res = await api.getMeetings();
      setMeetings(res.meetings || []);
    } catch {
      // ignore
    }
  }, []);

  const handleCreateMeeting = async (data: {
    title: string;
    communicationMode: string;
    participantIds: string[];
  }) => {
    const res = await api.createMeeting(data);
    setMeetings((prev) => [res.meeting, ...prev]);
    setActiveMeetingId(res.meeting.id);
    return res.meeting;
  };

  const handleJoinMeeting = (meetingId: string) => {
    // Explicit user join — clear any pending invite and open the room.
    setPendingMeetingInviteId(null);
    setActiveMeetingId(meetingId);
  };

  const handleDismissMeetingInvite = () => {
    setPendingMeetingInviteId(null);
  };

  const handleEndMeeting = async (meetingId: string) => {
    await api.endMeeting(meetingId);
    setActiveMeetingId(null);
    setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
  };

  return {
    currentUser,
    interpreterProfile,
    allUsers,
    languages,
    interpreters,
    requests,
    assignments,
    sessions,
    completions,
    notifications,
    auditLogs,
    settings,
    loading,
    error,
    locale,
    setLocale,
    supportVoice,
    supportExpanded,
    openSupport: (voice: boolean) => {
      setSupportVoice(voice);
      setSupportExpanded(false);
      setIsOrzoSupportOpen(true);
    },
    closeSupport: () => {
      setSupportVoice(false);
      setSupportExpanded(false);
      setIsOrzoSupportOpen(false);
    },
    isNotificationOpen,
    setIsNotificationOpen,
    activeSessionRoomId,
    setActiveSessionRoomId,
    completionModalSessionId,
    setCompletionModalSessionId,
    feedbackModalSessionId,
    setFeedbackModalSessionId,
    isOrzoSupportOpen,
    setIsOrzoSupportOpen,
    preselectedSourceLanguage,
    setPreselectedSourceLanguage,
    refreshData,
    handleSwitchUser,
    handleLogin,
    handleLogout,
    completePasswordChange,
    acceptPasswordSetup,
    handleCreateRequest,
    handleCancelRequest,
    handleToggleAvailability,
    handleRespondAssignment,
    handleManualAssign,
    handleResolveUnknownLanguage,
    handleResolveIssue,
    handleUpdateLanguage,
    handleAddLanguage,
    handleVerifyInterpreter,
    handleUpdateSettings,
    handleEndSession,
    handleSubmitCompletion,
    handleSubmitFeedback,
    handleMarkNotificationRead,
    handleTakeWaitingCall,
    meetings,
    activeMeetingId,
    setActiveMeetingId,
    refreshMeetings,
    handleCreateMeeting,
    handleJoinMeeting,
    handleEndMeeting,
    pendingMeetingInviteId,
    handleDismissMeetingInvite,
  };
}

export type PortalState = ReturnType<typeof usePortal>;
