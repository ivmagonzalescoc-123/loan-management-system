import { useState } from 'react';
import { User } from '../App';
import { Search, CheckCircle, Wallet, FileText } from 'lucide-react';
import { useLoanApplications, useLoans } from '../lib/useApiData';
import { Loan, LoanApplication } from '../lib/types';
import { DisbursementForm } from './DisbursementForm';
import { formatPhp } from '../lib/currency';
import { DisbursementReceiptModal } from './DisbursementReceiptModal';

interface DisbursementsProps {
  user: User;
}

export function Disbursements({ user }: DisbursementsProps) {
  const { data: loanApplications, refresh: refreshApplications } = useLoanApplications();
  const { data: loans, refresh: refreshLoans } = useLoans();
  const [searchTerm, setSearchTerm] = useState('');
  const [showDisbursementForm, setShowDisbursementForm] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<LoanApplication | null>(null);
  const [selectedLoanForReceipt, setSelectedLoanForReceipt] = useState<Loan | null>(null);

  // Get approved applications that haven't been disbursed yet
  const readyForDisbursement = loanApplications.filter(
    app => app.status === 'approved' && 
    !loans.some(loan => loan.applicationId === app.id)
  );

  const disbursedLoans = loans.filter(loan => 
    loan.borrowerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    loan.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalDisbursed = loans.reduce((sum, loan) => sum + Number(loan.principalAmount || 0), 0);
  const totalOutstanding = loans
    .filter(l => l.status === 'active')
    .reduce((sum, loan) => sum + Number(loan.outstandingBalance || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900 mb-1">Loan Disbursements</h2>
          <p className="text-sm text-gray-600">Manage approved loan disbursements</p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Ready for Disbursement</div>
          <div className="text-2xl text-blue-600">{readyForDisbursement.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Total Disbursed</div>
          <div className="text-2xl text-gray-900">{formatPhp(totalDisbursed)}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Total Outstanding</div>
          <div className="text-2xl text-gray-900">{formatPhp(totalOutstanding)}</div>
        </div>
      </div>

      {/* Ready for Disbursement */}
      {readyForDisbursement.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-gray-900 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-blue-600" />
              Ready for Disbursement
            </h3>
          </div>
          <div className="p-6 space-y-3">
            {readyForDisbursement.map(app => (
              <div key={app.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex-1">
                  <div className="text-sm text-gray-900">{app.borrowerName}</div>
                  <div className="text-xs text-gray-500">
                    {app.id} • {app.loanType} • Approved on {app.reviewDate}
                  </div>
                </div>
                <div className="text-right mr-6">
                  <div className="text-lg text-gray-900">{formatPhp(app.approvedAmount)}</div>
                  <div className="text-xs text-gray-500">{app.termMonths} months @ {app.interestRate}%</div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedApplication(app);
                    setShowDisbursementForm(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Disburse
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search disbursed loans..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Disbursed Loans */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Loan ID</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Borrower</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Principal</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Interest Rate</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Term</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Monthly Payment</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Disbursed Date</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Disbursed By</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Receipt</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {disbursedLoans.map(loan => (
                <tr key={loan.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{loan.id}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{loan.borrowerName}</div>
                    <div className="text-xs text-gray-500">{loan.borrowerId}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{loan.loanType}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{formatPhp(loan.principalAmount)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{loan.interestRate}%</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{loan.termMonths} months</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{formatPhp(loan.monthlyPayment)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{loan.disbursedDate}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{loan.disbursedBy}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setSelectedLoanForReceipt(loan)}
                        className="px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-2 w-fit shadow-sm"
                        title={loan.receiptNumber ? `Receipt: ${loan.receiptNumber}` : 'View receipt'}
                      >
                        <FileText className="w-4 h-4" />
                        View
                      </button>
                      {loan.receiptNumber ? (
                        <span className="text-xs text-gray-500">{loan.receiptNumber}</span>
                      ) : (
                        <span className="text-xs text-gray-400">No receipt info</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs capitalize ${
                      loan.status === 'active' ? 'bg-green-100 text-green-700' :
                      loan.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      loan.status === 'defaulted' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {loan.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disbursement Form Modal */}
      {showDisbursementForm && selectedApplication && (
        <DisbursementForm
          application={selectedApplication}
          onClose={() => {
            setShowDisbursementForm(false);
            setSelectedApplication(null);
          }}
          onDisburse={() => {
            refreshLoans();
            refreshApplications();
            setShowDisbursementForm(false);
            setSelectedApplication(null);
          }}
        />
      )}

      {selectedLoanForReceipt && (
        <DisbursementReceiptModal loan={selectedLoanForReceipt} onClose={() => setSelectedLoanForReceipt(null)} />
      )}
    </div>
  );
}