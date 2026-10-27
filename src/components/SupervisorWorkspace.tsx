import React, { useState } from 'react';
import {
  User,
  InterpretationRequest,
  InterpretationSession,
  CompletionReport,
  InterpreterProfile,
  SupportedLanguage
} from '../types';
import {
  Activity,
  AlertTriangle,
  HelpCircle,
  Clock,
  CheckCircle,
  Users,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  RotateCcw,
  MessageSquare,
  FileText,
  PhoneCall,
  UserCheck
} from 'lucide-react';

interface SupervisorWorkspaceProps {
  currentUser: User;
  requests: InterpretationRequest[];
  sessions: InterpretationSession[];
  completions: CompletionReport[];
  interpreters: InterpreterProfile[];
  languages: SupportedLanguage[];
  onManualAssign: (requestReference: string, interpreterId: string, reason?: string) => Promise<void>;
  onResolveUnknownLanguage: (requestReference: string, languageCode: string, notes?: string) => Promise<void>;
  onResolveIssue: (completionId: string, resolutionNote: string) => Promise<void>;
  onJoinSession: (sessionId: string) => void;
}

export const SupervisorWorkspace: React.FC<SupervisorWorkspaceProps> = ({
  currentUser,
  requests,
  sessions,
  completions,
  interpreters,
  languages,
  onManualAssign,
  onResolveUnknownLanguage,
  onResolveIssue,
  onJoinSession,
}) => {
  const [activeTab, setActiveTab] = useState<'unknown_language' | 'delayed_unmatched' | 'active_sessions' | 'flagged_issues'>('unknown_language');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Unknown language modal
  const [resolvingReq, setResolvingReq] = useState<InterpretationRequest | null>(null);
  const [selectedLanguageCode, setSelectedLanguageCode] = useState('orm');
  const [coordinatorAssessment, setCoordinatorAssessment] = useState('');

  // Manual assign modal
  const [manualAssignReq, setManualAssignReq] = useState<InterpretationRequest | null>(null);
  const [selectedInterpreterId, setSelectedInterpreterId] = useState('');
  const [overrideReason, setOverrideReason] = useState('Immediate emergency clinical triage dispatch');

  // Flagged issue resolution modal
  const [resolvingCompletion, setResolvingCompletion] = useState<CompletionReport | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  // Filters
  const unknownLanguageList = requests.filter(
    (r) => r.isUnknownLanguage && r.status === 'pending_coordinator'
  );

  const delayedOrUnmatchedList = requests.filter(
    (r) =>
      (r.status === 'pending_coordinator' && !r.isUnknownLanguage) ||
      r.status === 'matching' ||
      r.status === 'unresolved'
  );

  const activeSessionsList = sessions.filter((s) => ['ready_to_join', 'active'].includes(s.status));

  const flaggedIssuesList = completions.filter((c) => c.reviewStatus === 'flagged_for_review');

  const handleConfirmResolveUnknown = async () => {
    if (!resolvingReq) return;
    try {
      await onResolveUnknownLanguage(
        resolvingReq.reference,
        selectedLanguageCode,
        coordinatorAssessment
      );
      setResolvingReq(null);
      setCoordinatorAssessment('');
    } catch (err: any) {
      alert(`Error resolving unknown language: ${err.message}`);
    }
  };

  const handleConfirmManualAssign = async () => {
    if (!manualAssignReq || !selectedInterpreterId) return;
    try {
      await onManualAssign(manualAssignReq.reference, selectedInterpreterId, overrideReason);
      setManualAssignReq(null);
      setSelectedInterpreterId('');
    } catch (err: any) {
      alert(`Error assigning interpreter: ${err.message}`);
    }
  };

  const handleConfirmIssueResolution = async () => {
    if (!resolvingCompletion) return;
    try {
      await onResolveIssue(resolvingCompletion.id, resolutionNote);
      setResolvingCompletion(null);
      setResolutionNote('');
    } catch (err: any) {
      alert(`Error resolving issue: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Coordinator Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-lg border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                Live Dispatch Console
              </span>
            </div>
            <h1 className="text-2xl font-black mt-1">Supervisor & Dispatch Hub</h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Monitor active queues, resolve unknown dialect requests, and manage manual dispatch.
            </p>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-300">
              Coordinator: <strong>{currentUser.fullName}</strong>
            </span>
          </div>
        </div>

        {/* 4 Metric Counters */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800">
          <button
            onClick={() => setActiveTab('unknown_language')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 'unknown_language'
                ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400'
                : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-amber-400 font-bold mb-1">
              <span>Unknown Dialects</span>
              <HelpCircle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-white">{unknownLanguageList.length}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Triage required</div>
          </button>

          <button
            onClick={() => setActiveTab('delayed_unmatched')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 'delayed_unmatched'
                ? 'bg-red-500/20 border-red-400 text-red-200 ring-1 ring-red-400'
                : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-red-400 font-bold mb-1">
              <span>Unmatched Requests</span>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-white">{delayedOrUnmatchedList.length}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Manual assignment</div>
          </button>

          <button
            onClick={() => setActiveTab('active_sessions')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 'active_sessions'
                ? 'bg-blue-500/20 border-blue-400 text-blue-200 ring-1 ring-blue-400'
                : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-blue-400 font-bold mb-1">
              <span>Active Calls</span>
              <Activity className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-white">{activeSessionsList.length}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Live sessions</div>
          </button>

          <button
            onClick={() => setActiveTab('flagged_issues')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === 'flagged_issues'
                ? 'bg-purple-500/20 border-purple-400 text-purple-200 ring-1 ring-purple-400'
                : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-purple-400 font-bold mb-1">
              <span>Flagged Reviews</span>
              <FileText className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-white">{flaggedIssuesList.length}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Post-call review</div>
          </button>
        </div>
      </div>

      {/* Main Tabbed Queue Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Queue:</span>
            <span className="text-xs font-extrabold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
              {activeTab === 'unknown_language' && 'Unknown Dialect Requests'}
              {activeTab === 'delayed_unmatched' && 'Awaiting Dispatch & Assignment'}
              {activeTab === 'active_sessions' && 'Active Sessions Monitor'}
              {activeTab === 'flagged_issues' && 'Flagged Completion Review'}
            </span>
          </div>
        </div>

        {/* TAB 1: UNKNOWN LANGUAGE */}
        {activeTab === 'unknown_language' && (
          <div className="divide-y divide-gray-100">
            {unknownLanguageList.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                <CheckCircle className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-800">No unknown dialect requests pending</p>
              </div>
            ) : (
              unknownLanguageList.map((req) => (
                <div key={req.reference} className="p-5 hover:bg-amber-50/40 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                          {req.reference}
                        </span>
                        <span className="text-xs font-bold text-red-600 uppercase bg-red-50 px-2 py-0.5 rounded">
                          {req.urgency}
                        </span>
                        <span className="text-xs text-gray-600 font-semibold">
                          {req.organizationName}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900">
                        {req.serviceCategory.replace('_', ' ').toUpperCase()} • Target: {req.targetLanguage.toUpperCase()}
                      </h4>
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 max-w-2xl">
                        <strong>Intake Dialect Notes:</strong> {req.unknownLanguageNotes || 'No initial notes.'}
                        <br />
                        <strong>Routing Context:</strong> {req.minRoutingContext}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => {
                          setResolvingReq(req);
                          setSelectedLanguageCode('orm');
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-xs flex items-center space-x-1.5 cursor-pointer"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Assess & Assign Language</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: DELAYED OR UNMATCHED */}
        {activeTab === 'delayed_unmatched' && (
          <div className="divide-y divide-gray-100">
            {delayedOrUnmatchedList.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                <CheckCircle className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-800">No unmatched requests in queue</p>
              </div>
            ) : (
              delayedOrUnmatchedList.map((req) => (
                <div key={req.reference} className="p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold bg-gray-100 px-2 py-0.5 rounded">
                          {req.reference}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                          {req.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {req.organizationName}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900">
                        {req.sourceLanguage.toUpperCase()} ⇄ {req.targetLanguage.toUpperCase()} (
                        {req.serviceCategory.replace('_', ' ')})
                      </h4>
                      <p className="text-xs text-gray-600 max-w-2xl">{req.minRoutingContext}</p>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => {
                          setManualAssignReq(req);
                          setSelectedInterpreterId(interpreters[0]?.id || '');
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-xs flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Users className="w-4 h-4" />
                        <span>Assign Interpreter</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: ACTIVE SESSIONS MONITOR */}
        {activeTab === 'active_sessions' && (
          <div className="divide-y divide-gray-100">
            {activeSessionsList.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-800">No active calls in flight</p>
              </div>
            ) : (
              activeSessionsList.map((session) => (
                <div key={session.id} className="p-5 hover:bg-blue-50/30 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold bg-blue-100 text-blue-900 px-2 py-0.5 rounded">
                          {session.id}
                        </span>
                        <span className="text-xs bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full flex items-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-white mr-1.5 animate-ping" />
                          {session.status}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">
                          Ref: {session.requestReference}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900">
                        {session.sourceLanguage.toUpperCase()} ⇄ {session.targetLanguage.toUpperCase()} •{' '}
                        {session.serviceCategory.replace('_', ' ')}
                      </h4>
                      <p className="text-xs text-gray-600">
                        <strong>Client:</strong> {session.clientName} ({session.organizationName}) •{' '}
                        <strong>Interpreter:</strong> {session.interpreterName || 'Connecting'}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => onJoinSession(session.id)}
                        className="bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-xs flex items-center space-x-1.5 cursor-pointer"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Supervisor Observe</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: FLAGGED REVIEWS */}
        {activeTab === 'flagged_issues' && (
          <div className="divide-y divide-gray-100">
            {flaggedIssuesList.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                <CheckCircle className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-800">No flagged reviews pending</p>
              </div>
            ) : (
              flaggedIssuesList.map((comp) => (
                <div key={comp.id} className="p-5 hover:bg-red-50/20 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold bg-purple-100 text-purple-900 px-2 py-0.5 rounded">
                          {comp.id}
                        </span>
                        <span className="text-xs bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded">
                          Issue: {comp.issueCode.replace('_', ' ')}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900">
                        Interpreter: {comp.interpreterName} • Duration: {comp.durationMinutes} mins
                      </h4>
                      <p className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-200 max-w-2xl">
                        <strong>Notes:</strong> {comp.notes}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => {
                          setResolvingCompletion(comp);
                          setResolutionNote('');
                        }}
                        className="bg-purple-800 hover:bg-purple-900 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-xs cursor-pointer"
                      >
                        Record Resolution
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: RESOLVE UNKNOWN LANGUAGE */}
      {resolvingReq && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-base font-extrabold text-gray-900">
              Assign Verified Language
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Request: {resolvingReq.reference} • Organization: {resolvingReq.organizationName}
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Identified Language
                </label>
                <select
                  value={selectedLanguageCode}
                  onChange={(e) => setSelectedLanguageCode(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded-lg bg-white"
                >
                  {languages.filter((l) => l.isActive).map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name} ({l.nativeName}) - {l.script}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Coordinator Assessment Notes
                </label>
                <textarea
                  rows={2}
                  value={coordinatorAssessment}
                  onChange={(e) => setCoordinatorAssessment(e.target.value)}
                  placeholder="Notes on dialect assessment..."
                  className="w-full text-xs p-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end space-x-2 border-t pt-3">
              <button
                onClick={() => setResolvingReq(null)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResolveUnknown}
                className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                Confirm & Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: MANUAL ASSIGNMENT */}
      {manualAssignReq && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-base font-extrabold text-gray-900">
              Manual Dispatch Override
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Select accredited interpreter for request {manualAssignReq.reference} (
              {manualAssignReq.sourceLanguage.toUpperCase()} ⇄ {manualAssignReq.targetLanguage.toUpperCase()}).
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Eligible Interpreters
                </label>
                <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
                  {interpreters.map((int) => (
                    <label
                      key={int.id}
                      className={`p-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer ${
                        selectedInterpreterId === int.id ? 'bg-blue-50 font-bold' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-2 text-xs">
                        <input
                          type="radio"
                          name="selectedInterpreter"
                          value={int.id}
                          checked={selectedInterpreterId === int.id}
                          onChange={(e) => setSelectedInterpreterId(e.target.value)}
                          className="text-blue-600"
                        />
                        <div>
                          <div className="text-gray-900 font-bold">{int.fullName}</div>
                          <div className="text-[11px] text-gray-500">
                            Status: {int.availability.toUpperCase()}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                        {int.supportedLanguages.map((l) => l.languageCode.toUpperCase()).join('/')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Override Reason
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end space-x-2 border-t pt-3">
              <button
                onClick={() => setManualAssignReq(null)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmManualAssign}
                disabled={!selectedInterpreterId}
                className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RESOLVE FLAGGED ISSUE */}
      {resolvingCompletion && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-base font-extrabold text-gray-900">
              Close & Resolve Flagged Session
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Issue code: <strong>{resolvingCompletion.issueCode}</strong> for session {resolvingCompletion.sessionId}.
            </p>

            <div className="mt-3">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Resolution Note
              </label>
              <textarea
                rows={3}
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Resolution details..."
                className="w-full text-xs p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div className="mt-5 flex items-center justify-end space-x-2 border-t pt-3">
              <button
                onClick={() => setResolvingCompletion(null)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmIssueResolution}
                disabled={!resolutionNote.trim()}
                className="px-4 py-2 text-xs font-bold bg-purple-800 text-white rounded-lg hover:bg-purple-900 disabled:opacity-50 cursor-pointer"
              >
                Save Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
