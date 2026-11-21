import React, { useState, useEffect, useRef } from 'react';
import { InterpretationSession, InterpretationRequest, User } from '../types';
import { api } from '../api';
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  ConnectionState,
} from 'livekit-client';import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  PhoneCall,
  Signal,
  Wifi,
  Shield,
  Clock,
  Volume2,
  BookOpen,
  Radio,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface LiveSessionRoomProps {
  session: InterpretationSession;
  currentUser: User;
  onEndSession: (sessionId: string) => Promise<void>;
  onClose: () => void;
  onCallFinished?: (sessionId: string) => void;
  onOpenCompletionModal: (sessionId: string) => void;
  onTakeWaitingCall?: (reference: string) => Promise<void>;
}

export const LiveSessionRoom: React.FC<LiveSessionRoomProps> = ({
  session,
  currentUser,
  onEndSession,
  onClose,
  onCallFinished,
  onOpenCompletionModal,
  onTakeWaitingCall,
}) => {
  const isVideoMode = session.communicationMode === 'video';

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!isVideoMode);
  const [isLowBandwidth, setIsLowBandwidth] = useState(session.lowBandwidthMode);
  const [duration, setDuration] = useState(session.durationSeconds || 0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [showTerminology, setShowTerminology] = useState(false);
  const [endingCall, setEndingCall] = useState(false);

  // LiveKit Connection States (credentials come from server .env — no UI config)
  const [connectionState, setConnectionState] = useState<string>('initializing');
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);

  // Web Audio mic activity level (0-100)
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState<number>(0);
  const [remoteParticipantName, setRemoteParticipantName] = useState<string | null>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState<boolean>(false);
  const [remoteIsMuted, setRemoteIsMuted] = useState<boolean>(false);
  const [waitingCalls, setWaitingCalls] = useState<InterpretationRequest[]>([]);
  const [takingCall, setTakingCall] = useState<string | null>(null);
  // Live countdown ticker — increments every second to force sidebar re-renders
  const [tick, setTick] = useState(0);

  // DOM Refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Streams & Room Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const roomRef = useRef<Room | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Timer + heartbeat (Eliotel-style presence while the call is open)
  useEffect(() => {
    const timer = setInterval(() => {
      setDuration((prev) => {
        const next = prev + 1;
        if (next % 5 === 0) {
          api
            .sendHeartbeat(session.id, connectionState === 'connected' ? 'optimal' : 'fair', next)
            .catch(() => undefined);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [session.id, connectionState]);

  // 1-second ticker to drive waiting-calls countdown display
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll waiting calls (interpreters only) — shows queued calls in the sidebar
  useEffect(() => {
    if (currentUser.role !== 'interpreter' || !onTakeWaitingCall) return;
    const fetchWaiting = async () => {
      try {
        const res = await api.getWaitingCalls();
        setWaitingCalls(res.waitingCalls || []);
      } catch {
        // ignore transient errors
      }
    };
    fetchWaiting();
    const timer = setInterval(fetchWaiting, 5000);
    return () => clearInterval(timer);
  }, [currentUser.role, onTakeWaitingCall]);

  const handleTakeCall = async (reference: string) => {
    setTakingCall(reference);
    try {
      // Disconnect current room before switching
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      await onTakeWaitingCall?.(reference);
    } catch (e: any) {
      console.warn('Failed to take waiting call:', e);
      setTakingCall(null);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const attachLocalPreview = (room: Room) => {
    const pubs = Array.from(room.localParticipant.trackPublications.values());
    const stream = new MediaStream();
    for (const pub of pubs) {
      const track = pub.track;
      if (!track) continue;
      const media = track.mediaStreamTrack;
      if (media) stream.addTrack(media);
    }
    if (stream.getTracks().length) {
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      try {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length) {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
              audioContextRef.current.close().catch(() => {});
            }
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(new MediaStream([audioTracks[0]]));
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            analyser.smoothingTimeConstant = 0.5;
            source.connect(analyser);
            analyserRef.current = analyser;
            const buffer = new Uint8Array(analyser.frequencyBinCount);
            const checkVolume = () => {
              if (!analyserRef.current) return;
              analyserRef.current.getByteFrequencyData(buffer);
              let sum = 0;
              for (let i = 0; i < buffer.length; i++) sum += buffer[i];
              setAudioLevel(Math.min(100, Math.round((sum / buffer.length / 60) * 100)));
              animFrameRef.current = requestAnimationFrame(checkVolume);
            };
            checkVolume();
          }
        }
      } catch (audioErr) {
        console.warn('Audio metering fallback:', audioErr);
      }
    }
  };

  // Eliotel-style join flow on LiveKit: authorize → token → connect shared room → publish
  useEffect(() => {
    let active = true;

    async function joinCall() {
      try {
        setConnectionState('connecting');
        setConnectionNotice('Joining secure interpretation room...');

        // 1) Mark participant joined (session → active / request → in_session)
        try {
          const token =
            session.sessionToken && !session.sessionToken.startsWith('SES-LIVE')
              ? session.sessionToken
              : undefined;
          await api.joinSession(session.id, token);
        } catch (joinErr: any) {
          console.warn('Session join notice:', joinErr?.message || joinErr);
        }
        if (!active) return;

        // 2) Mint LiveKit token for the shared call room (orzo-<requestReference>)
        const tokenRes = await api.getLiveKitToken(session.id);
        if (!active) return;

        console.info('[LiveSessionRoom] shared call room:', tokenRes.room, 'session:', session.id);

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: isLowBandwidth
            ? { resolution: { width: 640, height: 360, frameRate: 15 } }
            : { resolution: { width: 1280, height: 720, frameRate: 24 } },
        });
        roomRef.current = room;

        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          if (!active) return;
          if (state === ConnectionState.Connected) {
            setConnectionState('connected');
            setConnectionNotice(null);
          } else if (state === ConnectionState.Connecting) {
            setConnectionState('connecting');
          } else if (state === ConnectionState.Reconnecting) {
            setConnectionState('reconnecting');
            setConnectionNotice('Reconnecting to the call room...');
          } else if (state === ConnectionState.Disconnected) {
            setConnectionState('disconnected');
          }
        });

        const attachRemoteTrack = (track: RemoteTrack, participant: RemoteParticipant) => {
          setRemoteParticipantName(participant.name || participant.identity);
          if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
            track.attach(remoteVideoRef.current);
            setHasRemoteVideo(true);
            void remoteVideoRef.current.play?.().catch(() => undefined);
          } else if (track.kind === Track.Kind.Audio) {
            if (remoteAudioRef.current) {
              track.attach(remoteAudioRef.current);
              remoteAudioRef.current.muted = false;
              remoteAudioRef.current.volume = 1;
              void remoteAudioRef.current.play().catch(() => {
                // Browser autoplay policy blocked playback — user must click to enable.
                setAudioBlocked(true);
              });
            } else {
              // Fallback: LiveKit can create/attach its own audio element
              track.attach();
            }
            setRemoteAudioLevel(70);
          }
        };

        const bindExistingRemoteTracks = () => {
          room.remoteParticipants.forEach((participant) => {
            setRemoteParticipantName(participant.name || participant.identity);
            participant.trackPublications.forEach((publication: RemoteTrackPublication) => {
              if (!publication.isSubscribed) {
                try {
                  publication.setSubscribed(true);
                } catch {
                  // Older clients may not expose setSubscribed.
                }
              }
              if (publication.track) {
                attachRemoteTrack(publication.track, participant);
              }
            });
          });
        };

        room.on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
            if (!active) return;
            attachRemoteTrack(track, participant);
          }
        );

        room.on(RoomEvent.TrackPublished, (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (!active) return;
          try {
            publication.setSubscribed(true);
          } catch {
            // ignore
          }
          if (publication.track) attachRemoteTrack(publication.track, participant);
        });

        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          track.detach();
          if (track.kind === Track.Kind.Video) setHasRemoteVideo(false);
          if (track.kind === Track.Kind.Audio) {
            setRemoteAudioLevel(0);
            setRemoteIsMuted(true);
          }
        });

        // Remote mute/unmute detection
        room.on(RoomEvent.TrackMuted, (publication, participant) => {
          if (!active) return;
          if (participant instanceof RemoteParticipant && publication.kind === Track.Kind.Audio) {
            setRemoteIsMuted(true);
          }
        });
        room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
          if (!active) return;
          if (participant instanceof RemoteParticipant && publication.kind === Track.Kind.Audio) {
            setRemoteIsMuted(false);
          }
        });

        room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
          setRemoteParticipantName(participant.name || participant.identity);
          setConnectionNotice(null);
          // Check initial mute state
          participant.trackPublications.forEach((publication) => {
            if (publication.kind === Track.Kind.Audio && publication.isMuted) {
              setRemoteIsMuted(true);
            }
            if (publication.track) attachRemoteTrack(publication.track, participant);
          });
        });

        room.on(RoomEvent.ParticipantDisconnected, () => {
          setRemoteParticipantName(null);
          setHasRemoteVideo(false);
          setRemoteAudioLevel(0);
          setRemoteIsMuted(false);
        });
        await room.connect(tokenRes.url, tokenRes.token, { autoSubscribe: true });
        if (!active) return;

        setConnectionState('connected');
        setConnectionNotice(null);

        // Bind tracks already in the room (second joiner / reconnect).
        bindExistingRemoteTracks();

        // 3) Publish local AV through LiveKit (single capture path — no double getUserMedia)
        try {
          if (isVideoMode) {
            await room.localParticipant.setMicrophoneEnabled(true);
            await room.localParticipant.setCameraEnabled(true);
            setIsVideoOff(false);
          } else {
            await room.localParticipant.setMicrophoneEnabled(true);
            await room.localParticipant.setCameraEnabled(false);
            setIsVideoOff(true);
          }
        } catch (mediaErr: any) {
          console.warn('Local media publish error:', mediaErr);
          setConnectionNotice(
            mediaErr?.message ||
              'Microphone/camera permission is required. Allow access and rejoin the call.',
          );
        }
        if (!active) return;
        attachLocalPreview(room);
        // Re-bind remotes after publish settles (some SFUs delay TrackSubscribed).
        window.setTimeout(() => {
          if (active && roomRef.current === room) bindExistingRemoteTracks();
        }, 800);
      } catch (err: any) {
        if (!active) return;
        console.warn('LiveKit join error:', err);
        setConnectionState('error');
        setConnectionNotice(err?.message || 'Failed to join the LiveKit call room.');
      }
    }

    joinCall();

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      localStreamRef.current = null;
    };
  }, [session.id, session.sessionToken, isVideoMode, isLowBandwidth]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onCallFinishedRef = useRef(onCallFinished);
  onCallFinishedRef.current = onCallFinished;

  const leaveBecauseCallEnded = () => {
    roomRef.current?.disconnect();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (onCallFinishedRef.current) onCallFinishedRef.current(session.id);
    else onCloseRef.current();
  };

  useEffect(() => {
    let stopped = false;
    const watch = async () => {
      try {
        const res = await api.getSession(session.id);
        if (stopped || !['completed', 'cancelled', 'expired'].includes(res.session.status)) return;
        stopped = true;
        leaveBecauseCallEnded();
      } catch {
        // A missed status check should not drop a live call.
      }
    };
    const timer = window.setInterval(watch, 1500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [session.id]);

  // Toggle Mute — LiveKit local participant is the source of truth
  const handleToggleMute = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (roomRef.current?.localParticipant) {
      try {
        await roomRef.current.localParticipant.setMicrophoneEnabled(!nextMuted);
      } catch (e) {
        console.warn('LiveKit mute toggle:', e);
      }
    }
  };

  // Toggle Video — publish/unpublish via LiveKit only.
  // Works in both audio and video modes so participants can turn on
  // their camera mid-call.
  const handleToggleVideo = async () => {
    const nextVideoOff = !isVideoOff;
    setIsVideoOff(nextVideoOff);
    try {
      if (roomRef.current?.localParticipant) {
        await roomRef.current.localParticipant.setCameraEnabled(!nextVideoOff);
        attachLocalPreview(roomRef.current);
      }
    } catch (e: any) {
      console.warn('Camera toggle error:', e);
      setIsVideoOff(true);
      setConnectionNotice(e?.message || 'Camera permission required for video call.');
    }
  };

  // Enable audio — called from a user click to satisfy browser autoplay policy
  const handleEnableAudio = async () => {
    try {
      if (remoteAudioRef.current) {
        await remoteAudioRef.current.play();
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.volume = 1;
      }
      setAudioBlocked(false);
    } catch {
      // Still blocked — user may need to click again
    }
  };

  // End Call — disconnect media first, then notify backend.
  // A network hiccup on the backend call must never strand the user in the room.
  const handleEndCall = async () => {
    if (endingCall) return;
    setEndingCall(true);

    // 1. Immediately stop local media and disconnect LiveKit room so the user's
    //    mic/camera stops regardless of what happens next.
    try {
      roomRef.current?.disconnect();
    } catch { /* ignore */ }
    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch { /* ignore */ }

    // 2. Tell the backend the session ended. If the fetch fails (network blip,
    //    server offline, session already completed) we still exit gracefully.
    try {
      await onEndSession(session.id);
    } catch (err: any) {
      // Log the error but do NOT block exit — the status-watcher poll will
      // eventually reconcile if the request reached the server.
      console.warn('End-session API call failed (session will be cleaned up by poll):', err?.message ?? err);
    }

    // 3. Exit the room UI regardless.
    if (currentUser.role === 'interpreter') {
      onOpenCompletionModal(session.id);
    } else if (onCallFinished) {
      onCallFinished(session.id);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.16),transparent_30%),linear-gradient(135deg,#020617,#0f172a_55%,#020617)] text-white flex flex-col overflow-hidden select-none">
      {/* Remote Audio Track (Hidden) — must autoplay + playsInline for mobile/desktop */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Audio enable overlay — browser autoplay policy requires a user gesture */}
      {audioBlocked && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="text-center space-y-4 px-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-400/40">
              <Volume2 className="w-8 h-8 text-emerald-300" />
            </div>
            <h3 className="text-lg font-bold text-white">Click to enable audio</h3>
            <p className="text-sm text-white/70 max-w-xs">
              Your browser blocked automatic audio playback for security. Click below to hear the interpreter.
            </p>
            <button
              onClick={handleEnableAudio}
              className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              Enable Audio
            </button>
          </div>
        </div>
      )}

      {/* Clean professional background */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />

      {/* Top Header Bar */}
      <div className="relative bg-slate-950/80 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              connectionState === 'connected'
                ? 'bg-emerald-400'
                : connectionState === 'connecting'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-slate-400'
            }`}
          />
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm sm:text-base text-white tracking-tight">
                Live Interpretation Session
              </span>
              <span className="text-xs bg-cyan-950/70 text-cyan-300 font-mono px-2 py-0.5 rounded-md border border-cyan-700/50 backdrop-blur-md">
                {session.id}
              </span>
              <span className="text-xs bg-white/10 text-slate-200 px-2 py-0.5 rounded-md border border-white/10 backdrop-blur-md">
                Ref: {session.requestReference}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {session.organizationName} • {session.serviceCategory.replace('_', ' ').toUpperCase()} •{' '}
              <strong className="text-cyan-300">
                {session.sourceLanguage.toUpperCase()} ⇄ {session.targetLanguage.toUpperCase()}
              </strong>
            </p>
          </div>
        </div>

        {/* Center / Right stats: Duration & LiveKit Status */}
        <div className="flex items-center space-x-3">
          {/* Duration Pill */}
          <div className="flex items-center space-x-1.5 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 font-mono text-sm">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-cyan-300">{formatTimer(duration)}</span>
          </div>

          {/* Connection status (read-only — LiveKit keys are server-side only) */}
          <div
            className={`hidden sm:flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-xl border backdrop-blur-md ${
              connectionState === 'connected'
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                : 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
            }`}
            title="Live media connection"
          >
            <Signal className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {connectionState === 'connected' ? (
                <strong className="text-emerald-400">Live Connected</strong>
              ) : (
                <span>Connecting…</span>
              )}
            </span>
          </div>

          {/* Security badge */}
          <div className="hidden md:flex items-center space-x-1.5 text-[11px] bg-slate-900/60 text-slate-400 border border-white/10 px-2.5 py-1 rounded-lg">
            <Shield className="w-3.5 h-3.5 text-slate-500" />
            <span>Encrypted · No Recording</span>
          </div>

          {/* Glossary */}
          <button
            onClick={() => setShowTerminology(!showTerminology)}
            className="p-2 text-xs bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg border border-white/10 flex items-center space-x-1 cursor-pointer transition"
            title="Linguistic Glossary"
          >
            <BookOpen className="w-4 h-4 text-slate-400" />
            <span className="hidden lg:inline">Glossary</span>
          </button>
        </div>
      </div>

      {/* Connection / permission notices */}
      {connectionNotice && (
        <div className="bg-slate-900/80 border-b border-white/10 px-4 py-2 text-xs text-slate-300 flex items-center gap-2 z-10">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="truncate">{connectionNotice}</span>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 relative flex overflow-hidden z-10">
        {/* Call Viewport Grid */}
        <div className="flex-1 bg-transparent p-4 sm:p-6 flex flex-col justify-between">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5 items-center max-w-5xl mx-auto w-full">
            {/* Box 1: Local Participant Feed (Requester / You) */}
            <div className="relative bg-slate-900/80 border border-white/10 rounded-2xl h-72 sm:h-84 flex flex-col items-center justify-center overflow-hidden shadow-xl transition-all duration-300">
              {/* Always render video element so ref is available for track attachment */}
              <div className="absolute inset-0 w-full h-full">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              </div>

              {/* Placeholder overlay when camera off */}
              {isVideoOff && (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 z-10">
                  <div className="w-24 h-24 rounded-3xl bg-cyan-950/60 text-cyan-300 flex items-center justify-center text-3xl font-black border border-cyan-700/50 shadow-inner backdrop-blur-md">
                    <UserIcon className="w-12 h-12" />
                    {!isMuted && audioLevel > 5 && (
                      <span
                        className="absolute inset-0 rounded-3xl border-2 border-emerald-400 animate-ping opacity-75"
                        style={{ animationDuration: '1.2s' }}
                      />
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    {isMuted ? (
                      <span className="text-red-400">Microphone Muted</span>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Camera Off</span>
                      </>
                    )}
                  </span>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

              {/* Local Participant Tag */}
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-2 border border-white/10 z-10">
                <span className={`w-2 h-2 rounded-full ${isMuted ? 'bg-red-400' : 'bg-emerald-400'}`} />
                <span>
                  {currentUser.fullName} ({currentUser.role === 'interpreter' ? 'Interpreter' : 'Requester'})
                </span>
                {isMuted && <MicOff className="w-3.5 h-3.5 text-red-400 ml-1" />}
              </div>
            </div>

            {/* Box 2: Remote Participant Feed (Interpreter or Client) */}
            <div className="relative bg-slate-900/80 border border-white/10 rounded-2xl h-72 sm:h-84 flex flex-col items-center justify-center overflow-hidden shadow-xl transition-all duration-300">
              {/* Always render video element so ref is available for track attachment */}
              <div className="absolute inset-0 w-full h-full">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Audio wave placeholder — shown only when no remote video */}
              {!hasRemoteVideo && (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3.5 z-10">
                  <div className="w-24 h-24 rounded-3xl bg-blue-950/60 text-blue-300 flex items-center justify-center text-3xl font-black border border-blue-700/50 shadow-inner backdrop-blur-md">
                    <Volume2 className="w-12 h-12" />
                  </div>

                  {/* Remote Voice Indicator */}
                  <div className="flex items-center space-x-1 h-8">
                    {[1, 2, 3, 4, 5, 6, 7].map((bar) => (
                      <span
                        key={bar}
                        className="w-1.5 bg-cyan-400 rounded-full animate-bounce"
                        style={{
                          height: `${14 + (bar % 4) * 5}px`,
                          animationDelay: `${bar * 0.12}s`,
                          animationDuration: '1s',
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>Interpretation Channel Live</span>
                  </span>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

              {/* Remote Participant Tag */}
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-2 border border-white/10 z-10">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>
                  {remoteParticipantName || session.interpreterName || 'Assigned Certified Interpreter'}
                </span>
                {remoteIsMuted && (
                  <span className="flex items-center gap-1 text-red-400 ml-1">
                    <MicOff className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold">Muted</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Speakerphone Banner for Assisted Calls */}
          {session.communicationMode === 'phone_assisted' && (
            <div className="max-w-xl mx-auto w-full my-3 p-3 bg-slate-950/50 backdrop-blur-xl border border-cyan-500/30 text-cyan-200 text-xs rounded-2xl flex items-center space-x-2">
              <Radio className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                <strong>Speakerphone Mode:</strong> Active on terminal speakerphone.
              </span>
            </div>
          )}

          {/* Bottom Control Bar */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 max-w-xl mx-auto w-full rounded-2xl p-3 flex items-center justify-between shadow-xl">
            {/* Microphone Toggle */}
            <button
              onClick={handleToggleMute}
              className={`p-3 rounded-xl transition-all cursor-pointer ${
                isMuted
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30'
                  : 'bg-white/10 hover:bg-white/20 text-slate-100 border border-white/10'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Video Toggle (Always clickable to enable or disable camera) */}
            <button
              onClick={handleToggleVideo}
              className={`p-3 rounded-xl transition-all cursor-pointer ${
                isVideoOff
                  ? 'bg-white/10 hover:bg-white/20 text-slate-300 border border-white/10'
                  : 'bg-emerald-600/80 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 border border-emerald-400/40'
              }`}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
            </button>

            {/* Low-Bandwidth Mode */}
            <button
              onClick={() => setIsLowBandwidth(!isLowBandwidth)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 ${
                isLowBandwidth
                  ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50'
                  : 'bg-white/10 text-slate-200 hover:bg-white/20 border border-white/10'
              }`}
              title="Toggle low-bandwidth optimization"
            >
              <Wifi className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Low-Bandwidth</span>
            </button>

            {/* End Call Button */}
            <button
              onClick={handleEndCall}
              disabled={endingCall}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg transition-transform hover:scale-105 cursor-pointer flex items-center space-x-1.5 border border-red-500/40"
            >
              <PhoneOff className="w-4 h-4" />
              <span>{endingCall ? 'Ending...' : 'End Call'}</span>
            </button>
          </div>
        </div>

        {/* Waiting Calls Sidebar (interpreters only) */}
        {currentUser.role === 'interpreter' && waitingCalls.length > 0 && (
          <div className="w-72 bg-slate-900/95 backdrop-blur-md border-l border-white/10 overflow-y-auto flex-shrink-0 z-20">
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center space-x-2">
                <PhoneCall className="w-4 h-4 text-amber-400 animate-pulse" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Live Waiting Calls ({waitingCalls.length})
                </h3>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Active rings only. Take one to switch — your current call ends.
              </p>
            </div>
            <div className="p-3 space-y-2">
              {waitingCalls.map((call) => {
                void tick; // drives re-render every second for countdown
                const expiresAt = call.assignmentExpiresAt ? new Date(call.assignmentExpiresAt).getTime() : 0;
                const secondsLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : 0;
                // Hide calls where the countdown has already hit zero
                if (!call.queued && secondsLeft === 0) return null;
                const urgent = secondsLeft <= 10;
                return (
                  <div
                    key={call.reference}
                    className={`border rounded-xl p-3 space-y-2 transition-all ${
                      urgent ? 'bg-red-950/40 border-red-500/50' : 'bg-white/5 border-white/10'
                    }`}
                  >
                    {/* Countdown bar */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-cyan-300 font-bold truncate">
                        {call.reference}
                      </span>
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg ${
                        urgent ? 'bg-red-500/30 text-red-300 animate-pulse' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        ⏱ {secondsLeft}s
                      </span>
                    </div>

                    {/* Visual countdown bar */}
                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all ${urgent ? 'bg-red-400' : 'bg-amber-400'}`}
                        style={{ width: `${Math.min(100, (secondsLeft / 60) * 100)}%` }}
                      />
                    </div>

                    <div className="text-[11px] text-slate-300 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white">{call.sourceLanguage?.toUpperCase() || '???'}</span>
                        <span className="text-slate-500">→</span>
                        <span className="font-bold text-white">{call.targetLanguage?.toUpperCase() || '???'}</span>
                        {call.urgency === 'emergency' && (
                          <span className="text-[9px] bg-red-500/30 text-red-300 px-1.5 py-0.5 rounded-full font-bold uppercase ml-auto">
                            Emergency
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400">{call.serviceCategory.replace(/_/g, ' ')}</div>
                      <div className="text-slate-400 truncate">{call.requesterName}</div>
                    </div>

                    <button
                      onClick={() => handleTakeCall(call.reference)}
                      disabled={takingCall === call.reference || secondsLeft === 0}
                      className={`w-full py-2 rounded-lg text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        urgent
                          ? 'bg-red-600 hover:bg-red-500'
                          : 'bg-emerald-600 hover:bg-emerald-500'
                      } disabled:opacity-50`}
                    >
                      {takingCall === call.reference ? (
                        'Connecting...'
                      ) : (
                        <>
                          <PhoneCall className="w-3.5 h-3.5" />
                          Take Call
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sidebar Glossary */}
        {showTerminology && (
          <div className="w-80 bg-slate-950/85 backdrop-blur-2xl border-l border-white/15 p-4 overflow-y-auto flex flex-col justify-between z-20">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Linguistic Glossary
                  </h3>
                </div>
                <button
                  onClick={() => setShowTerminology(false)}
                  className="text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="p-2.5 bg-slate-800/80 rounded-lg text-xs">
                  <div className="font-bold text-blue-400">Clinical Consent (የሕክምና ፈቃድ)</div>
                  <div className="text-[11px] text-slate-300 mt-1">
                    <strong>Amharic:</strong> የህክምና ስምምነት መስጠት
                    <br />
                    <strong>Oromo:</strong> Hayyama yaalaa kennuu
                    <br />
                    <strong>Tigrinya:</strong> ስምምዕ ሕክምና ምሃብ
                  </div>
                </div>

                <div className="p-2.5 bg-slate-800/80 rounded-lg text-xs">
                  <div className="font-bold text-blue-400">Sworn Testimony (የመሃላ ቃል)</div>
                  <div className="text-[11px] text-slate-300 mt-1">
                    <strong>Amharic:</strong> የመሐላ ቃል መስጠት
                    <br />
                    <strong>Oromo:</strong> Kakuudhaan ragaa kennuu
                    <br />
                    <strong>Somali:</strong> Markhaati dhaar ah
                  </div>
                </div>

                <div className="p-2.5 bg-slate-800/80 rounded-lg text-xs">
                  <div className="font-bold text-blue-400">Triage / Emergency (አስቸኳይ ሕክምና)</div>
                  <div className="text-[11px] text-slate-300 mt-1">
                    <strong>Amharic:</strong> ድንገተኛ የሕክምና እርዳታ
                    <br />
                    <strong>Oromo:</strong> Yaala ariifachiisaa
                    <br />
                    <strong>Tigrinya:</strong> ህጹጽ ረድኤት ሕክምና
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-400">
              Verified clinical & legal terminology.
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
