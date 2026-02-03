import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { User } from '../App';
import { useLoans, usePayments } from '../lib/useApiData';
import { formatPhp } from '../lib/currency';
import { LoanActionsModal } from './LoanActionsModal';

interface LoanContinuityActionsProps {
  user: User;
}

export function LoanContinuityActions({ user }: LoanContinuityActionsProps) {
  const { data: loans, refresh: refreshLoans } = useLoans();
  const { refresh: refreshPayments } = usePayments();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [detailsLoanId, setDetailsLoanId] = useState<string | null>(null);

  const canAccess = user.role === 'admin' || user.role === 'manager';

  const filteredLoans = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return loans.filter((loan) => {
      if (loan.status !== 'active') return false;
      if (!term) return true;
      return (
        loan.borrowerName.toLowerCase().includes(term) ||
        loan.id.toLowerCase().includes(term)
      );
    });
  }, [loans, searchTerm]);

  const selectedLoan = selectedLoanId
    ? loans.find((loan) => loan.id === selectedLoanId) || null
    : null;

  const detailsLoan = detailsLoanId
    ? loans.find((loan) => loan.id === detailsLoanId) || null
    : null;

  const openActionsForLoan = (loanId: string) => {
    setSelectedLoanId(loanId);
    setShowActions(true);
  };

  if (!canAccess) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-gray-900 mb-2">Loan Continuity Actions</h2>
        <p className="text-sm text-gray-600">Access restricted to administrators and managers.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-1">Loan Continuity Actions</h2>
        <p className="text-sm text-gray-600">
          Select a loan to refinance, transfer ownership, or close the account.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search active loans by borrower or loan ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="max-h-[70vh] overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Loan ID</th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Borrower</th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Outstanding</th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Next Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLoans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{loan.id}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{loan.borrowerName}</div>
                      <div className="text-xs text-gray-500">{loan.loanType}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatPhp(loan.outstandingBalance)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>{loan.nextDueDate}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailsLoanId(loan.id)}
                          className="px-4 py-2 text-sm rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          onClick={() => openActionsForLoan(loan.id)}
                          className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700"
                        >
                          Actions
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredLoans.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-6 text-center text-sm text-gray-500">
                      No active loans match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showActions && selectedLoan && (
        <LoanActionsModal
          loan={selectedLoan}
          user={user}
          onClose={() => setShowActions(false)}
          onUpdated={() => {
            refreshLoans();
            refreshPayments();
          }}
        />
      )}

      {detailsLoan && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setDetailsLoanId(null)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-gray-900">Loan Details</h3>
                <p className="text-sm text-gray-600 mt-1">Loan ID: {detailsLoan.id}</p>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-gray-500">Borrower</div>
                <div className="text-gray-900">{detailsLoan.borrowerName}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Loan Type</div>
                <div className="text-gray-900">{detailsLoan.loanType}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Principal</div>
                <div className="text-gray-900">{formatPhp(detailsLoan.principalAmount)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Outstanding</div>
                <div className="text-gray-900">{formatPhp(detailsLoan.outstandingBalance)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Term</div>
                <div className="text-gray-900">{detailsLoan.termMonths} months</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Interest Rate</div>
                <div className="text-gray-900">{detailsLoan.interestRate}%</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Next Due Date</div>
                <div className="text-gray-900">{detailsLoan.nextDueDate}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Status</div>
                <div className="text-gray-900 capitalize">{detailsLoan.status}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
