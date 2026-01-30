import { useEffect, useState } from 'react';
import { User } from '../App';
import { getBorrowerLoans } from '../lib/api';
import { Loan } from '../lib/types';
import { formatPhp } from '../lib/currency';

interface BorrowerLoanHistoryProps {
  user: User;
}

export function BorrowerLoanHistory({ user }: BorrowerLoanHistoryProps) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLoans = async () => {
      setLoading(true);
      try {
        const rows = await getBorrowerLoans(user.id);
        setLoans(rows);
      } finally {
        setLoading(false);
      }
    };

    void loadLoans();
  }, [user.id]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-1">Loan History</h2>
        <p className="text-sm text-gray-600">View your loan records</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {loading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : loans.length === 0 ? (
          <div className="text-sm text-gray-500">No loans found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider">Loan ID</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider">Principal</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-600 uppercase tracking-wider">Disbursed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loans.map(loan => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">{loan.id}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 capitalize">{loan.loanType}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{formatPhp(loan.principalAmount)}</td>
                    <td className="px-4 py-2 text-sm">
                      <span className={`px-2 py-1 rounded text-xs capitalize ${
                        loan.status === 'active' ? 'bg-green-100 text-green-700' :
                        loan.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        loan.status === 'defaulted' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {loan.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">{loan.disbursedDate}</td>
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
