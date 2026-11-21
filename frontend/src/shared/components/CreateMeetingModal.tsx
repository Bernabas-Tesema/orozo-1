import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { User, Meeting } from '../types';
import { X, Video, PhoneCall, Users, Search } from 'lucide-react';

interface CreateMeetingModalProps {
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { title: string; communicationMode: string; participantIds: string[] }) => Promise<Meeting>;
}

export const CreateMeetingModal: React.FC<CreateMeetingModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [communicationMode, setCommunicationMode] = useState<'audio' | 'video'>('video');
  const [staff, setStaff] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    api.getStaff().then((res) => setStaff(res.staff || [])).catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = staff.filter((s) => {
    if (s.id === currentUser.id) return false;
    if (roleFilter !== 'all' && s.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.fullName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    }
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Meeting title is required'); return; }
    setCreating(true);
    setError(null);
    try {
      await onCreate({ title: title.trim(), communicationMode, participantIds: Array.from(selectedIds) });
      setTitle('');
      setSelectedIds(new Set());
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create meeting');
    } finally {
      setCreating(false);
    }
  };

  const roleLabel = (role: string) => {
    if (role === 'platform_admin') return 'Admin';
    if (role === 'supervisor') return 'Supervisor';
    if (role === 'interpreter') return 'Interpreter';
    return role;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Create Group Meeting</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Meeting Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Weekly staff sync..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              />
            </div>

            {/* Communication mode */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Call Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCommunicationMode('video')}
                  className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer transition ${
                    communicationMode === 'video' ? 'bg-blue-50 border-blue-600 text-blue-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Video className="w-4 h-4" /> Video Call
                </button>
                <button
                  type="button"
                  onClick={() => setCommunicationMode('audio')}
                  className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer transition ${
                    communicationMode === 'audio' ? 'bg-blue-50 border-blue-600 text-blue-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <PhoneCall className="w-4 h-4" /> Audio Only
                </button>
              </div>
            </div>

            {/* Participant selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-700 uppercase">
                  Select Participants ({selectedIds.size} selected)
                </label>
                <span className="text-xs text-gray-500">{filtered.length} available</span>
              </div>

              {/* Role filter */}
              <div className="flex gap-1.5 mb-3">
                {[
                  { key: 'all', label: 'All Staff' },
                  { key: 'interpreter', label: 'Interpreters' },
                  { key: 'supervisor', label: 'Supervisors' },
                  { key: 'platform_admin', label: 'Admins' },
                ].map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRoleFilter(r.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                      roleFilter === r.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Staff list */}
              <div className="border border-gray-200 rounded-xl max-h-64 overflow-y-auto divide-y divide-gray-100">
                {filtered.length === 0 && (
                  <div className="p-4 text-center text-sm text-gray-400">No staff members found</div>
                )}
                {filtered.map((person) => (
                  <label
                    key={person.id}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(person.id)}
                      onChange={() => toggleSelect(person.id)}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{person.fullName}</div>
                      <div className="text-xs text-gray-500 truncate">{person.email}</div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      person.role === 'platform_admin' ? 'bg-purple-100 text-purple-700' :
                      person.role === 'supervisor' ? 'bg-blue-100 text-blue-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {roleLabel(person.role)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <span className="text-xs text-gray-500">
              You will be the meeting host.
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-200 cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !title.trim()}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 cursor-pointer transition"
              >
                {creating ? 'Creating...' : 'Start Meeting'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
