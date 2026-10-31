import { useState } from 'react';
import { BarChart3, LayoutDashboard } from 'lucide-react';
import { WindowFrame } from '../shared/components/WindowFrame';
import type { PortalState } from '../shared/usePortal';
import { InterpreterPortal } from './InterpreterPortal';
import { OperationalReports } from './OperationalReports';
import { PlatformAdminPortal } from './PlatformAdminPortal';
import { SupervisorWorkspace } from './SupervisorWorkspace';

type StaffView = 'main' | 'reports';

export function StaffWorkspace({ portal }: { portal: PortalState }) {
  const [view, setView] = useState<StaffView>('main');
  const user = portal.currentUser;
  if (!user) return null;

  const showReports = user.role === 'supervisor' || user.role === 'platform_admin';

  return (
    <>
      {showReports && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-4">
              <button
                onClick={() => setView('main')}
                className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 cursor-pointer ${
                  view === 'main'
                    ? 'border-blue-600 text-blue-900'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>{user.role === 'supervisor' ? 'Coordinator Hub' : 'System Administration'}</span>
              </button>
              <button
                onClick={() => setView('reports')}
                className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center space-x-1.5 cursor-pointer ${
                  view === 'reports'
                    ? 'border-blue-600 text-blue-900'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Operational Reports</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <WindowFrame title={user.role === 'interpreter' ? 'Interpreter desk' : user.role === 'supervisor' ? 'Supervisor desk' : 'Platform desk'}>
        {view === 'reports' && showReports ? (
          <OperationalReports />
        ) : (
          <>
            {user.role === 'interpreter' && (
              <InterpreterPortal
                currentUser={user}
                profile={portal.interpreterProfile}
                assignments={portal.assignments}
                requests={portal.requests}
                languages={portal.languages}
                onToggleAvailability={portal.handleToggleAvailability}
                onRespondAssignment={portal.handleRespondAssignment}
                onJoinSession={(sessionId) => portal.setActiveSessionRoomId(sessionId)}
              />
            )}
            {user.role === 'supervisor' && (
              <SupervisorWorkspace
                currentUser={user}
                requests={portal.requests}
                sessions={portal.sessions}
                completions={portal.completions}
                interpreters={portal.interpreters}
                languages={portal.languages}
                onManualAssign={portal.handleManualAssign}
                onResolveUnknownLanguage={portal.handleResolveUnknownLanguage}
                onResolveIssue={portal.handleResolveIssue}
                onJoinSession={(sessionId) => portal.setActiveSessionRoomId(sessionId)}
              />
            )}
            {user.role === 'platform_admin' && portal.settings && (
              <PlatformAdminPortal
                currentUser={user}
                languages={portal.languages}
                interpreters={portal.interpreters}
                auditLogs={portal.auditLogs}
                settings={portal.settings}
                onUpdateLanguage={portal.handleUpdateLanguage}
                onAddLanguage={portal.handleAddLanguage}
                onVerifyInterpreter={portal.handleVerifyInterpreter}
                onUpdateSettings={portal.handleUpdateSettings}
                onAccountsCreated={portal.refreshData}
              />
            )}
          </>
        )}
        </WindowFrame>
      </main>
    </>
  );
}
