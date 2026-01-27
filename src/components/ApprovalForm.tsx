import { useState } from 'react';
import { X, CheckCircle, XCircle, Calculator, FileText } from 'lucide-react';
import { LoanApplication } from '../lib/types';
import { updateLoanApplication } from '../lib/api';

interface ApprovalFormProps {
  application: LoanApplication;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}

export function ApprovalForm({ application, onClose, onApprove, onReject }: ApprovalFormProps) {
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [formData, setFormData] = useState({
    approvedAmount: application.requestedAmount.toString(),
    interestRate: '7.5',
    termMonths: '36',
    processingFee: '500',
    insuranceFee: '200',
    disbursementMethod: 'bank_transfer',
    requireDocuments: [] as string[],
    specialConditions: '',
    internalNotes: '',
    rejectionReason: '',
    rejectionCategory: 'credit_score'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDocumentToggle = (doc: string) => {
    setFormData(prev => ({
      ...prev,
      requireDocuments: prev.requireDocuments.includes(doc)
        ? prev.requireDocuments.filter(d => d !== doc)
        : [...prev.requireDocuments, doc]
    }));
  };

  const calculateMonthlyPayment = () => {
    const principal = parseFloat(formData.approvedAmount);
    const rate = parseFloat(formData.interestRate) / 100 / 12;
    const months = parseInt(formData.termMonths);
    const payment = (principal * rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1);
    return isNaN(payment) ? 0 : payment;
  };

  const calculateTotalAmount = () => {
    const monthly = calculateMonthlyPayment();
    const months = parseInt(formData.termMonths);
    return monthly * months;
  };

  const handleSubmit = async () => {
    const reviewDate = new Date().toISOString().split('T')[0];

    if (action === 'approve') {
      await updateLoanApplication(application.id, {
        status: 'approved',
        approvedAmount: parseFloat(formData.approvedAmount),
        interestRate: parseFloat(formData.interestRate),
        termMonths: parseInt(formData.termMonths, 10),
        reviewedBy: 'Loan Officer',
        reviewDate
      });
      onApprove();
      return;
    }

    await updateLoanApplication(application.id, {
      status: 'rejected',
      reviewedBy: 'Loan Officer',
      reviewDate
    });
    onReject();
  };

  const documentOptions = [
    'Valid Government ID',
    'Proof of Income (Latest Payslip)',
    'Bank Statements (Last 3 months)',
    'Certificate of Employment',
    'Proof of Address',
    'Tax Returns (Last 2 years)',
    'Collateral Documents',
    'Business Registration (if applicable)'
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
          <div>
            <h3 className="text-gray-900">Loan Application Review</h3>
            <p className="text-sm text-gray-600 mt-1">
              {application.id} - {application.borrowerName}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Action Selector */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setAction('approve')}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                action === 'approve'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <CheckCircle className="w-5 h-5 inline-block mr-2" />
              Approve Application
            </button>
            <button
              onClick={() => setAction('reject')}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                action === 'reject'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <XCircle className="w-5 h-5 inline-block mr-2" />
              Reject Application
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Application Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="text-sm text-blue-900 mb-3">Application Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-blue-700">Borrower</div>
                <div className="text-blue-900">{application.borrowerName}</div>
              </div>
              <div>
                <div className="text-blue-700">Loan Type</div>
                <div className="text-blue-900 capitalize">{application.loanType}</div>
              </div>
              <div>
                <div className="text-blue-700">Requested Amount</div>
                <div className="text-blue-900">${application.requestedAmount.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-blue-700">Credit Score</div>
                <div className={`${
                  application.creditScore >= 700 ? 'text-green-600' :
                  application.creditScore >= 600 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {application.creditScore}
                </div>
              </div>
            </div>
          </div>

          {action === 'approve' ? (
            <div className="space-y-6">
              {/* Approval Terms */}
              <div>
                <h4 className="text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-green-600" />
                  Approval Terms
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-2">Approved Amount ($) *</label>
                    <input
                      type="number"
                      name="approvedAmount"
                      value={formData.approvedAmount}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-2">Interest Rate (% per annum) *</label>
                    <input
                      type="number"
                      step="0.1"
                      name="interestRate"
                      value={formData.interestRate}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-2">Loan Term (months) *</label>
                    <select
                      name="termMonths"
                      value={formData.termMonths}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    >
                      <option value="12">12 months (1 year)</option>
                      <option value="24">24 months (2 years)</option>
                      <option value="36">36 months (3 years)</option>
                      <option value="48">48 months (4 years)</option>
                      <option value="60">60 months (5 years)</option>
                      <option value="120">120 months (10 years)</option>
                      <option value="180">180 months (15 years)</option>
                      <option value="240">240 months (20 years)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-2">Disbursement Method *</label>
                    <select
                      name="disbursementMethod"
                      value={formData.disbursementMethod}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    >
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="check">Check</option>
                      <option value="cash">Cash</option>
                      <option value="digital_wallet">Digital Wallet</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-2">Processing Fee ($)</label>
                    <input
                      type="number"
                      name="processingFee"
                      value={formData.processingFee}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-2">Insurance Fee ($)</label>
                    <input
                      type="number"
                      name="insuranceFee"
                      value={formData.insuranceFee}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Loan Calculation */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="text-sm text-green-900 mb-3 flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  Loan Calculation
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-green-700">Principal Amount</div>
                    <div className="text-lg text-green-900">${parseFloat(formData.approvedAmount || '0').toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-green-700">Monthly Payment</div>
                    <div className="text-lg text-green-900">${Math.round(calculateMonthlyPayment()).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-green-700">Total Amount</div>
                    <div className="text-lg text-green-900">${Math.round(calculateTotalAmount()).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-green-700">Total Interest</div>
                    <div className="text-lg text-green-900">
                      ${Math.round(calculateTotalAmount() - parseFloat(formData.approvedAmount || '0')).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Required Documents */}
              <div>
                <label className="block text-sm text-gray-700 mb-2">Required Documents</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {documentOptions.map(doc => (
                    <label key={doc} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.requireDocuments.includes(doc)}
                        onChange={() => handleDocumentToggle(doc)}
                        className="w-4 h-4 text-green-600"
                      />
                      <span className="text-sm text-gray-700">{doc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Special Conditions */}
              <div>
                <label className="block text-sm text-gray-700 mb-2">Special Conditions / Terms</label>
                <textarea
                  name="specialConditions"
                  value={formData.specialConditions}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Enter any special conditions, requirements, or terms for this loan..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Internal Notes */}
              <div>
                <label className="block text-sm text-gray-700 mb-2">Internal Notes (Not visible to borrower)</label>
                <textarea
                  name="internalNotes"
                  value={formData.internalNotes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Add internal notes about this approval decision..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Rejection Form */}
              <div>
                <h4 className="text-gray-900 mb-4 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  Rejection Details
                </h4>

                <div>
                  <label className="block text-sm text-gray-700 mb-2">Rejection Category *</label>
                  <select
                    name="rejectionCategory"
                    value={formData.rejectionCategory}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  >
                    <option value="credit_score">Insufficient Credit Score</option>
                    <option value="income">Insufficient Income</option>
                    <option value="debt_ratio">High Debt-to-Income Ratio</option>
                    <option value="employment">Unstable Employment History</option>
                    <option value="collateral">Inadequate Collateral</option>
                    <option value="documentation">Incomplete Documentation</option>
                    <option value="verification">Failed Verification</option>
                    <option value="policy">Against Lending Policy</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="mt-4">
                  <label className="block text-sm text-gray-700 mb-2">Rejection Reason *</label>
                  <textarea
                    name="rejectionReason"
                    value={formData.rejectionReason}
                    onChange={handleChange}
                    rows={5}
                    placeholder="Provide a detailed reason for rejection. This will be visible to the borrower..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm text-gray-700 mb-2">Internal Notes</label>
                  <textarea
                    name="internalNotes"
                    value={formData.internalNotes}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Add internal notes (not visible to borrower)..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className={`px-6 py-2 text-white rounded-lg transition-colors ${
              action === 'approve'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {action === 'approve' ? 'Approve Application' : 'Reject Application'}
          </button>
        </div>
      </div>
    </div>
  );
}
