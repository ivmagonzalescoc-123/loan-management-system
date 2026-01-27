import { useState } from 'react';
import { User } from '../App';
import { KeyRound } from 'lucide-react';
import { changeBorrowerPassword } from '../lib/api';

interface BorrowerProfileProps {
  user: User;
}

export function BorrowerProfile({ user }: BorrowerProfileProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChangePassword = async () => {
    setError(null);
    setMessage(null);

    if (!currentPassword || !newPassword) {
      setError('Please fill in all password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    try {
      await changeBorrowerPassword({ email: user.email, currentPassword, newPassword });
      setMessage('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-1">My Profile</h2>
        <p className="text-sm text-gray-600">Update your account password</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-xl">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-5 h-5 text-blue-600" />
          <h3 className="text-gray-900">Change Password</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-2">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-2">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-2">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
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
          <button
            onClick={handleChangePassword}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Update Password
          </button>
        </div>
      </div>

    </div>
  );
}
