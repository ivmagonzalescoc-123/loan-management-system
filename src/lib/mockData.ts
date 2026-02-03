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
  status: 'active' | 'completed' | 'defaulted' | 'written_off';
  outstandingBalance: number;
  nextDueDate: string;
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
