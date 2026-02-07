import { useEffect, useState } from 'react';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { User } from '../App';
import { loginUser, registerBorrower, requestPasswordResetOtp, resetPasswordWithOtpToken, verifyPasswordResetOtp } from '../lib/api';
import { PrivacyNoticeModal } from './PrivacyNoticeModal';
import logoUrl from '../../logo.png';

const COMPANY_NAME = import.meta.env.VITE_COMPANY_NAME || 'GLMS Inc';

const PASSWORD_POLICY = {
  minLength: 8,
  requireUpper: true,
  requireLower: true,
  requireNumber: true,
  requireSpecial: true
};

const validatePasswordPolicy = (password: string) => {
  if (typeof password !== 'string' || !password) return 'Password is required.';
  if (password.length < PASSWORD_POLICY.minLength) {
    return `Password must be at least ${PASSWORD_POLICY.minLength} characters.`;
  }
  if (PASSWORD_POLICY.requireUpper && !/[A-Z]/.test(password)) {
    return 'Password must include at least 1 uppercase letter.';
  }
  if (PASSWORD_POLICY.requireLower && !/[a-z]/.test(password)) {
    return 'Password must include at least 1 lowercase letter.';
  }
  if (PASSWORD_POLICY.requireNumber && !/\d/.test(password)) {
    return 'Password must include at least 1 number.';
  }
  if (PASSWORD_POLICY.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include at least 1 special character.';
  }
  return null;
};

interface LoginProps {
  onLogin: (user: User) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);

  const [forgotStep, setForgotStep] = useState<'request' | 'verify' | 'reset' | 'done'>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotEmailMasked, setForgotEmailMasked] = useState<string | null>(null);
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotInlineOtp, setForgotInlineOtp] = useState<string | null>(null);
  const [forgotResetToken, setForgotResetToken] = useState<string | null>(null);
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    if (forgotStep !== 'verify') return;
    if (!forgotInlineOtp) return;
    if (forgotOtp && forgotOtp.trim().length > 0) return;
    setForgotOtp(forgotInlineOtp);
  }, [forgotInlineOtp, forgotOtp, forgotStep]);

  const resetForgotState = (seedEmail?: string) => {
    const seeded = (seedEmail ?? email ?? '').trim();
    setForgotStep('request');
    setForgotEmail(seeded);
    setForgotEmailMasked(null);
    setForgotOtp('');
    setForgotInlineOtp(null);
    setForgotResetToken(null);
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setShowForgotNewPassword(false);
    setShowForgotConfirmPassword(false);
    setForgotError(null);
    setForgotLoading(false);
  };

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const user = await loginUser({ email, password });
      onLogin(user as User);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!firstName.trim() || !lastName.trim() || !phone.trim() || !email.trim() || !password) {
        throw new Error('Please complete all required fields.');
      }

      const passwordError = validatePasswordPolicy(password);
      if (passwordError) {
        throw new Error(passwordError);
      }

      if (password !== confirmPassword) {
        throw new Error('Passwords do not match.');
      }
      if (!consentGiven) {
        throw new Error('Consent is required to create an account.');
      }

      const user = await registerBorrower({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        consentGiven
      });
      onLogin(user as User);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#ffffff' }}>
      <div className="bg-gray-10 rounded-2xl shadow-xl login-card-shadow p-8 w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full overflow-hidden shrink-0">
            <img src={logoUrl} alt="Loan Management System logo" className="w-11 h-11 object-contain" />
          </div>
          <h2 className="text-gray-900">{COMPANY_NAME}</h2>
        </div>

        <div className="space-y-4 mb-6">
          {mode === 'register' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    aria-label="First name"
                    className="w-full py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 px-3"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    aria-label="Last name"
                    className="w-full py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 px-3"
                  />
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone"
                  aria-label="Phone"
                  className="w-full py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 px-3"
                />
              </div>
            </>
          )}

          <div className="login-input-wrap">
            <Mail className="login-input-icon" size={18} aria-hidden="true" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              aria-label="Email"
              className="w-full py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 login-input"
            />
          </div>

          <div className="login-input-wrap">
            <Lock className="login-input-icon" size={18} aria-hidden="true" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              aria-label="Password"
              className="w-full py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 login-input login-input--toggle"
            />
            <button
              type="button"
              className="login-input-toggle"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>

          {mode === 'register' && (
            <div className="login-input-wrap">
              <Lock className="login-input-icon" size={18} aria-hidden="true" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                aria-label="Confirm password"
                className="w-full py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 login-input login-input--toggle"
              />
              <button
                type="button"
                className="login-input-toggle"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                onClick={() => setShowConfirmPassword((v) => !v)}
              >
                {showConfirmPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          )}

          {mode === 'register' ? (
            <div className="flex items-start gap-3">
              <input
                id="consent"
                name="consent"
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => {
                  if (e.target.checked) {
                    setShowPrivacyNotice(true);
                    return;
                  }
                  setConsentGiven(false);
                }}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="text-sm text-gray-700">
                <div>
                  I acknowledge and agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setShowPrivacyNotice(true)}
                    className="text-green-700 hover:underline"
                  >
                    Privacy & Consent
                  </button>
                  .
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                resetForgotState();
                setShowForgotPassword(true);
              }}
              className="text-sm text-green-700 text-center w-full mb-2 login-no-hover"
            >
              Forgot password?
            </button>
          )}

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
        </div>

        <button
          onClick={mode === 'login' ? handleLogin : handleRegister}
          disabled={loading}
          className="w-full btn-forest py-3 rounded-lg transition-colors disabled:opacity-60"
          style={{ backgroundColor: 'var(--forest-700)', color: '#fff' }}
        >
          {loading
            ? mode === 'login'
              ? 'Signing in...'
              : 'Creating account...'
            : mode === 'login'
              ? 'Sign In'
              : 'Create Account'}
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setError(null);
            setMode((prev) => (prev === 'login' ? 'register' : 'login'));
            setConsentGiven(false);
            setShowPassword(false);
            setShowConfirmPassword(false);
          }}
          className="text-sm text-green-700 text-center w-full mt-3 login-no-hover disabled:opacity-60"
        >
          {mode === 'login' ? 'Create Account' : 'Back to sign in'}
        </button>
      </div>

      <PrivacyNoticeModal
        open={showPrivacyNotice}
        onClose={() => setShowPrivacyNotice(false)}
        requireScrollToBottom
        onAcknowledge={() => {
          setConsentGiven(true);
          setShowPrivacyNotice(false);
        }}
      />

      {showForgotPassword && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 login-forgot-modal"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowForgotPassword(false);
          }}
        >
          <div className="bg-white rounded-xl shadow-xl modal-inner p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-gray-900 font-semibold">Reset password</div>
              <button
                type="button"
                className="text-sm text-gray-600 hover:text-gray-900"
                onClick={() => setShowForgotPassword(false)}
                disabled={forgotLoading}
              >
                Close
              </button>
            </div>

            {forgotStep === 'request' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Enter your email. We’ll send a 6-digit OTP code.
                </p>

                <div className="login-input-wrap">
                  <Mail className="login-input-icon" size={18} aria-hidden="true" />
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="Enter your email"
                    aria-label="Email"
                    className="w-full py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 login-input"
                  />
                </div>

                {forgotError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {forgotError}
                  </div>
                )}

                <button
                  type="button"
                  disabled={forgotLoading}
                  className="w-full btn-forest py-2 rounded-lg transition-colors disabled:opacity-60"
                  style={{ backgroundColor: 'var(--forest-700)', color: '#fff' }}
                  onClick={async () => {
                    setForgotError(null);
                    setForgotLoading(true);
                    try {
                      const response = await requestPasswordResetOtp(forgotEmail.trim().toLowerCase());
                      setForgotEmailMasked(response.emailMasked || null);
                      if (response.otp) {
                        setForgotInlineOtp(response.otp);
                        setForgotOtp(response.otp);
                      }
                      setForgotStep('verify');
                    } catch (err) {
                      setForgotError(err instanceof Error ? err.message : 'Failed to send OTP');
                    } finally {
                      setForgotLoading(false);
                    }
                  }}
                >
                  {forgotLoading ? 'Sending OTP…' : 'Send OTP'}
                </button>
              </div>
            )}

            {forgotStep === 'verify' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Enter the OTP sent to <span className="font-medium text-gray-800">{forgotEmailMasked || forgotEmail}</span>.
                </p>


                <input
                  type="text"
                  inputMode="numeric"
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value)}
                  maxLength={6}
                  placeholder="6-digit OTP"
                  aria-label="OTP"
                  className="w-full py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 px-3"
                />

                {forgotError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {forgotError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={forgotLoading}
                    className="w-full py-2 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-60"
                    onClick={() => {
                      resetForgotState(forgotEmail);
                    }}
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    disabled={forgotLoading}
                    className="w-full btn-forest py-2 rounded-lg transition-colors disabled:opacity-60"
                    style={{ backgroundColor: 'var(--forest-700)', color: '#fff' }}
                    onClick={async () => {
                      setForgotError(null);
                      setForgotLoading(true);
                      try {
                        const response = await verifyPasswordResetOtp(
                          forgotEmail.trim().toLowerCase(),
                          forgotOtp.trim()
                        );
                        setForgotEmailMasked(response.emailMasked || forgotEmailMasked);
                        setForgotResetToken(response.resetToken);
                        setForgotStep('reset');
                      } catch (err) {
                        setForgotError(err instanceof Error ? err.message : 'OTP verification failed');
                      } finally {
                        setForgotLoading(false);
                      }
                    }}
                  >
                    {forgotLoading ? 'Verifying…' : 'Verify'}
                  </button>
                </div>

                <button
                  type="button"
                  disabled={forgotLoading}
                  className="text-sm text-green-700 text-center w-full login-no-hover disabled:opacity-60"
                  onClick={async () => {
                    setForgotError(null);
                    setForgotLoading(true);
                    try {
                      const response = await requestPasswordResetOtp(forgotEmail.trim().toLowerCase());
                      setForgotEmailMasked(response.emailMasked || null);
                      setForgotOtp('');
                      setForgotInlineOtp(response.otp || null);
                      if (response.otp) setForgotOtp(response.otp);
                    } catch (err) {
                      setForgotError(err instanceof Error ? err.message : 'Failed to resend OTP');
                    } finally {
                      setForgotLoading(false);
                    }
                  }}
                >
                  Resend OTP
                </button>
              </div>
            )}

            {forgotStep === 'reset' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Set a new password for <span className="font-medium text-gray-800">{forgotEmailMasked || forgotEmail}</span>.
                </p>

                <div className="login-input-wrap">
                  <Lock className="login-input-icon" size={18} aria-hidden="true" />
                  <input
                    type={showForgotNewPassword ? 'text' : 'password'}
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    placeholder="New password"
                    aria-label="New password"
                    className="w-full py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 login-input login-input--toggle"
                  />
                  <button
                    type="button"
                    className="login-input-toggle"
                    aria-label={showForgotNewPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowForgotNewPassword((v) => !v)}
                  >
                    {showForgotNewPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>

                <div className="login-input-wrap">
                  <Lock className="login-input-icon" size={18} aria-hidden="true" />
                  <input
                    type={showForgotConfirmPassword ? 'text' : 'password'}
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    aria-label="Confirm new password"
                    className="w-full py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 login-input login-input--toggle"
                  />
                  <button
                    type="button"
                    className="login-input-toggle"
                    aria-label={showForgotConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    onClick={() => setShowForgotConfirmPassword((v) => !v)}
                  >
                    {showForgotConfirmPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>

                {forgotError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {forgotError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={forgotLoading}
                    className="w-full py-2 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-60"
                    onClick={() => {
                      setForgotError(null);
                      setForgotStep('verify');
                    }}
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    disabled={forgotLoading}
                    className="w-full btn-forest py-2 rounded-lg transition-colors disabled:opacity-60"
                    style={{ backgroundColor: 'var(--forest-700)', color: '#fff' }}
                    onClick={async () => {
                      setForgotError(null);
                      const policyError = validatePasswordPolicy(forgotNewPassword);
                      if (policyError) {
                        setForgotError(policyError);
                        return;
                      }
                      if (forgotNewPassword !== forgotConfirmPassword) {
                        setForgotError('Passwords do not match.');
                        return;
                      }
                      if (!forgotResetToken) {
                        setForgotError('Reset token missing. Please verify OTP again.');
                        setForgotStep('verify');
                        return;
                      }

                      setForgotLoading(true);
                      try {
                        await resetPasswordWithOtpToken(
                          forgotEmail.trim().toLowerCase(),
                          forgotResetToken,
                          forgotNewPassword
                        );
                        setForgotStep('done');
                      } catch (err) {
                        setForgotError(err instanceof Error ? err.message : 'Password reset failed');
                      } finally {
                        setForgotLoading(false);
                      }
                    }}
                  >
                    {forgotLoading ? 'Saving…' : 'Reset password'}
                  </button>
                </div>
              </div>
            )}

            {forgotStep === 'done' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-700">Password updated. You can now sign in.</p>
                <button
                  type="button"
                  className="w-full btn-forest py-2 rounded-lg transition-colors"
                  style={{ backgroundColor: 'var(--forest-700)', color: '#fff' }}
                  onClick={() => {
                    setShowForgotPassword(false);
                  }}
                >
                  Back to sign in
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
