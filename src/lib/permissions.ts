import type { UserRole } from '../App';

export interface ApprovalPermissionSettings {
  allowLoanOfficerManagerOverride: boolean;
  overrideLimit: number;
  bypassManagerApproval: boolean;
  bypassLoanOfficerApproval: boolean;
}

export interface PermissionSettings {
  navAccess: Partial<Record<UserRole, Partial<Record<string, boolean>>>>;
  approvals: ApprovalPermissionSettings;
}

const DEFAULT_SETTINGS: PermissionSettings = {
  navAccess: {},
  approvals: {
    allowLoanOfficerManagerOverride: false,
    overrideLimit: 50000,
    bypassManagerApproval: false,
    bypassLoanOfficerApproval: false,
  },
};

const STORAGE_KEY = 'lms-permissions';

export const DEFAULT_NAV_ACCESS: Record<UserRole, Record<string, boolean>> = {
  admin: {
    dashboard: true,
    borrowers: true,
    'user-management': true,
    permissions: true,
    applications: true,
    disbursements: true,
    repayments: true,
    'loan-continuity': true,
    reports: true,
    'audit-logs': true,
    'system-logs': true,
    notifications: true,
    profile: true,
  },
  manager: {
    dashboard: true,
    borrowers: true,
    applications: true,
    repayments: true,
    'loan-continuity': true,
    reports: true,
    notifications: true,
    profile: true,
  },
  loan_officer: {
    dashboard: true,
    borrowers: true,
    applications: true,
    repayments: true,
    reports: true,
    notifications: true,
    profile: true,
  },
  cashier: {
    dashboard: true,
    disbursements: true,
    repayments: true,
    notifications: true,
    profile: true,
  },
  borrower: {
    dashboard: true,
    'borrower-loans': true,
    'borrower-payments': true,
    notifications: true,
    profile: true,
  },
};

const mergeSettings = (base: PermissionSettings, update?: Partial<PermissionSettings>): PermissionSettings => {
  if (!update) return base;
  return {
    navAccess: { ...base.navAccess, ...(update.navAccess || {}) },
    approvals: { ...base.approvals, ...(update.approvals || {}) },
  };
};

export const getPermissionSettings = (): PermissionSettings => {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<PermissionSettings>;
    return mergeSettings(DEFAULT_SETTINGS, parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const savePermissionSettings = (settings: PermissionSettings) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const isNavAllowed = (
  role: UserRole,
  view: string,
  settings?: PermissionSettings,
): boolean => {
  const override = settings?.navAccess?.[role]?.[view];
  if (override !== undefined) return override;
  return DEFAULT_NAV_ACCESS[role]?.[view] ?? false;
};
