import { useMemo, useState } from 'react';
import { Shield } from 'lucide-react';
import { useAuditLogs } from '../lib/useApiData';

export function AuditLogs() {
  const { data: auditLogs, loading, error } = useAuditLogs();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');

  const sortedLogs = useMemo(
    () =>
      [...auditLogs].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    [auditLogs]
  );

  const actionOptions = useMemo(() => {
    const set = new Set(sortedLogs.map((log) => log.action).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [sortedLogs]);

  const entityOptions = useMemo(() => {
    const set = new Set(sortedLogs.map((log) => log.entity).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [sortedLogs]);

  const filteredLogs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return sortedLogs.filter((log) => {
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (entityFilter !== 'all' && log.entity !== entityFilter) return false;
      if (!term) return true;
      const haystack = [
        log.userName,
        log.userId,
        log.action,
        log.entity,
        log.entityId,
        log.details,
        log.ipAddress,
        log.timestamp
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [sortedLogs, searchTerm, actionFilter, entityFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-1">Audit Logs</h2>
        <p className="text-sm text-gray-600">System activity history</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <h3 className="text-gray-900">System Audit Trail</h3>
        </div>
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {actionOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All Actions' : option.replace('_', ' ')}
                </option>
              ))}
            </select>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {entityOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All Entities' : option}
                </option>
              ))}
            </select>
          </div>
        </div>
        {loading && (
          <div className="p-6 text-sm text-gray-500">Loading audit logs...</div>
        )}
        {error && (
          <div className="p-6 text-sm text-red-600">{error}</div>
        )}
        {!loading && !error && sortedLogs.length === 0 && (
          <div className="p-6 text-sm text-gray-500">No audit logs available.</div>
        )}
        {!loading && !error && sortedLogs.length > 0 && filteredLogs.length === 0 && (
          <div className="p-6 text-sm text-gray-500">No audit logs match your filters.</div>
        )}
        {!loading && !error && filteredLogs.length > 0 && (
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
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{log.userName}</div>
                      <div className="text-xs text-gray-500">User ID: {log.userId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
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
        )}
      </div>
    </div>
  );
}
