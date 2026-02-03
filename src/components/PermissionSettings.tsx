import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { UserRole } from '../App';
import { getPermissionSettings, savePermissionSettings, type PermissionSettings, isNavAllowed } from '../lib/permissions';

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

  const approvalSettings = settings.approvals;

  const updateSettings = (next: PermissionSettings) => {
    setSettings(next);
    savePermissionSettings(next);
    onUpdated?.(next);
  };

  const handleNavToggle = (role: UserRole, moduleId: string) => {
    const effective = isNavAllowed(role, moduleId, settings);
    const nextValue = !effective;
    updateSettings({
      ...settings,
      navAccess: {
        ...settings.navAccess,
        [role]: {
          ...settings.navAccess?.[role],
          [moduleId]: nextValue,
        },
      },
    });
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
                updateSettings({
                  ...settings,
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
                updateSettings({
                  ...settings,
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
                updateSettings({
                  ...settings,
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
                updateSettings({
                  ...settings,
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
              <div className="text-sm text-gray-900 font-medium mb-3">{role.label}</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {navModules.map((module) => {
                  const checked = isNavAllowed(role.id, module.id, settings);
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
    </div>
  );
}
