import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Meeting, User } from '../types';
import { api } from '../api';
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  ConnectionState,
} from 'livekit-client';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Signal,
  Clock,
  User as UserIcon,
  Users,
  Volume2,
} from 'lucide-react';

interface ParticipantInfo {
  identity: string;
  name: string;
  hasVideo: boolean;
  isMuted: boolean;
}

interface MeetingRoomProps {
  meeting: Meeting;
  currentUser: User;
  onEnd: (meetingId: string) => Promise<void>;
  onClose: () => void;
}

export const MeetingRoom: React.FC<MeetingRoomProps> = ({
  meeting,
  currentUser,
  onEnd,
  onClose,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(meeting.communicationMode !== 'video');
  const [duration, setDuration] = useState(0);
  const [connectionState, setConnectionState] = useState<string>('initializing');
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [endingMeeting, setEndingMeeting] = useState(false);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  // Single shared audio element for all remote audio (works for group calls)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const roomRef = useRef<Room | null>(null);

  // Map: identity → DOM video element (populated by ref callbacks)
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map());
  // Map: identity → pending video track waiting for a DOM element
  const pendingTracks = useRef<Map<string, RemoteTrack>>(new Map());

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setDuration((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Keep both sides synchronized: when any participant ends the meeting,
  // the peer UI disconnects as soon as the meeting status is updated.
  useEffect(() => {
    let stopped = false;
    const watch = async () => {
      try {
        const res = await api.getMeetingDetail(meeting.id);
        if (stopped || res.meeting.status !== 'ended') return;
        stopped = true;
        try { roomRef.current?.disconnect(); } catch {}
        localStreamRef.current?.getTracks().forEach((track) => track.stop());
        onClose();
      } catch {
        // A missed status check should not drop a live call.
      }
    };
    const timer = window.setInterval(watch, 1500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [meeting.id, onClose]);

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  };

  // Called by ref callback when a remote video element mounts — attach any pending track
  const onRemoteVideoMount = useCallback((identity: string, el: HTMLVideoElement | null) => {
    remoteVideoRefs.current.set(identity, el);
    if (el) {
      const pending = pendingTracks.current.get(identity);
      if (pending) {
        pending.attach(el);
        void el.play?.().catch(() => undefined);
        pendingTracks.current.delete(identity);
        // Mark as having video
        setParticipants((prev) =>
          prev.map((p) => p.identity === identity ? { ...p, hasVideo: true } : p),
        );
      }
    }
  }, []);

  const attachRemoteTrack = useCallback((track: RemoteTrack, participant: RemoteParticipant) => {
    if (track.kind === Track.Kind.Audio) {
      // Use LiveKit's own element as fallback — works better for multi-participant
      track.attach();
      setParticipants((prev) =>
        prev.map((p) => p.identity === participant.identity ? { ...p, isMuted: false } : p),
      );
    } else if (track.kind === Track.Kind.Video) {
      // Add participant tile first
      setParticipants((prev) => {
        if (prev.find((p) => p.identity === participant.identity)) {
          return prev.map((p) =>
            p.identity === participant.identity ? { ...p, hasVideo: true } : p,
          );
        }
        return [
          ...prev,
          {
            identity: participant.identity,
            name: participant.name || participant.identity,
            hasVideo: true,
            isMuted: false,
          },
        ];
      });

      // Try to attach immediately if element already mounted
      const el = remoteVideoRefs.current.get(participant.identity);
      if (el) {
        track.attach(el);
        void el.play?.().catch(() => undefined);
      } else {
        // Store for when the DOM element mounts
        pendingTracks.current.set(participant.identity, track);
      }
    }
  }, []);

  // Join meeting on mount
  useEffect(() => {
    let active = true;

    async function join() {
      try {
        setConnectionState('connecting');
        setConnectionNotice('Joining meeting...');

        const tokenRes = await api.joinMeeting(meeting.id);
        if (!active) return;

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: { resolution: { width: 1280, height: 720, frameRate: 24 } },
        });
        roomRef.current = room;

        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          if (!active) return;
          if (state === ConnectionState.Connected) {
            setConnectionState('connected');
            setConnectionNotice(null);
          } else if (state === ConnectionState.Disconnected) {
            setConnectionState('disconnected');
          }
        });

        room.on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
            if (!active) return;
            attachRemoteTrack(track, participant);
          },
        );

        room.on(
          RoomEvent.TrackPublished,
          (pub: RemoteTrackPublication, participant: RemoteParticipant) => {
            if (!active) return;
            try { pub.setSubscribed(true); } catch {}
            if (pub.track) attachRemoteTrack(pub.track, participant);
          },
        );

        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          track.detach();
        });

        room.on(RoomEvent.TrackMuted, (pub, participant) => {
          if (!active) return;
          if (participant instanceof RemoteParticipant && pub.kind === Track.Kind.Audio) {
            setParticipants((prev) =>
              prev.map((p) => p.identity === participant.identity ? { ...p, isMuted: true } : p),
            );
          }
        });

        room.on(RoomEvent.TrackUnmuted, (pub, participant) => {
          if (!active) return;
          if (participant instanceof RemoteParticipant && pub.kind === Track.Kind.Audio) {
            setParticipants((prev) =>
              prev.map((p) => p.identity === participant.identity ? { ...p, isMuted: false } : p),
            );
          }
        });

        room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
          if (!active) return;
          setParticipants((prev) => {
            if (prev.find((p) => p.identity === participant.identity)) return prev;
            return [
              ...prev,
              {
                identity: participant.identity,
                name: participant.name || participant.identity,
                hasVideo: false,
                isMuted: false,
              },
            ];
          });
          participant.trackPublications.forEach((pub) => {
            try { pub.setSubscribed(true); } catch {}
            if (pub.track) attachRemoteTrack(pub.track, participant);
          });
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
          setParticipants((prev) => prev.filter((p) => p.identity !== participant.identity));
          pendingTracks.current.delete(participant.identity);
          remoteVideoRefs.current.delete(participant.identity);
        });

        // Seed existing participants before connect resolves
        room.remoteParticipants.forEach((participant) => {
          setParticipants((prev) => {
            if (prev.find((p) => p.identity === participant.identity)) return prev;
            return [
              ...prev,
              {
                identity: participant.identity,
                name: participant.name || participant.identity,
                hasVideo: false,
                isMuted: false,
              },
            ];
          });
          participant.trackPublications.forEach((pub) => {
            try { pub.setSubscribed(true); } catch {}
            if (pub.track) attachRemoteTrack(pub.track, participant);
          });
        });

        await room.connect(tokenRes.url, tokenRes.token, { autoSubscribe: true });
        if (!active) return;

        setConnectionState('connected');
        setConnectionNotice(null);

        // Re-bind after connect settles (second-joiner path)
        room.remoteParticipants.forEach((participant) => {
          participant.trackPublications.forEach((pub) => {
            try { pub.setSubscribed(true); } catch {}
            if (pub.track) attachRemoteTrack(pub.track, participant);
          });
        });

        // Publish local tracks
        try {
          await room.localParticipant.setMicrophoneEnabled(true);
          if (meeting.communicationMode === 'video') {
            await room.localParticipant.setCameraEnabled(true);
            setIsVideoOff(false);
          } else {
            await room.localParticipant.setCameraEnabled(false);
          }
        } catch (mediaErr: any) {
          console.warn('Media publish error:', mediaErr);
          setConnectionNotice(mediaErr?.message || 'Microphone/camera permission required.');
        }

        // Local video preview
        const attachLocal = () => {
          if (!room.localParticipant || !localVideoRef.current) return;
          const pubs = Array.from(room.localParticipant.trackPublications.values());
          const stream = new MediaStream();
          for (const pub of pubs) {
            const media = pub.track?.mediaStreamTrack;
            if (media) stream.addTrack(media);
          }
          if (stream.getTracks().length) {
            localStreamRef.current = stream;
            localVideoRef.current.srcObject = stream;
          }
        };
        attachLocal();
        // Also attach after a short delay in case camera stream is slightly delayed
        window.setTimeout(attachLocal, 500);

      } catch (err: any) {
        if (!active) return;
        console.warn('Meeting join error:', err);
        setConnectionState('error');
        setConnectionNotice(err?.message || 'Failed to join the meeting.');
      }
    }

    join();

    return () => {
      active = false;
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pendingTracks.current.clear();
    };
  }, [meeting.id, attachRemoteTrack]);

  const handleToggleMute = async () => {
    const next = !isMuted;
    setIsMuted(next);
    try { await roomRef.current?.localParticipant.setMicrophoneEnabled(!next); } catch {}
  };

  const handleToggleVideo = async () => {
    const next = !isVideoOff;
    setIsVideoOff(next);
    try {
      await roomRef.current?.localParticipant.setCameraEnabled(!next);
      // Refresh local preview
      if (localVideoRef.current && roomRef.current) {
        const pubs = Array.from(roomRef.current.localParticipant.trackPublications.values());
        const stream = new MediaStream();
        for (const pub of pubs) {
          const media = pub.track?.mediaStreamTrack;
          if (media) stream.addTrack(media);
        }
        if (stream.getTracks().length) localVideoRef.current.srcObject = stream;
      }
    } catch (e: any) {
      console.warn('Camera toggle:', e);
      setIsVideoOff(true);
    }
  };

  const handleEnableAudio = async () => {
    try {
      if (remoteAudioRef.current) await remoteAudioRef.current.play();
      setAudioBlocked(false);
    } catch {}
  };

  const handleEndMeeting = async () => {
    if (endingMeeting) return;
    setEndingMeeting(true);

    // Disconnect media immediately so the user's mic/camera stops right away.
    try { roomRef.current?.disconnect(); } catch { /* ignore */ }
    try { localStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }

    // Any participant may end the shared meeting. The status watcher closes
    // every peer's room, not just the participant who pressed the button.
    try {
      await onEnd(meeting.id);
    } catch (err: any) {
      console.warn('End-meeting API call failed (will reconcile on next poll):', err?.message ?? err);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),transparent_28%),linear-gradient(135deg,#07111f,#0b1020_55%,#111827)] text-white select-none">
      {/* Hidden audio element as fallback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {audioBlocked && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="text-center space-y-4 px-6">
            <Volume2 className="w-10 h-10 text-emerald-300 mx-auto" />
            <h3 className="text-lg font-bold">Click to enable audio</h3>
            <button
              onClick={handleEnableAudio}
              className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm cursor-pointer transition-all"
            >
              Enable Audio
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="z-10 flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex items-center space-x-3">
          <Users className="w-5 h-5 text-cyan-400" />
          <div>
            <span className="font-bold text-sm sm:text-base">{meeting.title}</span>
            <span className="text-xs text-slate-400 ml-2">
              {participants.length + 1} participant{participants.length !== 0 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-white/10 font-mono text-sm">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-cyan-300">{formatTimer(duration)}</span>
          </div>
          <div className={`flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-xl border ${
            connectionState === 'connected'
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
              : 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
          }`}>
            <Signal className="w-3.5 h-3.5" />
            <span>{connectionState === 'connected' ? 'Live' : 'Connecting…'}</span>
          </div>
        </div>
      </div>

      {connectionNotice && (
        <div className="bg-blue-950/70 px-4 py-2 text-xs text-blue-200 flex items-center gap-2 z-10">
          <span className="truncate">{connectionNotice}</span>
        </div>
      )}

      {/* Participant Grid */}
      <div className="flex-1 overflow-auto p-3 sm:p-5">
        <div className="mx-auto grid max-w-[1380px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Local participant tile */}
          <div className="relative h-[240px] overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/5 shadow-2xl sm:h-[280px] lg:h-[min(34vh,360px)]">
            <div className="absolute inset-0 w-full h-full">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
            </div>
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 flex items-center justify-center border border-cyan-700/50">
                  <UserIcon className="w-8 h-8 text-cyan-300" />
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/60 px-2.5 py-1 rounded-lg text-xs font-semibold z-10 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {currentUser.fullName} (You)
              {isMuted && <MicOff className="w-3 h-3 text-red-400 ml-1" />}
            </div>
          </div>

          {/* Remote participant tiles */}
          {participants.map((p) => (
            <div
              key={p.identity}
              className="relative h-[240px] overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/5 shadow-2xl sm:h-[280px] lg:h-[min(34vh,360px)]"
            >
              {/* Always render video element so ref is populated before track arrives */}
              <div className="absolute inset-0 w-full h-full">
                <video
                  ref={(el) => onRemoteVideoMount(p.identity, el)}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Avatar overlay when no video */}
              {!p.hasVideo && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="w-16 h-16 rounded-2xl bg-blue-950/60 flex items-center justify-center border border-blue-700/50">
                    <UserIcon className="w-8 h-8 text-blue-300" />
                  </div>
                </div>
              )}

              <div className="absolute bottom-2 left-2 bg-black/60 px-2.5 py-1 rounded-lg text-xs font-semibold z-10 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                {p.name}
                {p.isMuted && <MicOff className="w-3 h-3 text-red-400 ml-1" />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Control Bar */}
      <div className="z-10 flex items-center justify-center gap-3 border-t border-white/10 p-4">
        <button
          onClick={handleToggleMute}
          className={`p-3 rounded-xl transition-all cursor-pointer ${
            isMuted
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-white/10 hover:bg-white/20 text-slate-100 border border-white/10'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          onClick={handleToggleVideo}
          className={`p-3 rounded-xl transition-all cursor-pointer ${
            isVideoOff
              ? 'bg-white/10 hover:bg-white/20 text-slate-100 border border-white/10'
              : 'bg-emerald-600/80 hover:bg-emerald-500 text-white'
          }`}
          title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
        </button>

        <button
          onClick={handleEndMeeting}
          disabled={endingMeeting}
          className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-60"
        >
          <PhoneOff className="w-4 h-4" />
          <span>
            {endingMeeting
              ? 'Leaving...'
              : 'End Meeting'}
          </span>
        </button>
      </div>
    </div>
  );
};
