import { useState } from 'react';
import { User } from '../App';
import { BarChart3, PieChart, TrendingUp, Download, Calendar, Shield } from 'lucide-react';
import { useAuditLogs, useBorrowers, useLoanApplications, useLoans, usePayments } from '../lib/useApiData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, LineChart, Line } from 'recharts';

interface ReportsProps {
  user: User;
}

export function Reports({ user }: ReportsProps) {
  const { data: loans } = useLoans();
  const { data: borrowers } = useBorrowers();
  const { data: loanApplications } = useLoanApplications();
  const { data: payments } = usePayments();
  const { data: auditLogs } = useAuditLogs();
  const [selectedReport, setSelectedReport] = useState<'portfolio' | 'delinquency' | 'audit'>('portfolio');
  const [dateRange, setDateRange] = useState('month');

  // Portfolio Analysis
  const loansByType = loans.reduce((acc, loan) => {
    acc[loan.loanType] = (acc[loan.loanType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const portfolioData = Object.entries(loansByType).map(([type, count]) => ({
    name: type,
    count
  }));

  const loansByStatus = loans.reduce((acc, loan) => {
    acc[loan.status] = (acc[loan.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusData = Object.entries(loansByStatus).map(([status, count]) => ({
    name: status,
    value: count
  }));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  // Delinquency Analysis
  const delinquencyBuckets = [
    { range: '0-30 days', min: 1, max: 30 },
    { range: '31-60 days', min: 31, max: 60 },
    { range: '61-90 days', min: 61, max: 90 },
    { range: '90+ days', min: 91, max: Number.POSITIVE_INFINITY }
  ];

  const delinquencyData = delinquencyBuckets.map(bucket => {
    const overdueLoans = loans.filter(loan => {
      if (loan.status !== 'active') return false;
      const dueDate = new Date(loan.nextDueDate);
      const today = new Date();
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue <= 0) return false;
      return daysOverdue >= bucket.min && daysOverdue <= bucket.max;
    });

    return {
      range: bucket.range,
      count: overdueLoans.length,
      amount: overdueLoans.reduce((sum, loan) => sum + loan.outstandingBalance, 0)
    };
  });

  const buildMonthlyTrend = () => {
    const months: { key: string; label: string; disbursed: number; collected: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleString('en-US', { month: 'short' });
      months.push({ key, label, disbursed: 0, collected: 0 });
    }

    loans.forEach(loan => {
      const disbursedDate = new Date(loan.disbursedDate);
      const key = `${disbursedDate.getFullYear()}-${String(disbursedDate.getMonth() + 1).padStart(2, '0')}`;
      const entry = months.find(m => m.key === key);
      if (entry) entry.disbursed += loan.principalAmount;
    });

    payments.forEach(payment => {
      const paidDate = new Date(payment.paymentDate);
      const key = `${paidDate.getFullYear()}-${String(paidDate.getMonth() + 1).padStart(2, '0')}`;
      const entry = months.find(m => m.key === key);
      if (entry) entry.collected += payment.amount;
    });

    return months.map(m => ({ month: m.label, disbursed: m.disbursed, collected: m.collected }));
  };

  const monthlyTrend = buildMonthlyTrend();

  // Statistics
  const totalDisbursed = loans.reduce((sum, loan) => sum + loan.principalAmount, 0);
  const totalOutstanding = loans.filter(l => l.status === 'active').reduce((sum, loan) => sum + loan.outstandingBalance, 0);
  const totalCollected = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const avgCreditScore = borrowers.length > 0
    ? Math.round(borrowers.reduce((sum, b) => sum + b.creditScore, 0) / borrowers.length)
    : 0;
  const approvalRate = loanApplications.length > 0
    ? Math.round((loanApplications.filter(a => a.status === 'approved').length / loanApplications.length) * 100)
    : 0;

  const activeLoanCount = loans.filter(l => l.status === 'active').length;
  const totalDelinquentCount = delinquencyData.reduce((sum, bucket) => sum + bucket.count, 0);
  const totalDelinquentAmount = delinquencyData.reduce((sum, bucket) => sum + bucket.amount, 0);
  const delinquencyRate = activeLoanCount > 0
    ? Math.round((totalDelinquentCount / activeLoanCount) * 1000) / 10
    : 0;
  const recoveryRate = totalOutstanding > 0
    ? Math.round((totalCollected / totalOutstanding) * 1000) / 10
    : 0;

  const delinquentLoans = loans
    .filter(loan => {
      if (loan.status !== 'active') return false;
      const dueDate = new Date(loan.nextDueDate);
      return dueDate < new Date();
    })
    .map(loan => {
      const dueDate = new Date(loan.nextDueDate);
      const today = new Date();
      const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      return { ...loan, daysOverdue };
    });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-1">Reports & Analytics</h2>
        <p className="text-sm text-gray-600">Comprehensive reporting and audit trails</p>
      </div>

      {/* Report Type Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedReport('portfolio')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              selectedReport === 'portfolio' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Portfolio Analysis
          </button>
          <button
            onClick={() => setSelectedReport('delinquency')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              selectedReport === 'delinquency' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Delinquency Report
          </button>
          <button
            onClick={() => setSelectedReport('audit')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              selectedReport === 'audit' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Shield className="w-4 h-4" />
            Audit Logs
          </button>
          <div className="ml-auto flex items-center gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="quarter">Last Quarter</option>
              <option value="year">Last Year</option>
            </select>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-600 mb-1">Total Disbursed</div>
          <div className="text-xl text-gray-900">${totalDisbursed.toLocaleString()}</div>
          <div className="text-xs text-green-600 mt-1">+15% vs last period</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-600 mb-1">Total Outstanding</div>
          <div className="text-xl text-gray-900">${totalOutstanding.toLocaleString()}</div>
          <div className="text-xs text-red-600 mt-1">-5% vs last period</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-600 mb-1">Total Collected</div>
          <div className="text-xl text-gray-900">${totalCollected.toLocaleString()}</div>
          <div className="text-xs text-green-600 mt-1">+8% vs last period</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-600 mb-1">Avg Credit Score</div>
          <div className="text-xl text-gray-900">{avgCreditScore}</div>
          <div className="text-xs text-green-600 mt-1">+12 vs last period</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-600 mb-1">Approval Rate</div>
          <div className="text-xl text-gray-900">{approvalRate}%</div>
          <div className="text-xs text-gray-600 mt-1">
            {loanApplications.filter(a => a.status === 'approved').length} of {loanApplications.length} approved
          </div>
        </div>
      </div>

      {/* Portfolio Analysis */}
      {selectedReport === 'portfolio' && (
        <>
          {/* Monthly Trend */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-gray-900 mb-4">Disbursement vs Collection Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="disbursed" stroke="#3b82f6" name="Disbursed" strokeWidth={2} />
                <Line type="monotone" dataKey="collected" stroke="#10b981" name="Collected" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Loans by Type */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-gray-900 mb-4">Loans by Type</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={portfolioData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Loans by Status */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-gray-900 mb-4">Loan Portfolio Status</h3>
              <ResponsiveContainer width="100%" height={300}>
                <RePieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Delinquency Report */}
      {selectedReport === 'delinquency' && (
        <>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-gray-900 mb-4">Delinquency by Age</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={delinquencyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" />
                <YAxis yAxisId="right" orientation="right" stroke="#ef4444" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="count" fill="#3b82f6" name="Number of Loans" />
                <Bar yAxisId="right" dataKey="amount" fill="#ef4444" name="Amount ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm text-red-900 mb-1">Total Delinquent</div>
              <div className="text-2xl text-red-900">{totalDelinquentCount} loans</div>
              <div className="text-xs text-red-700 mt-1">${totalDelinquentAmount.toLocaleString()} outstanding</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-sm text-yellow-900 mb-1">Delinquency Rate</div>
              <div className="text-2xl text-yellow-900">{delinquencyRate}%</div>
              <div className="text-xs text-yellow-700 mt-1">Active loan portfolio</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm text-green-900 mb-1">Recovery Rate</div>
              <div className="text-2xl text-green-900">{recoveryRate}%</div>
              <div className="text-xs text-green-700 mt-1">Collected vs outstanding</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-gray-900">Delinquent Loans Detail</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Loan ID</th>
                    <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Borrower</th>
                    <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Days Overdue</th>
                    <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Amount Due</th>
                    <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Last Contact</th>
                    <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {delinquentLoans.map(loan => (
                    <tr key={loan.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{loan.id}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{loan.borrowerName}</td>
                      <td className="px-6 py-4 text-sm text-red-600">{loan.daysOverdue} days</td>
                      <td className="px-6 py-4 text-sm text-gray-900">${loan.outstandingBalance.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{loan.nextDueDate}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-700">
                          Follow-up needed
                        </span>
                      </td>
                    </tr>
                  ))}
                  {delinquentLoans.length === 0 && (
                    <tr>
                      <td className="px-6 py-6 text-sm text-gray-500" colSpan={6}>
                        No delinquent loans found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Audit Logs */}
      {selectedReport === 'audit' && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              System Audit Trail
            </h3>
            <p className="text-sm text-gray-600 mt-1">Complete history of all system activities</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Entity</th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Details</th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{log.userName}</div>
                      <div className="text-xs text-gray-500">User ID: {log.userId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        log.action === 'APPROVED' ? 'bg-green-100 text-green-700' :
                        log.action === 'REJECTED' ? 'bg-red-100 text-red-700' :
                        log.action === 'DISBURSED' ? 'bg-blue-100 text-blue-700' :
                        log.action === 'PAYMENT_RECEIVED' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {log.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{log.entity}</div>
                      <div className="text-xs text-gray-500">{log.entityId}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-md">{log.details}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{log.ipAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
