import { User } from '../App';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import { useBorrowers, useLoanApplications, useLoans, usePayments } from '../lib/useApiData';

interface DashboardProps {
  user: User;
}

export function Dashboard({ user }: DashboardProps) {
  const { data: borrowers } = useBorrowers();
  const { data: loans } = useLoans();
  const { data: loanApplications } = useLoanApplications();
  const { data: payments } = usePayments();

  // Calculate statistics
  const totalBorrowers = borrowers.filter(b => b.status === 'active').length;
  const totalActiveLoans = loans.filter(l => l.status === 'active').length;
  const totalOutstanding = loans
    .filter(l => l.status === 'active')
    .reduce((sum, loan) => sum + loan.outstandingBalance, 0);
  const totalDisbursed = loans.reduce((sum, loan) => sum + loan.principalAmount, 0);
  
  const pendingApplications = loanApplications.filter(a => a.status === 'pending').length;
  const approvedApplications = loanApplications.filter(a => a.status === 'approved').length;
  const rejectedApplications = loanApplications.filter(a => a.status === 'rejected').length;

  const recentPayments = payments.slice(0, 5);
  const recentApplications = loanApplications.slice(0, 5);

  const stats = [
    {
      label: 'Active Borrowers',
      value: totalBorrowers.toString(),
      icon: Users,
      color: 'bg-blue-500',
      change: '+12% from last month'
    },
    {
      label: 'Active Loans',
      value: totalActiveLoans.toString(),
      icon: TrendingUp,
      color: 'bg-green-500',
      change: '+8% from last month'
    },
    {
      label: 'Total Outstanding',
      value: `$${totalOutstanding.toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-purple-500',
      change: '-5% from last month'
    },
    {
      label: 'Total Disbursed',
      value: `$${totalDisbursed.toLocaleString()}`,
      icon: CheckCircle,
      color: 'bg-orange-500',
      change: '+15% from last month'
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-gray-900 mb-2">Dashboard</h2>
        <p className="text-gray-600">Welcome back, {user.name}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="text-2xl text-gray-900 mb-1">{stat.value}</div>
              <div className="text-sm text-gray-600 mb-2">{stat.label}</div>
              <div className="text-xs text-gray-500">{stat.change}</div>
            </div>
          );
        })}
      </div>

      {/* Application Status Overview */}
      {(user.role === 'admin' || user.role === 'loan_officer') && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-gray-900 mb-4">Application Status Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-4 p-4 bg-yellow-50 rounded-lg">
              <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">{pendingApplications}</div>
                <div className="text-sm text-gray-600">Pending Review</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg">
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">{approvedApplications}</div>
                <div className="text-sm text-gray-600">Approved</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-red-50 rounded-lg">
              <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
                <XCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl text-gray-900">{rejectedApplications}</div>
                <div className="text-sm text-gray-600">Rejected</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Applications */}
        {(user.role === 'admin' || user.role === 'loan_officer') && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-gray-900 mb-4">Recent Applications</h3>
            <div className="space-y-3">
              {recentApplications.map(app => (
                <div key={app.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="text-sm text-gray-900">{app.borrowerName}</div>
                    <div className="text-xs text-gray-500 capitalize">{app.loanType} - ${app.requestedAmount.toLocaleString()}</div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    app.status === 'approved' ? 'bg-green-100 text-green-700' :
                    app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    app.status === 'under_review' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {app.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Payments */}
        {(user.role === 'admin' || user.role === 'cashier') && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-gray-900 mb-4">Recent Payments</h3>
            <div className="space-y-3">
              {recentPayments.map(payment => (
                <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="text-sm text-gray-900">{payment.borrowerName}</div>
                    <div className="text-xs text-gray-500">{payment.paymentDate}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-900">${payment.amount.toLocaleString()}</div>
                    <span className={`text-xs ${
                      payment.status === 'paid' ? 'text-green-600' :
                      payment.status === 'late' ? 'text-red-600' :
                      'text-yellow-600'
                    }`}>
                      {payment.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Alerts */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-orange-500" />
          <h3 className="text-gray-900">Alerts & Notifications</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
            <div>
              <div className="text-sm text-gray-900">2 loans approaching due date</div>
              <div className="text-xs text-gray-500">Payments due within 3 days</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
            <Clock className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <div className="text-sm text-gray-900">{pendingApplications} applications pending review</div>
              <div className="text-xs text-gray-500">Action required from loan officers</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
