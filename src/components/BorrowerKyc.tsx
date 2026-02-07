import { useEffect, useMemo, useState } from 'react';
import { Briefcase, Home, PhilippinePeso, Shield, User as UserIcon } from 'lucide-react';
import { User } from '../App';
import { getBorrowerById, getBorrowerKyc, submitBorrowerKyc } from '../lib/api';

interface BorrowerKycProps {
  user: User;
}

const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'employed', label: 'Employed (Full-time)' },
  { value: 'parttime', label: 'Employed (Part-time)' },
  { value: 'selfemployed', label: 'Self-Employed' },
  { value: 'business', label: 'Business Owner' },
  { value: 'freelancer', label: 'Freelancer / Contractor' },
  { value: 'student', label: 'Student' },
  { value: 'unemployed', label: 'Unemployed' },
  { value: 'retired', label: 'Retired / Pensioner' },
  { value: 'homemaker', label: 'Homemaker' },
  { value: 'other', label: 'Other' }
] as const;

const NO_EMPLOYER_REQUIRED = new Set<string>(['unemployed', 'student', 'retired', 'homemaker']);

export function BorrowerKyc({ user }: BorrowerKycProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [step, setStep] = useState(1);
  const totalSteps = 5;

  const [kycStatus, setKycStatus] = useState<'pending' | 'submitted' | 'verified' | 'rejected'>('pending');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    // Step 1: Personal + ID
    firstName: '',
    middleName: '',
    lastName: '',
    email: user.email,
    phone: user.phone || '',
    alternatePhone: '',
    dateOfBirth: user.dateOfBirth || '',
    gender: 'male',
    maritalStatus: 'single',
    nationality: '',
    idFullName: '',
    idType: 'national_id',
    idNumber: '',

    // Step 2: Address
    addressLine1: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    residenceType: 'owned',
    yearsAtResidence: '',

    // Step 3: Employment
    employmentStatus: 'employed',
    employerName: '',
    jobTitle: '',
    industryType: '',
    employmentDuration: '',
    workAddress: '',
    workPhone: '',

    // Step 4: Financial + Bank
    monthlyIncome: '',
    otherIncomeSource: '',
    otherIncomeAmount: '',
    monthlyExpenses: '',
    existingDebts: '',
    bankName: '',
    accountNumber: '',
    accountType: 'savings',
    routingNumber: '',

    // Step 5: References + Emergency
    reference1Name: '',
    reference1Phone: '',
    reference1Relationship: '',
    reference2Name: '',
    reference2Phone: '',
    reference2Relationship: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: ''
  });

  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);

  const canSubmit = useMemo(() => {
    if (kycStatus === 'submitted' || kycStatus === 'verified') return false;
    return true;
  }, [kycStatus]);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const [status, borrower] = await Promise.all([getBorrowerKyc(user.id), getBorrowerById(user.id)]);
      setKycStatus(status.kycStatus);
      setRejectionReason(status.kycRejectionReason || null);

      const b = borrower as unknown as Record<string, unknown>;

      setFormData(prev => ({
        ...prev,
        firstName: String(b.firstName || prev.firstName || ''),
        middleName: String(b.middleName || prev.middleName || ''),
        lastName: String(b.lastName || prev.lastName || ''),
        email: String(b.email || prev.email || user.email),
        phone: String(b.phone || prev.phone || ''),
        alternatePhone: String(b.alternatePhone || prev.alternatePhone || ''),
        dateOfBirth: String(b.dateOfBirth || prev.dateOfBirth || ''),
        gender: String(b.gender || prev.gender || 'male'),
        maritalStatus: String(b.maritalStatus || prev.maritalStatus || 'single'),
        nationality: String(b.nationality || prev.nationality || ''),
        idFullName: String(b.idFullName || prev.idFullName || ''),
        idType: String(b.idType || prev.idType || 'national_id'),
        idNumber: String(b.idNumber || prev.idNumber || ''),

        addressLine1: String(b.addressLine1 || prev.addressLine1 || ''),
        city: String(b.city || prev.city || ''),
        state: String(b.state || prev.state || ''),
        zipCode: String(b.zipCode || prev.zipCode || ''),
        country: String(b.country || prev.country || ''),
        residenceType: String(b.residenceType || prev.residenceType || 'owned'),
        yearsAtResidence: b.yearsAtResidence != null ? String(b.yearsAtResidence) : prev.yearsAtResidence,

        employmentStatus: String(b.employmentStatus || prev.employmentStatus || 'employed'),
        employerName: String(b.employerName || prev.employerName || ''),
        jobTitle: String(b.jobTitle || prev.jobTitle || ''),
        industryType: String(b.industryType || prev.industryType || ''),
        employmentDuration: String(b.employmentDuration || prev.employmentDuration || ''),
        workAddress: String(b.workAddress || prev.workAddress || ''),
        workPhone: String(b.workPhone || prev.workPhone || ''),

        monthlyIncome: status.monthlyIncome ? String(status.monthlyIncome) : String(b.monthlyIncome || prev.monthlyIncome || ''),
        monthlyExpenses: status.monthlyExpenses ? String(status.monthlyExpenses) : String(b.monthlyExpenses || prev.monthlyExpenses || ''),
        otherIncomeSource: String(b.otherIncomeSource || prev.otherIncomeSource || ''),
        otherIncomeAmount: b.otherIncomeAmount != null ? String(b.otherIncomeAmount) : prev.otherIncomeAmount,
        existingDebts: b.existingDebts != null ? String(b.existingDebts) : prev.existingDebts,

        bankName: String(b.bankName || prev.bankName || ''),
        accountNumber: String(b.accountNumber || prev.accountNumber || ''),
        accountType: String(b.accountType || prev.accountType || 'savings'),
        routingNumber: String(b.routingNumber || prev.routingNumber || ''),

        reference1Name: String(b.reference1Name || prev.reference1Name || ''),
        reference1Phone: String(b.reference1Phone || prev.reference1Phone || ''),
        reference1Relationship: String(b.reference1Relationship || prev.reference1Relationship || ''),
        reference2Name: String(b.reference2Name || prev.reference2Name || ''),
        reference2Phone: String(b.reference2Phone || prev.reference2Phone || ''),
        reference2Relationship: String(b.reference2Relationship || prev.reference2Relationship || ''),
        emergencyContactName: String(b.emergencyContactName || prev.emergencyContactName || ''),
        emergencyContactPhone: String(b.emergencyContactPhone || prev.emergencyContactPhone || ''),
        emergencyContactRelationship: String(b.emergencyContactRelationship || prev.emergencyContactRelationship || '')
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load KYC status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const setField = (name: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!formData.firstName || !formData.lastName) return 'First and last name are required.';
      if (!formData.phone) return 'Phone number is required.';
      if (!formData.dateOfBirth) return 'Date of birth is required.';
      if (!formData.gender || !formData.maritalStatus || !formData.nationality) return 'Gender, marital status, and nationality are required.';
      if (!formData.idFullName || !formData.idType || !formData.idNumber) return 'ID full name, ID type, and ID number are required.';
      if (!selfieFile || !idFile) return 'Please upload both a selfie and an ID photo.';
      return null;
    }

    if (s === 2) {
      if (!formData.addressLine1 || !formData.city || !formData.state || !formData.zipCode || !formData.country) {
        return 'Complete address details are required.';
      }
      if (!formData.residenceType) return 'Residence type is required.';
      const years = Number(formData.yearsAtResidence);
      if (!Number.isFinite(years) || years < 0) return 'Years at residence must be 0 or more.';
      return null;
    }

    if (s === 3) {
      if (!formData.employmentStatus) return 'Employment status is required.';
      if (!NO_EMPLOYER_REQUIRED.has(formData.employmentStatus)) {
        if (!formData.employerName || !formData.jobTitle || !formData.employmentDuration) {
          return 'Employer/Business name, job title, and employment duration are required.';
        }
      }
      return null;
    }

    if (s === 4) {
      const monthlyIncome = Number(formData.monthlyIncome);
      const monthlyExpenses = Number(formData.monthlyExpenses);
      if (!Number.isFinite(monthlyIncome) || monthlyIncome <= 0) return 'Monthly income must be greater than 0.';
      if (!Number.isFinite(monthlyExpenses) || monthlyExpenses < 0) return 'Monthly expenses must be 0 or more.';
      if (!formData.bankName || !formData.accountType || !formData.accountNumber) return 'Bank name, account type, and account number are required.';
      return null;
    }

    if (s === 5) {
      if (!formData.reference1Name || !formData.reference1Phone || !formData.reference1Relationship) return 'Reference 1 is required.';
      if (!formData.reference2Name || !formData.reference2Phone || !formData.reference2Relationship) return 'Reference 2 is required.';
      if (!formData.emergencyContactName || !formData.emergencyContactPhone || !formData.emergencyContactRelationship) {
        return 'Emergency contact details are required.';
      }
      return null;
    }

    return null;
  };

  const goNext = () => {
    setError(null);
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setStep(s => Math.min(totalSteps, s + 1));
  };

  const goBack = () => {
    setError(null);
    setStep(s => Math.max(1, s - 1));
  };

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);

    const validationError = validateStep(5);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!selfieFile || !idFile) {
      setError('Please upload both a selfie and an ID photo.');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();

      (Object.keys(formData) as Array<keyof typeof formData>).forEach((k) => {
        fd.append(String(k), String(formData[k] ?? ''));
      });

      fd.append('selfie', selfieFile);
      fd.append('id', idFile);

      await submitBorrowerKyc(user.id, fd);
      setMessage('KYC submitted. Please wait for review.');
      await loadStatus();
      setSelfieFile(null);
      setIdFile(null);
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit KYC.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-1">KYC Verification</h2>
        <p className="text-sm text-gray-600">Complete KYC to unlock loan applications.</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-4xl space-y-4">
        {loading ? (
          <div className="text-sm text-gray-500">Loading KYC status...</div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">Status</div>
              <div className="text-sm font-medium text-gray-900 capitalize">{kycStatus.replace('_', ' ')}</div>
            </div>

            {kycStatus === 'rejected' && rejectionReason && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                Rejected: {rejectionReason}
              </div>
            )}

            {kycStatus === 'verified' && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                Your KYC is verified. You can now apply for loans.
              </div>
            )}

            {kycStatus === 'submitted' && (
              <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
                KYC submitted. Waiting for admin/manager/loan officer review.
              </div>
            )}

            {canSubmit && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-900 font-medium">KYC Form</div>
                    <div className="text-xs text-gray-600">Step {step} of {totalSteps}</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-4">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <div key={s} className="flex items-center flex-1">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                            s <= step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {s}
                        </div>
                        {s < 5 && (
                          <div className={`flex-1 h-1 mx-2 ${s < step ? 'bg-blue-600' : 'bg-gray-200'}`} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 1 */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-5 h-5 text-blue-600" />
                      <h4 className="text-gray-900">Personal & ID</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">First Name *</label>
                        <input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => setField('firstName', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Middle Name</label>
                        <input
                          type="text"
                          value={formData.middleName}
                          onChange={(e) => setField('middleName', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Last Name *</label>
                        <input
                          type="text"
                          value={formData.lastName}
                          onChange={(e) => setField('lastName', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Email</label>
                        <input
                          type="email"
                          value={formData.email}
                          readOnly
                          className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-700"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Phone Number *</label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setField('phone', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Alternate Phone</label>
                        <input
                          type="tel"
                          value={formData.alternatePhone}
                          onChange={(e) => setField('alternatePhone', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Date of Birth *</label>
                        <input
                          type="date"
                          value={formData.dateOfBirth}
                          onChange={(e) => setField('dateOfBirth', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Gender *</label>
                        <select
                          value={formData.gender}
                          onChange={(e) => setField('gender', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Marital Status *</label>
                        <select
                          value={formData.maritalStatus}
                          onChange={(e) => setField('maritalStatus', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="single">Single</option>
                          <option value="married">Married</option>
                          <option value="divorced">Divorced</option>
                          <option value="widowed">Widowed</option>
                          <option value="separated">Separated</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Nationality *</label>
                        <input
                          type="text"
                          value={formData.nationality}
                          onChange={(e) => setField('nationality', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm text-gray-700 mb-2">Full Name on ID *</label>
                        <input
                          type="text"
                          value={formData.idFullName}
                          onChange={(e) => setField('idFullName', e.target.value)}
                          placeholder="Enter exactly as shown on your ID"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">ID Type *</label>
                        <select
                          value={formData.idType}
                          onChange={(e) => setField('idType', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="national_id">National ID</option>
                          <option value="passport">Passport</option>
                          <option value="drivers_license">Driver's License</option>
                          <option value="umid">UMID</option>
                          <option value="postal_id">Postal ID</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">ID Number *</label>
                        <input
                          type="text"
                          value={formData.idNumber}
                          onChange={(e) => setField('idNumber', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-700 mb-2">Selfie *</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
                            className="block text-sm text-gray-600"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 mb-2">ID Photo *</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setIdFile(e.target.files?.[0] || null)}
                            className="block text-sm text-gray-600"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2 */}
                {step === 2 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <Home className="w-5 h-5 text-blue-600" />
                      <h4 className="text-gray-900">Address</h4>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Address Line *</label>
                      <input
                        type="text"
                        value={formData.addressLine1}
                        onChange={(e) => setField('addressLine1', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">City *</label>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => setField('city', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">State/Province *</label>
                        <input
                          type="text"
                          value={formData.state}
                          onChange={(e) => setField('state', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Zip Code *</label>
                        <input
                          type="text"
                          value={formData.zipCode}
                          onChange={(e) => setField('zipCode', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm text-gray-700 mb-2">Country *</label>
                        <input
                          type="text"
                          value={formData.country}
                          onChange={(e) => setField('country', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Residence Type *</label>
                        <select
                          value={formData.residenceType}
                          onChange={(e) => setField('residenceType', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="owned">Owned</option>
                          <option value="rented">Rented</option>
                          <option value="family">Living with Family</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Years at Residence *</label>
                        <input
                          type="number"
                          value={formData.yearsAtResidence}
                          onChange={(e) => setField('yearsAtResidence', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3 */}
                {step === 3 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-blue-600" />
                      <h4 className="text-gray-900">Employment</h4>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Employment Status *</label>
                      <select
                        value={formData.employmentStatus}
                        onChange={(e) => setField('employmentStatus', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {EMPLOYMENT_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {!NO_EMPLOYER_REQUIRED.has(formData.employmentStatus) && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-700 mb-2">Employer/Business Name *</label>
                            <input
                              type="text"
                              value={formData.employerName}
                              onChange={(e) => setField('employerName', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-700 mb-2">Job Title/Position *</label>
                            <input
                              type="text"
                              value={formData.jobTitle}
                              onChange={(e) => setField('jobTitle', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-700 mb-2">Industry Type</label>
                            <input
                              type="text"
                              value={formData.industryType}
                              onChange={(e) => setField('industryType', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-700 mb-2">Employment Duration *</label>
                            <select
                              value={formData.employmentDuration}
                              onChange={(e) => setField('employmentDuration', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">-- Select Duration --</option>
                              <option value="0-6">0-6 months</option>
                              <option value="6-12">6-12 months</option>
                              <option value="1-2">1-2 years</option>
                              <option value="2-5">2-5 years</option>
                              <option value="5+">5+ years</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm text-gray-700 mb-2">Work Address</label>
                          <textarea
                            rows={2}
                            value={formData.workAddress}
                            onChange={(e) => setField('workAddress', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm text-gray-700 mb-2">Work Phone</label>
                          <input
                            type="tel"
                            value={formData.workPhone}
                            onChange={(e) => setField('workPhone', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Step 4 */}
                {step === 4 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <PhilippinePeso className="w-5 h-5 text-blue-600" />
                      <h4 className="text-gray-900">Financial & Bank</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Monthly Income (₱) *</label>
                        <input
                          type="number"
                          value={formData.monthlyIncome}
                          onChange={(e) => setField('monthlyIncome', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Monthly Expenses (₱) *</label>
                        <input
                          type="number"
                          value={formData.monthlyExpenses}
                          onChange={(e) => setField('monthlyExpenses', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Other Income Source</label>
                        <input
                          type="text"
                          value={formData.otherIncomeSource}
                          onChange={(e) => setField('otherIncomeSource', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">Other Income Amount (₱)</label>
                        <input
                          type="number"
                          value={formData.otherIncomeAmount}
                          onChange={(e) => setField('otherIncomeAmount', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Total Existing Debts (₱)</label>
                      <input
                        type="number"
                        value={formData.existingDebts}
                        onChange={(e) => setField('existingDebts', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="border-t pt-4">
                      <h5 className="text-sm text-gray-700 mb-4">Bank Account Information</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-700 mb-2">Bank Name *</label>
                          <input
                            type="text"
                            value={formData.bankName}
                            onChange={(e) => setField('bankName', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 mb-2">Account Type *</label>
                          <select
                            value={formData.accountType}
                            onChange={(e) => setField('accountType', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="savings">Savings Account</option>
                            <option value="checking">Checking Account</option>
                            <option value="current">Current Account</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="block text-sm text-gray-700 mb-2">Account Number *</label>
                          <input
                            type="text"
                            value={formData.accountNumber}
                            onChange={(e) => setField('accountNumber', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 mb-2">Routing Number</label>
                          <input
                            type="text"
                            value={formData.routingNumber}
                            onChange={(e) => setField('routingNumber', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 5 */}
                {step === 5 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-blue-600" />
                      <h4 className="text-gray-900">References & Emergency Contact</h4>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h5 className="text-sm text-gray-700 mb-4">Reference 1</h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm text-gray-700 mb-2">Full Name *</label>
                          <input
                            type="text"
                            value={formData.reference1Name}
                            onChange={(e) => setField('reference1Name', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 mb-2">Phone Number *</label>
                          <input
                            type="tel"
                            value={formData.reference1Phone}
                            onChange={(e) => setField('reference1Phone', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 mb-2">Relationship *</label>
                          <input
                            type="text"
                            value={formData.reference1Relationship}
                            onChange={(e) => setField('reference1Relationship', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h5 className="text-sm text-gray-700 mb-4">Reference 2</h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm text-gray-700 mb-2">Full Name *</label>
                          <input
                            type="text"
                            value={formData.reference2Name}
                            onChange={(e) => setField('reference2Name', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 mb-2">Phone Number *</label>
                          <input
                            type="tel"
                            value={formData.reference2Phone}
                            onChange={(e) => setField('reference2Phone', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 mb-2">Relationship *</label>
                          <input
                            type="text"
                            value={formData.reference2Relationship}
                            onChange={(e) => setField('reference2Relationship', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h5 className="text-sm text-red-900 mb-4">Emergency Contact</h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm text-gray-700 mb-2">Full Name *</label>
                          <input
                            type="text"
                            value={formData.emergencyContactName}
                            onChange={(e) => setField('emergencyContactName', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 mb-2">Phone Number *</label>
                          <input
                            type="tel"
                            value={formData.emergencyContactPhone}
                            onChange={(e) => setField('emergencyContactPhone', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 mb-2">Relationship *</label>
                          <input
                            type="text"
                            value={formData.emergencyContactRelationship}
                            onChange={(e) => setField('emergencyContactRelationship', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {error}
                  </div>
                )}
                {message && (
                  <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                    {message}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={step === 1 || submitting}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60"
                  >
                    Back
                  </button>

                  {step < totalSteps ? (
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={submitting}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                    >
                      {submitting ? 'Submitting...' : 'Submit KYC'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
