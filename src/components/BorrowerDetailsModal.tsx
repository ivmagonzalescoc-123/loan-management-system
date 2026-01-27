import { X, TrendingUp, TrendingDown, DollarSign, Calendar, Briefcase } from 'lucide-react';
import { Borrower } from '../lib/types';
import { useEffect, useState } from 'react';
import { getBorrowerCreditScore } from '../lib/api';

interface BorrowerDetailsModalProps {
  borrower: Borrower;
  loanStats?: {
    total: number;
    active: number;
    totalBorrowed: number;
  };
  onClose: () => void;
}

export function BorrowerDetailsModal({ borrower, loanStats, onClose }: BorrowerDetailsModalProps) {
  const stats = loanStats || { total: 0, active: 0, totalBorrowed: 0 };
  const [score, setScore] = useState(borrower.creditScore);
  const [creditScoreFactors, setCreditScoreFactors] = useState([
    { label: 'Payment History', score: 70, weight: '35%' },
    { label: 'Credit Utilization', score: 70, weight: '30%' },
    { label: 'Credit Age', score: 70, weight: '15%' },
    { label: 'Total Debt', score: 70, weight: '10%' },
    { label: 'Recent Inquiries', score: 80, weight: '10%' },
  ]);

  useEffect(() => {
    const loadScore = async () => {
      try {
        const result = await getBorrowerCreditScore(borrower.id);
        setScore(result.score);
        setCreditScoreFactors([
          { label: 'Payment History', score: result.factors.paymentHistory, weight: '35%' },
          { label: 'Credit Utilization', score: result.factors.creditUtilization, weight: '30%' },
          { label: 'Credit Age', score: result.factors.creditAge, weight: '15%' },
          { label: 'Total Debt', score: result.factors.totalDebt, weight: '10%' },
          { label: 'Recent Inquiries', score: result.factors.recentInquiries, weight: '10%' },
        ]);
      } catch {
        setScore(borrower.creditScore);
      }
    };

    void loadScore();
  }, [borrower.creditScore, borrower.id]);

  const getCreditScoreColor = (score: number) => {
    if (score >= 700) return 'text-green-600';
    if (score >= 600) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCreditScoreBgColor = (score: number) => {
    if (score >= 700) return 'bg-green-600';
    if (score >= 600) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h3 className="text-gray-900 mb-1">Borrower Details</h3>
            <p className="text-sm text-gray-600">{borrower.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Personal Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm text-gray-600 mb-4">Personal Information</h4>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-500">Full Name</div>
                  <div className="text-sm text-gray-900">{borrower.firstName} {borrower.lastName}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Email</div>
                  <div className="text-sm text-gray-900">{borrower.email}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Phone</div>
                  <div className="text-sm text-gray-900">{borrower.phone}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Date of Birth</div>
                  <div className="text-sm text-gray-900">{borrower.dateOfBirth}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Address</div>
                  <div className="text-sm text-gray-900">{borrower.address}</div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm text-gray-600 mb-4">Financial Information</h4>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-500">Employment</div>
                  <div className="text-sm text-gray-900 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-gray-400" />
                    {borrower.employment}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Monthly Income</div>
                  <div className="text-sm text-gray-900 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    ${borrower.monthlyIncome.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Registration Date</div>
                  <div className="text-sm text-gray-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {borrower.registrationDate}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Status</div>
                  <span className={`inline-block px-2 py-1 rounded text-xs capitalize ${
                    borrower.status === 'active' ? 'bg-green-100 text-green-700' :
                    borrower.status === 'inactive' ? 'bg-gray-100 text-gray-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {borrower.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Credit Score Section */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6">
            <h4 className="text-sm text-gray-900 mb-4">Credit Score Analysis</h4>
            
            <div className="flex items-center gap-6 mb-6">
              <div className="relative">
                <div className="w-32 h-32 rounded-full border-8 border-gray-200 flex items-center justify-center">
                  <div className="text-center">
                    <div className={`text-3xl ${getCreditScoreColor(score)}`}>
                      {score}
                    </div>
                    <div className="text-xs text-gray-500">/ 850</div>
                  </div>
                </div>
                {borrower.creditScore >= 700 ? (
                  <div className="absolute -top-2 -right-2 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                ) : (
                  <div className="absolute -top-2 -right-2 w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className={`text-lg ${getCreditScoreColor(score)} mb-2`}>
                  {score >= 750 ? 'Excellent Credit' :
                   score >= 700 ? 'Good Credit' :
                   score >= 650 ? 'Fair Credit' :
                   score >= 600 ? 'Poor Credit' : 'Very Poor Credit'}
                </div>
                <p className="text-sm text-gray-600">
                  {score >= 700 
                    ? 'This borrower has excellent creditworthiness with low risk of default.'
                    : score >= 600
                    ? 'This borrower has fair creditworthiness. Consider additional collateral or guarantor.'
                    : 'This borrower has poor creditworthiness. High risk of default - proceed with caution.'}
                </p>
              </div>
            </div>

            {/* Credit Score Factors */}
            <div className="space-y-3">
              <div className="text-xs text-gray-600 mb-2">Credit Score Factors</div>
              {creditScoreFactors.map((factor, index) => (
                <div key={index} className="bg-white rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-700">{factor.label}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{factor.weight}</span>
                      <span className={`text-sm ${getCreditScoreColor(factor.score)}`}>
                        {factor.score}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${getCreditScoreBgColor(factor.score)}`}
                      style={{ width: `${factor.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Loan History */}
          <div>
            <h4 className="text-sm text-gray-600 mb-4">Loan History</h4>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl text-gray-900">{stats.total}</div>
                  <div className="text-xs text-gray-500">Total Loans</div>
                </div>
                <div>
                  <div className="text-2xl text-gray-900">{stats.active}</div>
                  <div className="text-xs text-gray-500">Active Loans</div>
                </div>
                <div>
                  <div className="text-2xl text-gray-900">${stats.totalBorrowed.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Total Borrowed</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
