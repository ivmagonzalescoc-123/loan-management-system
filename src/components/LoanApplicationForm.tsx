import { useState } from 'react';
import { X, User, PhilippinePeso, FileText, Shield, UserCheck } from 'lucide-react';
import { createLoanApplication } from '../lib/api';
import { useBorrowers } from '../lib/useApiData';
import { formatPhp } from '../lib/currency';

interface LoanApplicationFormProps {
  onClose: () => void;
  onSubmit: () => void;
}

export function LoanApplicationForm({ onClose, onSubmit }: LoanApplicationFormProps) {
  const { data: borrowers } = useBorrowers();
  const [step, setStep] = useState(1);

  const getSuggestedInterestRate = (termMonths: number) => {
    const safeTerm = Number.isFinite(termMonths) ? Math.max(1, termMonths) : 36;
    const steps = Math.ceil(Math.max(0, safeTerm - 12) / 12);
    return Math.min(20, 10 + steps * 2);
  };

  const [formData, setFormData] = useState({
    borrowerId: '',
    loanType: 'personal',
    requestedAmount: '',
    purpose: '',
    termMonths: '36',
    interestRate: String(getSuggestedInterestRate(36)),
    hasCollateral: false,
    collateralType: '',
    collateralValue: '',
    collateralDescription: '',
    hasGuarantor: false,
    guarantorName: '',
    guarantorPhone: '',
    guarantorEmail: '',
    guarantorAddress: '',
    guarantorRelationship: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const nextValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    setFormData(prev => {
      const next = { ...prev, [name]: nextValue } as typeof prev;

      if (name === 'termMonths') {
        const term = parseInt(String(value), 10);
        const suggested = getSuggestedInterestRate(Number.isFinite(term) ? term : 36);
        const currentRate = parseFloat(next.interestRate);
        if (!Number.isFinite(currentRate) || currentRate < suggested) {
          next.interestRate = String(suggested);
        }
      }

      return next;
    });
  };

  const handleSubmit = async () => {
    const borrower = borrowers.find(b => b.id === formData.borrowerId);
    if (!borrower) {
      alert('Please select a borrower.');
      return;
    }

    const requestedAmount = parseFloat(formData.requestedAmount);
    if (!requestedAmount || Number.isNaN(requestedAmount)) {
      alert('Please enter a valid requested amount.');
      return;
    }

    try {
      const collateralValue = formData.hasCollateral && formData.collateralValue
        ? parseFloat(formData.collateralValue)
        : undefined;

      const termMonths = parseInt(formData.termMonths, 10);
      const suggestedRate = getSuggestedInterestRate(Number.isFinite(termMonths) ? termMonths : 36);
      const selectedRate = parseFloat(formData.interestRate);
      const interestRate = Number.isFinite(selectedRate) ? Math.min(20, Math.max(suggestedRate, selectedRate)) : suggestedRate;

      await createLoanApplication({
        borrowerId: borrower.id,
        borrowerName: `${borrower.firstName} ${borrower.lastName}`,
        loanType: formData.loanType as 'personal' | 'business' | 'mortgage' | 'education' | 'vehicle',
        requestedAmount,
        purpose: formData.purpose,
        termMonths,
        interestRate,
        creditScore: borrower.creditScore,
        collateralType: formData.hasCollateral ? formData.collateralType : undefined,
        collateralValue: collateralValue && !Number.isNaN(collateralValue) ? collateralValue : undefined,
        guarantorName: formData.hasGuarantor ? formData.guarantorName : undefined,
        guarantorPhone: formData.hasGuarantor ? formData.guarantorPhone : undefined
      });
      onSubmit();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to submit application');
    }
  };

  const totalSteps = 3;
  const selectedTermMonths = parseInt(formData.termMonths, 10);
  const suggestedRate = getSuggestedInterestRate(Number.isFinite(selectedTermMonths) ? selectedTermMonths : 36);
  const interestRateOptions = Array.from({ length: Math.floor((20 - suggestedRate) * 2) + 1 }, (_, idx) => {
    const value = suggestedRate + idx * 0.5;
    return Math.round(value * 10) / 10;
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
          <div>
            <h3 className="text-gray-900">New Loan Application</h3>
            <p className="text-sm text-gray-600 mt-1">Step {step} of {totalSteps}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  s <= step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {s}
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

        {/* Form Content */}
        <div className="p-6">
          {/* Step 1: Borrower & Loan Details */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-blue-600" />
                <h4 className="text-gray-900">Borrower & Loan Information</h4>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">Select Borrower *</label>
                <select
                  name="borrowerId"
                  value={formData.borrowerId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Select Borrower --</option>
                  {borrowers.map(borrower => (
                    <option key={borrower.id} value={borrower.id}>
                      {borrower.firstName} {borrower.lastName} ({borrower.id}) - Credit Score: {borrower.creditScore}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Loan Type *</label>
                  <select
                    name="loanType"
                    value={formData.loanType}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="personal">Personal Loan</option>
                    <option value="business">Business Loan</option>
                    <option value="mortgage">Mortgage/Home Loan</option>
                    <option value="education">Education Loan</option>
                    <option value="vehicle">Vehicle Loan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-2">Requested Amount (₱) *</label>
                  <input
                    type="number"
                    name="requestedAmount"
                    value={formData.requestedAmount}
                    onChange={handleChange}
                    placeholder="Enter amount"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">Loan Term *</label>
                <select
                  name="termMonths"
                  value={formData.termMonths}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <option value="360">360 months (30 years)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">Interest Rate (% per annum) *</label>
                <select
                  name="interestRate"
                  value={formData.interestRate}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {interestRateOptions.map((rate) => (
                    <option key={rate} value={String(rate)}>
                      {rate}% {rate === suggestedRate ? '(suggested)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Longer terms have higher rates (max 20%).</p>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">Purpose of Loan *</label>
                <textarea
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Describe the purpose of this loan in detail..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          )}

          {/* Step 2: Collateral & Guarantor */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-blue-600" />
                <h4 className="text-gray-900">Collateral & Guarantor Information</h4>
              </div>

              {/* Collateral Section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="hasCollateral"
                    name="hasCollateral"
                    checked={formData.hasCollateral}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600"
                  />
                  <label htmlFor="hasCollateral" className="text-sm text-gray-900">
                    I have collateral to secure this loan
                  </label>
                </div>

                {formData.hasCollateral && (
                  <div className="space-y-4 mt-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Collateral Type *</label>
                      <select
                        name="collateralType"
                        value={formData.collateralType}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={formData.hasCollateral}
                      >
                        <option value="">-- Select Type --</option>
                        <option value="real-estate">Real Estate/Property</option>
                        <option value="vehicle">Vehicle</option>
                        <option value="equipment">Business Equipment</option>
                        <option value="inventory">Inventory/Stock</option>
                        <option value="securities">Securities/Investments</option>
                        <option value="jewelry">Jewelry/Valuables</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Estimated Value (₱) *</label>
                      <input
                        type="number"
                        name="collateralValue"
                        value={formData.collateralValue}
                        onChange={handleChange}
                        placeholder="Enter estimated value"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={formData.hasCollateral}
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Collateral Description *</label>
                      <textarea
                        name="collateralDescription"
                        value={formData.collateralDescription}
                        onChange={handleChange}
                        rows={3}
                        placeholder="Provide detailed description (e.g., make, model, year, condition, location)"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={formData.hasCollateral}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Guarantor Section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="hasGuarantor"
                    name="hasGuarantor"
                    checked={formData.hasGuarantor}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600"
                  />
                  <label htmlFor="hasGuarantor" className="text-sm text-gray-900">
                    I have a guarantor for this loan
                  </label>
                </div>

                {formData.hasGuarantor && (
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Guarantor Full Name *</label>
                        <input
                          type="text"
                          name="guarantorName"
                          value={formData.guarantorName}
                          onChange={handleChange}
                          placeholder="Enter full name"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required={formData.hasGuarantor}
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Relationship *</label>
                        <input
                          type="text"
                          name="guarantorRelationship"
                          value={formData.guarantorRelationship}
                          onChange={handleChange}
                          placeholder="e.g., Spouse, Parent, Sibling"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required={formData.hasGuarantor}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Phone Number *</label>
                        <input
                          type="tel"
                          name="guarantorPhone"
                          value={formData.guarantorPhone}
                          onChange={handleChange}
                          placeholder="+1-555-0000"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required={formData.hasGuarantor}
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Email Address *</label>
                        <input
                          type="email"
                          name="guarantorEmail"
                          value={formData.guarantorEmail}
                          onChange={handleChange}
                          placeholder="guarantor@email.com"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required={formData.hasGuarantor}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Address *</label>
                      <textarea
                        name="guarantorAddress"
                        value={formData.guarantorAddress}
                        onChange={handleChange}
                        rows={2}
                        placeholder="Enter complete address"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={formData.hasGuarantor}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Review & Submit */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-blue-600" />
                <h4 className="text-gray-900">Review & Submit</h4>
              </div>

              {/* Application Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm text-gray-900 mb-3">Application Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Borrower:</span>
                    <span className="text-gray-900">
                      {borrowers.find(b => b.id === formData.borrowerId)?.firstName} {borrowers.find(b => b.id === formData.borrowerId)?.lastName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Loan Type:</span>
                    <span className="text-gray-900 capitalize">{formData.loanType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Requested Amount:</span>
                    <span className="text-gray-900">{formatPhp(formData.requestedAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Term:</span>
                    <span className="text-gray-900">{formData.termMonths} months</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Interest Rate:</span>
                    <span className="text-gray-900">{formData.interestRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Collateral:</span>
                    <span className="text-gray-900">{formData.hasCollateral ? `Yes - ${formData.collateralType}` : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Guarantor:</span>
                    <span className="text-gray-900">{formData.hasGuarantor ? `Yes - ${formData.guarantorName}` : 'No'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  By submitting this application, you confirm that all information provided is accurate and complete. The loan will be disbursed to the bank account on file for this borrower.
                </p>
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
          
          {step < totalSteps ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Next Step
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Submit Application
            </button>
          )}
        </div>
      </div>
    </div>
  );
}