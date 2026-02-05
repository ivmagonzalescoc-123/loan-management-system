import { useState } from 'react';
import { User } from '../App';
import { Search, Plus, Eye, Edit, TrendingUp, TrendingDown, KeyRound, Printer } from 'lucide-react';
import { Borrower } from '../lib/types';
import { useBorrowers, useLoans } from '../lib/useApiData';
import { formatPhp } from '../lib/currency';
import { BorrowerDetailsModal } from './BorrowerDetailsModal';
import { AddBorrowerForm } from './AddBorrowerForm';
import { resetBorrowerPassword, updateBorrower } from '../lib/api';
import { printBorrowerRegistrationForm } from '../lib/printBorrowerRegistrationForm';

interface BorrowerManagementProps {
  user: User;
}

export function BorrowerManagement({ user }: BorrowerManagementProps) {
  const { data: borrowers, refresh: refreshBorrowers } = useBorrowers();
  const { data: loans } = useLoans();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBorrower, setSelectedBorrower] = useState<Borrower | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showAddBorrowerForm, setShowAddBorrowerForm] = useState(false);
  const [showEditBorrowerForm, setShowEditBorrowerForm] = useState(false);
  const [editingBorrower, setEditingBorrower] = useState<Borrower | null>(null);
  const [resetInfo, setResetInfo] = useState<{ email: string; password: string } | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    employment: '',
    monthlyIncome: '',
    bankName: '',
    accountNumber: '',
    accountType: 'savings',
    routingNumber: '',
    status: 'active'
  });

  const canEditBorrower = user.role === 'admin' || user.role === 'manager' || user.role === 'loan_officer';

  const filteredBorrowers = borrowers.filter(borrower => {
    const matchesSearch = 
      borrower.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      borrower.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      borrower.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      borrower.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || borrower.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getCreditScoreColor = (score: number) => {
    if (score >= 700) return 'text-green-600';
    if (score >= 600) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCreditScoreLabel = (score: number) => {
    if (score >= 750) return 'Excellent';
    if (score >= 700) return 'Good';
    if (score >= 650) return 'Fair';
    if (score >= 600) return 'Poor';
    return 'Very Poor';
  };

  const handleViewDetails = (borrower: Borrower) => {
    setSelectedBorrower(borrower);
    setShowDetails(true);
  };

  const handleEditBorrower = (borrower: Borrower) => {
    setEditingBorrower(borrower);
    setEditForm({
      firstName: borrower.firstName,
      lastName: borrower.lastName,
      email: borrower.email,
      phone: borrower.phone,
      address: borrower.address,
      employment: borrower.employment,
      monthlyIncome: borrower.monthlyIncome.toString(),
      bankName: borrower.bankName || '',
      accountNumber: borrower.accountNumber || '',
      accountType: borrower.accountType || 'savings',
      routingNumber: borrower.routingNumber || '',
      status: borrower.status
    });
    setShowEditBorrowerForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900 mb-1">Borrower Management</h2>
          <p className="text-sm text-gray-600">Manage borrower information and credit profiles</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => printBorrowerRegistrationForm()}
            className="px-4 py-2 bg-white text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            title="Print a blank registration form for physical filling"
          >
            <Printer className="w-4 h-4" />
            Print Registration Form
          </button>
          <button
            type="button"
            onClick={() => setShowAddBorrowerForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Borrower
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="blacklisted">Blacklisted</option>
          </select>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Total Borrowers</div>
          <div className="text-2xl text-gray-900">{borrowers.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Active Borrowers</div>
          <div className="text-2xl text-gray-900">{borrowers.filter(b => b.status === 'active').length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600 mb-1">Average Credit Score</div>
          <div className="text-2xl text-gray-900">
            {borrowers.length > 0
              ? Math.round(borrowers.reduce((sum, b) => sum + b.creditScore, 0) / borrowers.length)
              : 0}
          </div>
        </div>
      </div>

      {/* Borrowers Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Borrower ID</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Employment</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Monthly Income</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Credit Score</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredBorrowers.map(borrower => (
                <tr key={borrower.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{borrower.id}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{borrower.firstName} {borrower.lastName}</div>
                    <div className="text-xs text-gray-500">Joined {borrower.registrationDate}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{borrower.email}</div>
                    <div className="text-xs text-gray-500">{borrower.phone}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{borrower.employment}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{formatPhp(borrower.monthlyIncome)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-lg ${getCreditScoreColor(borrower.creditScore)}`}>
                        {borrower.creditScore}
                      </span>
                      {borrower.creditScore >= 700 ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <div className={`text-xs ${getCreditScoreColor(borrower.creditScore)}`}>
                      {getCreditScoreLabel(borrower.creditScore)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs capitalize ${
                      borrower.status === 'active' ? 'bg-green-100 text-green-700' :
                      borrower.status === 'inactive' ? 'bg-gray-100 text-gray-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {borrower.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleViewDetails(borrower)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canEditBorrower && (
                        <button 
                          onClick={() => handleEditBorrower(borrower)}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showDetails && selectedBorrower && (
        <BorrowerDetailsModal 
          borrower={selectedBorrower}
          loanStats={{
            total: loans.filter(loan => loan.borrowerId === selectedBorrower.id).length,
            active: loans.filter(loan => loan.borrowerId === selectedBorrower.id && loan.status === 'active').length,
            totalBorrowed: loans
              .filter(loan => loan.borrowerId === selectedBorrower.id)
              .reduce((sum, loan) => sum + Number(loan.principalAmount || 0), 0)
          }}
          onClose={() => setShowDetails(false)}
        />
      )}

      {showAddBorrowerForm && (
        <AddBorrowerForm
          onClose={() => setShowAddBorrowerForm(false)}
          onSubmit={() => {
            refreshBorrowers();
            setShowAddBorrowerForm(false);
          }}
        />
      )}

      {showEditBorrowerForm && editingBorrower && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-gray-900">Edit Borrower</h3>
              <p className="text-sm text-gray-600 mt-1">{editingBorrower.id}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">First Name</label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Last Name</label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Phone</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Address</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Employment</label>
                <input
                  type="text"
                  value={editForm.employment}
                  onChange={(e) => setEditForm(prev => ({ ...prev, employment: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Monthly Income</label>
                  <input
                    type="number"
                    value={editForm.monthlyIncome}
                    onChange={(e) => setEditForm(prev => ({ ...prev, monthlyIncome: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="blacklisted">Blacklisted</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Bank Name</label>
                  <input
                    type="text"
                    value={editForm.bankName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, bankName: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Account Number</label>
                  <input
                    type="text"
                    value={editForm.accountNumber}
                    onChange={(e) => setEditForm(prev => ({ ...prev, accountNumber: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Account Type</label>
                  <select
                    value={editForm.accountType}
                    onChange={(e) => setEditForm(prev => ({ ...prev, accountType: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="savings">Savings</option>
                    <option value="checking">Checking</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Routing Number</label>
                  <input
                    type="text"
                    value={editForm.routingNumber}
                    onChange={(e) => setEditForm(prev => ({ ...prev, routingNumber: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowEditBorrowerForm(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!editingBorrower) return;
                  const result = await resetBorrowerPassword(editingBorrower.email);
                  setResetInfo({ email: editingBorrower.email, password: result.tempPassword });
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <KeyRound className="w-4 h-4" />
                Reset Password
              </button>
              <button
                onClick={async () => {
                  if (!editingBorrower) return;
                  await updateBorrower(editingBorrower.id, {
                    firstName: editForm.firstName,
                    lastName: editForm.lastName,
                    email: editForm.email,
                    phone: editForm.phone,
                    address: editForm.address,
                    employment: editForm.employment,
                    monthlyIncome: editForm.monthlyIncome ? parseFloat(editForm.monthlyIncome) : undefined,
                    bankName: editForm.bankName || undefined,
                    accountNumber: editForm.accountNumber || undefined,
                    accountType: editForm.accountType || undefined,
                    routingNumber: editForm.routingNumber || undefined,
                    status: editForm.status as Borrower['status']
                  });
                  refreshBorrowers();
                  setShowEditBorrowerForm(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Changes
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