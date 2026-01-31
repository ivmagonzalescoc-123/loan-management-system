import { useEffect, useState } from 'react';
import { X, Upload, FileText, CheckCircle, AlertCircle, Banknote } from 'lucide-react';
import { LoanApplication } from '../lib/types';
import { consumeAuthorizationCode, createLoan } from '../lib/api';
import { useBorrowers } from '../lib/useApiData';
import { formatPhp } from '../lib/currency';
import type { Loan } from '../lib/types';
import { DisbursementReceiptModal } from './DisbursementReceiptModal';

interface DisbursementFormProps {
  application: LoanApplication;
  onClose: () => void;
  onDisburse: () => void;
}

export function DisbursementForm({ application, onClose, onDisburse }: DisbursementFormProps) {
  const { data: borrowers } = useBorrowers();
  const borrower = borrowers.find(b => b.id === application.borrowerId);
  const hasSavedBank = Boolean(borrower?.bankName && borrower?.accountNumber);

  const [formData, setFormData] = useState({
    disbursementMethod: 'bank_transfer',
    bankName: '',
    accountHolderName: application.borrowerName,
    accountNumber: '',
    accountType: 'savings',
    routingNumber: '',
    swiftCode: '',
    branchName: '',
    branchCode: '',
    checkNumber: '',
    checkDate: new Date().toISOString().split('T')[0],
    digitalWalletProvider: 'paypal',
    walletId: '',
    disbursementDate: new Date().toISOString().split('T')[0],
    disbursementTime: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    referenceNumber: 'REF-' + Date.now().toString().slice(-8),
    processingOfficer: 'Jane Cashier',
    notes: '',
    attachments: [] as string[],
    confirmAmount: '',
    confirmAccountNumber: '',
    verificationCode: ''
  });

  const [step, setStep] = useState(1);
  const [accountSource, setAccountSource] = useState<'borrower' | 'other'>(hasSavedBank ? 'borrower' : 'other');
  const [createdLoanForReceipt, setCreatedLoanForReceipt] = useState<Loan | null>(null);

  useEffect(() => {
    if (!hasSavedBank) return;
    if (accountSource === 'borrower') return;
    if (formData.bankName || formData.accountNumber) return;
    setAccountSource('borrower');
  }, [accountSource, formData.bankName, formData.accountNumber, hasSavedBank]);

  useEffect(() => {
    if (accountSource !== 'borrower' || !borrower) return;

    setFormData(prev => ({
      ...prev,
      bankName: borrower.bankName || '',
      accountNumber: borrower.accountNumber || '',
      accountType: borrower.accountType || 'savings',
      routingNumber: borrower.routingNumber || '',
      accountHolderName: `${borrower.firstName} ${borrower.lastName}`
    }));
  }, [accountSource, borrower]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileNames = Array.from(files).map(f => f.name);
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...fileNames]
      }));
    }
  };

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const calculateMonthlyPayment = (principal: number, rate: number, months: number, interestType: 'simple' | 'compound') => {
    if (!principal || !months) return 0;
    if (interestType === 'simple') {
      const total = principal * (1 + (rate / 100) * (months / 12));
      return total / months;
    }
    const monthlyRate = rate / 100 / 12;
    if (monthlyRate === 0) return principal / months;
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1);
  };

  const addMonths = (date: string, months: number) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
  };

  const handleDisburse = async () => {
    const approvedAmount = Number(application.approvedAmount || 0);
    const interestRate = Number(application.interestRate || 0);
    const termMonths = Number(application.termMonths || 0);
    if (!approvedAmount || !termMonths) {
      alert('Approved amount and term are required to disburse.');
      return;
    }

    const interestType = application.interestType || 'compound';
    const monthlyPayment = calculateMonthlyPayment(approvedAmount, interestRate, termMonths, interestType);
    const totalAmount = monthlyPayment * termMonths;

    if (!formData.verificationCode) {
      alert('Authorization code is required.');
      return;
    }

    try {
      await consumeAuthorizationCode({
        applicationId: application.id,
        code: formData.verificationCode.trim()
      });

      const receiptNumber = `DR-${Date.now().toString().slice(-6)}`;
      const referenceNumber = formData.referenceNumber || `REF-${Date.now().toString().slice(-8)}`;
      const disbursementMethod = formData.disbursementMethod;
      const disbursementMeta = {
        disbursementTime: formData.disbursementTime,
        disbursementMethod,
        bankName: formData.bankName,
        accountHolderName: formData.accountHolderName,
        accountNumberLast4: formData.accountNumber ? String(formData.accountNumber).slice(-4) : undefined,
        checkNumber: formData.checkNumber,
        checkDate: formData.checkDate,
        digitalWalletProvider: formData.digitalWalletProvider,
        walletId: formData.walletId,
        processingOfficer: formData.processingOfficer,
        notes: formData.notes
      };

      const { id: loanId } = await createLoan({
        applicationId: application.id,
        borrowerId: application.borrowerId,
        borrowerName: application.borrowerName,
        loanType: application.loanType,
        principalAmount: approvedAmount,
        interestRate,
        termMonths,
        monthlyPayment,
        totalAmount,
        disbursedDate: formData.disbursementDate,
        disbursedBy: formData.processingOfficer,
        disbursementMethod,
        referenceNumber,
        receiptNumber,
        disbursementMeta: JSON.stringify(disbursementMeta),
        status: 'active',
        outstandingBalance: totalAmount,
        nextDueDate: addMonths(formData.disbursementDate, 1),
        interestType,
        gracePeriodDays: application.gracePeriodDays ?? 5,
        penaltyRate: application.penaltyRate ?? 0.5,
        penaltyFlat: application.penaltyFlat ?? 0
      });

      // Show receipt preview first (no auto-print). User can print from the modal.
      setCreatedLoanForReceipt({
        id: loanId,
        applicationId: application.id,
        borrowerId: application.borrowerId,
        borrowerName: application.borrowerName,
        loanType: application.loanType,
        principalAmount: approvedAmount,
        interestRate,
        termMonths,
        monthlyPayment,
        totalAmount,
        disbursedDate: formData.disbursementDate,
        disbursedBy: formData.processingOfficer,
        disbursementMethod,
        referenceNumber,
        receiptNumber,
        disbursementMeta: JSON.stringify(disbursementMeta),
        status: 'active',
        outstandingBalance: totalAmount,
        nextDueDate: addMonths(formData.disbursementDate, 1),
        interestType,
        gracePeriodDays: application.gracePeriodDays ?? 5,
        penaltyRate: application.penaltyRate ?? 0.5,
        penaltyFlat: application.penaltyFlat ?? 0
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to disburse loan');
    }
  };

  const approvedAmount = Number(application.approvedAmount || 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {createdLoanForReceipt && (
          <DisbursementReceiptModal
            loan={createdLoanForReceipt}
            onClose={() => {
              setCreatedLoanForReceipt(null);
              onDisburse();
            }}
          />
        )}
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
          <div>
            <h3 className="text-gray-900">Loan Disbursement</h3>
            <p className="text-sm text-gray-600 mt-1">
              {application.id} - {application.borrowerName}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  s <= step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {s}
                </div>
                <div className="flex-1 text-center text-xs text-gray-600 ml-2">
                  {s === 1 ? 'Method' : s === 2 ? 'Details' : 'Verify'}
                </div>
                {s < 3 && (
                  <div className={`flex-1 h-1 mx-2 ${
                    s < step ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Loan Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-blue-700">Borrower</div>
                <div className="text-blue-900">{application.borrowerName}</div>
              </div>
              <div>
                <div className="text-blue-700">Approved Amount</div>
                <div className="text-lg text-blue-900">{formatPhp(approvedAmount)}</div>
              </div>
              <div>
                <div className="text-blue-700">Interest Rate</div>
                <div className="text-blue-900">{application.interestRate}%</div>
              </div>
              <div>
                <div className="text-blue-700">Term</div>
                <div className="text-blue-900">{application.termMonths} months</div>
              </div>
            </div>
          </div>

          {/* Step 1: Disbursement Method */}
          {step === 1 && (
            <div className="space-y-4">
              <h4 className="text-gray-900 mb-4">Select Disbursement Method</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { value: 'bank_transfer', label: 'Bank Transfer', icon: Banknote, desc: 'Direct transfer to bank account' },
                  { value: 'check', label: 'Check', icon: FileText, desc: 'Physical check issuance' },
                  { value: 'cash', label: 'Cash', icon: Banknote, desc: 'Cash disbursement' },
                  { value: 'digital_wallet', label: 'Digital Wallet', icon: Banknote, desc: 'PayPal, Venmo, etc.' }
                ].map(method => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.value}
                      onClick={() => setFormData(prev => ({ ...prev, disbursementMethod: method.value }))}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        formData.disbursementMethod === method.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={`w-6 h-6 mt-1 ${
                          formData.disbursementMethod === method.value ? 'text-blue-600' : 'text-gray-400'
                        }`} />
                        <div>
                          <div className="text-gray-900">{method.label}</div>
                          <div className="text-sm text-gray-500 mt-1">{method.desc}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Payment Details */}
          {step === 2 && (
            <div className="space-y-6">
              <h4 className="text-gray-900 mb-4">Enter Payment Details</h4>

              {/* Bank Transfer */}
              {formData.disbursementMethod === 'bank_transfer' && (
                <div className="space-y-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="text-sm text-gray-700 mb-3">Bank Account Source</div>
                    <div className="flex flex-col md:flex-row gap-3">
                      <button
                        type="button"
                        onClick={() => setAccountSource('borrower')}
                        disabled={!hasSavedBank}
                        className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                          accountSource === 'borrower'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                        } ${!hasSavedBank ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        Use Borrower Bank Details
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountSource('other')}
                        className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                          accountSource === 'other'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Use Other Bank Account
                      </button>
                    </div>
                    {!hasSavedBank && (
                      <p className="text-xs text-gray-500 mt-2">
                        No saved bank details found for this borrower.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Bank Name *</label>
                      <input
                        type="text"
                        name="bankName"
                        value={formData.bankName}
                        onChange={handleChange}
                        placeholder="e.g., Chase Bank"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={accountSource === 'borrower'}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Account Holder Name *</label>
                      <input
                        type="text"
                        name="accountHolderName"
                        value={formData.accountHolderName}
                        onChange={handleChange}
                        placeholder="Full name as per bank"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={accountSource === 'borrower'}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Account Number *</label>
                      <input
                        type="text"
                        name="accountNumber"
                        value={formData.accountNumber}
                        onChange={handleChange}
                        placeholder="Enter account number"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={accountSource === 'borrower'}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Account Type *</label>
                      <select
                        name="accountType"
                        value={formData.accountType}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={accountSource === 'borrower'}
                        required
                      >
                        <option value="savings">Savings Account</option>
                        <option value="checking">Checking Account</option>
                        <option value="current">Current Account</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Routing Number / IFSC *</label>
                      <input
                        type="text"
                        name="routingNumber"
                        value={formData.routingNumber}
                        onChange={handleChange}
                        placeholder="e.g., 021000021"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-2">SWIFT Code (International)</label>
                      <input
                        type="text"
                        name="swiftCode"
                        value={formData.swiftCode}
                        onChange={handleChange}
                        placeholder="Optional"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Branch Name</label>
                      <input
                        type="text"
                        name="branchName"
                        value={formData.branchName}
                        onChange={handleChange}
                        placeholder="e.g., Downtown Branch"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Branch Code</label>
                      <input
                        type="text"
                        name="branchCode"
                        value={formData.branchCode}
                        onChange={handleChange}
                        placeholder="Optional"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Check Payment */}
              {formData.disbursementMethod === 'check' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Check Number *</label>
                      <input
                        type="text"
                        name="checkNumber"
                        value={formData.checkNumber}
                        onChange={handleChange}
                        placeholder="Enter check number"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Check Date *</label>
                      <input
                        type="date"
                        name="checkDate"
                        value={formData.checkDate}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-2">Payee Name *</label>
                    <input
                      type="text"
                      name="accountHolderName"
                      value={formData.accountHolderName}
                      onChange={handleChange}
                      placeholder="Name on check"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Digital Wallet */}
              {formData.disbursementMethod === 'digital_wallet' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-2">Wallet Provider *</label>
                    <select
                      name="digitalWalletProvider"
                      value={formData.digitalWalletProvider}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="paypal">PayPal</option>
                      <option value="venmo">Venmo</option>
                      <option value="cashapp">Cash App</option>
                      <option value="zelle">Zelle</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-2">Wallet ID / Email / Phone *</label>
                    <input
                      type="text"
                      name="walletId"
                      value={formData.walletId}
                      onChange={handleChange}
                      placeholder="e.g., user@email.com or phone number"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Cash Disbursement */}
              {formData.disbursementMethod === 'cash' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <div className="text-sm text-yellow-900">Cash Disbursement Notice</div>
                      <div className="text-sm text-yellow-700 mt-1">
                        Cash disbursement requires borrower to be present with valid ID. Ensure proper documentation and receipt issuance.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Common Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Disbursement Date *</label>
                  <input
                    type="date"
                    name="disbursementDate"
                    value={formData.disbursementDate}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-2">Disbursement Time *</label>
                  <input
                    type="time"
                    name="disbursementTime"
                    value={formData.disbursementTime}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">Reference Number</label>
                <input
                  type="text"
                  name="referenceNumber"
                  value={formData.referenceNumber}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">Notes / Remarks</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Add any additional notes or remarks..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* File Attachments */}
              <div>
                <label className="block text-sm text-gray-700 mb-2">Supporting Documents</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer">
                    Click to upload
                  </label>
                  <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG up to 10MB</p>
                </div>
                {formData.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {formData.attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                        <span className="text-gray-700">{file}</span>
                        <button
                          onClick={() => removeAttachment(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Verification */}
          {step === 3 && (
            <div className="space-y-6">
              <h4 className="text-gray-900 mb-4">Verify & Confirm Disbursement</h4>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-900">
                    Please verify all details carefully. This action cannot be undone once confirmed.
                  </div>
                </div>
              </div>

              {/* Verification Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h5 className="text-sm text-gray-700">Disbursement Summary</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Borrower:</span>
                    <span className="text-gray-900">{application.borrowerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount:</span>
                    <span className="text-lg text-gray-900">{formatPhp(approvedAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Method:</span>
                    <span className="text-gray-900 capitalize">{formData.disbursementMethod.replace('_', ' ')}</span>
                  </div>
                  {formData.disbursementMethod === 'bank_transfer' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Bank:</span>
                        <span className="text-gray-900">{formData.bankName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Account:</span>
                        <span className="text-gray-900">***{formData.accountNumber.slice(-4)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Reference:</span>
                    <span className="text-gray-900">{formData.referenceNumber}</span>
                  </div>
                </div>
              </div>

              {/* Verification Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Confirm Amount (₱) *</label>
                  <input
                    type="number"
                    name="confirmAmount"
                    value={formData.confirmAmount}
                    onChange={handleChange}
                    placeholder={`Enter ${approvedAmount}`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  {formData.confirmAmount && Math.abs(parseFloat(formData.confirmAmount) - approvedAmount) > 0.01 && (
                    <p className="text-xs text-red-600 mt-1">Amount does not match</p>
                  )}
                </div>

                {formData.disbursementMethod === 'bank_transfer' && (
                  <div>
                    <label className="block text-sm text-gray-700 mb-2">Confirm Account Number *</label>
                    <input
                      type="text"
                      name="confirmAccountNumber"
                      value={formData.confirmAccountNumber}
                      onChange={handleChange}
                      placeholder="Re-enter account number"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    {formData.confirmAccountNumber && formData.confirmAccountNumber !== formData.accountNumber && (
                      <p className="text-xs text-red-600 mt-1">Account number does not match</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm text-gray-700 mb-2">Authorization Code *</label>
                  <input
                    type="text"
                    name="verificationCode"
                    value={formData.verificationCode}
                    onChange={handleChange}
                    placeholder="Enter your authorization code"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Use the code generated by admin or loan officer.</p>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <input type="checkbox" id="confirm-terms" className="mt-1" required />
                <label htmlFor="confirm-terms" className="text-sm text-blue-900">
                  I confirm that I have verified all disbursement details and authorize this transaction. I understand this action is irreversible.
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex justify-between">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="px-6 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Previous'}
          </button>
          
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Next Step
            </button>
          ) : (
            <button
              onClick={handleDisburse}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Confirm Disbursement
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
