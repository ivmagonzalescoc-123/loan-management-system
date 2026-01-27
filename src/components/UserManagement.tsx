import { useState } from 'react';
import { User } from '../App';
import { Search, Users, Plus, Edit, Archive, KeyRound } from 'lucide-react';
import { useUsers } from '../lib/useApiData';
import { AppUser } from '../lib/types';
import { createUser, updateUser } from '../lib/api';

interface UserManagementProps {
  user: User;
}

export function UserManagement({ user }: UserManagementProps) {
  const { data: users, refresh } = useUsers();
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [resetInfo, setResetInfo] = useState<{ email: string; password: string } | null>(null);
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    password: '',
    role: 'cashier' as AppUser['role'],
    status: 'active' as NonNullable<AppUser['status']>
  });

  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase();
    return (
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term)
    );
  });

  const openCreate = () => {
    setEditingUser(null);
    setFormState({ name: '', email: '', password: '', role: 'cashier', status: 'active' });
    setShowForm(true);
  };

  const openEdit = (u: AppUser) => {
    setEditingUser(u);
    setFormState({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      status: (u.status || 'active') as NonNullable<AppUser['status']>
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formState.name || !formState.email) return;

    if (editingUser) {
      await updateUser(editingUser.id, {
        name: formState.name,
        email: formState.email,
        password: formState.password || undefined,
        role: formState.role,
        status: formState.status
      });
    } else {
      if (!formState.password) return;
      await createUser({
        name: formState.name,
        email: formState.email,
        password: formState.password,
        role: formState.role,
        status: formState.status
      });
    }

    refresh();
    setShowForm(false);
  };

  const handleArchive = async (u: AppUser) => {
    if (u.status === 'archived') return;
    await updateUser(u.id, {
      status: 'archived',
      archivedAt: new Date().toISOString()
    });
    refresh();
  };

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleResetPassword = async (u: AppUser) => {
    const tempPassword = generateTempPassword();
    await updateUser(u.id, { password: tempPassword });
    setResetInfo({ email: u.email, password: tempPassword });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900 mb-1">User Management</h2>
          <p className="text-sm text-gray-600">Manage system users and roles</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create User
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{u.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700 capitalize">
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs capitalize ${
                      u.status === 'archived' ? 'bg-gray-200 text-gray-700' :
                      u.status === 'inactive' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {u.status || 'active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleResetPassword(u)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Reset Password"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleArchive(u)}
                        disabled={u.status === 'archived'}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="Archive"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="p-6 text-sm text-gray-500 flex items-center gap-2">
            <Users className="w-4 h-4" />
            No users found.
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-gray-900">{editingUser ? 'Edit User' : 'Create User'}</h3>
              <p className="text-sm text-gray-600 mt-1">Manage account details and role</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formState.email}
                  onChange={(e) => setFormState(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={formState.password}
                  onChange={(e) => setFormState(prev => ({ ...prev, password: e.target.value }))}
                  placeholder={editingUser ? 'Leave blank to keep current' : 'Set initial password'}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Role</label>
                  <select
                    value={formState.role}
                    onChange={(e) => setFormState(prev => ({ ...prev, role: e.target.value as AppUser['role'] }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="admin">Admin</option>
                    <option value="loan_officer">Loan Officer</option>
                    <option value="cashier">Cashier</option>
                    <option value="borrower">Borrower</option>
                    <option value="auditor">Auditor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Status</label>
                  <select
                    value={formState.status}
                    onChange={(e) => setFormState(prev => ({ ...prev, status: e.target.value as NonNullable<AppUser['status']> }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingUser ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-gray-900">Temporary Password</h3>
              <p className="text-sm text-gray-600 mt-1">Share this with the borrower</p>
            </div>
            <div className="p-6 space-y-3">
              <div className="text-sm text-gray-700">Email</div>
              <div className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                {resetInfo.email}
              </div>
              <div className="text-sm text-gray-700">Temporary Password</div>
              <div className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                {resetInfo.password}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setResetInfo(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
