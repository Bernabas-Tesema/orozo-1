import React, { useState } from 'react';
import { User } from '../types';
import {
  Languages,
  Shield,
  Building2,
  Headphones,
  Activity,
  ShieldCheck,
  ArrowRight,
  Monitor,
  Smartphone,
  Lock,
  Mail,
  CheckCircle2
} from 'lucide-react';

interface LoginPageProps {
  users: User[];
  onLogin: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ users, onLogin }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('usr-client-admin-1');
  const [email, setEmail] = useState('admin.bekele@tikuranbessa.gov.et');
  const [password, setPassword] = useState('••••••••');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectQuickAccount = (user: User) => {
    setSelectedUserId(user.id);
    setEmail(user.email);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const target = users.find((u) => u.id === selectedUserId) || users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || users[0];
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
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Top Brand */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-blue-600 items-center justify-center text-white shadow-lg mb-3">
          <Languages className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">ORZO Interpretation</h1>
        <p className="text-xs text-blue-200 mt-1">
          Ethiopian Language Interpretation & Dispatch Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-2xl rounded-2xl border border-gray-100">
          <div className="text-center pb-5 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Sign in to your Portal</h2>
            <p className="text-xs text-gray-500 mt-0.5">Select a role account or enter credentials</p>
          </div>

          {/* Quick Role Selection Cards */}
          <div className="mt-6 space-y-3">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Select Authorized Role
            </label>

            {/* Organizations: Admin Account vs Common Terminal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {orgAdminUsers[0] && (
                <button
                  type="button"
                  onClick={() => handleSelectQuickAccount(orgAdminUsers[0])}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedUserId === orgAdminUsers[0].id
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500'
                      : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                      Org Admin
                    </span>
                    <Building2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="font-bold text-xs text-gray-900 mt-1.5">{orgAdminUsers[0].fullName.split('(')[0]}</div>
                  <div className="text-[11px] text-gray-500 truncate">{orgAdminUsers[0].organizationName.split('(')[0]}</div>
                </button>
              )}

              {orgCommonUsers[0] && (
                <button
                  type="button"
                  onClick={() => handleSelectQuickAccount(orgCommonUsers[0])}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedUserId === orgCommonUsers[0].id
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500'
                      : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded">
                      Common Terminal
                    </span>
                    <Monitor className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="font-bold text-xs text-gray-900 mt-1.5">Shared Triage Desk</div>
                  <div className="text-[11px] text-gray-500 truncate">Staff / Ward Terminal</div>
                </button>
              )}
            </div>

            {/* Other System Roles */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {interpreters[0] && (
                <button
                  type="button"
                  onClick={() => handleSelectQuickAccount(interpreters[0])}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    selectedUserId === interpreters[0].id
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500'
                      : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                  }`}
                >
                  <Headphones className="w-4 h-4 text-blue-700 mx-auto" />
                  <div className="font-bold text-[11px] text-gray-900 mt-1">Interpreter</div>
                  <div className="text-[10px] text-gray-500">{interpreters[0].fullName.split(' ')[0]}</div>
                </button>
              )}

              {supervisors[0] && (
                <button
                  type="button"
                  onClick={() => handleSelectQuickAccount(supervisors[0])}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    selectedUserId === supervisors[0].id
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500'
                      : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                  }`}
                >
                  <Activity className="w-4 h-4 text-amber-600 mx-auto" />
                  <div className="font-bold text-[11px] text-gray-900 mt-1">Supervisor</div>
                  <div className="text-[10px] text-gray-500">Dispatch Hub</div>
                </button>
              )}

              {platformAdmins[0] && (
                <button
                  type="button"
                  onClick={() => handleSelectQuickAccount(platformAdmins[0])}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    selectedUserId === platformAdmins[0].id
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500'
                      : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-purple-600 mx-auto" />
                  <div className="font-bold text-[11px] text-gray-900 mt-1">Platform Admin</div>
                  <div className="text-[10px] text-gray-500">Governance</div>
                </button>
              )}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Account Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Session'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-center text-[11px] text-gray-400">
            <span>Role-Based Access Control • Sign-up restricted to accredited partners</span>
          </div>
        </div>
      </div>
    </div>
  );
};
