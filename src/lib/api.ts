import { Loan, Payment } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5174';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
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
  bankName?: string;
  accountNumber?: string;
  accountType?: string;
  routingNumber?: string;
  creditScore?: number;
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
  address?: string;
  employment?: string;
  monthlyIncome?: number;
  bankName?: string;
  accountNumber?: string;
  accountType?: string;
  routingNumber?: string;
  status?: 'active' | 'inactive' | 'blacklisted';
}

export interface CreateLoanApplicationPayload {
  borrowerId: string;
  borrowerName: string;
  loanType: 'personal' | 'business' | 'mortgage' | 'education' | 'vehicle';
  requestedAmount: number;
  purpose: string;
  collateralType?: string;
  collateralValue?: number;
  guarantorName?: string;
  guarantorPhone?: string;
  termMonths?: number;
  creditScore: number;
}

export interface ApproveLoanApplicationPayload {
  status: 'approved' | 'rejected' | 'under_review' | 'pending' | 'disbursed';
  approvedAmount?: number;
  interestRate?: number;
  termMonths?: number;
  reviewedBy?: string;
  reviewDate?: string;
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
  status?: 'active' | 'completed' | 'defaulted' | 'written_off';
  outstandingBalance: number;
  nextDueDate: string;
}

export interface CreatePaymentPayload {
  loanId: string;
  borrowerName: string;
  amount: number;
  paymentDate: string;
  dueDate: string;
  status: 'paid' | 'late' | 'pending';
  lateFee?: number;
  receivedBy: string;
  receiptNumber?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'loan_officer' | 'cashier' | 'borrower' | 'auditor';
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'loan_officer' | 'cashier' | 'borrower' | 'auditor';
  status?: 'active' | 'inactive' | 'archived';
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
  role?: 'admin' | 'loan_officer' | 'cashier' | 'borrower' | 'auditor';
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

export const createAuthorizationCode = (payload: { applicationId: string; createdBy: string; createdRole: string }) =>
  apiPost<{ code: string; expiresAt: string }>('/authorization-codes', payload);

export const consumeAuthorizationCode = (payload: { applicationId: string; code: string }) =>
  apiPost<{ ok: true }>('/authorization-codes/consume', payload);

export const createLoanApplication = (payload: CreateLoanApplicationPayload) =>
  apiPost<{ id: string }>('/loan-applications', payload);

export const updateLoanApplication = (id: string, payload: ApproveLoanApplicationPayload) =>
  apiPatch(`/loan-applications/${id}`, payload);

export const createLoan = (payload: CreateLoanPayload) =>
  apiPost<{ id: string }>('/loans', payload);

export const createPayment = (payload: CreatePaymentPayload) =>
  apiPost<{ id: string }>('/payments', payload);

export const loginUser = (payload: LoginPayload) =>
  apiPost<LoginResponse>('/login', payload);

export const changeBorrowerPassword = (payload: { email: string; currentPassword: string; newPassword: string }) =>
  apiPost<{ ok: true }>('/borrowers/change-password', payload);

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
