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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-1">Payment History</h2>
        <p className="text-sm text-gray-600">View your payment records</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {loading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : payments.length === 0 ? (
          <div className="text-sm text-gray-500">No payments found.</div>
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
                {payments.map(payment => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">{payment.receiptNumber}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">${payment.amount.toLocaleString()}</td>
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
