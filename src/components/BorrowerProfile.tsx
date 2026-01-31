import { useEffect, useState, type ChangeEvent } from 'react';
import { User } from '../App';
import { KeyRound } from 'lucide-react';
import { changeBorrowerPassword, getBorrowerById, updateBorrower } from '../lib/api';

interface BorrowerProfileProps {
  user: User;
  initialTab?: 'details' | 'security';
  onProfileUpdated?: (updates: Partial<User>) => void;
}

export function BorrowerProfile({ user, initialTab = 'details', onProfileUpdated }: BorrowerProfileProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'security'>(initialTab);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBorrower = async () => {
      setLoading(true);
      try {
        const borrower = await getBorrowerById(user.id);
        setFirstName(borrower.firstName || '');
        setLastName(borrower.lastName || '');
        setEmail(borrower.email || '');
        setPhone(borrower.phone || '');
        setDateOfBirth(borrower.dateOfBirth || '');
        setAddress(borrower.address || '');
        setProfileImage(borrower.profileImage || '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };

    void loadBorrower();
  }, [user.id]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleSaveDetails = async () => {
    setError(null);
    setMessage(null);

    if (!firstName || !lastName || !email) {
      setError('First name, last name, and email are required.');
      return;
    }

    try {
      await updateBorrower(user.id, {
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        address: address || undefined,
        dateOfBirth: dateOfBirth || undefined,
        profileImage: profileImage || undefined
      });
      setMessage('Profile updated successfully.');
      onProfileUpdated?.({
        name: `${firstName} ${lastName}`.trim(),
        email,
        profileImage: profileImage || undefined
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    }
  };

  const handleProfileImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }
    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      setError('Profile photo must be smaller than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setProfileImage(result);
    };
    reader.readAsDataURL(file);
  };

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

      <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl">
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 rounded-lg text-sm ${
              activeTab === 'details' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Personal Details
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 rounded-lg text-sm ${
              activeTab === 'security' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Password Settings
          </button>
        </div>

        {activeTab === 'details' && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-sm text-gray-500">Loading profile...</div>
            ) : (
              <>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Profile Photo</label>
                  <div className="flex items-center gap-4">
                    {profileImage ? (
                      <img
                        src={profileImage}
                        alt={`${firstName} ${lastName}`}
                        className="w-16 h-16 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                        No photo
                      </div>
                    )}
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfileImageChange}
                        className="block text-sm text-gray-600"
                      />
                      {profileImage && (
                        <button
                          type="button"
                          onClick={() => setProfileImage('')}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Remove photo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-2">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-2">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-2">Phone</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-2">Date of Birth</label>
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
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
                  onClick={handleSaveDetails}
                  className="w-full bg-gray-900 text-white py-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Save Details
                </button>
              </>
            )}
          </div>
        )}

        {activeTab === 'security' && (
          <>
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
          </>
        )}
      </div>

    </div>
  );
}
