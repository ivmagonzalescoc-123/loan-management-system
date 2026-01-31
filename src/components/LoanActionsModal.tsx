import { useMemo, useState } from 'react';
import { X, Repeat, UserCheck, FileCheck, AlertTriangle } from 'lucide-react';
import { Loan } from '../lib/types';
import { User } from '../App';
import { createLoanClosure, createLoanRestructure, createLoanTransfer } from '../lib/api';
import { useBorrowers } from '../lib/useApiData';
import { formatPhp } from '../lib/currency';

interface LoanActionsModalProps {
  loan: Loan;
  user: User;
  onClose: () => void;
  onUpdated: () => void;
}

export function LoanActionsModal({ loan, user, onClose, onUpdated }: LoanActionsModalProps) {
  const { data: borrowers } = useBorrowers();
  const [tab, setTab] = useState<'transfer' | 'restructure' | 'close'>('transfer');
  const [transferBorrowerId, setTransferBorrowerId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferStatus, setTransferStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const [restructureType, setRestructureType] = useState<'restructure' | 'refinance'>('restructure');
  const [newTermMonths, setNewTermMonths] = useState(String(loan.termMonths));
  const [newInterestRate, setNewInterestRate] = useState(String(loan.interestRate));
  const [restructureReason, setRestructureReason] = useState('');
  const [restructureNotes, setRestructureNotes] = useState('');
  const [restructureDate, setRestructureDate] = useState(new Date().toISOString().split('T')[0]);
  const [restructureStatus, setRestructureStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const [closureRemarks, setClosureRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canApprove = user.role === 'admin' || user.role === 'manager' || user.role === 'loan_officer' || user.role === 'cashier';
  const borrowerOptions = borrowers.filter(b => b.id !== loan.borrowerId);

  const projectedMonthlyPayment = useMemo(() => {
    const principal = Number(loan.outstandingBalance || loan.principalAmount || 0);
    const rate = parseFloat(newInterestRate) || loan.interestRate;
    const months = parseInt(newTermMonths, 10) || loan.termMonths;
    if (!principal || !months) return 0;
    if (loan.interestType === 'simple') {
      const total = principal * (1 + (rate / 100) * (months / 12));
      return total / months;
    }
    const monthlyRate = rate / 100 / 12;
    if (!monthlyRate) return principal / months;
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
  }, [loan, newInterestRate, newTermMonths]);

  const handleTransfer = async () => {
    if (!transferBorrowerId) {
      alert('Select a new borrower for transfer.');
      return;
    }
    if (!transferReason.trim()) {
      alert('Provide a transfer reason.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createLoanTransfer({
        loanId: loan.id,
        fromBorrowerId: loan.borrowerId,
        toBorrowerId: transferBorrowerId,
        reason: transferReason,
        status: canApprove ? transferStatus : 'pending',
        requestedBy: user.name,
        approvedBy: canApprove && transferStatus === 'approved' ? user.name : undefined,
        effectiveDate: transferDate,
        notes: transferNotes
      });
      onUpdated();
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to transfer loan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestructure = async () => {
    if (!restructureReason.trim()) {
      alert('Provide a restructure/refinance reason.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createLoanRestructure({
        loanId: loan.id,
        restructureType,
        newTermMonths: parseInt(newTermMonths, 10),
        newInterestRate: parseFloat(newInterestRate),
        newMonthlyPayment: projectedMonthlyPayment,
        reason: restructureReason,
        status: canApprove ? restructureStatus : 'pending',
        requestedBy: user.name,
        approvedBy: canApprove && restructureStatus === 'approved' ? user.name : undefined,
        effectiveDate: restructureDate,
        notes: restructureNotes
      });
      onUpdated();
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to submit restructure');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClosure = async () => {
    if (loan.status !== 'active') {
      alert('Only active loans can be closed.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createLoanClosure({
        loanId: loan.id,
        borrowerId: loan.borrowerId,
        closedBy: user.name,
        remarks: closureRemarks
      });
      onUpdated();
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to close loan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h3 className="text-gray-900">Loan Continuity Actions</h3>
            <p className="text-sm text-gray-600 mt-1">Loan ID: {loan.id}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500">Borrower</div>
              <div className="text-sm text-gray-900">{loan.borrowerName}</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500">Outstanding</div>
              <div className="text-sm text-gray-900">{formatPhp(loan.outstandingBalance)}</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-500">Status</div>
              <div className="text-sm text-gray-900 capitalize">{loan.status}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setTab('transfer')}
              className={`px-4 py-2 rounded-lg border ${tab === 'transfer' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-700'}`}
            >
              <UserCheck className="w-4 h-4 inline-block mr-2" />
              Transfer Ownership
            </button>
            <button
              onClick={() => setTab('restructure')}
              className={`px-4 py-2 rounded-lg border ${tab === 'restructure' ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-200 text-gray-700'}`}
            >
              <Repeat className="w-4 h-4 inline-block mr-2" />
              Restructure / Refinance
            </button>
            <button
              onClick={() => setTab('close')}
              className={`px-4 py-2 rounded-lg border ${tab === 'close' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'border-gray-200 text-gray-700'}`}
            >
              <FileCheck className="w-4 h-4 inline-block mr-2" />
              Close Loan
            </button>
          </div>

          {tab === 'transfer' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2">Transfer To Borrower *</label>
                <select
                  value={transferBorrowerId}
                  onChange={(e) => setTransferBorrowerId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Borrower --</option>
                  {borrowerOptions.map((borrower) => (
                    <option key={borrower.id} value={borrower.id}>
                      {borrower.firstName} {borrower.lastName} ({borrower.id})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Reason *</label>
                <textarea
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Effective Date</label>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Approval Status</label>
                  <select
                    value={transferStatus}
                    onChange={(e) => setTransferStatus(e.target.value as 'pending' | 'approved' | 'rejected')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!canApprove}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Notes</label>
                <textarea
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleTransfer}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Submit Transfer
              </button>
            </div>
          )}

          {tab === 'restructure' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Type</label>
                  <select
                    value={restructureType}
                    onChange={(e) => setRestructureType(e.target.value as 'restructure' | 'refinance')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="restructure">Restructure</option>
                    <option value="refinance">Refinance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Effective Date</label>
                  <input
                    type="date"
                    value={restructureDate}
                    onChange={(e) => setRestructureDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">New Term (months)</label>
                  <input
                    type="number"
                    value={newTermMonths}
                    onChange={(e) => setNewTermMonths(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">New Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newInterestRate}
                    onChange={(e) => setNewInterestRate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Projected Payment</label>
                  <div className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50">
                    {formatPhp(projectedMonthlyPayment)}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Reason *</label>
                <textarea
                  value={restructureReason}
                  onChange={(e) => setRestructureReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Approval Status</label>
                  <select
                    value={restructureStatus}
                    onChange={(e) => setRestructureStatus(e.target.value as 'pending' | 'approved' | 'rejected')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={!canApprove}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={restructureNotes}
                    onChange={(e) => setRestructureNotes(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <button
                onClick={handleRestructure}
                disabled={isSubmitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Submit Restructure
              </button>
            </div>
          )}

          {tab === 'close' && (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 mt-0.5" />
                Closing a loan will finalize the balance and issue a closure certificate.
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Closure Remarks</label>
                <textarea
                  value={closureRemarks}
                  onChange={(e) => setClosureRemarks(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                onClick={handleClosure}
                disabled={isSubmitting}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Issue Closure Certificate
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
