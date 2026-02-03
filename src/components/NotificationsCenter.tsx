import { useMemo, useState } from "react";
import { Bell, CheckCircle2, RefreshCcw } from "lucide-react";
import { useLoans, useNotifications } from "../lib/useApiData";
import { markNotificationRead } from "../lib/api";
import { User } from "../App";

interface NotificationsCenterProps {
  user: User;
}

const severityStyles: Record<string, string> = {
  info: "bg-green-50 text-green-700",
  warning: "bg-yellow-50 text-yellow-700",
  critical: "bg-red-50 text-red-700",
};

export function NotificationsCenter({ user }: NotificationsCenterProps) {
  const { data: notifications, loading, error, refresh } = useNotifications();
  const { data: loans } = useLoans();
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const borrowerLoanIds = useMemo(() => {
    if (user.role !== "borrower") return new Set<string>();
    return new Set(
      loans.filter((loan) => loan.borrowerId === user.id).map((loan) => loan.id)
    );
  }, [loans, user.id, user.role]);

  const visibleNotifications = useMemo(() => {
    return notifications.filter((note) => {
      if (note.targetRole && note.targetRole !== user.role) {
        return false;
      }

      if (user.role === "borrower") {
        if (note.borrowerId) {
          return note.borrowerId === user.id;
        }
        if (note.loanId) {
          return borrowerLoanIds.has(note.loanId);
        }
      }

      return true;
    });
  }, [notifications, borrowerLoanIds, user.id, user.role]);

  const sortedNotifications = useMemo(() => {
    return [...visibleNotifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [visibleNotifications]);

  const filteredNotifications = useMemo(() => {
    if (!showUnreadOnly) return sortedNotifications;
    return sortedNotifications.filter((note) => note.status === "unread");
  }, [showUnreadOnly, sortedNotifications]);

  const unreadNotifications = useMemo(() => {
    return sortedNotifications.filter((note) => note.status === "unread");
  }, [sortedNotifications]);

  const handleReadAll = async () => {
    if (unreadNotifications.length === 0) return;
    await Promise.all(unreadNotifications.map((note) => markNotificationRead(note.id)));
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-gray-900">Notifications</h2>
          <p className="text-sm text-gray-500">
            Updates for {user.role.replace("_", " ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowUnreadOnly((prev) => !prev)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            {showUnreadOnly ? "Show all" : "Show unread"}
          </button>
          <button
            onClick={handleReadAll}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Read all
          </button>
          <button
            onClick={refresh}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            aria-label="Refresh notifications"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Bell className="w-4 h-4" />
          Loading notifications...
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && !error && filteredNotifications.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Bell className="w-4 h-4" />
          No notifications to show.
        </div>
      )}

      <div className="space-y-3">
        {filteredNotifications.map((note) => (
          <div
            key={note.id}
            className={`border rounded-lg p-4 ${
              note.status === "unread" ? "border-green-200 bg-green-50/40" : "border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{note.title}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      severityStyles[note.severity] || "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {note.severity}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{note.message}</p>
                <div className="text-xs text-gray-400">
                  {new Date(note.createdAt).toLocaleString()}
                </div>
              </div>
              {note.status === "unread" && (
                <button
                  onClick={async () => {
                    await markNotificationRead(note.id);
                    refresh();
                  }}
                  className="text-xs text-green-700 hover:text-green-800"
                >
                  Mark read
                </button>
              )}
            </div>
            {note.status === "read" && (
              <div className="mt-3 flex items-center gap-1 text-xs text-gray-400">
                <CheckCircle2 className="w-3 h-3" />
                Read
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
