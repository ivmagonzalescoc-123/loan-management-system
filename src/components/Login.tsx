import { useState } from 'react';
import { User } from '../App';
import { Mail, Lock } from 'lucide-react';
import { loginUser } from '../lib/api';
import logoUrl from '../../logo.png';

const COMPANY_NAME = import.meta.env.VITE_COMPANY_NAME || 'GLMS Inc';

interface LoginProps {
  onLogin: (user: User) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

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

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#ffffff' }}
    >
      <div className="bg-gray-10 rounded-2xl shadow-xl login-card-shadow p-8 w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full overflow-hidden shrink-0">
            <img src={logoUrl} alt="Loan Management System logo" className="w-11 h-11 object-contain" />
          </div>
          <h2 className="text-gray-900">{COMPANY_NAME}</h2>
        </div>

        <div className="space-y-4 mb-6">
          <div>
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
          </div>
          <div>
            <div className="login-input-wrap">
              <Lock className="login-input-icon" size={18} aria-hidden="true" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                aria-label="Password"
                className="w-full py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 login-input"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            className="text-sm text-green-700 text-center w-full mb-2 login-no-hover"
          >
            Forgot password?
          </button>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full btn-forest py-3 rounded-lg transition-colors disabled:opacity-60"
          style={{ backgroundColor: 'var(--forest-700)', color: '#fff' }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </div>
      {showForgotPassword && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 login-forgot-modal"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowForgotPassword(false);
          }}
        >
          <div className="bg-white rounded-xl shadow-xl modal-inner p-4">
            <p className="text-sm text-gray-600 mb-4">
              Contact your local administrator to change your password.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
