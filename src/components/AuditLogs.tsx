import { useMemo } from "react";
import { Shield } from "lucide-react";
import { useAuditLogs } from "../lib/useApiData";

export function AuditLogs() {
  const { data: logs, loading, error, refresh } = useAuditLogs();

  const sortedLogs = useMemo(() => {
    return [...logs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [logs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900">Audit Logs</h2>
          <p className="text-sm text-gray-500">
            Security and compliance activity tracking.
          </p>
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
          <Shield className="w-4 h-4" />
          Loading audit logs...
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && !error && sortedLogs.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Shield className="w-4 h-4" />
          No audit logs available.
        </div>
      )}

      {!loading && !error && sortedLogs.length > 0 && (
        <div className="overflow-hidden border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Timestamp</th>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Action</th>
                <th className="px-4 py-3 text-left font-medium">Entity</th>
                <th className="px-4 py-3 text-left font-medium">Details</th>
                <th className="px-4 py-3 text-left font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedLogs.map((log) => (
                <tr key={log.id} className="text-gray-700">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{log.userName}</td>
                  <td className="px-4 py-3">{log.action}</td>
                  <td className="px-4 py-3">{log.entity}</td>
                  <td className="px-4 py-3 max-w-[320px] truncate" title={log.details}>
                    {log.details}
                  </td>
                  <td className="px-4 py-3">{log.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
