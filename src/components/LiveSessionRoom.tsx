import React, { useState, useEffect } from 'react';
import { InterpretationSession, User } from '../types';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Signal,
  Wifi,
  Shield,
  Clock,
  Volume2,
  BookOpen,
  Radio,
  User as UserIcon
} from 'lucide-react';

interface LiveSessionRoomProps {
  session: InterpretationSession;
  currentUser: User;
  onEndSession: (sessionId: string) => Promise<void>;
  onClose: () => void;
  onOpenCompletionModal: (sessionId: string) => void;
}

export const LiveSessionRoom: React.FC<LiveSessionRoomProps> = ({
  session,
  currentUser,
  onEndSession,
  onClose,
  onOpenCompletionModal,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(session.communicationMode === 'audio' || session.communicationMode === 'phone_assisted');
  const [isLowBandwidth, setIsLowBandwidth] = useState(session.lowBandwidthMode);
  const [duration, setDuration] = useState(session.durationSeconds || 0);
  const [showTerminology, setShowTerminology] = useState(false);
  const [endingCall, setEndingCall] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = async () => {
    setEndingCall(true);
    try {
      await onEndSession(session.id);
      if (currentUser.role === 'interpreter') {
        onOpenCompletionModal(session.id);
      } else {
        onClose();
      }
    } catch (err: any) {
      alert(`Error ending call: ${err.message}`);
      setEndingCall(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col overflow-hidden">
      {/* Top Header Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-3 w-3 rounded-full bg-blue-400 animate-ping" />
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                Live Interpretation Session
              </span>
              <span className="text-xs bg-blue-950 text-blue-300 font-mono px-2 py-0.5 rounded border border-blue-800">
                {session.id}
              </span>
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                Ref: {session.requestReference}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {session.organizationName} • {session.serviceCategory.replace('_', ' ').toUpperCase()} •{' '}
              <strong className="text-blue-300">
                {session.sourceLanguage.toUpperCase()} ⇄ {session.targetLanguage.toUpperCase()}
              </strong>
            </p>
          </div>
        </div>

        {/* Center / Right stats: Duration & Security badge */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 font-mono text-sm">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-blue-300">{formatTimer(duration)}</span>
          </div>

          <div className="hidden sm:flex items-center space-x-1 text-xs text-slate-400 bg-slate-800/60 px-2.5 py-1.5 rounded-lg">
            <Signal className="w-3.5 h-3.5 text-blue-400" />
            <span>Network: <strong className="text-blue-400">Optimal</strong></span>
          </div>

          <div className="hidden md:flex items-center space-x-1.5 text-[11px] bg-red-950/80 text-red-300 border border-red-800 px-2.5 py-1 rounded-md">
            <Shield className="w-3.5 h-3.5 text-red-400" />
            <span>No Recording</span>
          </div>

          <button
            onClick={() => setShowTerminology(!showTerminology)}
            className="p-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 flex items-center space-x-1 cursor-pointer"
            title="Glossary"
          >
            <BookOpen className="w-4 h-4 text-blue-400" />
            <span className="hidden lg:inline">Glossary</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Call Viewport Grid */}
        <div className="flex-1 bg-slate-950 p-4 sm:p-6 flex flex-col justify-between">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 items-center max-w-5xl mx-auto w-full">
            {/* Box 1: Client Feed */}
            <div className="relative bg-slate-900 border border-slate-800 rounded-2xl h-64 sm:h-80 flex flex-col items-center justify-center overflow-hidden shadow-2xl">
              {session.communicationMode === 'video' && !isVideoOff ? (
                <div className="relative w-full h-full bg-slate-800 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-3xl font-bold">
                    {session.clientName.split(' ')[0][0]}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-20 h-20 rounded-2xl bg-blue-900/60 text-blue-300 flex items-center justify-center text-2xl font-black border border-blue-700/50">
                    <UserIcon className="w-10 h-10" />
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-1.5 h-4 bg-blue-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-6 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-8 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    <span className="w-1.5 h-5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                  </div>
                  <span className="text-xs font-semibold text-slate-400">Audio Stream Active</span>
                </div>
              )}

              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-xs px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border border-white/10">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span>{session.clientName} (Requester)</span>
              </div>
            </div>

            {/* Box 2: Interpreter Feed */}
            <div className="relative bg-slate-900 border border-slate-800 rounded-2xl h-64 sm:h-80 flex flex-col items-center justify-center overflow-hidden shadow-2xl">
              {session.communicationMode === 'video' ? (
                <div className="relative w-full h-full bg-slate-800 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-blue-900 flex items-center justify-center text-blue-200 text-3xl font-bold">
                    {session.interpreterName ? session.interpreterName[0] : 'I'}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-20 h-20 rounded-2xl bg-blue-900/60 text-blue-300 flex items-center justify-center text-2xl font-black border border-blue-700/50">
                    <Volume2 className="w-10 h-10" />
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-1.5 h-6 bg-blue-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-1.5 h-8 bg-blue-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                    <span className="w-1.5 h-5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-4 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span className="text-xs font-semibold text-blue-300">Interpretation Feed Live</span>
                </div>
              )}

              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-xs px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border border-white/10">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span>{session.interpreterName || 'Assigned Interpreter'}</span>
              </div>
            </div>
          </div>

          {/* Speakerphone Banner */}
          {session.communicationMode === 'phone_assisted' && (
            <div className="max-w-xl mx-auto w-full my-3 p-3 bg-blue-950/60 border border-blue-800 text-blue-200 text-xs rounded-xl flex items-center space-x-2">
              <Radio className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                <strong>Speakerphone Mode:</strong> Active on terminal speaker.
              </span>
            </div>
          )}

          {/* Bottom Control Bar */}
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 max-w-xl mx-auto w-full rounded-2xl p-3 flex items-center justify-between shadow-2xl">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 rounded-xl transition-colors cursor-pointer ${
                isMuted ? 'bg-red-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={`p-3 rounded-xl transition-colors cursor-pointer ${
                isVideoOff ? 'bg-slate-800 text-slate-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
              title={isVideoOff ? 'Enable video' : 'Turn off video'}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setIsLowBandwidth(!isLowBandwidth)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 ${
                isLowBandwidth
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Low-Bandwidth Mode"
            >
              <Wifi className="w-4 h-4 text-blue-400" />
              <span className="hidden sm:inline">Low-Bandwidth</span>
            </button>

            <button
              onClick={handleEndCall}
              disabled={endingCall}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg transition-transform hover:scale-105 cursor-pointer flex items-center space-x-1.5"
            >
              <PhoneOff className="w-4 h-4" />
              <span>{endingCall ? 'Ending...' : 'End Call'}</span>
            </button>
          </div>
        </div>

        {/* Sidebar Glossary */}
        {showTerminology && (
          <div className="w-80 bg-slate-900 border-l border-slate-800 p-4 overflow-y-auto flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
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
