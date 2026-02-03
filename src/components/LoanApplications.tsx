import { useState } from 'react';
import { User } from '../App';
import { Search, Eye, CheckCircle, XCircle, Clock, Plus } from 'lucide-react';
import { LoanApplication } from '../lib/types';
import { useLoanApplications } from '../lib/useApiData';
import { ApplicationDetailsModal } from './ApplicationDetailsModal';
import { LoanApplicationForm } from './LoanApplicationForm';
import { formatPhp } from '../lib/currency';

interface LoanApplicationsProps {
  user: User;
}

export function LoanApplications({ user }: LoanApplicationsProps) {
  const { data: loanApplications, refresh: refreshApplications } = useLoanApplications();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedApplication, setSelectedApplication] = useState<LoanApplication | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  const filteredApplications = loanApplications.filter(app => {
    const matchesSearch = 
      app.borrowerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.loanType.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleViewDetails = (application: LoanApplication) => {
    setSelectedApplication(application);
    setShowDetails(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const stats = [
    {
      label: 'Total Applications',
      value: loanApplications.length,
      color: 'text-blue-600'
    },
    {
      label: 'Pending',
      value: loanApplications.filter(a => a.status === 'pending').length,
      color: 'text-yellow-600'
    },
    {
      label: 'Approved',
      value: loanApplications.filter(a => a.status === 'approved').length,
      color: 'text-green-600'
    },
    {
      label: 'Rejected',
      value: loanApplications.filter(a => a.status === 'rejected').length,
      color: 'text-red-600'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900 mb-1">Loan Applications</h2>
          <p className="text-sm text-gray-600">Review and process loan applications</p>
        </div>
        <button 
          onClick={() => setShowApplicationForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Application
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">{stat.label}</div>
            <div className={`text-2xl ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by borrower, ID, or loan type..."
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
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="disbursed">Disbursed</option>
          </select>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Application ID</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Borrower</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Loan Type</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Requested Amount</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Credit Score</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Eligibility</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Application Date</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredApplications.map(app => (
                <tr key={app.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{app.id}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{app.borrowerName}</div>
                    <div className="text-xs text-gray-500">{app.borrowerId}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900 capitalize">{app.loanType}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatPhp(app.requestedAmount)}
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const score = app.currentCreditScore ?? app.creditScore;
                      return (
                        <div
                          className={`text-sm ${
                            score >= 700 ? 'text-green-600' :
                            score >= 600 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}
                        >
                          {score}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs capitalize ${
                      app.eligibilityStatus === 'eligible' ? 'bg-green-100 text-green-700' :
                      app.eligibilityStatus === 'ineligible' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {app.eligibilityStatus || 'pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{app.applicationDate}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs capitalize ${
                      app.status === 'approved' ? 'bg-green-100 text-green-700' :
                      app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      app.status === 'under_review' ? 'bg-blue-100 text-blue-700' :
                      app.status === 'disbursed' ? 'bg-purple-100 text-purple-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {getStatusIcon(app.status)}
                      {app.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => handleViewDetails(app)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showDetails && selectedApplication && (
        <ApplicationDetailsModal 
          application={selectedApplication}
          user={user}
          onClose={() => setShowDetails(false)}
          onUpdated={() => refreshApplications()}
        />
      )}

      {showApplicationForm && (
        <LoanApplicationForm
          onClose={() => setShowApplicationForm(false)}
          onSubmit={() => {
            refreshApplications();
            setShowApplicationForm(false);
          }}
        />
      )}
    </div>
  );
}