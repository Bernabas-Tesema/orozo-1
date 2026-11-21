import React, { useEffect, useRef, useState } from 'react';
import {
  User,
  InterpretationRequest,
  SupportedLanguage,
  CommunicationMode
} from '../shared/types';
import {
  Video,
  PhoneCall,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  Check
} from 'lucide-react';
import { workplaceContext, workplaceLanguageLabel, workplaceOf } from '../shared/workplace';

interface TriageTerminalProps {
  currentUser: User;
  requests: InterpretationRequest[];
  languages: SupportedLanguage[];
  onCreateRequest: (data: {
    sourceLanguage?: string;
    targetLanguage: string;
    isUnknownLanguage?: boolean;
    unknownLanguageNotes?: string;
    serviceCategory: any;
    urgency: any;
    modality: CommunicationMode;
    scheduleType: any;
    scheduledTime?: string;
    minRoutingContext: string;
  }) => Promise<string | undefined | void>;
  onCancelRequest: (reference: string, reason?: string) => Promise<void>;
  onJoinSession: (sessionId: string) => void;
  onOpenFeedback: (sessionId: string) => void;
  initialSourceLanguage?: string | null;
}

export const TriageTerminal: React.FC<TriageTerminalProps> = ({
  currentUser,
  requests,
  languages,
  onCreateRequest,
  onJoinSession,
  initialSourceLanguage,
}) => {
  const workplace = workplaceOf(currentUser);
  const [sourceLanguage, setSourceLanguage] = useState(initialSourceLanguage || 'orm');
  const [targetLanguage, setTargetLanguage] = useState('amh');
  const [context, setContext] = useState('');
  const [callMode, setCallMode] = useState<'audio' | 'video'>('audio');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ringRef = useRef<{ stop: () => void } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const routingContext = context.trim() || workplaceContext(workplace);

    setIsSubmitting(true);
    setCalling(true);
    // No outgoing ring sound — the waiting state is shown silently.
    try {
      const result = await onCreateRequest({
        sourceLanguage: sourceLanguage === 'unknown' ? undefined : sourceLanguage,
        targetLanguage,
        isUnknownLanguage: sourceLanguage === 'unknown',
        unknownLanguageNotes: sourceLanguage === 'unknown' ? 'Unknown dialect reported at desk' : undefined,
        serviceCategory: workplace,
        urgency: 'emergency',
        modality: callMode,
        scheduleType: 'immediate',
        minRoutingContext: routingContext,
      });

      // Keep waiting UI while interpreters ring — never auto-join the call room.
      if (result === 'waiting' || result === 'ringing') {
        return;
      }
      setCalling(false);
      setError('The request was saved. An interpreter will be assigned from the dispatch queue.');
    } catch (err: any) {
      setCalling(false);
      setError(err?.message || 'The request could not be saved.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeLanguages = languages.filter((l) => l.isActive);
  // Only show ring/wait UI after the desk starts a call from this form (no auto call on load).
  const ringingRequest = calling
    ? requests.find(
        (item) =>
          item.requesterId === currentUser.id &&
          ['matching', 'assigned', 'in_session'].includes(item.status),
      )
    : undefined;
  const interpreterReady =
    Boolean(ringingRequest?.activeSessionId) &&
    (ringingRequest?.status === 'assigned' || ringingRequest?.status === 'in_session');
  const showCalling = calling;
  const phoneRinging = calling && !interpreterReady && !isSubmitting;
  const languageName = (code?: string) => languages.find((item) => item.code === code)?.name || (code ? code.toUpperCase() : 'Unknown language');

  useEffect(() => {
    if (!calling || isSubmitting) return;
    // When the call goes into session (in_session), stop the ringing UI.
    // Also clear if the request is completed/cancelled/expired — the call ended.
    const stillWaiting = requests.some(
      (item) =>
        item.requesterId === currentUser.id &&
        ['submitted', 'validating', 'matching', 'assigned'].includes(item.status),
    );
    const sessionDone = requests.some(
      (item) =>
        item.requesterId === currentUser.id &&
        ['completed', 'cancelled', 'expired', 'unresolved'].includes(item.status),
    );
    if (!stillWaiting || sessionDone) {
      setCalling(false);
    }
  }, [calling, currentUser.id, isSubmitting, requests]);

  useEffect(() => {
    if (!phoneRinging) {
      stopOutgoingRing(ringRef);
      return;
    }
    // No audio ring on the client side — the waiting state is visual only.
    return () => stopOutgoingRing(ringRef);
  }, [phoneRinging]);

  return (
    <div className="relative min-h-[calc(100vh-140px)] w-full flex items-center justify-center p-4 sm:p-8 overflow-hidden rounded-[2rem] border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),transparent_35%),linear-gradient(135deg,#0f172a,#172554,#0f172a)] shadow-inner">
      {/* Triage Card */}
      <div className="relative z-10 w-full max-w-lg rounded-[1.75rem] border border-white/70 bg-white/95 p-7 sm:p-10 text-slate-900 space-y-6 shadow-[0_24px_80px_rgba(15,23,42,0.38)] backdrop-blur-xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Request an Interpreter
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            {currentUser.organizationName || 'Tikur Anbessa Specialized Hospital (Addis Ababa)'}
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {showCalling ? (
          <div className="space-y-4">
            {/* Quiet side-panel waiting indicator — no audio, no dramatic animation */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" style={{ animationDuration: '2s' }} />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                </span>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  {interpreterReady ? 'Interpreter ready' : 'Searching for interpreter…'}
                </p>
              </div>

              <h2 className="mt-3 text-lg font-black text-slate-900 leading-snug">
                {interpreterReady ? 'An interpreter accepted your request.' : 'Locating an available interpreter.'}
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
                {interpreterReady
                  ? 'Join the call when you are ready.'
                  : 'Please stay on this screen. This usually takes under a minute.'}
              </p>

              {interpreterReady && ringingRequest?.activeSessionId && (
                <button
                  type="button"
                  onClick={() => onJoinSession(ringingRequest.activeSessionId!)}
                  className="mt-5 w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm cursor-pointer transition-all"
                >
                  Join call
                </button>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">This call</p>
              <p className="mt-1 font-mono text-sm font-bold text-slate-900">{ringingRequest?.reference || 'Connecting'}</p>
              <p className="mt-2 text-sm text-slate-700">
                {languageName(ringingRequest?.sourceLanguage || sourceLanguage)} to {languageName(ringingRequest?.targetLanguage || targetLanguage)}
              </p>
              <p className="mt-1 text-xs text-slate-500">{callMode === 'video' ? 'Video call' : 'Audio call'} · {currentUser.organizationName}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                stopOutgoingRing(ringRef);
                setCalling(false);
              }}
              className="w-full h-11 rounded-xl border border-slate-300 bg-white text-slate-600 text-xs font-bold cursor-pointer hover:bg-slate-50"
            >
              Back to form
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Patient Language Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              {workplaceLanguageLabel(workplace)}
            </label>
            <div className="relative">
              <select
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value)}
                className="w-full h-12 px-4 pr-10 text-sm font-medium border border-slate-300 rounded-xl bg-white text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition cursor-pointer"
              >
                {activeLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-white text-slate-900">
                    {lang.name} ({lang.nativeName})
                  </option>
                ))}
                <option value="unknown" className="bg-white text-slate-900">
                  Uncertain / Other Dialect
                </option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-4 pointer-events-none" />
            </div>
          </div>

          {/* Staff Language Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Staff Language
            </label>
            <div className="relative">
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full h-12 px-4 pr-10 text-sm font-medium border border-slate-300 rounded-xl bg-white text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition cursor-pointer"
              >
                <option value="amh" className="bg-white text-slate-900">Amharic (አማርኛ)</option>
                <option value="eng" className="bg-white text-slate-900">English</option>
                <option value="orm" className="bg-white text-slate-900">Oromo (Afaan Oromoo)</option>
                <option value="tir" className="bg-white text-slate-900">Tigrinya (ትግርኛ)</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-4 pointer-events-none" />
            </div>
          </div>

          {/* Context Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Context
            </label>
            <input
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder={workplaceContext(workplace)}
              className="w-full h-12 px-4 text-sm border border-slate-300 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
            />
          </div>

          {/* Call Preference (Audio vs Video) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Call Preference
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCallMode('audio')}
                className={`h-12 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                  callMode === 'audio'
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <PhoneCall className="w-4 h-4" />
                <span>Audio Call</span>
                {callMode === 'audio' && <Check className="w-3.5 h-3.5 ml-0.5" />}
              </button>

              <button
                type="button"
                onClick={() => setCallMode('video')}
                className={`h-12 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                  callMode === 'video'
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>Video Call</span>
                {callMode === 'video' && <Check className="w-3.5 h-3.5 ml-0.5" />}
              </button>
            </div>
          </div>

          {/* Connect with Interpreter Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Connecting to Call...</span>
                </>
              ) : (
                <>
                  <span>Connect with Interpreter</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

function stopOutgoingRing(ringRef: React.MutableRefObject<{ stop: () => void } | null>) {
  ringRef.current?.stop();
  ringRef.current = null;
}
