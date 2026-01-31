import { User } from '../App';
import { useLoans, useNotifications } from '../lib/useApiData';
import { markNotificationRead } from '../lib/api';

interface NotificationsCenterProps {
  user: User;
}

export function NotificationsCenter({ user }: NotificationsCenterProps) {
  const { data: notifications, loading, error, refresh } = useNotifications();
  const { data: loans } = useLoans();

  const isBorrower = user.role === 'borrower';
  const borrowerLoanIds = new Set(
    loans.filter((loan) => loan.borrowerId === user.id).map((loan) => loan.id)
  );

  const visibleNotifications = isBorrower
    ? notifications.filter(
        (note) =>
          (note.borrowerId && note.borrowerId === user.id) ||
          (note.loanId && borrowerLoanIds.has(note.loanId))
      )
    : notifications;

  const sortedNotifications = [...visibleNotifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 mb-1">Notifications</h2>
        <p className="text-sm text-gray-600">Workflow updates and reminders</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        {loading && (
          <div className="p-6 text-sm text-gray-500">Loading notifications...</div>
        )}
        {error && (
          <div className="p-6 text-sm text-red-600">{error}</div>
        )}
        {!loading && !error && sortedNotifications.length === 0 && (
          <div className="p-6 text-sm text-gray-500">No notifications available.</div>
        )}
        {!loading && !error && sortedNotifications.length > 0 && (
          <div className="divide-y divide-gray-100">
            {sortedNotifications.map((note) => (
              <div key={note.id} className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      note.status === 'unread'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {note.status === 'unread' ? 'Unread' : 'Read'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(note.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-900 font-medium mt-2">
                    {note.title}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {note.message}
                  </div>
                </div>
                {note.status === 'unread' && (
                  <button
                    onClick={() => handleMarkRead(note.id)}
                    className="self-start md:self-center text-sm text-blue-600 hover:text-blue-700"
                  >
                    Mark as read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
