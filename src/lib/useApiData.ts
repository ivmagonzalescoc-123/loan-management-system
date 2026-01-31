import { useCallback, useEffect, useState } from 'react';
import { apiGet } from './api';
import { AppUser, AuditLog, Borrower, Loan, LoanApplication, LoanApproval, LoanClosure, LoanRestructure, LoanTransfer, Notification, Payment } from './types';

interface ApiState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function useApiList<T>(path: string): ApiState<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<T[]>(path);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}

export const useBorrowers = () => useApiList<Borrower>('/borrowers');
export const useLoanApplications = () => useApiList<LoanApplication>('/loan-applications');
export const useLoans = () => useApiList<Loan>('/loans');
export const usePayments = () => useApiList<Payment>('/payments');
export const useAuditLogs = () => useApiList<AuditLog>('/audit-logs');
export const useUsers = () => useApiList<AppUser>('/users');
export const useLoanApprovals = () => useApiList<LoanApproval>('/loan-approvals');
export const useNotifications = () => useApiList<Notification>('/notifications');
export const useLoanTransfers = () => useApiList<LoanTransfer>('/loan-transfers');
export const useLoanRestructures = () => useApiList<LoanRestructure>('/loan-restructures');
export const useLoanClosures = () => useApiList<LoanClosure>('/loan-closures');
