import { Video, PhoneCall, X, Users } from 'lucide-react';
import { Meeting } from '../types';

interface MeetingInviteToastProps {
  meeting: Meeting;
  /** Display name of the person who invited this user. */
  hostName: string;
  onJoin: () => void;
  onDismiss: () => void;
}

/**
 * Pop-out meeting invitation shown to staff when a platform_admin starts a
 * meeting. The user must click "Join meeting" themselves — the room is never
 * opened automatically.
 *
 * No sound plays. The toast slides in from the top-right and stays until the
 * user joins or dismisses it.
 */
export function MeetingInviteToast({ meeting, hostName, onJoin, onDismiss }: MeetingInviteToastProps) {
  const isVideo = meeting.communicationMode === 'video';
  const participantCount = meeting.participants?.length ?? 1;

  return (
    <div
      className="fixed top-20 right-4 z-[60] w-80 max-w-[calc(100vw-2rem)]"
      role="alertdialog"
      aria-modal="false"
      aria-labelledby="meeting-invite-title"
    >
      <div
        className="rounded-2xl border border-blue-500/40 bg-slate-900 shadow-2xl overflow-hidden"
        style={{ animation: 'meetingInviteSlideIn 0.3s ease-out' }}
      >
        {/* Header strip */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-white">
            <Users className="w-3.5 h-3.5" />
            Meeting invitation
          </span>
          <button
            type="button"
            onClick={onDismiss}
            className="text-white/70 hover:text-white cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex gap-3 items-start text-white">
          <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/20 text-blue-300">
            {isVideo ? <Video className="w-5 h-5" /> : <PhoneCall className="w-5 h-5" />}
          </div>

          <div className="flex-1 min-w-0">
            <p
              id="meeting-invite-title"
              className="text-sm font-black leading-tight truncate"
            >
              {meeting.title}
            </p>
            <p className="text-xs mt-0.5 text-white/60">
              <strong className="text-white/90">{hostName}</strong> invited you
            </p>
            <p className="text-[11px] mt-1 text-white/40">
              {isVideo ? 'Video meeting' : 'Audio meeting'} · {participantCount} invited
            </p>

            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={onJoin}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer transition-all flex items-center gap-1.5"
              >
                {isVideo ? <Video className="w-3.5 h-3.5" /> : <PhoneCall className="w-3.5 h-3.5" />}
                Join meeting
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="text-xs font-semibold text-white/40 hover:text-white/70 cursor-pointer"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes meetingInviteSlideIn {
          from { transform: translateX(calc(100% + 1rem)); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
