/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import {
  User,
  SupportedLanguage,
  InterpreterProfile,
  InterpretationRequest,
  Assignment,
  InterpretationSession,
  CompletionReport,
  PlatformNotification,
  AuditLog,
  PlatformSettings,
  ServiceCategory,
  UrgencyLevel,
  CommunicationMode,
  ScheduleType,
  CompletionOutcome,
  IssueCode
} from './types';
import { Header } from './components/Header';
import { NotificationDrawer } from './components/NotificationDrawer';
import { ClientPortal } from './components/ClientPortal';
import { InterpreterPortal } from './components/InterpreterPortal';
import { SupervisorWorkspace } from './components/SupervisorWorkspace';
import { PlatformAdminPortal } from './components/PlatformAdminPortal';
import { LiveSessionRoom } from './components/LiveSessionRoom';
import { CompletionReportModal } from './components/CompletionReportModal';
import { FeedbackModal } from './components/FeedbackModal';
import { OperationalReports } from './components/OperationalReports';
import { AndroidClientApp } from './components/AndroidClientApp';
import { OrzoSupportModal } from './components/OrzoSupportModal';
import { LoginPage } from './components/LoginPage';
import {
  LayoutDashboard,
  BarChart3,
  AlertCircle,
  RefreshCw,
  Info,
  Smartphone,
  Monitor,
  Bot,
  Mic
} from 'lucide-react';

export default function App() {
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
  const [locale, setLocale] = useState('en');

  // Modals & Active Workspaces
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [activeSessionRoomId, setActiveSessionRoomId] = useState<string | null>(null);
  const [completionModalSessionId, setCompletionModalSessionId] = useState<string | null>(null);
  const [feedbackModalSessionId, setFeedbackModalSessionId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'main' | 'reports'>('main');
  const [platformMode, setPlatformMode] = useState<'web' | 'android'>('web');
  const [isOrzoSupportOpen, setIsOrzoSupportOpen] = useState(false);
  const [preselectedSourceLanguage, setPreselectedSourceLanguage] = useState<string | null>(null);

  // Initial Data Fetch
  const refreshData = useCallback(async () => {
    try {
      const [
        meRes,
        usersRes,
        langsRes,
        interpsRes,
        reqsRes,
        asgRes,
        notifsRes,
        settingsRes,
      ] = await Promise.all([
        api.getMe(),
        api.getUsers(),
        api.getLanguages(),
        api.getInterpreters(),
        api.getRequests(),
        api.getAssignments(),
        api.getNotifications(),
        api.getPlatformSettings(),
      ]);

      setCurrentUser(meRes.user);
      setInterpreterProfile(meRes.interpreterProfile);
      setAllUsers(usersRes.users);
      setLanguages(langsRes.languages);
      setInterpreters(interpsRes.interpreters);
      setRequests(reqsRes.requests);
      setAssignments(asgRes.assignments);
      setNotifications(notifsRes.notifications);
      setSettings(settingsRes.settings);

      // If supervisor or admin, fetch queue & audits
      if (meRes.user?.role === 'supervisor' || meRes.user?.role === 'platform_admin') {
        const queueRes = await api.getSupervisorQueue().catch(() => null);
        if (queueRes) {
          setSessions(queueRes.activeSessions);
          setCompletions(queueRes.flaggedCompletions);
        }
      }

      if (meRes.user?.role === 'platform_admin') {
        const auditRes = await api.getAuditLogs().catch(() => null);
        if (auditRes) {
          setAuditLogs(auditRes.auditLogs);
        }
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load platform data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    const timer = setInterval(() => {
      refreshData();
    }, 15000);
    return () => clearInterval(timer);
  }, [refreshData]);

  // Handle Role Switch / Login
  const handleSwitchUser = async (userId: string) => {
    try {
      setLoading(true);
      const res = await api.switchRole(userId);
      setCurrentUser(res.user);
      setInterpreterProfile(res.interpreterProfile);
      setCurrentView('main');
      await refreshData();
    } catch (err: any) {
      alert(`Could not switch user: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (user: User) => {
    try {
      setLoading(true);
      const res = await api.login({ userId: user.id });
      setCurrentUser(res.user);
      setInterpreterProfile(res.interpreterProfile);
      setCurrentView('main');
      await refreshData();
    } catch (err: any) {
      alert(`Login failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      setCurrentUser(null);
      setInterpreterProfile(null);
    } catch (err) {
      setCurrentUser(null);
    }
  };

  // Client Request Actions
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
    if (res.dispatch?.session?.id) {
      setActiveSessionRoomId(res.dispatch.session.id);
    }
  };

  const handleCancelRequest = async (reference: string, reason?: string) => {
    await api.cancelRequest(reference, reason);
    await refreshData();
  };

  // Interpreter Actions
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
    if (response === 'accepted' && res.session?.id) {
      setActiveSessionRoomId(res.session.id);
    }
  };

  // Supervisor Actions
  const handleManualAssign = async (
    requestReference: string,
    interpreterId: string,
    reason?: string
  ) => {
    await api.supervisorAssign(requestReference, interpreterId, reason);
    await refreshData();
  };

  const handleResolveUnknownLanguage = async (
    requestReference: string,
    languageCode: string,
    notes?: string
  ) => {
    await api.supervisorResolveUnknown(requestReference, languageCode, notes);
    await refreshData();
  };

  const handleResolveIssue = async (completionId: string, resolutionNote: string) => {
    await api.supervisorResolveIssue(completionId, resolutionNote);
    await refreshData();
  };

  // Platform Admin Actions
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

  // Session & Completion Actions
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

  const handleSubmitFeedback = async (data: {
    sessionId: string;
    rating: number;
    comment?: string;
  }) => {
    await api.submitFeedback(data);
    setFeedbackModalSessionId(null);
    await refreshData();
  };

  const handleMarkNotificationRead = async (id: string) => {
    await api.markNotificationRead(id);
    await refreshData();
  };

  // Active Session for Current User
  const activeSessionForUser = requests.find(
    (r) => ['assigned', 'in_session'].includes(r.status) && r.activeSessionId
  )?.activeSessionId;

  const currentLiveSession = activeSessionRoomId
    ? sessions.find((s) => s.id === activeSessionRoomId) || {
        id: activeSessionRoomId,
        requestReference: 'REQ-LIVE',
        sessionToken: 'SES-LIVE-TOKEN',
        status: 'active' as const,
        communicationMode: 'audio' as const,
        lowBandwidthMode: settings?.telecomLowBandwidthPreset || true,
        recordingEnabled: false,
        durationSeconds: 120,
        clientId: currentUser?.id || 'usr-client',
        clientName: currentUser?.fullName || 'Client',
        interpreterName: interpreterProfile?.fullName || 'Assigned Interpreter',
        organizationName: currentUser?.organizationName || 'Health Center',
        sourceLanguage: 'orm',
        targetLanguage: 'amh',
        serviceCategory: 'healthcare' as const,
        connectionHealth: 'optimal' as const,
        authorizedParticipantIds: [currentUser?.id || ''],
      }
    : null;

  if (loading && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center font-bold text-2xl mb-4 border border-blue-400 animate-pulse">
          የ
        </div>
        <h2 className="text-lg font-bold">ORZO Translation & Interpretation</h2>
        <p className="text-xs text-slate-400 mt-1">Connecting to secure dispatch platform...</p>
        <RefreshCw className="w-5 h-5 text-blue-400 animate-spin mt-4" />
      </div>
    );
  }

  if (error && !currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-md w-full border border-red-200 text-center">
          <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-2" />
          <h3 className="text-base font-bold text-gray-900">Connection Error</h3>
          <p className="text-xs text-gray-600 mt-2">{error}</p>
          <button
            onClick={() => refreshData()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // If not logged in, render the clean role-based login page
  if (!currentUser) {
    return <LoginPage users={allUsers} onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans text-gray-900">
      {/* Platform Banner Notice */}
      {settings?.systemBannerNotice && (
        <div className="bg-slate-900 text-slate-300 text-[11px] font-medium py-1.5 px-4 text-center border-b border-slate-800 flex items-center justify-center space-x-2">
          <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>{settings.systemBannerNotice}</span>
        </div>
      )}

      {/* Main Global Header */}
      <Header
        currentUser={currentUser}
        users={allUsers}
        onSwitchUser={handleSwitchUser}
        notifications={notifications}
        onOpenNotifications={() => setIsNotificationOpen(true)}
        currentLocale={locale}
        onChangeLocale={setLocale}
        activeSessionId={activeSessionForUser}
        onJoinActiveSession={(sessionId) => setActiveSessionRoomId(sessionId)}
        onOpenOrzoSupport={() => setIsOrzoSupportOpen(true)}
        onLogout={handleLogout}
        orgViewMode={platformMode}
        onToggleOrgViewMode={(m) => setPlatformMode(m)}
      />

      {/* Privileged Role Navigation Bar (Supervisor & Admin) */}
      {currentUser && (currentUser.role === 'supervisor' || currentUser.role === 'platform_admin') && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-4">
              <button
                onClick={() => setCurrentView('main')}
                className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 cursor-pointer ${
                  currentView === 'main'
                    ? 'border-blue-600 text-blue-900'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>
                  {currentUser.role === 'supervisor' ? 'Coordinator Hub' : 'System Administration'}
                </span>
              </button>

              <button
                onClick={() => setCurrentView('reports')}
                className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 cursor-pointer ${
                  currentView === 'reports'
                    ? 'border-blue-600 text-blue-900'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Operational Reports</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentUser.role === 'client' && platformMode === 'android' ? (
          <AndroidClientApp
            currentUser={currentUser}
            requests={requests}
            languages={languages}
            onCreateRequest={handleCreateRequest}
            onJoinSession={(sessionId) => setActiveSessionRoomId(sessionId)}
            onOpenFeedback={(sessionId) => setFeedbackModalSessionId(sessionId)}
            onOpenOrzoSupport={() => setIsOrzoSupportOpen(true)}
            initialSourceLanguage={preselectedSourceLanguage}
          />
        ) : currentView === 'reports' ? (
          <OperationalReports />
        ) : (
          <>
            {currentUser.role === 'client' && (
              <ClientPortal
                currentUser={currentUser}
                requests={requests}
                languages={languages}
                onCreateRequest={handleCreateRequest}
                onCancelRequest={handleCancelRequest}
                onJoinSession={(sessionId) => setActiveSessionRoomId(sessionId)}
                onOpenFeedback={(sessionId) => setFeedbackModalSessionId(sessionId)}
              />
            )}

            {currentUser.role === 'interpreter' && (
              <InterpreterPortal
                currentUser={currentUser}
                profile={interpreterProfile}
                assignments={assignments}
                requests={requests}
                languages={languages}
                onToggleAvailability={handleToggleAvailability}
                onRespondAssignment={handleRespondAssignment}
                onJoinSession={(sessionId) => setActiveSessionRoomId(sessionId)}
              />
            )}

            {currentUser.role === 'supervisor' && (
              <SupervisorWorkspace
                currentUser={currentUser}
                requests={requests}
                sessions={sessions}
                completions={completions}
                interpreters={interpreters}
                languages={languages}
                onManualAssign={handleManualAssign}
                onResolveUnknownLanguage={handleResolveUnknownLanguage}
                onResolveIssue={handleResolveIssue}
                onJoinSession={(sessionId) => setActiveSessionRoomId(sessionId)}
              />
            )}

            {currentUser.role === 'platform_admin' && settings && (
              <PlatformAdminPortal
                currentUser={currentUser}
                languages={languages}
                interpreters={interpreters}
                auditLogs={auditLogs}
                settings={settings}
                onUpdateLanguage={handleUpdateLanguage}
                onAddLanguage={handleAddLanguage}
                onVerifyInterpreter={handleVerifyInterpreter}
                onUpdateSettings={handleUpdateSettings}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
          <div>
            <strong>ORZO Translation & Interpretation</strong> • Ethiopian Language Interpretation Platform
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            <span>Amharic • Afaan Oromoo • Tigrinya • Somali • Sidama • Wolaytta</span>
            <span>•</span>
            <span className="text-blue-700 font-semibold">Institutional Dispatch</span>
          </div>
        </div>
      </footer>

      {/* Live Session Room Overlay (Audio/Video Session) */}
      {activeSessionRoomId && currentLiveSession && currentUser && (
        <LiveSessionRoom
          session={currentLiveSession}
          currentUser={currentUser}
          onEndSession={handleEndSession}
          onClose={() => setActiveSessionRoomId(null)}
          onOpenCompletionModal={(sessionId) => {
            setActiveSessionRoomId(null);
            setCompletionModalSessionId(sessionId);
          }}
        />
      )}

      {/* Completion Report Modal (For Interpreters) */}
      {completionModalSessionId && (
        <CompletionReportModal
          sessionId={completionModalSessionId}
          isOpen={!!completionModalSessionId}
          onClose={() => setCompletionModalSessionId(null)}
          onSubmit={handleSubmitCompletion}
        />
      )}

      {/* Client Feedback Modal */}
      {feedbackModalSessionId && (
        <FeedbackModal
          sessionId={feedbackModalSessionId}
          isOpen={!!feedbackModalSessionId}
          onClose={() => setFeedbackModalSessionId(null)}
          onSubmit={handleSubmitFeedback}
        />
      )}

      {/* Notifications Drawer */}
      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        notifications={notifications}
        onMarkRead={handleMarkNotificationRead}
      />

      {/* Floating ORZO Support & Audio Language Identifier Trigger Button */}
      <button
        onClick={() => setIsOrzoSupportOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-2xl shadow-xl border border-blue-400 hover:scale-105 transition-all flex items-center space-x-2.5 cursor-pointer group"
        title="ORZO Customer Support & Audio Dialect Identifier"
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-xl bg-white text-blue-700 flex items-center justify-center font-black shadow-xs">
            <Bot className="w-5 h-5" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
          </span>
        </div>
        <div className="text-left hidden sm:block">
          <div className="text-xs font-black tracking-tight">
            ORZO Support
          </div>
          <div className="text-[10px] text-blue-100 flex items-center">
            <Mic className="w-3 h-3 mr-1 text-red-300" />
            <span>Audio Dialect Identifier</span>
          </div>
        </div>
      </button>

      {/* ORZO Customer Support & Audio Language Identification Modal */}
      <OrzoSupportModal
        isOpen={isOrzoSupportOpen}
        onClose={() => setIsOrzoSupportOpen(false)}
        onSelectLanguageForRequest={(langCode) => {
          setPreselectedSourceLanguage(langCode);
          setPlatformMode('web');
        }}
      />
    </div>
  );
}
