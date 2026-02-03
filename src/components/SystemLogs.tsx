import { useMemo } from 'react';
import { Monitor } from 'lucide-react';
import { useSystemLogs } from '../lib/useApiData';

export function SystemLogs() {
  const { data: logs, loading, error, refresh } = useSystemLogs();

  const sortedLogs = useMemo(() => {
    return [...logs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [logs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900">System Logs</h2>
          <p className="text-sm text-gray-500">Login activity across all roles.</p>
        </div>
        <button
          onClick={refresh}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Monitor className="w-4 h-4" />
          Loading system logs...
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && !error && sortedLogs.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Monitor className="w-4 h-4" />
          No system logs available.
        </div>
      )}

      {!loading && !error && sortedLogs.length > 0 && (
        <div className="overflow-hidden border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Date / Time</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">IP Address</th>
                <th className="px-4 py-3 text-left font-medium">Device Login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedLogs.map((log) => (
                <tr key={log.id} className="text-gray-700">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{log.name}</td>
                  <td className="px-4 py-3 capitalize">{log.role}</td>
                  <td className="px-4 py-3">{log.ipAddress}</td>
                  <td className="px-4 py-3 max-w-[360px] truncate" title={log.userAgent}>
                    {log.userAgent || 'Unknown device'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
