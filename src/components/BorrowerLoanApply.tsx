import { useEffect, useMemo, useState } from 'react';
import { User } from '../App';
import { createLoanApplication, getBorrowerById, getBorrowerCreditLimit } from '../lib/api';
import { formatPhp } from '../lib/currency';

interface BorrowerLoanApplyProps {
  user: User;
}

export function BorrowerLoanApply({ user }: BorrowerLoanApplyProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [availableCredit, setAvailableCredit] = useState<number | null>(null);
  const [maxCredit, setMaxCredit] = useState<number | null>(null);
  const [kycStatus, setKycStatus] = useState<string>('pending');
  const [creditScore, setCreditScore] = useState<number>(650);

  const [form, setForm] = useState({
    loanType: 'personal' as 'personal' | 'business' | 'mortgage' | 'education' | 'vehicle',
    requestedAmount: '',
    purpose: '',
    consentAcknowledged: false
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [limit, borrower] = await Promise.all([
        getBorrowerCreditLimit(user.id),
        getBorrowerById(user.id)
      ]);
      setAvailableCredit(Number(limit.availableCredit || 0));
      setMaxCredit(Number(limit.maxCredit || 0));
      setKycStatus(String(limit.kycStatus || 'pending'));
      setCreditScore(Number(borrower.creditScore || 650));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credit limit.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const canApply = useMemo(() => kycStatus === 'verified', [kycStatus]);

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);

    if (!canApply) {
      setError('KYC verification is required before applying for a loan.');
      return;
    }
    if (!form.consentAcknowledged) {
      setError('Consent acknowledgment is required.');
      return;
    }

    const requestedAmount = Number(form.requestedAmount);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      setError('Requested amount must be a valid number greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      await createLoanApplication({
        borrowerId: user.id,
        borrowerName: user.name,
        loanType: form.loanType,
        requestedAmount,
        purpose: form.purpose,
        consentAcknowledged: true,
        creditScore
      });
      setMessage('Loan application submitted.');
      setForm((prev) => ({ ...prev, requestedAmount: '', purpose: '', consentAcknowledged: false }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit loan application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-1">Apply for a Loan</h2>
        <p className="text-sm text-gray-600">Your available credit is based on your KYC financials and repayment history.</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl space-y-4">
        {loading ? (
          <div className="text-sm text-gray-500">Loading credit limit...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="text-xs text-gray-500">KYC Status</div>
                <div className="text-sm font-medium text-gray-900 capitalize">{kycStatus}</div>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="text-xs text-gray-500">Available Credit</div>
                <div className="text-lg font-semibold text-blue-900">
                  {availableCredit === null ? '—' : formatPhp(availableCredit)}
                </div>
                <div className="text-xs text-gray-500">Max: {maxCredit === null ? '—' : formatPhp(maxCredit)}</div>
              </div>
            </div>

            {!canApply && (
              <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
                Complete and get approval for KYC before you can apply.
              </div>
            )}

            {canApply ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Loan Type</label>
                  <select
                    value={form.loanType}
                    onChange={(e) => setForm((prev) => ({ ...prev, loanType: e.target.value as any }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="personal">Personal</option>
                    <option value="business">Business</option>
                    <option value="mortgage">Mortgage</option>
                    <option value="education">Education</option>
                    <option value="vehicle">Vehicle</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-2">Requested Amount</label>
                  <input
                    type="number"
                    value={form.requestedAmount}
                    onChange={(e) => setForm((prev) => ({ ...prev, requestedAmount: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-2">Purpose</label>
                  <textarea
                    value={form.purpose}
                    onChange={(e) => setForm((prev) => ({ ...prev, purpose: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Why do you need this loan?"
                  />
                </div>

                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.consentAcknowledged}
                    onChange={(e) => setForm((prev) => ({ ...prev, consentAcknowledged: e.target.checked }))}
                    className="mt-1"
                  />
                  <span>I acknowledge the privacy notice and consent to loan processing.</span>
                </label>

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

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                  >
                    {submitting ? 'Submitting...' : 'Submit Application'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">
                Loan application form is hidden until your KYC is verified.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
