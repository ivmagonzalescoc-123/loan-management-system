import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { UserRole } from '../App';
import { loginUser } from '../lib/api';
import { DEFAULT_NAV_ACCESS, getPermissionSettings, isNavAllowed, savePermissionSettings, type PermissionSettings } from '../lib/permissions';

interface PermissionSettingsProps {
  onUpdated?: (settings: PermissionSettings) => void;
}

const roles: Array<{ id: UserRole; label: string }> = [
  { id: 'manager', label: 'Manager' },
  { id: 'loan_officer', label: 'Loan Officer' },
  { id: 'cashier', label: 'Cashier' },
  { id: 'borrower', label: 'Borrower' },
];

const navModules = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'borrowers', label: 'Borrowers' },
  { id: 'user-management', label: 'User Management' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'applications', label: 'Loan Applications' },
  { id: 'disbursements', label: 'Disbursements' },
  { id: 'repayments', label: 'Repayments' },
  { id: 'loan-continuity', label: 'Loan Continuity' },
  { id: 'reports', label: 'Reports' },
  { id: 'audit-logs', label: 'Audit Logs' },
  { id: 'system-logs', label: 'System Logs' },
  { id: 'borrower-loans', label: 'Loan History' },
  { id: 'borrower-payments', label: 'Payment History' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'profile', label: 'Profile' },
];

export function PermissionSettings({ onUpdated }: PermissionSettingsProps) {
  const [settings, setSettings] = useState<PermissionSettings>(() => getPermissionSettings());
  const [draftSettings, setDraftSettings] = useState<PermissionSettings>(() => getPermissionSettings());
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const approvalSettings = draftSettings.approvals;

  const updateSettings = (next: PermissionSettings) => {
    setSettings(next);
    savePermissionSettings(next);
    onUpdated?.(next);
  };

  const updateDraft = (next: PermissionSettings) => {
    setDraftSettings(next);
  };

  const handleConfirmAdminPassword = async () => {
    if (!draftSettings) return;
    const sessionRaw = typeof window === 'undefined' ? null : sessionStorage.getItem('lms-session-user');
    let sessionUser: { email?: string; role?: string } | null = null;
    if (sessionRaw) {
      try {
        sessionUser = JSON.parse(sessionRaw) as { email?: string; role?: string };
      } catch {
        sessionUser = null;
      }
    }
    if (!sessionUser?.email) {
      setAuthError('Unable to verify session. Please sign in again.');
      return;
    }

    setAuthBusy(true);
    setAuthError(null);
    try {
      const auth = await loginUser({ email: sessionUser.email, password: adminPassword });
      if (!auth || auth.role !== 'admin' || auth.email !== sessionUser.email) {
        throw new Error('Invalid admin password.');
      }
      updateSettings(draftSettings);
      setShowAuthPrompt(false);
      setAdminPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleNavToggle = (role: UserRole, moduleId: string) => {
    const effective = isNavAllowed(role, moduleId, draftSettings);
    const nextValue = !effective;
    updateDraft({
      ...draftSettings,
      navAccess: {
        ...draftSettings.navAccess,
        [role]: {
          ...draftSettings.navAccess?.[role],
          [moduleId]: nextValue,
        },
      },
    });
  };

  const handleResetRoleAccess = (role: UserRole) => {
    const { [role]: _removed, ...rest } = draftSettings.navAccess;
    updateDraft({
      ...draftSettings,
      navAccess: {
        ...rest,
        [role]: { ...DEFAULT_NAV_ACCESS[role] },
      },
    });
  };

  const handleApplyChanges = () => {
    setAdminPassword('');
    setAuthError(null);
    setShowAuthPrompt(true);
  };

  const approvalSummary = useMemo(() => {
    const limit = approvalSettings.overrideLimit;
    return `Loan officer override limit: ₱${limit.toLocaleString()}`;
  }, [approvalSettings.overrideLimit]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-1 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-green-600" />
          Permissions & Workflow Overrides
        </h2>
        <p className="text-sm text-gray-600">
          Configure module access and approval overrides for absent roles.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <h3 className="text-gray-900 mb-1">Approval Overrides</h3>
          <p className="text-xs text-gray-500">{approvalSummary}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={approvalSettings.allowLoanOfficerManagerOverride}
              onChange={(e) =>
                updateDraft({
                  ...draftSettings,
                  approvals: {
                    ...approvalSettings,
                    allowLoanOfficerManagerOverride: e.target.checked,
                  },
                })
              }
              className="mt-1 h-4 w-4 text-green-600"
            />
            <span>
              Allow loan officers to approve manager stage for loans below the limit.
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={approvalSettings.bypassManagerApproval}
              onChange={(e) =>
                updateDraft({
                  ...draftSettings,
                  approvals: {
                    ...approvalSettings,
                    bypassManagerApproval: e.target.checked,
                  },
                })
              }
              className="mt-1 h-4 w-4 text-green-600"
            />
            <span>Bypass manager approval when manager is absent.</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={approvalSettings.bypassLoanOfficerApproval}
              onChange={(e) =>
                updateDraft({
                  ...draftSettings,
                  approvals: {
                    ...approvalSettings,
                    bypassLoanOfficerApproval: e.target.checked,
                  },
                })
              }
              className="mt-1 h-4 w-4 text-green-600"
            />
            <span>Bypass loan officer approval when loan officers are absent.</span>
          </label>
          <div>
            <label className="block text-sm text-gray-700 mb-2">Override limit (₱)</label>
            <input
              type="number"
              min={0}
              value={approvalSettings.overrideLimit}
              onChange={(e) =>
                updateDraft({
                  ...draftSettings,
                  approvals: {
                    ...approvalSettings,
                    overrideLimit: Number(e.target.value || 0),
                  },
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-gray-900 mb-4">Module Access</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {roles.map((role) => (
            <div key={role.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="text-sm text-gray-900 font-medium">{role.label}</div>
                <button
                  type="button"
                  onClick={() => handleResetRoleAccess(role.id)}
                  className="text-xs text-green-700 hover:text-green-800"
                >
                  Reset to default
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {navModules.map((module) => {
                  const checked = isNavAllowed(role.id, module.id, draftSettings);
                  return (
                    <label key={module.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleNavToggle(role.id, module.id)}
                        className="h-4 w-4 text-green-600"
                      />
                      <span>{module.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleApplyChanges}
          className="px-4 py-2 rounded-lg text-white"
          style={{ backgroundColor: 'var(--forest-700)' }}
        >
          Apply changes
        </button>
      </div>

      {showAuthPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-gray-900 mb-2">Confirm admin password</h3>
            <p className="text-sm text-gray-600 mb-4">
              Re-enter your admin password to apply permission changes.
            </p>
            <div className="space-y-3">
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Admin password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />
              {authError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  {authError}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAuthPrompt(false);
                    setAdminPassword('');
                    setAuthError(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 w-full"
                  disabled={authBusy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAdminPassword}
                  className="px-4 py-2 rounded-lg w-full text-white"
                  style={{ backgroundColor: 'var(--forest-700)' }}
                  disabled={authBusy || !adminPassword}
                >
                  {authBusy ? 'Verifying...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
