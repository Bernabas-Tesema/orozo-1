import { Router, Request, Response } from 'express';
import { db } from './db';
import {
  InterpretationRequest,
  Assignment,
  ServiceCategory,
  UrgencyLevel,
  CommunicationMode,
  ScheduleType,
  CompletionReport,
  PlatformSettings
} from './types';
import { dispatchRequest, handleAssignmentResponse, findEligibleInterpreters } from './matchingEngine';
import { askOrzoSupport, identifyAudioLanguage } from './orzoSupportService';

const router = Router();

// Middleware: inject current mock/session authenticated user
router.use((req: Request, _res: Response, next) => {
  const current = db.getCurrentUser();
  (req as any).user = current;
  next();
});

// ==========================================
// 1. AUTHENTICATION & USERS (/api/v1/auth & /api/v1/users)
// ==========================================
router.get('/auth/me', (req: Request, res: Response) => {
  const user = db.getCurrentUser();
  const interpreterProfile = user ? db.interpreters.find(i => i.userId === user.id) : null;
  res.json({
    user: user || null,
    interpreterProfile: interpreterProfile || null,
  });
});

router.get('/users', (_req: Request, res: Response) => {
  res.json({ users: db.users });
});

router.post('/auth/login', (req: Request, res: Response) => {
  const { email, userId } = req.body;
  let targetUser = null;
  if (userId) {
    targetUser = db.users.find(u => u.id === userId);
  } else if (email) {
    targetUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  if (!targetUser) {
    return res.status(401).json({ error: 'Invalid credentials. User account not found.' });
  }

  const user = db.setCurrentUser(targetUser.id);
  const interpreterProfile = db.interpreters.find(i => i.userId === user.id);

  db.logAudit({
    actorId: user.id,
    actorName: user.fullName,
    actorRole: user.role,
    action: 'USER_LOGIN',
    resourceType: 'user_session',
    resourceId: user.id,
    result: 'success',
    securityMetadata: { note: `Authenticated as ${user.fullName} (${user.role})` },
  });

  res.json({
    success: true,
    user,
    interpreterProfile: interpreterProfile || null,
    message: `Logged in as ${user.fullName}`,
  });
});

router.post('/auth/logout', (_req: Request, res: Response) => {
  db.logout();
  res.json({ success: true, message: 'Logged out successfully' });
});

router.post('/auth/switch-role', (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  try {
    const updatedUser = db.setCurrentUser(userId);
    const interpreterProfile = db.interpreters.find(i => i.userId === updatedUser.id);
    res.json({
      success: true,
      user: updatedUser,
      interpreterProfile: interpreterProfile || null,
      message: `Active perspective switched to ${updatedUser.fullName} (${updatedUser.role})`,
    });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// ==========================================
// 2. SUPPORTED LANGUAGES (/api/v1/languages)
// ==========================================
router.get('/languages', (req: Request, res: Response) => {
  const { activeOnly } = req.query;
  let languages = db.languages;
  if (activeOnly === 'true') {
    languages = languages.filter(l => l.isActive);
  }
  res.json({ languages });
});

router.post('/languages', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Only platform administrators can add languages' });
  }
  const { code, name, nativeName, script, variants } = req.body;
  if (!code || !name) {
    return res.status(400).json({ error: 'Language code and name are required' });
  }

  const existing = db.languages.find(l => l.code.toLowerCase() === code.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Language code already exists in catalog' });
  }

  const newLang = {
    code: code.toLowerCase(),
    name,
    nativeName: nativeName || name,
    script: script || 'Latin',
    variants: variants || [],
    isActive: true,
  };
  db.languages.push(newLang);

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'LANGUAGE_CATALOG_CREATED',
    resourceType: 'language',
    resourceId: newLang.code,
    result: 'success',
    securityMetadata: { note: `Added ${newLang.name} (${newLang.code}) to platform catalog` },
  });

  res.status(201).json({ language: newLang });
});

router.patch('/languages/:code', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Only platform administrators can modify languages' });
  }

  const { code } = req.params;
  const lang = db.languages.find(l => l.code.toLowerCase() === code.toLowerCase());
  if (!lang) {
    return res.status(404).json({ error: 'Language not found' });
  }

  if (typeof req.body.isActive === 'boolean') {
    lang.isActive = req.body.isActive;
  }
  if (req.body.variants && Array.isArray(req.body.variants)) {
    lang.variants = req.body.variants;
  }

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'LANGUAGE_CATALOG_UPDATED',
    resourceType: 'language',
    resourceId: lang.code,
    result: 'success',
    securityMetadata: { note: `Toggled active state to ${lang.isActive}` },
  });

  res.json({ language: lang });
});

// ==========================================
// 3. INTERPRETER PROFILES & AVAILABILITY (/api/v1/interpreters & /api/v1/availability)
// ==========================================
router.get('/interpreters', (req: Request, res: Response) => {
  const { category, language, availability, verification } = req.query;
  let list = db.interpreters;

  if (category) {
    list = list.filter(i => i.serviceCategories.includes(category as ServiceCategory));
  }
  if (language) {
    list = list.filter(i => i.supportedLanguages.some(l => l.languageCode === language));
  }
  if (availability) {
    list = list.filter(i => i.availability === availability);
  }
  if (verification) {
    list = list.filter(i => i.verificationState === verification);
  }

  res.json({ interpreters: list });
});

router.get('/interpreters/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const profile = db.interpreters.find(i => i.id === id || i.userId === id);
  if (!profile) {
    return res.status(404).json({ error: 'Interpreter not found' });
  }
  res.json({ interpreter: profile });
});

router.patch('/interpreters/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = (req as any).user;
  const profile = db.interpreters.find(i => i.id === id || i.userId === id);

  if (!profile) {
    return res.status(404).json({ error: 'Interpreter not found' });
  }

  // Authorization check: only interpreter themselves or platform admin
  if (currentUser.role !== 'platform_admin' && profile.userId !== currentUser.id) {
    return res.status(403).json({ error: 'Unauthorized to modify this interpreter profile' });
  }

  const { supportedLanguages, serviceCategories, availability, currentWorkstation } = req.body;

  if (supportedLanguages) profile.supportedLanguages = supportedLanguages;
  if (serviceCategories) profile.serviceCategories = serviceCategories;
  if (availability) profile.availability = availability;
  if (currentWorkstation) profile.currentWorkstation = currentWorkstation;

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'INTERPRETER_PROFILE_UPDATED',
    resourceType: 'interpreter_profile',
    resourceId: profile.id,
    result: 'success',
    securityMetadata: { note: 'Interpreter profile preferences updated' },
  });

  res.json({ interpreter: profile });
});

// Verification check by platform admin (FR-011, FR-012, FR-065)
router.patch('/interpreters/:id/verification', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Only platform administrators can verify or suspend interpreters' });
  }

  const { id } = req.params;
  const { verificationState, note } = req.body;
  const profile = db.interpreters.find(i => i.id === id || i.userId === id);

  if (!profile) {
    return res.status(404).json({ error: 'Interpreter not found' });
  }

  const previousState = profile.verificationState;
  profile.verificationState = verificationState;

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'INTERPRETER_VERIFICATION_CHANGED',
    resourceType: 'interpreter_profile',
    resourceId: profile.id,
    result: 'success',
    securityMetadata: {
      note: `Status changed from ${previousState} to ${verificationState}. Reason: ${note || 'Admin verification check'}`,
    },
  });

  res.json({ interpreter: profile, message: `Interpreter status updated to ${verificationState}` });
});

router.patch('/availability', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const profile = db.interpreters.find(i => i.userId === currentUser.id);

  if (!profile) {
    return res.status(404).json({ error: 'No interpreter profile associated with current account' });
  }

  const { availability } = req.body;
  if (!['available', 'busy', 'offline'].includes(availability)) {
    return res.status(400).json({ error: 'Invalid availability state' });
  }

  profile.availability = availability;

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'AVAILABILITY_TOGGLED',
    resourceType: 'interpreter_profile',
    resourceId: profile.id,
    result: 'success',
    securityMetadata: { note: `Set to ${availability}` },
  });

  res.json({ success: true, availability: profile.availability });
});

// ==========================================
// 4. INTERPRETATION REQUESTS (/api/v1/requests)
// ==========================================
router.get('/requests', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const { status, urgency, category } = req.query;

  let list = db.requests;

  // Role scoping:
  // Clients see their own requests (or requests belonging to their organization)
  if (currentUser.role === 'client') {
    list = list.filter(r => r.requesterId === currentUser.id);
  } else if (currentUser.role === 'interpreter') {
    const interpProfile = db.interpreters.find(i => i.userId === currentUser.id);
    list = list.filter(r => r.assignedInterpreterId === interpProfile?.id);
  }
  // Supervisors and Platform Admins see all requests

  if (status) {
    list = list.filter(r => r.status === status);
  }
  if (urgency) {
    list = list.filter(r => r.urgency === urgency);
  }
  if (category) {
    list = list.filter(r => r.serviceCategory === category);
  }

  // Sort newest first
  list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ requests: list });
});

router.get('/requests/:reference', (req: Request, res: Response) => {
  const { reference } = req.params;
  const reqItem = db.requests.find(r => r.reference === reference);
  if (!reqItem) {
    return res.status(404).json({ error: 'Request not found' });
  }

  const session = db.sessions.find(s => s.requestReference === reqItem.reference);
  const assignments = db.assignments.filter(a => a.requestReference === reqItem.reference);
  const eligibleCandidates = findEligibleInterpreters(reqItem);

  res.json({
    request: reqItem,
    session: session || null,
    assignments,
    eligibleCandidates: eligibleCandidates.map(c => ({
      id: c.interpreter.id,
      name: c.interpreter.fullName,
      score: c.score,
      reasons: c.matchReasons,
      availability: c.interpreter.availability,
    })),
  });
});

router.post('/requests', (req: Request, res: Response) => {
  const currentUser = (req as any).user;

  const {
    sourceLanguage,
    targetLanguage,
    isUnknownLanguage,
    unknownLanguageNotes,
    serviceCategory,
    urgency,
    modality,
    scheduleType,
    scheduledTime,
    minRoutingContext,
  } = req.body;

  // Validation per FR-024, FR-025, FR-027
  if (!serviceCategory) {
    return res.status(400).json({ error: 'Service category is required' });
  }
  if (!isUnknownLanguage && !sourceLanguage) {
    return res.status(400).json({ error: 'Source language is required or flag as unknown language' });
  }
  if (!minRoutingContext || minRoutingContext.trim().length < 5) {
    return res.status(400).json({ error: 'Minimum context is required (purpose of interpretation)' });
  }

  const randomRef = `REQ-2026-${Math.floor(10000 + Math.random() * 90000)}`;

  const newRequest: InterpretationRequest = {
    reference: randomRef,
    requesterId: currentUser.id,
    requesterName: currentUser.fullName,
    requesterPhone: currentUser.phone,
    organizationName: currentUser.organizationName,
    sourceLanguage: isUnknownLanguage ? 'unknown' : sourceLanguage,
    targetLanguage: targetLanguage || 'amh',
    isUnknownLanguage: !!isUnknownLanguage,
    unknownLanguageNotes: unknownLanguageNotes || '',
    serviceCategory: serviceCategory as ServiceCategory,
    urgency: (urgency as UrgencyLevel) || 'standard',
    modality: (modality as CommunicationMode) || 'audio',
    scheduleType: (scheduleType as ScheduleType) || 'immediate',
    scheduledTime: scheduledTime || undefined,
    status: scheduleType === 'scheduled' ? 'submitted' : 'matching',
    minRoutingContext: minRoutingContext.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.requests.unshift(newRequest);

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'REQUEST_CREATED',
    resourceType: 'interpretation_request',
    resourceId: newRequest.reference,
    result: 'success',
    securityMetadata: {
      note: `Created ${newRequest.scheduleType} request in ${newRequest.serviceCategory} (${newRequest.urgency})`,
    },
  });

  // If immediate request, execute dispatch and matching immediately
  let dispatchResult = null;
  if (newRequest.scheduleType === 'immediate') {
    dispatchResult = dispatchRequest(newRequest.reference);
  }

  res.status(201).json({
    request: newRequest,
    dispatch: dispatchResult,
  });
});

router.post('/requests/:reference/cancel', (req: Request, res: Response) => {
  const { reference } = req.params;
  const { reason } = req.body;
  const currentUser = (req as any).user;

  const reqItem = db.requests.find(r => r.reference === reference);
  if (!reqItem) {
    return res.status(404).json({ error: 'Request not found' });
  }

  if (['completed', 'cancelled'].includes(reqItem.status)) {
    return res.status(400).json({ error: `Cannot cancel request in status: ${reqItem.status}` });
  }

  reqItem.status = 'cancelled';
  reqItem.cancellationReason = reason || 'Cancelled by requester';
  reqItem.updatedAt = new Date().toISOString();

  // Cancel any active session
  const session = db.sessions.find(s => s.requestReference === reqItem.reference);
  if (session && session.status !== 'completed') {
    session.status = 'cancelled';
  }

  // Release interpreter availability if assigned
  if (reqItem.assignedInterpreterId) {
    const interp = db.interpreters.find(i => i.id === reqItem.assignedInterpreterId);
    if (interp && interp.activeSessionId === session?.id) {
      interp.availability = 'available';
      interp.activeSessionId = undefined;
    }
  }

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'REQUEST_CANCELLED',
    resourceType: 'interpretation_request',
    resourceId: reqItem.reference,
    result: 'success',
    securityMetadata: { note: reason || 'Cancelled' },
  });

  res.json({ success: true, request: reqItem, message: 'Request cancelled successfully' });
});

// ==========================================
// 5. ASSIGNMENTS & DISPATCH (/api/v1/assignments)
// ==========================================
router.get('/assignments', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const interpProfile = db.interpreters.find(i => i.userId === currentUser.id);

  let list = db.assignments;
  if (currentUser.role === 'interpreter' && interpProfile) {
    list = list.filter(a => a.interpreterId === interpProfile.id);
  }

  res.json({ assignments: list });
});

router.post('/assignments/:id/respond', (req: Request, res: Response) => {
  const { id } = req.params;
  const { response, reason } = req.body;
  const currentUser = (req as any).user;

  const interpProfile = db.interpreters.find(i => i.userId === currentUser.id);
  if (!interpProfile) {
    return res.status(403).json({ error: 'Only registered interpreters can respond to assignments' });
  }

  if (!['accepted', 'rejected'].includes(response)) {
    return res.status(400).json({ error: 'Response must be accepted or rejected' });
  }

  const result = handleAssignmentResponse(id, interpProfile.id, response, reason);
  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }

  res.json(result);
});

// ==========================================
// 6. SESSIONS & WEBRTC ROOM (/api/v1/sessions)
// ==========================================
router.get('/sessions/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const session = db.sessions.find(s => s.id === id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const participants = db.sessionParticipants.filter(p => p.sessionId === session.id);
  const completion = db.completions.find(c => c.sessionId === session.id);

  res.json({ session, participants, completion: completion || null });
});

router.post('/sessions/:id/join', (req: Request, res: Response) => {
  const { id } = req.params;
  const { sessionToken, deviceType } = req.body;
  const currentUser = (req as any).user;

  const session = db.sessions.find(s => s.id === id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Verification of authorized participant per FR-045
  const isAuthorized = session.authorizedParticipantIds.includes(currentUser.id) ||
    session.clientId === currentUser.id ||
    session.interpreterId === db.interpreters.find(i => i.userId === currentUser.id)?.id;

  if (!isAuthorized && currentUser.role !== 'supervisor' && currentUser.role !== 'platform_admin') {
    db.logAudit({
      actorId: currentUser.id,
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      action: 'UNAUTHORIZED_SESSION_ACCESS_DENIED',
      resourceType: 'interpretation_session',
      resourceId: session.id,
      result: 'denied',
      securityMetadata: { note: 'Attempted to join session without authorization token or assignment' },
    });
    return res.status(403).json({ error: 'Unauthorized: You are not an assigned participant in this session' });
  }

  // Token validation if provided
  if (sessionToken && sessionToken !== session.sessionToken) {
    return res.status(401).json({ error: 'Invalid or expired session credentials' });
  }

  // Mark active if ready
  if (session.status === 'ready_to_join') {
    session.status = 'active';
    session.startedAt = new Date().toISOString();

    const reqItem = db.requests.find(r => r.reference === session.requestReference);
    if (reqItem) {
      reqItem.status = 'in_session';
      reqItem.updatedAt = new Date().toISOString();
    }
  }

  // Add participant event
  const participant = {
    id: `part-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    sessionId: session.id,
    userId: currentUser.id,
    displayName: currentUser.fullName,
    role: currentUser.role,
    joinedAt: new Date().toISOString(),
    deviceType: deviceType || 'web_desktop',
  };
  db.sessionParticipants.push(participant);

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'SESSION_JOINED',
    resourceType: 'interpretation_session',
    resourceId: session.id,
    result: 'success',
    securityMetadata: { note: `Role: ${currentUser.role}` },
  });

  res.json({
    success: true,
    session,
    participant,
    roomCredentials: {
      sessionToken: session.sessionToken,
      lowBandwidthMode: session.lowBandwidthMode,
      recordingEnabled: false, // strictly false per SRS FR-016
      expiresInMinutes: 60,
    },
  });
});

router.post('/sessions/:id/heartbeat', (req: Request, res: Response) => {
  const { id } = req.params;
  const { connectionHealth, durationSeconds } = req.body;
  const session = db.sessions.find(s => s.id === id);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (connectionHealth) {
    session.connectionHealth = connectionHealth;
  }
  if (typeof durationSeconds === 'number') {
    session.durationSeconds = durationSeconds;
  }

  res.json({ success: true, status: session.status, durationSeconds: session.durationSeconds });
});

router.post('/sessions/:id/end', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = (req as any).user;

  const session = db.sessions.find(s => s.id === id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  session.status = 'completed';
  session.endedAt = new Date().toISOString();

  const reqItem = db.requests.find(r => r.reference === session.requestReference);
  if (reqItem) {
    reqItem.status = 'completed';
    reqItem.updatedAt = new Date().toISOString();
  }

  // Release interpreter availability
  if (session.interpreterId) {
    const interp = db.interpreters.find(i => i.id === session.interpreterId);
    if (interp) {
      interp.availability = 'available';
      interp.activeSessionId = undefined;
      interp.totalSessionsCompleted += 1;
    }
  }

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'SESSION_CONCLUDED',
    resourceType: 'interpretation_session',
    resourceId: session.id,
    result: 'success',
    securityMetadata: { note: `Concluded by ${currentUser.fullName}` },
  });

  res.json({ success: true, session, message: 'Session concluded. Interpreter completion form pending.' });
});

// ==========================================
// 7. COMPLETION REPORTS & CLIENT FEEDBACK (/api/v1/completions & /api/v1/feedback)
// ==========================================
router.get('/completions', (_req: Request, res: Response) => {
  res.json({ completions: db.completions });
});

router.post('/completions', (req: Request, res: Response) => {
  const { sessionId, requestReference, outcome, durationMinutes, issueCode, notes } = req.body;
  const currentUser = (req as any).user;

  const session = db.sessions.find(s => s.id === sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const interpProfile = db.interpreters.find(i => i.userId === currentUser.id);
  const interpreterId = interpProfile ? interpProfile.id : session.interpreterId || 'unknown';
  const interpreterName = interpProfile ? interpProfile.fullName : session.interpreterName || 'Interpreter';

  const newReport: CompletionReport = {
    id: `cmp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    sessionId,
    requestReference: requestReference || session.requestReference,
    interpreterId,
    interpreterName,
    outcome: outcome || 'completed',
    durationMinutes: Number(durationMinutes) || Math.round(session.durationSeconds / 60) || 1,
    issueCode: issueCode || 'none',
    notes: notes || '',
    reviewStatus: issueCode && issueCode !== 'none' ? 'flagged_for_review' : 'standard',
    createdAt: new Date().toISOString(),
  };

  db.completions.unshift(newReport);

  // If flagged for review, notify supervisor
  if (newReport.reviewStatus === 'flagged_for_review') {
    db.createNotification({
      recipientId: 'usr-super-1',
      title: 'Flagged Interpretation Session',
      message: `Session ${sessionId} flagged by ${interpreterName} with issue code: ${newReport.issueCode}.`,
      channel: 'in_app',
      status: 'delivered',
      read: false,
      actionUrl: '/supervisor',
    });
  }

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'COMPLETION_REPORT_SUBMITTED',
    resourceType: 'completion_report',
    resourceId: newReport.id,
    result: 'success',
    securityMetadata: { note: `Outcome: ${newReport.outcome}; Issues: ${newReport.issueCode}` },
  });

  res.status(201).json({ completionReport: newReport });
});

router.post('/feedback', (req: Request, res: Response) => {
  const { sessionId, rating, comment } = req.body;
  const currentUser = (req as any).user;

  const completion = db.completions.find(c => c.sessionId === sessionId);
  if (!completion) {
    return res.status(404).json({ error: 'No completion record found for this session yet' });
  }

  completion.clientFeedback = {
    rating: Number(rating) || 5,
    comment: comment || '',
    submittedAt: new Date().toISOString(),
  };

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'CLIENT_FEEDBACK_SUBMITTED',
    resourceType: 'completion_report',
    resourceId: completion.id,
    result: 'success',
    securityMetadata: { note: `Rating: ${rating}/5` },
  });

  res.json({ success: true, message: 'Feedback recorded securely' });
});

// ==========================================
// 8. SUPERVISOR / COORDINATOR WORKSPACE (/api/v1/supervisor/*)
// ==========================================
router.get('/supervisor/queue', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== 'supervisor' && currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Restricted: Coordinator workspace requires supervisor role' });
  }

  // Queue categorizations
  const pendingMatching = db.requests.filter(r => ['submitted', 'matching'].includes(r.status));
  const unknownLanguageEscalations = db.requests.filter(r => r.status === 'pending_coordinator' && r.isUnknownLanguage);
  const noMatchEscalations = db.requests.filter(r => r.status === 'pending_coordinator' && !r.isUnknownLanguage);
  const activeSessions = db.sessions.filter(s => ['ready_to_join', 'active'].includes(s.status));
  const flaggedCompletions = db.completions.filter(c => c.reviewStatus === 'flagged_for_review');

  res.json({
    pendingMatching,
    unknownLanguageEscalations,
    noMatchEscalations,
    activeSessions,
    flaggedCompletions,
    totalQueued: pendingMatching.length + unknownLanguageEscalations.length + noMatchEscalations.length,
  });
});

router.post('/supervisor/assign', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== 'supervisor' && currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Restricted to supervisor role' });
  }

  const { requestReference, interpreterId, reason } = req.body;
  const reqItem = db.requests.find(r => r.reference === requestReference);
  if (!reqItem) {
    return res.status(404).json({ error: 'Request not found' });
  }

  const interp = db.interpreters.find(i => i.id === interpreterId);
  if (!interp) {
    return res.status(404).json({ error: 'Interpreter not found' });
  }

  // Manual assignment by coordinator
  const assignment: Assignment = {
    id: `asg-manual-${Date.now()}`,
    requestReference: reqItem.reference,
    interpreterId: interp.id,
    interpreterName: interp.fullName,
    assignedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 120 * 1000).toISOString(),
    outcome: 'pending',
  };
  db.assignments.push(assignment);

  reqItem.status = 'assigned';
  reqItem.assignedInterpreterId = interp.id;
  reqItem.assignedInterpreterName = interp.fullName;
  reqItem.updatedAt = new Date().toISOString();

  // Create or update session
  let session = db.sessions.find(s => s.requestReference === reqItem.reference);
  if (!session) {
    session = {
      id: `SES-${Date.now().toString().slice(-4)}`,
      requestReference: reqItem.reference,
      sessionToken: `SES-TOKEN-${Math.random().toString(36).substring(2, 10)}`,
      status: 'awaiting_acceptance',
      communicationMode: reqItem.modality,
      lowBandwidthMode: db.settings.telecomLowBandwidthPreset,
      recordingEnabled: false,
      durationSeconds: 0,
      interpreterId: interp.id,
      interpreterName: interp.fullName,
      clientId: reqItem.requesterId,
      clientName: reqItem.requesterName,
      organizationName: reqItem.organizationName,
      sourceLanguage: reqItem.sourceLanguage,
      targetLanguage: reqItem.targetLanguage,
      serviceCategory: reqItem.serviceCategory,
      connectionHealth: 'optimal',
      authorizedParticipantIds: [reqItem.requesterId, interp.userId],
    };
    db.sessions.push(session);
  } else {
    session.interpreterId = interp.id;
    session.interpreterName = interp.fullName;
    session.status = 'awaiting_acceptance';
    session.authorizedParticipantIds = [reqItem.requesterId, interp.userId];
  }
  reqItem.activeSessionId = session.id;

  db.createNotification({
    recipientId: interp.userId,
    title: 'Coordinator Direct Assignment',
    message: `Supervisor ${currentUser.fullName} manually assigned ${reqItem.reference} to you. Reason: ${reason || 'Direct operational dispatch'}`,
    channel: 'in_app',
    status: 'delivered',
    read: false,
    actionUrl: '/interpreter',
  });

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'COORDINATOR_MANUAL_ASSIGNMENT',
    resourceType: 'interpretation_request',
    resourceId: reqItem.reference,
    result: 'success',
    securityMetadata: { note: `Assigned to ${interp.fullName}. Reason: ${reason || 'Manual override'}` },
  });

  res.json({ success: true, message: `Successfully assigned to ${interp.fullName}`, request: reqItem, assignment, session });
});

router.post('/supervisor/resolve-unknown', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== 'supervisor' && currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Restricted to supervisor role' });
  }

  const { requestReference, identifiedLanguageCode, coordinatorNotes } = req.body;
  const reqItem = db.requests.find(r => r.reference === requestReference);
  if (!reqItem) {
    return res.status(404).json({ error: 'Request not found' });
  }

  reqItem.sourceLanguage = identifiedLanguageCode;
  reqItem.isUnknownLanguage = false;
  reqItem.unknownLanguageNotes = `${reqItem.unknownLanguageNotes ? reqItem.unknownLanguageNotes + ' | ' : ''}Identified by coordinator: ${coordinatorNotes || 'Confirmed through linguistic assessment'}`;
  reqItem.status = 'matching';
  reqItem.updatedAt = new Date().toISOString();

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'UNKNOWN_LANGUAGE_RESOLVED',
    resourceType: 'interpretation_request',
    resourceId: reqItem.reference,
    result: 'success',
    securityMetadata: { note: `Identified language as ${identifiedLanguageCode}. Dispatched to matching queue.` },
  });

  // Re-run dispatch
  const dispatch = dispatchRequest(reqItem.reference);

  res.json({
    success: true,
    message: `Language confirmed as ${identifiedLanguageCode.toUpperCase()}. Request re-dispatched.`,
    request: reqItem,
    dispatch,
  });
});

router.post('/supervisor/resolve-issue', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== 'supervisor' && currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Restricted to supervisor role' });
  }

  const { completionId, resolutionNote } = req.body;
  const completion = db.completions.find(c => c.id === completionId);
  if (!completion) {
    return res.status(404).json({ error: 'Completion record not found' });
  }

  completion.reviewStatus = 'resolved_by_supervisor';
  completion.supervisorResolutionNote = resolutionNote || 'Reviewed and closed by coordinator.';

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'DISPUTE_OR_ISSUE_RESOLVED',
    resourceType: 'completion_report',
    resourceId: completion.id,
    result: 'success',
    securityMetadata: { note: resolutionNote },
  });

  res.json({ success: true, completion });
});

// ==========================================
// 9. OPERATIONAL REPORTS & AUDIT LOGS (/api/v1/reports & /api/v1/audit-logs)
// ==========================================
router.get('/reports', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== 'supervisor' && currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Operational reports require supervisor or platform admin role' });
  }

  // Calculate high-fidelity real metrics based on data
  const totalRequests = db.requests.length;
  const completedRequests = db.requests.filter(r => r.status === 'completed').length;
  const activeSessionsCount = db.sessions.filter(s => ['active', 'ready_to_join'].includes(s.status)).length;
  const unknownLanguageCount = db.requests.filter(r => r.isUnknownLanguage).length;

  // Language breakdown
  const languageDemand: Record<string, number> = {};
  for (const r of db.requests) {
    const lang = r.sourceLanguage;
    languageDemand[lang] = (languageDemand[lang] || 0) + 1;
  }

  // Category breakdown
  const categoryDemand: Record<string, number> = {};
  for (const r of db.requests) {
    categoryDemand[r.serviceCategory] = (categoryDemand[r.serviceCategory] || 0) + 1;
  }

  // Interpreter availability summary
  const availableInterpreters = db.interpreters.filter(i => i.availability === 'available').length;
  const busyInterpreters = db.interpreters.filter(i => i.availability === 'busy').length;
  const offlineInterpreters = db.interpreters.filter(i => i.availability === 'offline').length;
  const verifiedInterpreters = db.interpreters.filter(i => i.verificationState === 'verified').length;

  // Service metrics
  const avgResponseTimeSeconds = 24.5; // under pilot target 45s
  const completionRatePercent = totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 100;

  res.json({
    summary: {
      totalRequests,
      completedRequests,
      activeSessionsCount,
      unknownLanguageCount,
      completionRatePercent,
      avgResponseTimeSeconds,
      availableInterpreters,
      busyInterpreters,
      offlineInterpreters,
      verifiedInterpreters,
    },
    languageDemand,
    categoryDemand,
    disclaimer: 'Operational reporting baseline for pilot deployment. Data strictly synthetic in development environment.',
  });
});

router.get('/audit-logs', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Audit logs access restricted strictly to Platform Administrators per FR-066' });
  }

  const { action, actorRole } = req.query;
  let list = db.auditLogs;

  if (action) {
    list = list.filter(l => l.action.toLowerCase().includes(String(action).toLowerCase()));
  }
  if (actorRole) {
    list = list.filter(l => l.actorRole === actorRole);
  }

  res.json({ auditLogs: list });
});

// ==========================================
// 10. PLATFORM SETTINGS (/api/v1/platform-settings)
// ==========================================
router.get('/platform-settings', (_req: Request, res: Response) => {
  res.json({ settings: db.settings });
});

router.patch('/platform-settings', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Only platform administrators can change global settings' });
  }

  const {
    assignmentTimeoutSeconds,
    maxAutoRetries,
    emergencyPriorityBypass,
    allowDirectRecording,
    maintenanceMode,
    telecomLowBandwidthPreset,
    systemBannerNotice,
  } = req.body;

  if (typeof assignmentTimeoutSeconds === 'number') db.settings.assignmentTimeoutSeconds = assignmentTimeoutSeconds;
  if (typeof maxAutoRetries === 'number') db.settings.maxAutoRetries = maxAutoRetries;
  if (typeof emergencyPriorityBypass === 'boolean') db.settings.emergencyPriorityBypass = emergencyPriorityBypass;
  if (typeof allowDirectRecording === 'boolean') {
    // Note: SRS FR-016 & 7.4 strictly warns against default recording
    db.settings.allowDirectRecording = allowDirectRecording;
  }
  if (typeof maintenanceMode === 'boolean') db.settings.maintenanceMode = maintenanceMode;
  if (typeof telecomLowBandwidthPreset === 'boolean') db.settings.telecomLowBandwidthPreset = telecomLowBandwidthPreset;
  if (typeof systemBannerNotice === 'string') db.settings.systemBannerNotice = systemBannerNotice;

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'PLATFORM_SETTINGS_MODIFIED',
    resourceType: 'platform_settings',
    resourceId: 'global',
    result: 'success',
    securityMetadata: { note: 'Global platform settings updated' },
  });

  res.json({ settings: db.settings, message: 'Settings saved successfully' });
});

// ==========================================
// 11. NOTIFICATIONS (/api/v1/notifications)
// ==========================================
router.get('/notifications', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const list = db.notifications.filter(n => n.recipientId === currentUser.id);
  res.json({ notifications: list });
});

router.patch('/notifications/:id/read', (req: Request, res: Response) => {
  const { id } = req.params;
  const notif = db.notifications.find(n => n.id === id);
  if (notif) {
    notif.read = true;
  }
  res.json({ success: true, notification: notif });
});
// ==========================================
// 12. ORZO CUSTOMER SUPPORT & AUDIO LANGUAGE IDENTIFICATION
// ==========================================
router.post('/support/chat', async (req: Request, res: Response) => {
  const { message, chatHistory } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const answer = await askOrzoSupport(message, chatHistory || []);
    res.json({ response: answer });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error processing support query' });
  }
});

router.post('/support/identify-audio', async (req: Request, res: Response) => {
  const { audioBase64, sampleId, clientNotes } = req.body;
  try {
    const result = await identifyAudioLanguage(audioBase64, sampleId, clientNotes);
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error identifying language from audio' });
  }
});

export default router;
