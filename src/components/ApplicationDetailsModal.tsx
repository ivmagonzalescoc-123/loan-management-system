import { X, CheckCircle, XCircle, User, PhilippinePeso, Calendar, FileText, Shield, KeyRound } from 'lucide-react';
import { LoanApplication } from '../lib/types';
import { User as AppUser } from '../App';
import { useState } from 'react';
import { ApprovalForm } from './ApprovalForm';
import { createAuthorizationCode } from '../lib/api';
import { formatPhp } from '../lib/currency';

interface ApplicationDetailsModalProps {
  application: LoanApplication;
  user: AppUser;
  onClose: () => void;
  onUpdated: () => void;
}

export function ApplicationDetailsModal({ application, user, onClose, onUpdated }: ApplicationDetailsModalProps) {
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [authExpiry, setAuthExpiry] = useState<string | null>(null);
  const canGenerateCode = user.role === 'admin' || user.role === 'loan_officer';

  const handleApprove = () => {
    setShowApprovalForm(true);
  };

  const handleReject = () => {
    setShowApprovalForm(true);
  };

  const calculateMonthlyPayment = (principal: number, rate: number, months: number) => {
    const monthlyRate = rate / 100 / 12;
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
           (Math.pow(1 + monthlyRate, months) - 1);
  };

  const getCreditScoreColor = (score: number) => {
    if (score >= 700) return 'text-green-600';
    if (score >= 600) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCreditScoreLabel = (score: number) => {
    if (score >= 750) return 'Excellent';
    if (score >= 700) return 'Good';
    if (score >= 650) return 'Fair';
    if (score >= 600) return 'Poor';
    return 'Very Poor';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h3 className="text-gray-900 mb-1">Application Details</h3>
            <p className="text-sm text-gray-600">{application.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Banner */}
          <div className={`rounded-lg p-4 ${
            application.status === 'approved' ? 'bg-green-50 border border-green-200' :
            application.status === 'rejected' ? 'bg-red-50 border border-red-200' :
            application.status === 'under_review' ? 'bg-blue-50 border border-blue-200' :
            'bg-yellow-50 border border-yellow-200'
          }`}>
            <div className="flex items-center gap-3">
              {application.status === 'approved' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : application.status === 'rejected' ? (
                <XCircle className="w-5 h-5 text-red-600" />
              ) : (
                <FileText className="w-5 h-5 text-yellow-600" />
              )}
              <div>
                <div className={`text-sm ${
                  application.status === 'approved' ? 'text-green-900' :
                  application.status === 'rejected' ? 'text-red-900' :
                  application.status === 'under_review' ? 'text-blue-900' :
                  'text-yellow-900'
                }`}>
                  Application Status: <span className="capitalize">{application.status.replace('_', ' ')}</span>
                </div>
                {application.reviewedBy && (
                  <div className="text-xs text-gray-600 mt-1">
                    Reviewed by {application.reviewedBy} on {application.reviewDate}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Application Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm text-gray-600 mb-4 flex items-center gap-2">
                <User className="w-4 h-4" />
                Borrower Information
              </h4>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-500">Name</div>
                  <div className="text-sm text-gray-900">{application.borrowerName}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Borrower ID</div>
                  <div className="text-sm text-gray-900">{application.borrowerId}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Credit Score</div>
                  <div className={`text-lg ${getCreditScoreColor(application.creditScore)}`}>
                    {application.creditScore} - {getCreditScoreLabel(application.creditScore)}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm text-gray-600 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Loan Details
              </h4>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-500">Loan Type</div>
                  <div className="text-sm text-gray-900 capitalize">{application.loanType}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Requested Amount</div>
                  <div className="text-lg text-gray-900">{formatPhp(application.requestedAmount)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Application Date</div>
                  <div className="text-sm text-gray-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {application.applicationDate}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Loan Purpose */}
          <div>
            <h4 className="text-sm text-gray-600 mb-2">Purpose</h4>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-900">{application.purpose}</p>
            </div>
          </div>

          {/* Collateral & Guarantor */}
          {(application.collateralType || application.guarantorName) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {application.collateralType && (
                <div>
                  <h4 className="text-sm text-gray-600 mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Collateral Information
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-gray-500">Collateral Type</div>
                      <div className="text-sm text-gray-900">{application.collateralType}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Estimated Value</div>
                      <div className="text-sm text-gray-900">{formatPhp(application.collateralValue)}</div>
                    </div>
                  </div>
                </div>
              )}

              {application.guarantorName && (
                <div>
                  <h4 className="text-sm text-gray-600 mb-4 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Guarantor Information
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-gray-500">Name</div>
                      <div className="text-sm text-gray-900">{application.guarantorName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Phone</div>
                      <div className="text-sm text-gray-900">{application.guarantorPhone}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Approved Terms (if approved) */}
          {application.status === 'approved' && application.approvedAmount && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h4 className="text-sm text-green-900 mb-4 flex items-center gap-2">
                <PhilippinePeso className="w-4 h-4" />
                Approved Terms
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-green-700">Approved Amount</div>
                  <div className="text-lg text-green-900">{formatPhp(application.approvedAmount)}</div>
                </div>
                <div>
                  <div className="text-xs text-green-700">Interest Rate</div>
                  <div className="text-lg text-green-900">{application.interestRate}%</div>
                </div>
                <div>
                  <div className="text-xs text-green-700">Term</div>
                  <div className="text-lg text-green-900">{application.termMonths} months</div>
                </div>
                <div>
                  <div className="text-xs text-green-700">Est. Monthly Payment</div>
                  <div className="text-lg text-green-900">
                    {formatPhp(Math.round(calculateMonthlyPayment(
                      application.approvedAmount,
                      application.interestRate!,
                      application.termMonths!
                    )), { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {canGenerateCode && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <KeyRound className="w-5 h-5 text-blue-600" />
                <h4 className="text-sm text-gray-900">Disbursement Authorization Code</h4>
              </div>
              <p className="text-xs text-gray-600 mb-4">
                Generate a code for the cashier to complete disbursement.
              </p>
              {authCode ? (
                <div className="space-y-3">
                  <div className="text-sm text-gray-700">Authorization Code</div>
                  <div className="text-lg font-semibold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    {authCode}
                  </div>
                  {authExpiry && (
                    <div className="text-xs text-gray-500">Expires: {new Date(authExpiry).toLocaleString()}</div>
                  )}
                </div>
              ) : (
                <button
                  onClick={async () => {
                    const result = await createAuthorizationCode({
                      applicationId: application.id,
                      createdBy: user.id,
                      createdRole: user.role
                    });
                    setAuthCode(result.code);
                    setAuthExpiry(result.expiresAt);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Generate Code
                </button>
              )}
            </div>
          )}

          {/* Risk Assessment */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h4 className="text-sm text-blue-900 mb-4">Risk Assessment</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-900">Credit Score</span>
                <span className={`text-sm ${getCreditScoreColor(application.creditScore)}`}>
                  {application.creditScore >= 700 ? 'Low Risk' : 
                   application.creditScore >= 600 ? 'Medium Risk' : 'High Risk'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-900">Collateral Coverage</span>
                <span className="text-sm text-green-600">
                  {application.collateralValue && application.collateralValue > application.requestedAmount 
                    ? 'Adequate' : 'Not Provided'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-900">Guarantor</span>
                <span className="text-sm text-green-600">
                  {application.guarantorName ? 'Provided' : 'Not Provided'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Close
          </button>
          
          {application.status === 'pending' || application.status === 'under_review' ? (
            <>
              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Process Application
              </button>
            </>
          ) : null}
        </div>
      </div>

      {showApprovalForm && (
        <ApprovalForm
          application={application}
          onClose={() => {
            setShowApprovalForm(false);
            onClose();
          }}
          onApprove={() => {
            setShowApprovalForm(false);
            onUpdated();
            onClose();
          }}
          onReject={() => {
            setShowApprovalForm(false);
            onUpdated();
            onClose();
          }}
        />
      )}
    </div>
  );
}