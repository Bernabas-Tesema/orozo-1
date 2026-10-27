import React, { useState, useEffect } from 'react';
import {
  User,
  SupportedLanguage,
  InterpretationRequest,
  ServiceCategory,
  UrgencyLevel,
  CommunicationMode,
  ScheduleType
} from '../types';
import {
  Smartphone,
  Wifi,
  Battery,
  AlertTriangle,
  PhoneCall,
  Video,
  Volume2,
  CheckCircle2,
  Clock,
  Send,
  HelpCircle,
  Building,
  Radio,
  Star,
  RefreshCw,
  Layers,
  Mic,
  Bot
} from 'lucide-react';

interface AndroidClientAppProps {
  currentUser: User;
  requests: InterpretationRequest[];
  languages: SupportedLanguage[];
  onCreateRequest: (data: {
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
  }) => Promise<void>;
  onJoinSession: (sessionId: string) => void;
  onOpenFeedback: (sessionId: string) => void;
  onOpenOrzoSupport?: () => void;
  initialSourceLanguage?: string | null;
}

export const AndroidClientApp: React.FC<AndroidClientAppProps> = ({
  currentUser,
  requests,
  languages,
  onCreateRequest,
  onJoinSession,
  onOpenFeedback,
  onOpenOrzoSupport,
  initialSourceLanguage,
}) => {
  const [activeTab, setActiveTab] = useState<'intake' | 'tracker' | 'speakerphone'>('intake');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [frameMode, setFrameMode] = useState<'device' | 'fullscreen'>('device');

  // Form states
  const [sourceLanguage, setSourceLanguage] = useState(initialSourceLanguage || 'orm');

  useEffect(() => {
    if (initialSourceLanguage) {
      setSourceLanguage(initialSourceLanguage);
      setIsUnknownLanguage(false);
    }
  }, [initialSourceLanguage]);

  const [targetLanguage, setTargetLanguage] = useState('amh');
  const [isUnknownLanguage, setIsUnknownLanguage] = useState(false);
  const [unknownNotes, setUnknownNotes] = useState('');
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory>('healthcare');
  const [urgency, setUrgency] = useState<UrgencyLevel>('emergency');
  const [modality, setModality] = useState<CommunicationMode>('audio');
  const [minRoutingContext, setMinRoutingContext] = useState('');
  const [formFeedback, setFormFeedback] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!minRoutingContext.trim()) {
      setFormFeedback('Please provide minimal intake context.');
      return;
    }

    setIsSubmitting(true);
    setFormFeedback(null);
    try {
      await onCreateRequest({
        sourceLanguage: isUnknownLanguage ? undefined : sourceLanguage,
        targetLanguage,
        isUnknownLanguage,
        unknownLanguageNotes: unknownNotes,
        serviceCategory,
        urgency,
        modality,
        scheduleType: 'immediate',
        minRoutingContext: minRoutingContext.trim(),
      });
      setMinRoutingContext('');
      setUnknownNotes('');
      setIsUnknownLanguage(false);
      setActiveTab('tracker');
    } catch (err: any) {
      setFormFeedback(err.message || 'Dispatch failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const clientRequests = requests.filter((r) => r.requesterId === currentUser.id);

  const AndroidStatusBar = () => (
    <div className="bg-slate-900 text-white text-[11px] px-4 py-1.5 flex items-center justify-between select-none border-b border-slate-800">
      <div className="font-bold flex items-center space-x-1.5">
        <span>08:45</span>
        <span className="text-[9px] text-blue-400 font-semibold uppercase">Ethio Telecom 4G</span>
      </div>
      <div className="flex items-center space-x-2">
        <Wifi className="w-3.5 h-3.5 text-slate-300" />
        <span className="text-[10px] text-slate-300">95%</span>
        <Battery className="w-3.5 h-3.5 text-blue-400" />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Simulation Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-gray-900">
                ORZO Android App (Field Terminal)
              </h2>
              <span className="text-[10px] bg-blue-50 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-200">
                {currentUser.clientAccountType === 'organization_admin' ? 'Admin Device' : 'Shared Staff Device'}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Mobile intake terminal for clinics, field triage desks, and mobile stations.
            </p>
          </div>
        </div>

        <button
          onClick={() => setFrameMode(frameMode === 'device' ? 'fullscreen' : 'device')}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 flex items-center space-x-1 cursor-pointer self-start sm:self-auto"
        >
          <Layers className="w-3.5 h-3.5 mr-1 text-gray-500" />
          <span>{frameMode === 'device' ? 'Expand View' : 'Device Frame View'}</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="flex justify-center">
        <div
          className={`w-full transition-all duration-300 ${
            frameMode === 'device'
              ? 'max-w-sm rounded-[40px] border-[10px] border-slate-900 shadow-2xl overflow-hidden bg-slate-900 relative ring-4 ring-slate-800'
              : 'max-w-2xl rounded-2xl border border-gray-300 shadow-md overflow-hidden bg-white'
          }`}
        >
          {frameMode === 'device' && (
            <div className="bg-slate-900 h-5 w-full flex items-center justify-center">
              <div className="w-16 h-3.5 bg-black rounded-b-xl flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-slate-800" />
              </div>
            </div>
          )}

          <AndroidStatusBar />

          {/* Android App Content */}
          <div className="bg-gray-100 flex flex-col min-h-[640px] max-h-[720px] overflow-hidden">
            {/* Top App Bar */}
            <div className="bg-blue-600 text-white px-4 py-3 shadow-md flex items-center justify-between">
              <div>
                <div className="text-[10px] text-blue-100 font-bold uppercase tracking-wider">
                  ORZO Client • {currentUser.organizationName.split(' ')[0]}
                </div>
                <h3 className="text-base font-extrabold tracking-tight">
                  {activeTab === 'intake' && 'New Interpretation'}
                  {activeTab === 'tracker' && 'Active Requests'}
                  {activeTab === 'speakerphone' && 'Speakerphone Assist'}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-[10px] bg-blue-700 px-2 py-0.5 rounded text-white">
                  {currentUser.fullName.split(' ')[0]}
                </span>
              </div>
            </div>

            {/* Scrollable View */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {/* TAB 1: INTAKE */}
              {activeTab === 'intake' && (
                <form onSubmit={handleSubmit} className="space-y-3">
                  {formFeedback && (
                    <div className="p-2.5 bg-red-100 border border-red-300 text-red-800 text-xs rounded-xl flex items-center space-x-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{formFeedback}</span>
                    </div>
                  )}

                  {/* Urgency Selector */}
                  <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1.5">
                      Urgency
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setUrgency('emergency')}
                        className={`py-2 px-1 text-[11px] font-bold rounded-xl border flex flex-col items-center justify-center cursor-pointer ${
                          urgency === 'emergency'
                            ? 'bg-red-50 border-red-500 text-red-800 ring-2 ring-red-400'
                            : 'border-gray-200 text-gray-700'
                        }`}
                      >
                        <span className="text-red-600 flex items-center">
                          <AlertTriangle className="w-3 h-3 mr-0.5" /> Emergency
                        </span>
                        <span className="text-[9px] text-gray-500 font-normal">Immediate</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setUrgency('high')}
                        className={`py-2 px-1 text-[11px] font-bold rounded-xl border flex flex-col items-center justify-center cursor-pointer ${
                          urgency === 'high'
                            ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-400'
                            : 'border-gray-200 text-gray-700'
                        }`}
                      >
                        <span>High Priority</span>
                        <span className="text-[9px] text-gray-500 font-normal">Priority</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setUrgency('standard')}
                        className={`py-2 px-1 text-[11px] font-bold rounded-xl border flex flex-col items-center justify-center cursor-pointer ${
                          urgency === 'standard'
                            ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-400'
                            : 'border-gray-200 text-gray-700'
                        }`}
                      >
                        <span>Standard</span>
                        <span className="text-[9px] text-gray-500 font-normal">Routine</span>
                      </button>
                    </div>
                  </div>

                  {/* Sector */}
                  <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                      Sector
                    </label>
                    <select
                      value={serviceCategory}
                      onChange={(e) => setServiceCategory(e.target.value as ServiceCategory)}
                      className="w-full text-xs font-semibold p-2 border border-gray-300 rounded-xl bg-white"
                    >
                      <option value="healthcare">Healthcare & Clinical Triage</option>
                      <option value="legal_court">Judicial & Courtroom Hearings</option>
                      <option value="immigration">Immigration & Refugee Center</option>
                      <option value="public_services">Public & Civil Administration</option>
                      <option value="ngo_humanitarian">NGO Humanitarian Mission</option>
                    </select>
                  </div>

                  {/* Quick Audio Dialect Identifier */}
                  {onOpenOrzoSupport && (
                    <button
                      type="button"
                      onClick={onOpenOrzoSupport}
                      className="w-full p-2.5 bg-blue-50 border border-blue-200 rounded-2xl text-xs font-bold text-blue-900 flex items-center justify-between hover:bg-blue-100 transition-all cursor-pointer shadow-xs"
                    >
                      <span className="flex items-center space-x-1.5">
                        <Mic className="w-4 h-4 text-red-500 animate-pulse" />
                        <span>Unsure of dialect? Record voice to identify</span>
                      </span>
                      <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold">
                        ORZO Audio
                      </span>
                    </button>
                  )}

                  {/* Unknown Language Toggle */}
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl">
                    <label className="flex items-start space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isUnknownLanguage}
                        onChange={(e) => setIsUnknownLanguage(e.target.checked)}
                        className="mt-0.5 rounded text-amber-600"
                      />
                      <div>
                        <span className="text-xs font-bold text-amber-950">
                          Unknown Dialect
                        </span>
                        <p className="text-[10px] text-amber-800 mt-0.5">
                          Routes directly to dispatch coordinator.
                        </p>
                      </div>
                    </label>

                    {isUnknownLanguage && (
                      <div className="mt-2.5">
                        <textarea
                          rows={2}
                          value={unknownNotes}
                          onChange={(e) => setUnknownNotes(e.target.value)}
                          placeholder="Describe patient speech or region of origin..."
                          className="w-full text-xs p-2 border border-amber-300 rounded-xl bg-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Language Pickers */}
                  {!isUnknownLanguage && (
                    <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-xs space-y-2">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                          Patient Speaks (Source)
                        </label>
                        <select
                          value={sourceLanguage}
                          onChange={(e) => setSourceLanguage(e.target.value)}
                          className="w-full text-xs font-semibold p-2 border border-gray-300 rounded-xl bg-white"
                        >
                          {languages.filter((l) => l.isActive).map((lang) => (
                            <option key={lang.code} value={lang.code}>
                              {lang.name} ({lang.nativeName})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                          Staff Speaks (Target)
                        </label>
                        <select
                          value={targetLanguage}
                          onChange={(e) => setTargetLanguage(e.target.value)}
                          className="w-full text-xs font-semibold p-2 border border-gray-300 rounded-xl bg-white"
                        >
                          {languages.filter((l) => l.isActive).map((lang) => (
                            <option key={lang.code} value={lang.code}>
                              {lang.name} ({lang.nativeName})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Call Mode */}
                  <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1.5">
                      Mode
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setModality('audio')}
                        className={`py-2 px-1 text-[11px] font-bold rounded-xl border flex items-center justify-center cursor-pointer ${
                          modality === 'audio' ? 'bg-blue-50 border-blue-600 text-blue-800' : 'border-gray-200 text-gray-600'
                        }`}
                      >
                        <Volume2 className="w-3.5 h-3.5 mr-1" /> Audio
                      </button>
                      <button
                        type="button"
                        onClick={() => setModality('video')}
                        className={`py-2 px-1 text-[11px] font-bold rounded-xl border flex items-center justify-center cursor-pointer ${
                          modality === 'video' ? 'bg-blue-50 border-blue-600 text-blue-800' : 'border-gray-200 text-gray-600'
                        }`}
                      >
                        <Video className="w-3.5 h-3.5 mr-1" /> Video
                      </button>
                      <button
                        type="button"
                        onClick={() => setModality('phone_assisted')}
                        className={`py-2 px-1 text-[11px] font-bold rounded-xl border flex items-center justify-center cursor-pointer ${
                          modality === 'phone_assisted' ? 'bg-blue-50 border-blue-600 text-blue-800' : 'border-gray-200 text-gray-600'
                        }`}
                      >
                        <PhoneCall className="w-3.5 h-3.5 mr-1" /> Speaker
                      </button>
                    </div>
                  </div>

                  {/* Context */}
                  <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                      Routing Context
                    </label>
                    <textarea
                      rows={2}
                      value={minRoutingContext}
                      onChange={(e) => setMinRoutingContext(e.target.value)}
                      placeholder="e.g. Pediatric trauma triage, vital signs assessment"
                      className="w-full text-xs p-2 border border-gray-300 rounded-xl focus:outline-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Dispatching...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Dispatch Interpreter</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* TAB 2: REQUESTS TRACKER */}
              {activeTab === 'tracker' && (
                <div className="space-y-3">
                  {clientRequests.length === 0 ? (
                    <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center">
                      <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-gray-800">No active requests</p>
                      <button
                        onClick={() => setActiveTab('intake')}
                        className="mt-3 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                      >
                        Create Intake
                      </button>
                    </div>
                  ) : (
                    clientRequests.map((req) => (
                      <div
                        key={req.reference}
                        className="bg-white rounded-2xl border border-gray-200 p-3.5 shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                            {req.reference}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              req.status === 'in_session'
                                ? 'bg-blue-100 text-blue-800 animate-pulse'
                                : req.status === 'assigned'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {req.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="text-xs font-bold text-gray-900">
                          {req.sourceLanguage.toUpperCase()} ➔ {req.targetLanguage.toUpperCase()} (
                          {req.serviceCategory.replace('_', ' ')})
                        </div>

                        <p className="text-[11px] text-gray-600 line-clamp-2">
                          {req.minRoutingContext}
                        </p>

                        {req.assignedInterpreterName && (
                          <div className="p-2 bg-blue-50 rounded-xl text-xs text-blue-900 flex items-center space-x-1.5 border border-blue-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>
                              <strong>Interpreter:</strong> {req.assignedInterpreterName}
                            </span>
                          </div>
                        )}

                        <div className="pt-2 flex items-center justify-between border-t border-gray-100">
                          <span className="text-[10px] text-gray-400">
                            {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>

                          <div className="flex items-center space-x-2">
                            {['assigned', 'in_session'].includes(req.status) && req.activeSessionId && (
                              <button
                                onClick={() => onJoinSession(req.activeSessionId!)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs flex items-center space-x-1 cursor-pointer"
                              >
                                <PhoneCall className="w-3 h-3" />
                                <span>Join Room</span>
                              </button>
                            )}

                            {req.status === 'completed' && req.activeSessionId && (
                              <button
                                onClick={() => onOpenFeedback(req.activeSessionId!)}
                                className="bg-amber-100 text-amber-900 font-semibold text-xs px-2.5 py-1 rounded-lg flex items-center space-x-1 cursor-pointer"
                              >
                                <Star className="w-3 h-3 text-amber-600 fill-amber-500" />
                                <span>Feedback</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: SPEAKERPHONE ASSIST */}
              {activeTab === 'speakerphone' && (
                <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-4">
                  <div className="flex items-center space-x-2 text-blue-800 font-bold text-xs">
                    <Radio className="w-4 h-4 text-blue-600" />
                    <span>Speakerphone Mode</span>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed">
                    Position device between staff and client for hands-free audio interpretation.
                  </p>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                      <strong>1. Placement:</strong> Place terminal within 1 meter of participants.
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                      <strong>2. Volume:</strong> Calibrated with background noise suppression.
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setModality('phone_assisted');
                      setActiveTab('intake');
                    }}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Start Speakerphone Intake
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Nav */}
            <div className="bg-white border-t border-gray-200 px-3 py-2 flex items-center justify-around shadow-inner">
              <button
                onClick={() => setActiveTab('intake')}
                className={`flex flex-col items-center cursor-pointer ${
                  activeTab === 'intake' ? 'text-blue-600 font-bold' : 'text-gray-500'
                }`}
              >
                <div className={`p-1 rounded-xl ${activeTab === 'intake' ? 'bg-blue-50' : ''}`}>
                  <Send className="w-4 h-4" />
                </div>
                <span className="text-[10px] mt-0.5">Intake</span>
              </button>

              <button
                onClick={() => setActiveTab('tracker')}
                className={`flex flex-col items-center cursor-pointer ${
                  activeTab === 'tracker' ? 'text-blue-600 font-bold' : 'text-gray-500'
                }`}
              >
                <div className={`p-1 rounded-xl ${activeTab === 'tracker' ? 'bg-blue-50' : ''}`}>
                  <Clock className="w-4 h-4" />
                </div>
                <span className="text-[10px] mt-0.5">Requests</span>
              </button>

              <button
                onClick={() => setActiveTab('speakerphone')}
                className={`flex flex-col items-center cursor-pointer ${
                  activeTab === 'speakerphone' ? 'text-blue-600 font-bold' : 'text-gray-500'
                }`}
              >
                <div className={`p-1 rounded-xl ${activeTab === 'speakerphone' ? 'bg-blue-50' : ''}`}>
                  <Volume2 className="w-4 h-4" />
                </div>
                <span className="text-[10px] mt-0.5">Speaker</span>
              </button>
            </div>

            {frameMode === 'device' && (
              <div className="bg-black py-2 flex items-center justify-center space-x-12 text-slate-500">
                <span className="w-3 h-3 border-l-2 border-b-2 border-slate-500 transform rotate-45" />
                <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-500" />
                <span className="w-3 h-3 border-2 border-slate-500 rounded-xs" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
