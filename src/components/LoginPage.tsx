import React, { useState } from 'react';
import { User } from '../types';
import { Building2, Headphones, Activity, Monitor, Lock, UserRound, ShieldCheck } from 'lucide-react';

interface LoginPageProps {
  users: User[];
  onLogin: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ users, onLogin }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('usr-client-admin-1');
  const [email, setEmail] = useState('admin.bekele@tikuranbessa.gov.et');
  const [password, setPassword] = useState('orzo');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [showOther, setShowOther] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectQuickAccount = (user: User) => {
    setSelectedUserId(user.id);
    setEmail(user.email);
    setNotice(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const target =
      users.find((u) => u.id === selectedUserId) ||
      users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ||
      users[0];
    setTimeout(() => {
      onLogin(target);
      setIsSubmitting(false);
    }, 250);
  };

  const orgAdminUsers = users.filter((u) => u.role === 'client' && u.clientAccountType === 'organization_admin');
  const orgCommonUsers = users.filter((u) => u.role === 'client' && u.clientAccountType === 'common_terminal');
  const interpreters = users.filter((u) => u.role === 'interpreter');
  const supervisors = users.filter((u) => u.role === 'supervisor');
  const platformAdmins = users.filter((u) => u.role === 'platform_admin');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3b82f6] via-[#2f6fe0] to-[#1d4ed8] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-4xl bg-white rounded-[28px] shadow-2xl overflow-hidden grid grid-cols-2 min-h-[520px]">
        <section className="relative bg-[#2f6fe8] text-white px-8 pt-8 pb-10 overflow-hidden flex flex-col">
          <div className="absolute -left-16 -bottom-20 w-56 h-56 rounded-full bg-[#5b93f5]" />
          <div className="absolute left-24 -bottom-24 w-48 h-48 rounded-full bg-[#4b86f3]" />
          <div className="absolute -right-10 top-1/2 w-36 h-36 rounded-full bg-[#6aa0f8]/80" />
          <div className="relative z-10 flex flex-col flex-1">
            <img src="/orzo-logo.png" alt="ORZO" className="w-14 h-14 rounded-full ring-2 ring-white/50" />
            <img
              src="/welcome-illustration.png"
              alt=""
              className="mt-5 w-40 h-auto self-start"
            />
            <div className="max-w-xs pt-8">
            <h1 className="text-4xl font-black tracking-[0.18em]">WELCOME</h1>
            <p className="mt-3 text-sm font-semibold tracking-[0.22em] text-white/90">ORZO STAFF PORTAL</p>
            <p className="mt-5 text-sm text-blue-50/90 leading-relaxed">
              Sign in to request interpreters for hospitals, courts, immigration desks, and public service.
            </p>
            </div>
          </div>
        </section>

        <section className="relative px-8 sm:px-10 py-10">
          <div className="absolute -right-8 bottom-10 w-24 h-24 rounded-full bg-[#dbe7ff]" />
          <form onSubmit={handleSubmit} className="relative z-10">
            <h2 className="text-3xl font-bold text-slate-900">Sign in</h2>
            <p className="mt-1 text-sm text-slate-400">Use your staff account to open the portal.</p>

            <label className="mt-8 flex items-center gap-3 border border-slate-200 rounded-lg px-3 py-2.5">
              <UserRound className="w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSelectedUserId('');
                }}
                placeholder="User Name"
                className="w-full text-sm outline-none bg-transparent"
              />
            </label>

            <label className="mt-4 flex items-center gap-3 border border-slate-200 rounded-lg px-3 py-2.5">
              <Lock className="w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full text-sm outline-none bg-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassword((open) => !open)}
                className="text-[11px] font-bold tracking-wide text-slate-500 cursor-pointer"
              >
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </label>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => setNotice('Passwords are issued by your organization desk.')}
                className="cursor-pointer hover:text-slate-800"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || users.length === 0}
              className="mt-6 w-full bg-[#163a63] hover:bg-[#102c4c] disabled:opacity-60 text-white font-semibold py-3 rounded-lg cursor-pointer"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              or
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={() => setShowOther((open) => !open)}
              className="w-full border border-slate-300 text-slate-700 font-semibold py-3 rounded-lg cursor-pointer hover:bg-slate-50"
            >
              Sign in with other
            </button>

            {showOther && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {orgAdminUsers[0] && (
                  <RoleButton
                    active={selectedUserId === orgAdminUsers[0].id}
                    label="Org Admin"
                    detail={orgAdminUsers[0].fullName.split('(')[0]}
                    icon={<Building2 className="w-4 h-4" />}
                    onClick={() => handleSelectQuickAccount(orgAdminUsers[0])}
                  />
                )}
                {orgCommonUsers[0] && (
                  <RoleButton
                    active={selectedUserId === orgCommonUsers[0].id}
                    label="Triage desk"
                    detail="Shared terminal"
                    icon={<Monitor className="w-4 h-4" />}
                    onClick={() => handleSelectQuickAccount(orgCommonUsers[0])}
                  />
                )}
                {interpreters[0] && (
                  <RoleButton
                    active={selectedUserId === interpreters[0].id}
                    label="Interpreter"
                    detail={interpreters[0].fullName.split(' ')[0]}
                    icon={<Headphones className="w-4 h-4" />}
                    onClick={() => handleSelectQuickAccount(interpreters[0])}
                  />
                )}
                {supervisors[0] && (
                  <RoleButton
                    active={selectedUserId === supervisors[0].id}
                    label="Supervisor"
                    detail="Dispatch hub"
                    icon={<Activity className="w-4 h-4" />}
                    onClick={() => handleSelectQuickAccount(supervisors[0])}
                  />
                )}
                {platformAdmins[0] && (
                  <RoleButton
                    active={selectedUserId === platformAdmins[0].id}
                    label="Admin"
                    detail="Governance"
                    icon={<ShieldCheck className="w-4 h-4" />}
                    onClick={() => handleSelectQuickAccount(platformAdmins[0])}
                  />
                )}
              </div>
            )}

            {notice && <p className="mt-3 text-xs text-slate-500">{notice}</p>}

            <p className="mt-6 text-center text-xs text-slate-400">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setNotice('New accounts are opened by a platform administrator.')}
                className="text-slate-700 font-semibold cursor-pointer"
              >
                Sign Up
              </button>
            </p>
          </form>
        </section>
      </div>
    </div>
  );
};

function RoleButton({
  active,
  label,
  detail,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  detail: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-2.5 rounded-lg border text-xs cursor-pointer ${
        active ? 'border-[#2f6fe8] bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
      }`}
    >
      <span className="flex items-center gap-1.5 font-bold text-slate-800">
        {icon}
        {label}
      </span>
      <span className="block text-slate-500 mt-0.5 truncate">{detail}</span>
    </button>
  );
}
