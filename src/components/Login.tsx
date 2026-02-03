import { useState } from 'react';
import { User } from '../App';
import { Shield } from 'lucide-react';
import { loginUser } from '../lib/api';
import logoUrl from '../../logo.png';

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
      style={{ backgroundColor: 'var(--forest-700)' }}
    >
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-6 overflow-hidden">
          <img src={logoUrl} alt="Loan Management System logo" className="w-10 h-10 object-contain" />
        </div>
        
        <h2 className="text-center text-gray-900 mb-2">Gonzales LMS</h2>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="enter your email"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            className="text-sm text-green-700 hover:text-green-800 text-left"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 login-forgot-modal">
          <div className="bg-white rounded-xl shadow-xl modal-inner p-4">
            <h3 className="text-gray-900 mb-2">Forgot Password</h3>
            <p className="text-sm text-gray-600 mb-4">
              Contact your administrator to change your password.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="btn-forest py-2 rounded-lg w-full"
                style={{ backgroundColor: 'var(--forest-700)', color: '#fff' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
