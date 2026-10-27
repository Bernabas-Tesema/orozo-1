import React from 'react';
import { User, PlatformNotification } from '../types';
import {
  Languages,
  Bell,
  ShieldCheck,
  UserCheck,
  Headphones,
  Building2,
  Activity,
  PhoneCall,
  Bot,
  LogOut,
  Monitor,
  Smartphone
} from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  users: User[];
  onSwitchUser: (userId: string) => void;
  notifications: PlatformNotification[];
  onOpenNotifications: () => void;
  currentLocale: string;
  onChangeLocale: (locale: string) => void;
  activeSessionId?: string;
  onJoinActiveSession?: (sessionId: string) => void;
  onOpenOrzoSupport?: () => void;
  onLogout?: () => void;
  orgViewMode?: 'web' | 'android';
  onToggleOrgViewMode?: (mode: 'web' | 'android') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  users,
  onSwitchUser,
  notifications,
  onOpenNotifications,
  currentLocale,
  onChangeLocale,
  activeSessionId,
  onJoinActiveSession,
  onOpenOrzoSupport,
  onLogout,
  orgViewMode,
  onToggleOrgViewMode,
}) => {
  const unreadCount = notifications.filter((n) => !n.read).length;

  const getRoleBadge = (role: string, user: User) => {
    switch (role) {
      case 'client':
        if (user.clientAccountType === 'organization_admin') {
          return {
            label: 'Org Admin',
            color: 'bg-blue-100 text-blue-800 border-blue-200',
            icon: <Building2 className="w-3.5 h-3.5 mr-1" />,
          };
        }
        return {
          label: 'Common Terminal',
          color: 'bg-slate-100 text-slate-800 border-slate-200',
          icon: <Monitor className="w-3.5 h-3.5 mr-1" />,
        };
      case 'interpreter':
        return {
          label: 'Interpreter',
          color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          icon: <Headphones className="w-3.5 h-3.5 mr-1" />,
        };
      case 'supervisor':
        return {
          label: 'Supervisor',
          color: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: <Activity className="w-3.5 h-3.5 mr-1" />,
        };
      case 'platform_admin':
        return {
          label: 'Admin',
          color: 'bg-purple-100 text-purple-800 border-purple-200',
          icon: <ShieldCheck className="w-3.5 h-3.5 mr-1" />,
        };
      default:
        return {
          label: role,
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: <UserCheck className="w-3.5 h-3.5 mr-1" />,
        };
    }
  };

  const badge = getRoleBadge(currentUser.role, currentUser);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-xs">
      {/* Crisp Blue Brand Header Bar */}
      <div className="h-1 w-full bg-blue-600" />

      {/* Active Session Global Alert Banner */}
      {activeSessionId && (
        <div className="bg-blue-800 text-white px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-between shadow-inner">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
            </span>
            <span>
              <strong>Active Session:</strong> Room {activeSessionId} is ready to connect.
            </span>
          </div>
          {onJoinActiveSession && (
            <button
              onClick={() => onJoinActiveSession(activeSessionId)}
              className="bg-white text-blue-900 px-3 py-1 rounded-md text-xs font-bold hover:bg-blue-50 transition-colors flex items-center shadow-xs cursor-pointer"
            >
              <PhoneCall className="w-3.5 h-3.5 mr-1.5" />
              Join Room
            </button>
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Name */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              <Languages className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-gray-900 text-base sm:text-lg tracking-tight">
                  ORZO
                </span>
                <span className="text-xs bg-blue-50 text-blue-800 font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                  Translation & Interpretation
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                የኢትዮጵያ ቋንቋዎች አስተርጓሚ መድረክ
              </p>
            </div>
          </div>

          {/* Right Controls: Organization View Switcher, ORZO Support, Notifications, Profile, Logout */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* If Client/Organization: Separate Website vs Android App toggle */}
            {currentUser.role === 'client' && onToggleOrgViewMode && (
              <div className="hidden sm:inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
                <button
                  onClick={() => onToggleOrgViewMode('web')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all flex items-center space-x-1 cursor-pointer ${
                    orgViewMode === 'web'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Organization Web Portal"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Web Portal</span>
                </button>
                <button
                  onClick={() => onToggleOrgViewMode('android')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all flex items-center space-x-1 cursor-pointer ${
                    orgViewMode === 'android'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Organization Android App"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Android App</span>
                </button>
              </div>
            )}

            {/* Language Locale Preview */}
            <select
              value={currentLocale}
              onChange={(e) => onChangeLocale(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-300 text-gray-700 rounded-lg px-2 py-1.5 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer hidden md:block"
            >
              <option value="en">English (EN)</option>
              <option value="am">አማርኛ (Amharic)</option>
              <option value="om">Afaan Oromoo</option>
              <option value="ti">ትግርኛ (Tigrinya)</option>
              <option value="so">Af-Soomaali</option>
            </select>

            {/* ORZO Support & Audio Identifier Button */}
            {onOpenOrzoSupport && (
              <button
                onClick={onOpenOrzoSupport}
                className="bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
                title="ORZO Customer Support & Audio Dialect Identifier"
              >
                <Bot className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline">ORZO Support</span>
              </button>
            )}

            {/* Notifications Button */}
            <button
              onClick={onOpenNotifications}
              className="relative p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Current Active User Profile Badge */}
            <div className="flex items-center space-x-2 pl-2 border-l border-gray-200">
              <img
                src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt={currentUser.fullName}
                className="w-8 h-8 rounded-full object-cover border border-gray-300"
              />
              <div className="hidden lg:block text-left">
                <div className="text-xs font-bold text-gray-900 leading-tight">
                  {currentUser.fullName}
                </div>
                <div className="flex items-center mt-0.5">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold border ${badge.color}`}
                  >
                    {badge.icon}
                    {badge.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Logout Button */}
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 rounded-lg text-gray-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                title="Sign out / Switch Role"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
