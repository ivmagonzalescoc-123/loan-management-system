import { useState } from 'react';
import { User } from '../App';
import { Search, Plus, PhilippinePeso, Calendar, AlertCircle } from 'lucide-react';
import { createPayment } from '../lib/api';
import { useLoans, usePayments } from '../lib/useApiData';
import { formatPhp } from '../lib/currency';

interface RepaymentTrackingProps {
  user: User;
}

export function RepaymentTracking({ user }: RepaymentTrackingProps) {
  const { data: loans, refresh: refreshLoans } = useLoans();
  const { data: payments, refresh: refreshPayments } = usePayments();
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'paid' | 'late' | 'pending'>('all');
  const [paymentDateFrom, setPaymentDateFrom] = useState('');
  const [paymentDateTo, setPaymentDateTo] = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');

  const activeLoans = loans.filter(loan => 
    loan.status === 'active' &&
    (loan.borrowerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
     loan.id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const upcomingPayments = activeLoans.filter(loan => {
    const dueDate = new Date(loan.nextDueDate);
    const today = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDue <= 7 && daysUntilDue >= 0;
  });

  const overduePayments = activeLoans.filter(loan => {
    const dueDate = new Date(loan.nextDueDate);
    const today = new Date();
    return dueDate < today;
  });

  const totalCollected = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const totalOutstanding = activeLoans.reduce((sum, loan) => sum + Number(loan.outstandingBalance || 0), 0);

  const filteredPayments = payments
    .filter((payment) => {
      if (paymentStatusFilter !== 'all' && payment.status !== paymentStatusFilter) return false;

      const pDate = new Date(payment.paymentDate);
      if (paymentDateFrom) {
        const from = new Date(paymentDateFrom);
        from.setHours(0, 0, 0, 0);
        if (pDate < from) return false;
      }
      if (paymentDateTo) {
        const to = new Date(paymentDateTo);
        to.setHours(23, 59, 59, 999);
        if (pDate > to) return false;
      }

      const q = paymentSearchQuery.trim().toLowerCase();
      if (!q) return true;

      const haystack = [
        payment.receiptNumber,
        payment.borrowerName,
        payment.loanId,
        payment.paymentDate,
        payment.dueDate,
        payment.status,
        payment.receivedBy,
        String(payment.amount ?? ''),
        String(payment.lateFee ?? ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    })
    .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

  const handleRecordPayment = (loanId: string) => {
    setSelectedLoan(loanId);
    setPaymentAmount('');
    setPaymentMethod('Cash');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setShowPaymentForm(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-1">Repayment Tracking</h2>
        <p className="text-sm text-gray-600">Track and record loan repayments</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Active Loans</div>
          <div className="text-2xl text-gray-900">{activeLoans.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Total Outstanding</div>
          <div className="text-2xl text-gray-900">{formatPhp(totalOutstanding)}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Total Collected</div>
          <div className="text-2xl text-green-600">{formatPhp(totalCollected)}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Overdue Payments</div>
          <div className="text-2xl text-red-600">{overduePayments.length}</div>
        </div>
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Overdue Payments */}
        {overduePayments.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <h3 className="text-sm text-red-900">Overdue Payments ({overduePayments.length})</h3>
            </div>
            <div className="space-y-2">
              {overduePayments.map(loan => (
                <div key={loan.id} className="flex items-center justify-between p-2 bg-white rounded">
                  <div>
                    <div className="text-sm text-gray-900">{loan.borrowerName}</div>
                    <div className="text-xs text-gray-500">Due: {loan.nextDueDate}</div>
                  </div>
                  <button
                    onClick={() => handleRecordPayment(loan.id)}
                    className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                  >
                    Record Payment
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Payments */}
        {upcomingPayments.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-yellow-600" />
              <h3 className="text-sm text-yellow-900">Upcoming Payments (Next 7 Days)</h3>
            </div>
            <div className="space-y-2">
              {upcomingPayments.map(loan => (
                <div key={loan.id} className="flex items-center justify-between p-2 bg-white rounded">
                  <div>
                    <div className="text-sm text-gray-900">{loan.borrowerName}</div>
                    <div className="text-xs text-gray-500">Due: {loan.nextDueDate}</div>
                  </div>
                  <div className="text-sm text-gray-900">{formatPhp(loan.monthlyPayment)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by borrower name or loan ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Active Loans Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Loan ID</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Borrower</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Principal</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Outstanding</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Monthly Payment</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Next Due Date</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Progress</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {activeLoans.map(loan => {
                const principalAmount = Number(loan.principalAmount || 0);
                const outstandingBalance = Number(loan.outstandingBalance || 0);
                const paidPercentage = principalAmount > 0
                  ? ((principalAmount - outstandingBalance) / principalAmount) * 100
                  : 0;
                const dueDate = new Date(loan.nextDueDate);
                const today = new Date();
                const isOverdue = dueDate < today;
                const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                
                return (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{loan.id}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{loan.borrowerName}</div>
                      <div className="text-xs text-gray-500">{loan.loanType}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{formatPhp(loan.principalAmount)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{formatPhp(loan.outstandingBalance)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{formatPhp(loan.monthlyPayment)}</td>
                    <td className="px-6 py-4">
                      <div className={`text-sm ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                        {loan.nextDueDate}
                      </div>
                      <div className={`text-xs ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                        {isOverdue ? `Overdue by ${Math.abs(daysUntilDue)} days` : 
                         daysUntilDue <= 7 ? `Due in ${daysUntilDue} days` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500"
                            style={{ width: `${paidPercentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600">{Math.round(paidPercentage)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleRecordPayment(loan.id)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Payment
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Payments */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-gray-900 flex items-center gap-2">
                <PhilippinePeso className="w-5 h-5 text-green-600" />
                Recent Payments
              </h3>
              <div className="text-xs text-gray-600">
                Showing <span className="text-gray-900">{filteredPayments.length}</span> of{' '}
                <span className="text-gray-900">{payments.length}</span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="w-full md:flex-1">
                <label className="block text-xs text-gray-600 mb-1">Search</label>
                <input
                  value={paymentSearchQuery}
                  onChange={(e) => setPaymentSearchQuery(e.target.value)}
                  placeholder="Search receipt, borrower, loan ID, received by..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="w-full md:w-40">
                <label className="block text-xs text-gray-600 mb-1">Status</label>
                <select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value as 'all' | 'paid' | 'late' | 'pending')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="paid">Paid</option>
                  <option value="late">Late</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div className="w-full md:w-40">
                <label className="block text-xs text-gray-600 mb-1">From</label>
                <input
                  type="date"
                  value={paymentDateFrom}
                  onChange={(e) => setPaymentDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="w-full md:w-40">
                <label className="block text-xs text-gray-600 mb-1">To</label>
                <input
                  type="date"
                  value={paymentDateTo}
                  onChange={(e) => setPaymentDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end md:justify-start">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentSearchQuery('');
                    setPaymentStatusFilter('all');
                    setPaymentDateFrom('');
                    setPaymentDateTo('');
                  }}
                  className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Receipt #</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Borrower</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Payment Date</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Received By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPayments.map(payment => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{payment.receiptNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{payment.borrowerName}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatPhp(payment.amount)}
                    {payment.lateFee && (
                      <span className="text-xs text-red-600 ml-1">
                        (+{formatPhp(payment.lateFee)} late fee)
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{payment.paymentDate}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{payment.dueDate}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs capitalize ${
                      payment.status === 'paid' ? 'bg-green-100 text-green-700' :
                      payment.status === 'late' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{payment.receivedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Form Modal */}
      {showPaymentForm && selectedLoan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-gray-900">Record Payment</h3>
              <p className="text-sm text-gray-600 mt-1">
                Loan ID: {selectedLoan}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2">Payment Amount</label>
                <div className="relative">
                  <PhilippinePeso className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    type="number" 
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>Cash</option>
                  <option>Bank Transfer</option>
                  <option>Check</option>
                  <option>Digital Wallet</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Payment Date</label>
                <input 
                  type="date" 
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Notes</label>
                <textarea 
                  rows={3}
                  placeholder="Add any notes about this payment..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowPaymentForm(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const loan = loans.find(l => l.id === selectedLoan);
                  if (!loan) {
                    alert('Loan not found.');
                    return;
                  }

                  if (!paymentAmount) {
                    alert('Please enter a payment amount.');
                    return;
                  }

                  const dueDate = loan.nextDueDate;
                  const status = new Date(paymentDate) > new Date(dueDate) ? 'late' : 'paid';
                  try {
                    await createPayment({
                      loanId: loan.id,
                      borrowerName: loan.borrowerName,
                      amount: parseFloat(paymentAmount),
                      paymentDate,
                      dueDate,
                      status,
                      receivedBy: user.name,
                      receiptNumber: `RC-${Date.now().toString().slice(-6)}`
                    });
                    refreshPayments();
                    refreshLoans();
                    setShowPaymentForm(false);
                  } catch (error) {
                    alert(error instanceof Error ? error.message : 'Failed to record payment');
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
