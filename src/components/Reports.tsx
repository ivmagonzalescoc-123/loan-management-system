import { useEffect, useState } from 'react';
import { User } from '../App';
import { BarChart3, PieChart, TrendingUp, Download, Calendar } from 'lucide-react';
import { useBorrowers, useLoanApplications, useLoans, usePayments } from '../lib/useApiData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, LineChart, Line } from 'recharts';
import * as XLSX from 'xlsx';
import { formatPhp } from '../lib/currency';

interface ReportsProps {
  user: User;
  initialReport?: 'portfolio' | 'delinquency';
}

export function Reports({ user, initialReport = 'portfolio' }: ReportsProps) {
  const { data: loans } = useLoans();
  const { data: borrowers } = useBorrowers();
  const { data: loanApplications } = useLoanApplications();
  const { data: payments } = usePayments();
  const [selectedReport, setSelectedReport] = useState<'portfolio' | 'delinquency'>(initialReport);
  const [dateRange, setDateRange] = useState('month');
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv');

  useEffect(() => {
    setSelectedReport(initialReport);
  }, [initialReport]);

  const now = new Date();
  const getRangeStart = (range: string) => {
    const start = new Date(now);
    switch (range) {
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(start.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        break;
      default:
        start.setMonth(start.getMonth() - 1);
        break;
    }
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const rangeStart = getRangeStart(dateRange);
  const isWithinRange = (dateValue: string) => {
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed >= rangeStart && parsed <= now;
  };

  const filteredLoans = loans.filter(loan => isWithinRange(loan.disbursedDate));
  const filteredPayments = payments.filter(payment => isWithinRange(payment.paymentDate));
  const filteredLoanApplications = loanApplications.filter(app => isWithinRange(app.reviewDate || app.applicationDate));
  const filteredBorrowers = borrowers.filter(borrower => isWithinRange(borrower.registrationDate));
  const delinquencyLoans = loans.filter(loan => isWithinRange(loan.nextDueDate));

  // Portfolio Analysis
  const loansByType = filteredLoans.reduce((acc, loan) => {
    acc[loan.loanType] = (acc[loan.loanType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const portfolioData = Object.entries(loansByType).map(([type, count]) => ({
    name: type,
    count
  }));

  const loansByStatus = filteredLoans.reduce((acc, loan) => {
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
    const overdueLoans = delinquencyLoans.filter(loan => {
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
      amount: overdueLoans.reduce((sum, loan) => sum + Number(loan.outstandingBalance || 0), 0)
    };
  });

  const buildMonthlyTrend = () => {
    const months: { key: string; label: string; disbursed: number; collected: number }[] = [];
    const nowDate = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleString('en-US', { month: 'short' });
      months.push({ key, label, disbursed: 0, collected: 0 });
    }

    filteredLoans.forEach(loan => {
      const disbursedDate = new Date(loan.disbursedDate);
      const key = `${disbursedDate.getFullYear()}-${String(disbursedDate.getMonth() + 1).padStart(2, '0')}`;
      const entry = months.find(m => m.key === key);
      if (entry) entry.disbursed += Number(loan.principalAmount || 0);
    });

    filteredPayments.forEach(payment => {
      const paidDate = new Date(payment.paymentDate);
      const key = `${paidDate.getFullYear()}-${String(paidDate.getMonth() + 1).padStart(2, '0')}`;
      const entry = months.find(m => m.key === key);
      if (entry) entry.collected += Number(payment.amount || 0);
    });

    return months.map(m => ({ month: m.label, disbursed: m.disbursed, collected: m.collected }));
  };

  const monthlyTrend = buildMonthlyTrend();

  // Statistics
  const totalDisbursed = filteredLoans.reduce((sum, loan) => sum + Number(loan.principalAmount || 0), 0);
  const totalOutstanding = filteredLoans.filter(l => l.status === 'active').reduce((sum, loan) => sum + Number(loan.outstandingBalance || 0), 0);
  const totalCollected = filteredPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const avgCreditScore = filteredBorrowers.length > 0
    ? Math.round(filteredBorrowers.reduce((sum, b) => sum + b.creditScore, 0) / filteredBorrowers.length)
    : 0;
  const approvedOrDisbursedCount = filteredLoanApplications.filter(a => a.status === 'approved' || a.status === 'disbursed').length;
  const approvalRate = filteredLoanApplications.length > 0
    ? Math.round((approvedOrDisbursedCount / filteredLoanApplications.length) * 100)
    : 0;

  const activeLoanCount = delinquencyLoans.filter(l => l.status === 'active').length;
  const totalDelinquentCount = delinquencyData.reduce((sum, bucket) => sum + bucket.count, 0);
  const totalDelinquentAmount = delinquencyData.reduce((sum, bucket) => sum + Number(bucket.amount || 0), 0);
  const delinquencyRate = activeLoanCount > 0
    ? Math.round((totalDelinquentCount / activeLoanCount) * 1000) / 10
    : 0;
  const recoveryRate = totalOutstanding > 0
    ? Math.round((totalCollected / totalOutstanding) * 1000) / 10
    : 0;

  const delinquentLoans = delinquencyLoans
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

  const getExportFileName = () => {
    const rangeLabel = dateRange;
    const reportLabel = selectedReport;
    const dateStamp = now.toISOString().split('T')[0];
    return `report-${reportLabel}-${rangeLabel}-${dateStamp}`;
  };

  const toCsv = (rows: Record<string, string | number | null | undefined>[]) => {
    if (rows.length === 0) return '';
    const headers = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
    const escapeValue = (value: string | number | null | undefined) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };
    const lines = [headers.join(',')];
    rows.forEach(row => {
      lines.push(headers.map(key => escapeValue(row[key])).join(','));
    });
    return lines.join('\n');
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    const filename = getExportFileName();

    if (selectedReport === 'portfolio') {
      const metricsRows = [
        { metric: 'Total Disbursed', value: totalDisbursed },
        { metric: 'Total Outstanding', value: totalOutstanding },
        { metric: 'Total Collected', value: totalCollected },
        { metric: 'Avg Credit Score', value: avgCreditScore },
        { metric: 'Approval Rate (%)', value: approvalRate }
      ];
      if (exportFormat === 'csv') {
        const rows = [
          ...metricsRows.map(r => ({ section: 'Metrics', ...r })),
          ...portfolioData.map(r => ({ section: 'Loans by Type', ...r })),
          ...statusData.map(r => ({ section: 'Loans by Status', ...r })),
          ...monthlyTrend.map(r => ({ section: 'Monthly Trend', ...r }))
        ];
        const csv = toCsv(rows);
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
        return;
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(metricsRows), 'Metrics');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(portfolioData), 'Loans by Type');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(statusData), 'Loans by Status');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(monthlyTrend), 'Monthly Trend');
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      downloadBlob(new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filename}.xlsx`);
      return;
    }

    if (selectedReport === 'delinquency') {
      if (exportFormat === 'csv') {
        const rows = [
          ...delinquencyData.map(r => ({ section: 'Delinquency Buckets', ...r })),
          ...delinquentLoans.map(r => ({
            section: 'Delinquent Loans',
            id: r.id,
            borrowerName: r.borrowerName,
            daysOverdue: r.daysOverdue,
            outstandingBalance: r.outstandingBalance,
            nextDueDate: r.nextDueDate,
            status: r.status
          }))
        ];
        const csv = toCsv(rows);
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
        return;
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(delinquencyData), 'Delinquency Buckets');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(delinquentLoans.map(r => ({
        id: r.id,
        borrowerName: r.borrowerName,
        daysOverdue: r.daysOverdue,
        outstandingBalance: r.outstandingBalance,
        nextDueDate: r.nextDueDate,
        status: r.status
      }))), 'Delinquent Loans');
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      downloadBlob(new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filename}.xlsx`);
      return;
    }

  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-1">Reports & Analytics</h2>
        <p className="text-sm text-gray-600">Comprehensive reporting and analytics</p>
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
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'csv' | 'xlsx')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="csv">CSV</option>
              <option value="xlsx">Excel</option>
            </select>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
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
          <div className="text-xl text-gray-900">{formatPhp(totalDisbursed)}</div>
          <div className="text-xs text-green-600 mt-1">+15% vs last period</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-600 mb-1">Total Outstanding</div>
          <div className="text-xl text-gray-900">{formatPhp(totalOutstanding)}</div>
          <div className="text-xs text-red-600 mt-1">-5% vs last period</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-600 mb-1">Total Collected</div>
          <div className="text-xl text-gray-900">{formatPhp(totalCollected)}</div>
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
            {approvedOrDisbursedCount} of {filteredLoanApplications.length} approved
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
                <Tooltip
                  formatter={(value: unknown, name: string) => {
                    if (name === 'Disbursed' || name === 'Collected') {
                      return [formatPhp(Number(value)), name];
                    }
                    return [value as any, name];
                  }}
                />
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
                <Tooltip
                  formatter={(value: unknown, name: string) => {
                    if (name === 'Amount (₱)') {
                      return [formatPhp(Number(value)), name];
                    }
                    return [value as any, name];
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="count" fill="#3b82f6" name="Number of Loans" />
                <Bar yAxisId="right" dataKey="amount" fill="#ef4444" name="Amount (₱)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm text-red-900 mb-1">Total Delinquent</div>
              <div className="text-2xl text-red-900">{totalDelinquentCount} loans</div>
              <div className="text-xs text-red-700 mt-1">{formatPhp(totalDelinquentAmount)} outstanding</div>
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
                      <td className="px-6 py-4 text-sm text-gray-900">{formatPhp(loan.outstandingBalance)}</td>
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

    </div>
  );
}
