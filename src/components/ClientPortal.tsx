import React, { useState } from 'react';
import {
  User,
  InterpretationRequest,
  SupportedLanguage,
  ServiceCategory,
  UrgencyLevel,
  CommunicationMode,
  ScheduleType
} from '../types';
import {
  PlusCircle,
  Clock,
  AlertTriangle,
  PhoneCall,
  Video,
  Volume2,
  Calendar,
  Building2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  Star,
  Monitor
} from 'lucide-react';

interface ClientPortalProps {
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
  onCancelRequest: (reference: string, reason?: string) => Promise<void>;
  onJoinSession: (sessionId: string) => void;
  onOpenFeedback: (sessionId: string) => void;
}

export const ClientPortal: React.FC<ClientPortalProps> = ({
  currentUser,
  requests,
  languages,
  onCreateRequest,
  onCancelRequest,
  onJoinSession,
  onOpenFeedback,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [sourceLanguage, setSourceLanguage] = useState('orm');
  const [targetLanguage, setTargetLanguage] = useState('amh');
  const [isUnknownLanguage, setIsUnknownLanguage] = useState(false);
  const [unknownNotes, setUnknownNotes] = useState('');
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory>('healthcare');
  const [urgency, setUrgency] = useState<UrgencyLevel>('emergency');
  const [modality, setModality] = useState<CommunicationMode>('audio');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('immediate');
  const [scheduledTime, setScheduledTime] = useState('');
  const [minRoutingContext, setMinRoutingContext] = useState('');

  // Cancellation modal state
  const [cancelModalRef, setCancelModalRef] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const isOrgAdmin = currentUser.clientAccountType === 'organization_admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!minRoutingContext.trim()) {
      setFormError('Please enter routing context.');
      return;
    }

    if (scheduleType === 'scheduled' && !scheduledTime) {
      setFormError('Please select a date and time.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateRequest({
        sourceLanguage: isUnknownLanguage ? undefined : sourceLanguage,
        targetLanguage,
        isUnknownLanguage,
        unknownLanguageNotes: unknownNotes,
        serviceCategory,
        urgency,
        modality,
        scheduleType,
        scheduledTime: scheduleType === 'scheduled' ? scheduledTime : undefined,
        minRoutingContext: minRoutingContext.trim(),
      });
      setShowModal(false);
      setMinRoutingContext('');
      setUnknownNotes('');
      setIsUnknownLanguage(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalRef) return;
    try {
      await onCancelRequest(cancelModalRef, cancelReason);
      setCancelModalRef(null);
      setCancelReason('');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_session':
        return {
          label: 'Active Call',
          className: 'bg-blue-100 text-blue-800 border-blue-300 font-bold animate-pulse',
        };
      case 'assigned':
        return {
          label: 'Interpreter Assigned',
          className: 'bg-indigo-100 text-indigo-800 border-indigo-300 font-semibold',
        };
      case 'matching':
        return {
          label: 'Matching...',
          className: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
        };
      case 'pending_coordinator':
        return {
          label: 'In Coordinator Queue',
          className: 'bg-purple-100 text-purple-800 border-purple-300 font-semibold',
        };
      case 'completed':
        return {
          label: 'Completed',
          className: 'bg-gray-100 text-gray-700 border-gray-300',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          className: 'bg-red-50 text-red-700 border-red-200',
        };
      default:
        return {
          label: status.replace('_', ' '),
          className: 'bg-gray-100 text-gray-700 border-gray-200',
        };
    }
  };

  const activeLanguages = languages.filter((l) => l.isActive);

  return (
    <div className="space-y-6">
      {/* Top Banner: Crisp, purposeful, and Blue */}
      <div className="bg-slate-900 rounded-2xl p-6 sm:p-7 text-white shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-blue-900/60 text-blue-300 text-xs font-semibold mb-2 border border-blue-700/50">
            {isOrgAdmin ? <Building2 className="w-3.5 h-3.5 mr-1" /> : <Monitor className="w-3.5 h-3.5 mr-1" />}
            <span>{isOrgAdmin ? 'Organization Admin Portal' : 'Shared Staff Terminal'} • {currentUser.organizationName}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            Interpretation Intake & Dispatch
          </h1>
          <p className="mt-1 text-slate-300 text-xs">
            Connect verified interpreters for healthcare, courtroom testimony, and civil intake.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0">
          <button
            onClick={() => {
              setScheduleType('immediate');
              setUrgency('emergency');
              setShowModal(true);
            }}
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm text-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Emergency Dispatch</span>
          </button>

          <button
            onClick={() => {
              setScheduleType('immediate');
              setUrgency('standard');
              setShowModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm text-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Request</span>
          </button>
        </div>
      </div>

      {/* Requests Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/70">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              {isOrgAdmin ? 'Organization Request History' : 'Terminal Active Requests'}
            </h2>
            <p className="text-xs text-gray-500">Live matching, assigned interpreters, and session actions</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors cursor-pointer shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Create</span>
          </button>
        </div>

        {requests.length === 0 ? (
          <div className="text-center py-12 px-4">
            <h3 className="text-xs font-semibold text-gray-800">No requests submitted yet</h3>
            <button
              onClick={() => setShowModal(true)}
              className="mt-3 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 cursor-pointer"
            >
              Submit Intake Request
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {requests.map((req) => {
              const badge = getStatusBadge(req.status);
              const sourceLangObj = languages.find((l) => l.code === req.sourceLanguage);
              const targetLangObj = languages.find((l) => l.code === req.targetLanguage);

              return (
                <div key={req.reference} className="p-4 hover:bg-gray-50/70 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                          {req.reference}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${badge.className}`}>
                          {badge.label}
                        </span>
                        {req.urgency === 'emergency' && (
                          <span className="text-[10px] bg-red-600 text-white font-black uppercase px-2 py-0.5 rounded-full">
                            Emergency
                          </span>
                        )}
                        <span className="text-xs text-gray-500 font-semibold uppercase">
                          {req.serviceCategory.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500 flex items-center">
                          {req.modality === 'video' && <Video className="w-3.5 h-3.5 mr-1 text-purple-600" />}
                          {req.modality === 'audio' && <Volume2 className="w-3.5 h-3.5 mr-1 text-blue-600" />}
                          {req.modality === 'phone_assisted' && <PhoneCall className="w-3.5 h-3.5 mr-1 text-amber-600" />}
                          {req.modality === 'phone_assisted' ? 'Speakerphone' : req.modality}
                        </span>
                      </div>

                      {/* Language Pair */}
                      <div className="flex items-center space-x-2 text-xs">
                        {req.isUnknownLanguage ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                            <HelpCircle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                            Unknown Dialect (Coordinator Escalation)
                          </span>
                        ) : (
                          <div className="font-bold text-gray-900 flex items-center space-x-1.5">
                            <span className="text-blue-800">
                              {sourceLangObj ? `${sourceLangObj.name} (${sourceLangObj.nativeName})` : req.sourceLanguage.toUpperCase()}
                            </span>
                            <span className="text-gray-400">➔</span>
                            <span className="text-blue-800">
                              {targetLangObj ? `${targetLangObj.name} (${targetLangObj.nativeName})` : req.targetLanguage.toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Context */}
                      <p className="text-xs text-gray-600 max-w-2xl line-clamp-1">
                        <strong>Context: </strong>{req.minRoutingContext}
                      </p>

                      {req.assignedInterpreterName && (
                        <div className="text-xs text-blue-900 bg-blue-50 border border-blue-200 rounded-md p-1.5 flex items-center space-x-1.5 max-w-sm">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>
                            <strong>Interpreter:</strong> {req.assignedInterpreterName}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right Action Buttons */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <div className="text-[11px] text-gray-400 flex items-center mr-2">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>

                      {['assigned', 'in_session'].includes(req.status) && req.activeSessionId && (
                        <button
                          onClick={() => onJoinSession(req.activeSessionId!)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-xs flex items-center space-x-1 transition-colors cursor-pointer"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>Join Room</span>
                        </button>
                      )}

                      {req.status === 'completed' && req.activeSessionId && (
                        <button
                          onClick={() => onOpenFeedback(req.activeSessionId!)}
                          className="bg-amber-50 text-amber-800 border border-amber-300 font-semibold text-xs px-2.5 py-1.5 rounded-lg hover:bg-amber-100 flex items-center space-x-1 cursor-pointer"
                        >
                          <Star className="w-3 h-3 text-amber-600 fill-amber-500" />
                          <span>Rate</span>
                        </button>
                      )}

                      {!['completed', 'cancelled'].includes(req.status) && (
                        <button
                          onClick={() => setCancelModalRef(req.reference)}
                          className="text-gray-400 hover:text-red-600 text-xs px-2 py-1 rounded cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Request Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900">
                New Interpretation Request
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              {/* Urgency */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Urgency Tier
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setUrgency('emergency')}
                    className={`py-2 px-2 text-xs font-bold rounded-lg border text-center cursor-pointer ${
                      urgency === 'emergency'
                        ? 'bg-red-50 border-red-500 text-red-800 ring-2 ring-red-400'
                        : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    Emergency
                  </button>
                  <button
                    type="button"
                    onClick={() => setUrgency('high')}
                    className={`py-2 px-2 text-xs font-bold rounded-lg border text-center cursor-pointer ${
                      urgency === 'high'
                        ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-400'
                        : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    High Priority
                  </button>
                  <button
                    type="button"
                    onClick={() => setUrgency('standard')}
                    className={`py-2 px-2 text-xs font-bold rounded-lg border text-center cursor-pointer ${
                      urgency === 'standard'
                        ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-400'
                        : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    Standard
                  </button>
                </div>
              </div>

              {/* Service Sector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Sector
                </label>
                <select
                  value={serviceCategory}
                  onChange={(e) => setServiceCategory(e.target.value as ServiceCategory)}
                  className="w-full text-xs font-medium border border-gray-300 rounded-lg p-2 bg-white cursor-pointer"
                >
                  <option value="healthcare">Healthcare & Clinical Triage</option>
                  <option value="legal_court">Judicial & Court Proceedings</option>
                  <option value="immigration">Immigration & Refugee Center</option>
                  <option value="public_services">Public & Civil Administration</option>
                  <option value="ngo_humanitarian">NGO Humanitarian Operations</option>
                </select>
              </div>

              {/* Unknown Language toggle */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isUnknownLanguage}
                    onChange={(e) => setIsUnknownLanguage(e.target.checked)}
                    className="rounded text-amber-600 h-4 w-4"
                  />
                  <span className="text-xs font-bold text-amber-900">
                    Unknown or Uncertain Dialect (Route to Human Coordinator)
                  </span>
                </label>

                {isUnknownLanguage && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={unknownNotes}
                      onChange={(e) => setUnknownNotes(e.target.value)}
                      placeholder="Dialect clues or origin (e.g. Borana / Moyale border)..."
                      className="w-full text-xs p-2 border border-amber-300 rounded-lg bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Languages (when not unknown) */}
              {!isUnknownLanguage && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Patient Language
                    </label>
                    <select
                      value={sourceLanguage}
                      onChange={(e) => setSourceLanguage(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white"
                    >
                      {activeLanguages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name} ({lang.nativeName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Staff Language
                    </label>
                    <select
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white"
                    >
                      {activeLanguages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name} ({lang.nativeName})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Modality */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Call Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setModality('audio')}
                    className={`py-2 px-1 text-xs font-semibold rounded-lg border flex items-center justify-center cursor-pointer ${
                      modality === 'audio' ? 'bg-blue-50 border-blue-600 text-blue-800' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5 mr-1" /> Audio
                  </button>
                  <button
                    type="button"
                    onClick={() => setModality('video')}
                    className={`py-2 px-1 text-xs font-semibold rounded-lg border flex items-center justify-center cursor-pointer ${
                      modality === 'video' ? 'bg-blue-50 border-blue-600 text-blue-800' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5 mr-1" /> Video
                  </button>
                  <button
                    type="button"
                    onClick={() => setModality('phone_assisted')}
                    className={`py-2 px-1 text-xs font-semibold rounded-lg border flex items-center justify-center cursor-pointer ${
                      modality === 'phone_assisted' ? 'bg-blue-50 border-blue-600 text-blue-800' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <PhoneCall className="w-3.5 h-3.5 mr-1" /> Speaker
                  </button>
                </div>
              </div>

              {/* Routing Context */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Context (Minimal PII)
                </label>
                <input
                  type="text"
                  value={minRoutingContext}
                  onChange={(e) => setMinRoutingContext(e.target.value)}
                  placeholder="e.g. Acute pediatric respiratory intake"
                  className="w-full text-xs p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer flex items-center space-x-1"
                >
                  <span>{isSubmitting ? 'Dispatching...' : 'Dispatch Request'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModalRef && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full shadow-xl border border-gray-200">
            <h4 className="text-sm font-bold text-gray-900">Cancel Request {cancelModalRef}</h4>
            <p className="text-xs text-gray-500 mt-1">Provide a cancellation reason:</p>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. On-site bilingual staff resolved"
              className="mt-3 w-full text-xs p-2 border border-gray-300 rounded-lg"
            />
            <div className="mt-4 flex items-center justify-end space-x-2">
              <button
                onClick={() => setCancelModalRef(null)}
                className="px-3 py-1.5 text-xs text-gray-600 cursor-pointer"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmCancel}
                className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
