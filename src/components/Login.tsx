import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { User } from '../App';
import { loginUser, registerBorrower } from '../lib/api';
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
              onClick={() => setShowForgotPassword(true)}
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
            <p className="text-sm text-gray-600 mb-4">Contact your local administrator to change your password.</p>
          </div>
        </div>
      )}
    </div>
  );
}
