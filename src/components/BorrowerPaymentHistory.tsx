import { useEffect, useState } from 'react';
import { User } from '../App';
import { getBorrowerPayments } from '../lib/api';
import { Payment } from '../lib/types';

interface BorrowerPaymentHistoryProps {
  user: User;
}

export function BorrowerPaymentHistory({ user }: BorrowerPaymentHistoryProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Payment['status']>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const loadPayments = async () => {
      setLoading(true);
      try {
        const rows = await getBorrowerPayments(user.id);
        setPayments(rows);
      } finally {
        setLoading(false);
      }
    };

    void loadPayments();
  }, [user.id]);

  const filteredPayments = payments
    .filter((payment) => {
      if (statusFilter !== 'all' && payment.status !== statusFilter) return false;

      const paymentDate = new Date(payment.paymentDate);
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (paymentDate < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (paymentDate > to) return false;
      }

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      const haystack = [
        payment.receiptNumber,
        payment.status,
        payment.paymentDate,
        payment.dueDate,
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-1">Payment History</h2>
        <p className="text-sm text-gray-600">View your payment records</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Search</label>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search receipt, status, date, amount..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | Payment['status'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="late">Late</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div className="flex items-end justify-end">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setDateFrom('');
                setDateTo('');
              }}
              className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200"
            >
              Clear
            </button>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:col-span-2 flex items-end">
            <div className="text-xs text-gray-600">
              Showing <span className="text-gray-900">{filteredPayments.length}</span> of{' '}
              <span className="text-gray-900">{payments.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {loading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : payments.length === 0 ? (
          <div className="text-sm text-gray-500">No payments found.</div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-sm text-gray-500">No payments match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider">Receipt</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPayments.map(payment => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">{payment.receiptNumber}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">${Number(payment.amount || 0).toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{payment.paymentDate}</td>
                    <td className="px-4 py-2 text-sm">
                      <span className={`px-2 py-1 rounded text-xs capitalize ${
                        payment.status === 'paid' ? 'bg-green-100 text-green-700' :
                        payment.status === 'late' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
