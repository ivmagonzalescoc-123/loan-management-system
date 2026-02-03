export interface Borrower {
  id: string;
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
  facialImage?: string;
  idImage?: string;
  profileImage?: string;
  creditScore: number;
  status: 'active' | 'inactive' | 'blacklisted';
  registrationDate: string;
}

export interface LoanApplication {
  id: string;
  borrowerId: string;
  borrowerName: string;
  loanType: 'personal' | 'business' | 'mortgage' | 'education' | 'vehicle';
  requestedAmount: number;
  purpose: string;
  collateralType?: string;
  collateralValue?: number;
  guarantorName?: string;
  guarantorPhone?: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'disbursed';
  applicationDate: string;
  reviewedBy?: string;
  reviewDate?: string;
  approvedAmount?: number;
  interestRate?: number;
  termMonths?: number;
  creditScore: number;
  currentCreditScore?: number;
  eligibilityStatus?: 'pending' | 'eligible' | 'ineligible' | 'manual_review';
  eligibilityScore?: number;
  incomeRatio?: number;
  debtToIncome?: number;
  riskTier?: 'low' | 'medium' | 'high';
  kycStatus?: 'pending' | 'verified' | 'rejected';
  documentStatus?: 'pending' | 'complete' | 'missing';
  recommendation?: string;
  interestType?: 'simple' | 'compound';
  gracePeriodDays?: number;
  penaltyRate?: number;
  penaltyFlat?: number;
}

export interface Loan {
  id: string;
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
  disbursementMethod?: string | null;
  referenceNumber?: string | null;
  receiptNumber?: string | null;
  disbursementMeta?: string | null;
  status: 'active' | 'completed' | 'defaulted' | 'written_off';
  outstandingBalance: number;
  nextDueDate: string;
  interestType?: 'simple' | 'compound';
  gracePeriodDays?: number;
  penaltyRate?: number;
  penaltyFlat?: number;
  closureCertificateNumber?: string | null;
  closedDate?: string | null;
}

export interface Payment {
  id: string;
  loanId: string;
  borrowerName: string;
  amount: number;
  paymentDate: string;
  dueDate: string;
  status: 'paid' | 'late' | 'pending';
  lateFee?: number;
  receivedBy: string;
  receiptNumber: string;
}

export interface LoanApproval {
  id: string;
  applicationId: string;
  approvalStage: 'loan_officer' | 'cashier' | 'manager';
  decision: 'approved' | 'rejected';
  decidedBy: string;
  decidedById?: string | null;
  notes?: string | null;
  decidedAt: string;
}

export interface Notification {
  id: string;
  borrowerId?: string | null;
  loanId?: string | null;
  actorName?: string | null;
  actorProfileImage?: string | null;
  targetRole?: 'admin' | 'manager' | 'loan_officer' | 'cashier' | 'borrower' | null;
  type:
    | 'payment_due'
    | 'payment_overdue'
    | 'approval_pending'
    | 'approval_requested'
    | 'approval_completed'
    | 'loan_approved'
    | 'loan_rejected'
    | 'loan_disbursed'
    | 'payment_received'
    | 'kyc_pending'
    | 'general';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'unread' | 'read';
  referenceKey?: string | null;
  createdAt: string;
}

export interface LoanTransfer {
  id: string;
  loanId: string;
  fromBorrowerId: string;
  toBorrowerId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  approvedBy?: string | null;
  effectiveDate?: string | null;
  createdAt: string;
  notes?: string | null;
}

export interface LoanRestructure {
  id: string;
  loanId: string;
  restructureType: 'restructure' | 'refinance';
  newTermMonths?: number | null;
  newInterestRate?: number | null;
  newMonthlyPayment?: number | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  approvedBy?: string | null;
  effectiveDate?: string | null;
  createdAt: string;
  notes?: string | null;
}

export interface LoanClosure {
  id: string;
  loanId: string;
  borrowerId: string;
  closedAt: string;
  closedBy: string;
  certificateNumber: string;
  remarks?: string | null;
}

export interface RepaymentSchedule {
  id: string;
  loanId: string;
  installmentNumber: number;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  status: 'pending' | 'paid' | 'overdue';
  paidDate?: string;
  paidAmount?: number;
}

export interface CreditScoreHistory {
  id: string;
  borrowerId: string;
  score: number;
  factors: {
    paymentHistory: number;
    creditUtilization: number;
    creditAge: number;
    totalDebt: number;
    recentInquiries: number;
  };
  calculatedDate: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  timestamp: string;
  ipAddress: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  profileImage?: string;
  role: 'admin' | 'manager' | 'loan_officer' | 'cashier' | 'borrower';
  createdAt: string;
  status?: 'active' | 'inactive' | 'archived';
  archivedAt?: string | null;
}
