import React, { useState } from 'react';
import {
  User,
  SupportedLanguage,
  InterpreterProfile,
  AuditLog,
  PlatformSettings
} from '../types';
import {
  ShieldCheck,
  Languages,
  Sliders,
  FileCheck2,
  Lock,
  Plus,
  Check,
  X,
  AlertTriangle,
  Search,
  ExternalLink,
  Save,
  Radio,
  Server,
  Ban
} from 'lucide-react';

interface PlatformAdminPortalProps {
  currentUser: User;
  languages: SupportedLanguage[];
  interpreters: InterpreterProfile[];
  auditLogs: AuditLog[];
  settings: PlatformSettings;
  onUpdateLanguage: (code: string, data: Partial<SupportedLanguage>) => Promise<void>;
  onAddLanguage: (data: Partial<SupportedLanguage>) => Promise<void>;
  onVerifyInterpreter: (id: string, status: string, note?: string) => Promise<void>;
  onUpdateSettings: (settings: Partial<PlatformSettings>) => Promise<void>;
}

export const PlatformAdminPortal: React.FC<PlatformAdminPortalProps> = ({
  currentUser,
  languages,
  interpreters,
  auditLogs,
  settings,
  onUpdateLanguage,
  onAddLanguage,
  onVerifyInterpreter,
  onUpdateSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'languages' | 'verification' | 'settings' | 'audit'>('languages');
  const [searchAudit, setSearchAudit] = useState('');

  // Add Language modal
  const [showAddLang, setShowAddLang] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newNativeName, setNewNativeName] = useState('');
  const [newScript, setNewScript] = useState<'Ethiopic' | 'Latin' | 'Arabic'>('Ethiopic');
  const [newVariants, setNewVariants] = useState('');

  // Settings form
  const [assignmentTimeout, setAssignmentTimeout] = useState(settings.assignmentTimeoutSeconds);
  const [maxRetries, setMaxRetries] = useState(settings.maxAutoRetries);
  const [lowBandwidthPreset, setLowBandwidthPreset] = useState(settings.telecomLowBandwidthPreset);
  const [emergencyBypass, setEmergencyBypass] = useState(settings.emergencyPriorityBypass);
  const [allowRecording, setAllowRecording] = useState(settings.allowDirectRecording);
  const [bannerNotice, setBannerNotice] = useState(settings.systemBannerNotice);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Interpreter verification note modal
  const [verifyModalInt, setVerifyModalInt] = useState<{ id: string; targetState: string } | null>(null);
  const [verifyNote, setVerifyNote] = useState('');

  const handleToggleLang = async (code: string, currentActive: boolean) => {
    try {
      await onUpdateLanguage(code, { isActive: !currentActive });
    } catch (err: any) {
      alert(`Error toggling language: ${err.message}`);
    }
  };

  const handleCreateLanguage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName) return;
    try {
      await onAddLanguage({
        code: newCode.toLowerCase(),
        name: newName,
        nativeName: newNativeName || newName,
        script: newScript,
        variants: newVariants ? newVariants.split(',').map((s) => s.trim()) : [],
        isActive: true,
      });
      setShowAddLang(false);
      setNewCode('');
      setNewName('');
      setNewNativeName('');
      setNewVariants('');
    } catch (err: any) {
      alert(`Failed to add language: ${err.message}`);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsSuccess(false);
    try {
      await onUpdateSettings({
        assignmentTimeoutSeconds: Number(assignmentTimeout),
        maxAutoRetries: Number(maxRetries),
        telecomLowBandwidthPreset: lowBandwidthPreset,
        emergencyPriorityBypass: emergencyBypass,
        allowDirectRecording: allowRecording,
        systemBannerNotice: bannerNotice,
      });
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to update settings: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleConfirmVerification = async () => {
    if (!verifyModalInt) return;
    try {
      await onVerifyInterpreter(verifyModalInt.id, verifyModalInt.targetState, verifyNote);
      setVerifyModalInt(null);
      setVerifyNote('');
    } catch (err: any) {
      alert(`Error updating verification: ${err.message}`);
    }
  };

  const filteredLogs = auditLogs.filter(
    (l) =>
      l.action.toLowerCase().includes(searchAudit.toLowerCase()) ||
      l.actorName.toLowerCase().includes(searchAudit.toLowerCase()) ||
      l.resourceId.toLowerCase().includes(searchAudit.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Admin Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-lg border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-purple-400" />
              <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
                System Governance & Registry
              </span>
            </div>
            <h1 className="text-2xl font-black mt-1">Platform Administration & Audit</h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Control the national language catalog, verify interpreter certifications, manage telecom resilience presets, and inspect immutable security audit trails.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs bg-purple-950/70 border border-purple-800 text-purple-300 px-3 py-1.5 rounded-lg">
              Admin: <strong>{currentUser.fullName}</strong>
            </span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-slate-800">
          <button
            onClick={() => setActiveTab('languages')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'languages'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Languages className="w-4 h-4" />
            <span>Supported Languages ({languages.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('verification')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'verification'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Interpreter Accreditation Registry ({interpreters.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'settings'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Platform Configuration</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'audit'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Security Audit Logs ({auditLogs.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: SUPPORTED LANGUAGES CATALOG (FR-014, FR-019) */}
      {activeTab === 'languages' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                National Supported Language Catalog (SRS FR-014)
              </h3>
              <p className="text-xs text-gray-500">
                Languages can be deactivated but never deleted to preserve historical case records (FR-019).
              </p>
            </div>
            <button
              onClick={() => setShowAddLang(true)}
              className="px-3 py-1.5 bg-purple-700 text-white text-xs font-semibold rounded-lg hover:bg-purple-800 flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Language</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100/75 text-gray-700 font-bold uppercase tracking-wider text-[11px] border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Language Name</th>
                  <th className="py-3 px-4">Native Name</th>
                  <th className="py-3 px-4">Script</th>
                  <th className="py-3 px-4">Dialect Variants</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {languages.map((l) => (
                  <tr key={l.code} className="hover:bg-gray-50/80">
                    <td className="py-3 px-4 font-mono font-bold text-gray-900 uppercase">{l.code}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{l.name}</td>
                    <td className="py-3 px-4 text-gray-700 font-medium">{l.nativeName}</td>
                    <td className="py-3 px-4 text-gray-600">
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-mono">
                        {l.script}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 max-w-xs truncate">
                      {l.variants.join(', ')}
                    </td>
                    <td className="py-3 px-4">
                      {l.isActive ? (
                        <span className="inline-flex items-center text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold border border-emerald-200 text-[10px]">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full font-semibold text-[10px]">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggleLang(l.code, l.isActive)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded cursor-pointer ${
                          l.isActive
                            ? 'text-red-700 hover:bg-red-50'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {l.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: INTERPRETER ACCREDITATION REGISTRY (FR-011, FR-012, FR-013) */}
      {activeTab === 'verification' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-900">
              Accredited Interpreters Verification Status (SRS FR-012)
            </h3>
            <p className="text-xs text-gray-500">
              High-stakes medical and court assignments require verified credentials. Unverified or suspended interpreters are excluded from dispatch (FR-013).
            </p>
          </div>

          <div className="divide-y divide-gray-100">
            {interpreters.map((int) => (
              <div key={int.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-bold text-gray-900">{int.fullName}</h4>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        int.verificationState === 'verified'
                          ? 'bg-emerald-100 text-emerald-800'
                          : int.verificationState === 'suspended'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {int.verificationState}
                    </span>
                    <span className="text-xs text-gray-500">ID: {int.id}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    <strong>Languages:</strong>{' '}
                    {int.supportedLanguages.map((l) => `${l.languageCode.toUpperCase()} (${l.proficiency})`).join(', ')}
                  </div>
                  <div className="text-xs text-gray-500">
                    <strong>Credentials:</strong>{' '}
                    {int.qualifications.map((q) => `${q.title} [${q.issuingBody}]`).join(' • ')}
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {int.verificationState !== 'verified' && (
                    <button
                      onClick={() => setVerifyModalInt({ id: int.id, targetState: 'verified' })}
                      className="px-3 py-1.5 text-xs font-bold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 cursor-pointer"
                    >
                      Approve & Verify
                    </button>
                  )}
                  {int.verificationState !== 'suspended' && (
                    <button
                      onClick={() => setVerifyModalInt({ id: int.id, targetState: 'suspended' })}
                      className="px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-50 rounded-lg cursor-pointer"
                    >
                      Suspend
                    </button>
                  )}
                  {int.verificationState === 'suspended' && (
                    <button
                      onClick={() => setVerifyModalInt({ id: int.id, targetState: 'verified' })}
                      className="px-3 py-1.5 text-xs font-bold bg-blue-700 text-white rounded-lg hover:bg-blue-800 cursor-pointer"
                    >
                      Reinstate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PLATFORM SETTINGS (FR-016, 7.4) */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs max-w-3xl space-y-6">
          <div>
            <h3 className="text-base font-bold text-gray-900">Global Platform Configuration</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Tune dispatch timeouts, telecom network resilience, and security policies.
            </p>
          </div>

          {settingsSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-lg flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Configuration successfully saved and applied to dispatch workers.</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Interpreter Assignment Accept Timeout (Seconds)
              </label>
              <input
                type="number"
                min={15}
                max={180}
                value={assignmentTimeout}
                onChange={(e) => setAssignmentTimeout(Number(e.target.value))}
                className="w-48 text-xs p-2 border border-gray-300 rounded-lg"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                After this duration, unanswered assignments automatically cycle to next candidate or coordinator queue (FR-033).
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Maximum Automated Dispatch Retries
              </label>
              <input
                type="number"
                min={1}
                max={5}
                value={maxRetries}
                onChange={(e) => setMaxRetries(Number(e.target.value))}
                className="w-48 text-xs p-2 border border-gray-300 rounded-lg"
              />
            </div>

            {/* Telecom Low Bandwidth Preset */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-xs font-bold text-gray-900">
                    Ethiopian Telecom Low-Bandwidth Resilience Preset
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Forces 16kbps Opus voice audio codec fallback for unstable rural 3G/4G connections.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={lowBandwidthPreset}
                  onChange={(e) => setLowBandwidthPreset(e.target.checked)}
                  className="rounded text-purple-600 h-4 w-4"
                />
              </label>
            </div>

            {/* Direct Recording Warning per SRS FR-016 & 7.4 */}
            <div className="p-4 bg-red-50/60 border border-red-200 rounded-xl">
              <label className="flex items-start justify-between cursor-pointer">
                <div className="pr-4">
                  <div className="text-xs font-bold text-red-900 flex items-center">
                    <Ban className="w-3.5 h-3.5 mr-1 text-red-700" />
                    Session Media Recording Policy (SRS Section 7.4)
                  </div>
                  <div className="text-[11px] text-red-800 mt-0.5 leading-relaxed">
                    <strong>Recording is disabled by default.</strong> Any recording requires written legal policy approval, patient/witness explicit consent, and defined retention rules. Turning this on without prior legal approval breaches SRS Section 7.4.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={allowRecording}
                  onChange={(e) => setAllowRecording(e.target.checked)}
                  className="mt-1 rounded text-red-600 h-4 w-4"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                System Broadcast Announcement Notice
              </label>
              <input
                type="text"
                value={bannerNotice}
                onChange={(e) => setBannerNotice(e.target.value)}
                className="w-full text-xs p-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="px-5 py-2.5 bg-purple-700 text-white text-xs font-bold rounded-xl hover:bg-purple-800 transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{savingSettings ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS (FR-066, FR-067, 7.5) */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Security & Operational Audit Trail (SRS FR-066)
              </h3>
              <p className="text-xs text-gray-500">
                Non-tamperable chronological security log for privileged actions, reassignments, and verification checks.
              </p>
            </div>
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search action, actor, resource..."
                value={searchAudit}
                onChange={(e) => setSearchAudit(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100/75 text-gray-700 font-bold uppercase tracking-wider text-[11px] border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">Result</th>
                  <th className="py-3 px-4">Security Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-gray-900">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-4 text-gray-700">
                      <span className="font-semibold">{log.actorName}</span>{' '}
                      <span className="text-[10px] text-gray-400">({log.actorRole})</span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-gray-600">
                      {log.resourceType}:{log.resourceId}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          log.result === 'success'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.result === 'denied'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {log.result}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-500 max-w-xs truncate text-[11px]">
                      {log.securityMetadata?.note || log.correlationId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Language Modal */}
      {showAddLang && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900">Add Ethiopian Language to Catalog</h3>
            <form onSubmit={handleCreateLanguage} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Language Code (ISO/Custom 3-letter)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., kst, brm, hrr"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Language Name (English)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Harari"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Native Script Display
                </label>
                <input
                  type="text"
                  placeholder="e.g., ሐረሪ"
                  value={newNativeName}
                  onChange={(e) => setNewNativeName(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Orthography / Script Type
                </label>
                <select
                  value={newScript}
                  onChange={(e) => setNewScript(e.target.value as any)}
                  className="w-full text-xs p-2 border border-gray-300 rounded-lg"
                >
                  <option value="Ethiopic">Ethiopic (ግዕዝ)</option>
                  <option value="Latin">Latin / Qubee</option>
                  <option value="Arabic">Arabic</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Regional Dialect Variants (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Jugol, Aw Abdal"
                  value={newVariants}
                  onChange={(e) => setNewVariants(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddLang(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
                >
                  Save Language
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verify Interpreter Modal */}
      {verifyModalInt && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900">
              Update Accreditation Status: {verifyModalInt.targetState.toUpperCase()}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Interpreter ID: {verifyModalInt.id}. This action is logged permanently to the platform security audit trail.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Audit Note / Verification Registry Reference
              </label>
              <textarea
                rows={3}
                value={verifyNote}
                onChange={(e) => setVerifyNote(e.target.value)}
                placeholder="e.g. Verified with Ethiopian Medical Association registry #EMA-2026-904"
                className="w-full text-xs p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div className="pt-4 mt-4 flex items-center justify-end space-x-2 border-t">
              <button
                onClick={() => setVerifyModalInt(null)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmVerification}
                className="px-4 py-2 text-xs font-bold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
              >
                Confirm Status Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
