import { Borrower, Loan, LoanApproval, LoanClosure, LoanRestructure, LoanTransfer, Notification, Payment } from './types';
import { globalLoading } from './globalLoading';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5174';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const method = String(options?.method || 'GET').toUpperCase();
  const shouldShowGlobalLoading = method !== 'GET';

  const isPaymentCreate = method === 'POST' && path === '/payments';
  const isDisbursementCreate = method === 'POST' && path === '/loans';
  const shouldFlashResult = isPaymentCreate || isDisbursementCreate;
  const loadingLabel = isPaymentCreate
    ? 'Recording payment…'
    : isDisbursementCreate
      ? 'Disbursing loan…'
      : undefined;

  if (shouldShowGlobalLoading) globalLoading.inc({ label: loadingLabel });

  try {
    const response = await fetch(`${API_BASE_URL}/api${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {})
      },
      ...options
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (shouldFlashResult) {
        const title = isPaymentCreate ? 'Payment failed' : 'Disbursement failed';
        globalLoading.flashError(title, errorText || `Request failed with status ${response.status}`);
      }

      throw new Error(errorText || `Request failed with status ${response.status}`);
    }

    const json = await response.json() as T;

    if (shouldFlashResult) {
      const title = isPaymentCreate ? 'Payment recorded' : 'Loan disbursed';
      globalLoading.flashSuccess(title);
    }

    return json;
  } finally {
    if (shouldShowGlobalLoading) globalLoading.dec();
  }
}

async function requestFormData<T>(path: string, formData: FormData, options?: Omit<RequestInit, 'body' | 'method'>): Promise<T> {
  globalLoading.inc({ label: 'Uploading…' });
  try {
    const response = await fetch(`${API_BASE_URL}/api${path}`, {
      method: 'POST',
      body: formData,
      ...(options || {})
    });

    if (!response.ok) {
      const errorText = await response.text();
      globalLoading.flashError('Upload failed', errorText || `Request failed with status ${response.status}`);
      throw new Error(errorText || `Request failed with status ${response.status}`);
    }

    const json = await response.json() as T;
    globalLoading.flashSuccess('Upload complete');
    return json;
  } finally {
    globalLoading.dec();
  }
}

export const apiGet = <T>(path: string) => request<T>(path);
export const apiPost = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const apiPatch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export interface CreateBorrowerPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  employment: string;
  monthlyIncome: number;
  monthlyExpenses?: number;
  consentGiven: boolean;
  consentPurpose?: string;
  consentNoticeVersion?: string;
  bankName?: string;
  accountNumber?: string;
  accountType?: string;
  routingNumber?: string;
  facialImage?: string;
  idImage?: string;
  profileImage?: string;
  creditScore?: number;
  kycStatus?: 'pending' | 'submitted' | 'verified' | 'rejected';
  status?: 'active' | 'inactive' | 'blacklisted';
  registrationDate?: string;
}

export interface CreateBorrowerResponse {
  id: string;
  tempPassword?: string | null;
}

export interface UpdateBorrowerPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
  employment?: string;
  monthlyIncome?: number;
  monthlyExpenses?: number;
  bankName?: string;
  accountNumber?: string;
  accountType?: string;
  routingNumber?: string;
  facialImage?: string;
  idImage?: string;
  profileImage?: string;
  status?: 'active' | 'inactive' | 'blacklisted';
}

export interface CreateLoanApplicationPayload {
  borrowerId: string;
  borrowerName: string;
  loanType: 'personal' | 'business' | 'mortgage' | 'education' | 'vehicle';
  requestedAmount: number;
  purpose: string;
  consentAcknowledged: boolean;
  collateralType?: string;
  collateralValue?: number;
  guarantorName?: string;
  guarantorPhone?: string;
  termMonths?: number;
  interestRate?: number;
  creditScore: number;
  interestType?: 'simple' | 'compound';
  gracePeriodDays?: number;
  penaltyRate?: number;
  penaltyFlat?: number;
}

export interface ApproveLoanApplicationPayload {
  status: 'approved' | 'rejected' | 'under_review' | 'pending' | 'disbursed';
  approvedAmount?: number;
  interestRate?: number;
  termMonths?: number;
  reviewedBy?: string;
  reviewDate?: string;
  interestType?: 'simple' | 'compound';
  gracePeriodDays?: number;
  penaltyRate?: number;
  penaltyFlat?: number;
  recommendation?: string;
}

export interface CreateLoanPayload {
  applicationId: string;
  borrowerId: string;
  borrowerName: string;
  loanType: string;
  principalAmount: number;
  interestRate: number;
  termMonths: number;
  monthlyPayment: number;
  totalAmount: number;
  disbursedDate: string;
  disbursedBy: string;
  disbursementMethod?: string;
  referenceNumber?: string;
  receiptNumber?: string;
  disbursementMeta?: string;
  status?: 'active' | 'completed' | 'defaulted' | 'written_off';
  outstandingBalance: number;
  nextDueDate: string;
  interestType?: 'simple' | 'compound';
  gracePeriodDays?: number;
  penaltyRate?: number;
  penaltyFlat?: number;
}

export interface CreatePaymentPayload {
  loanId: string;
  borrowerName: string;
  amount: number;
  paymentDate: string;
  dueDate: string;
  status?: 'paid' | 'late' | 'pending';
  lateFee?: number;
  receivedBy: string;
  receiptNumber?: string;
}

export interface CreateLoanApprovalPayload {
  approvalStage: 'loan_officer' | 'cashier' | 'manager';
  decision: 'approved' | 'rejected';
  decidedBy: string;
  decidedById?: string;
  notes?: string;
}

export interface CreateLoanTransferPayload {
  loanId: string;
  fromBorrowerId: string;
  toBorrowerId: string;
  reason: string;
  status?: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  approvedBy?: string;
  effectiveDate?: string;
  notes?: string;
}

export interface CreateLoanRestructurePayload {
  loanId: string;
  restructureType: 'restructure' | 'refinance';
  newTermMonths?: number;
  newInterestRate?: number;
  newMonthlyPayment?: number;
  reason: string;
  status?: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  approvedBy?: string;
  effectiveDate?: string;
  notes?: string;
}

export interface CreateLoanClosurePayload {
  loanId: string;
  borrowerId: string;
  closedBy: string;
  remarks?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  profileImage?: string;
  role: 'admin' | 'manager' | 'loan_officer' | 'cashier' | 'borrower';
}

export interface BorrowerRegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  consentGiven: boolean;
  consentPurpose?: string;
  consentNoticeVersion?: string;
}

export interface BorrowerKycStatus {
  borrowerId: string;
  kycStatus: 'pending' | 'submitted' | 'verified' | 'rejected';
  kycSubmittedAt?: string | null;
  kycReviewedAt?: string | null;
  kycReviewedBy?: string | null;
  kycReviewedRole?: string | null;
  kycRejectionReason?: string | null;
  monthlyIncome: number;
  monthlyExpenses: number;
  selfieUrl?: string | null;
  idUrl?: string | null;
}

export interface BorrowerCreditLimit {
  borrowerId: string;
  kycStatus: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  completedLoans: number;
  incomeMultiplier: number;
  capByIncome: number;
  capByDisposable: number;
  maxCredit: number;
  totalOutstanding: number;
  availableCredit: number;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  profileImage?: string;
  role: 'admin' | 'manager' | 'loan_officer' | 'cashier' | 'borrower';
  status?: 'active' | 'inactive' | 'archived';
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  profileImage?: string;
  role?: 'admin' | 'manager' | 'loan_officer' | 'cashier' | 'borrower';
  status?: 'active' | 'inactive' | 'archived';
  archivedAt?: string | null;
}

export const createBorrower = (payload: CreateBorrowerPayload) =>
  apiPost<CreateBorrowerResponse>('/borrowers', payload);

export const updateBorrower = (id: string, payload: UpdateBorrowerPayload) =>
  apiPatch(`/borrowers/${id}`, payload);

export const resetUserPasswordByEmail = (email: string) =>
  apiPost<{ tempPassword: string }>('/users/reset-password', { email });

export const resetBorrowerPassword = (email: string) =>
  apiPost<{ tempPassword: string }>('/borrowers/reset-password', { email });

export const registerBorrower = (payload: BorrowerRegisterPayload) =>
  apiPost<LoginResponse>('/borrowers/register', payload);

export const getBorrowerKyc = (borrowerId: string) =>
  apiGet<BorrowerKycStatus>(`/borrowers/${borrowerId}/kyc`);

export const submitBorrowerKyc = (borrowerId: string, formData: FormData) =>
  requestFormData<{ ok: true; borrowerId: string; kycStatus: 'submitted' }>(`/borrowers/${borrowerId}/kyc`, formData);

export const reviewBorrowerKyc = (
  borrowerId: string,
  payload: { decision: 'verified' | 'rejected'; reviewedBy: string; reviewedRole: string; reason?: string }
) => apiPost<{ ok: true; borrowerId: string; kycStatus: string }>(`/borrowers/${borrowerId}/kyc/review`, payload);

export const getBorrowerCreditLimit = (borrowerId: string) =>
  apiGet<BorrowerCreditLimit>(`/borrowers/${borrowerId}/credit-limit`);

export const createAuthorizationCode = (payload: { applicationId: string; createdBy: string; createdRole: string }) =>
  apiPost<{ code: string; expiresAt: string }>('/authorization-codes', payload);

export const consumeAuthorizationCode = (payload: { applicationId: string; code: string }) =>
  apiPost<{ ok: true }>('/authorization-codes/consume', payload);

export const createLoanApplication = (payload: CreateLoanApplicationPayload) =>
  apiPost<{ id: string }>('/loan-applications', payload);

export const updateLoanApplication = (id: string, payload: ApproveLoanApplicationPayload) =>
  apiPatch(`/loan-applications/${id}`, payload);

export const createLoanApproval = (applicationId: string, payload: CreateLoanApprovalPayload) =>
  apiPost<{ id: string }>(`/loan-applications/${applicationId}/approvals`, payload);

export const getLoanApprovals = (applicationId?: string) =>
  apiGet<LoanApproval[]>(applicationId ? `/loan-approvals?applicationId=${applicationId}` : '/loan-approvals');

export const createLoan = (payload: CreateLoanPayload) =>
  apiPost<{ id: string }>('/loans', payload);

export const createPayment = (payload: CreatePaymentPayload) =>
  apiPost<{ id: string }>('/payments', payload);

export const getNotifications = () =>
  apiGet<Notification[]>('/notifications');

export const markNotificationRead = (id: string) =>
  apiPost<{ ok: true }>(`/notifications/${id}/read`, {});

export const sendAlertReminder = (payload: {
  borrowerId: string;
  loanId: string;
  monthsDue: number;
}) => apiPost<{ ok: true }>(`/alerts/remind`, payload);

export const loginUser = (payload: LoginPayload) =>
  apiPost<LoginResponse>('/login', payload);

export const changeBorrowerPassword = (payload: { email: string; currentPassword: string; newPassword: string }) =>
  apiPost<{ ok: true }>('/borrowers/change-password', payload);

export const getBorrowerById = (id: string) =>
  apiGet<Borrower>(`/borrowers/${id}`);

export const changeUserPassword = (payload: { email: string; currentPassword: string; newPassword: string }) =>
  apiPost<{ ok: true }>('/users/change-password', payload);

export const getBorrowerLoans = (borrowerId: string) =>
  apiGet<Loan[]>(`/borrowers/${borrowerId}/loans`);

export const getBorrowerPayments = (borrowerId: string) =>
  apiGet<Payment[]>(`/borrowers/${borrowerId}/payments`);

export const getBorrowerCreditScore = (borrowerId: string) =>
  apiGet<{
    score: number;
    factors: {
      paymentHistory: number;
      creditUtilization: number;
      creditAge: number;
      totalDebt: number;
      recentInquiries: number;
    };
  }>(`/borrowers/${borrowerId}/credit-score`);

export const createUser = (payload: CreateUserPayload) =>
  apiPost<{ id: string }>('/users', payload);

export const updateUser = (id: string, payload: UpdateUserPayload) =>
  apiPatch(`/users/${id}`, payload);

export const createLoanTransfer = (payload: CreateLoanTransferPayload) =>
  apiPost<{ id: string }>('/loan-transfers', payload);

export const createLoanRestructure = (payload: CreateLoanRestructurePayload) =>
  apiPost<{ id: string }>('/loan-restructures', payload);

export const createLoanClosure = (payload: CreateLoanClosurePayload) =>
  apiPost<{ id: string; certificateNumber: string }>('/loan-closures', payload);

export const getLoanTransfers = () =>
  apiGet<LoanTransfer[]>('/loan-transfers');

export const getLoanRestructures = () =>
  apiGet<LoanRestructure[]>('/loan-restructures');

export const getLoanClosures = () =>
  apiGet<LoanClosure[]>('/loan-closures');
