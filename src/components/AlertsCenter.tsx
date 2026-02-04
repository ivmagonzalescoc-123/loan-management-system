import { useMemo, useState } from "react";
import { Bell, Mail } from "lucide-react";
import { User } from "../App";
import { useBorrowers, useLoans } from "../lib/useApiData";
import { sendAlertReminder } from "../lib/api";

interface AlertsCenterProps {
  user: User;
}

const monthDiff = (from: Date, to: Date) => {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  return Math.max(0, months);
};

export function AlertsCenter({ user }: AlertsCenterProps) {
  const { data: borrowers } = useBorrowers();
  const { data: loans } = useLoans();
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [remindingAll, setRemindingAll] = useState(false);

  const overdueByBorrower = useMemo(() => {
    const today = new Date();
    const map = new Map<string, { loanId: string; monthsDue: number; daysLate: number }>();

    loans
      .filter((loan) => loan.status === "active" && loan.nextDueDate)
      .forEach((loan) => {
        const dueDate = new Date(loan.nextDueDate);
        if (Number.isNaN(dueDate.getTime())) return;
        if (dueDate >= today) return;

        const daysLate = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const monthsDue = Math.max(1, Math.ceil(daysLate / 30));
        const existing = map.get(loan.borrowerId);
        if (!existing || monthsDue > existing.monthsDue) {
          map.set(loan.borrowerId, { loanId: loan.id, monthsDue, daysLate });
        }
      });

    return map;
  }, [loans]);

  const rows = useMemo(() => {
    return borrowers
      .map((borrower) => {
        const overdue = overdueByBorrower.get(borrower.id);
        if (!overdue) return null;
        return {
          ...borrower,
          loanId: overdue.loanId,
          monthsDue: overdue.monthsDue,
          daysLate: overdue.daysLate,
        };
      })
      .filter(Boolean);
  }, [borrowers, overdueByBorrower]);

  const handleRemind = async (borrowerId: string, loanId: string, monthsDue: number) => {
    try {
      setRemindingId(borrowerId);
      await sendAlertReminder({ borrowerId, loanId, monthsDue });
      alert("Reminder sent to borrower portal.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to send reminder.");
    } finally {
      setRemindingId(null);
    }
  };

  const handleRemindAll = async () => {
    if (rows.length === 0) return;
    try {
      setRemindingAll(true);
      await Promise.all(
        rows.map((row) => sendAlertReminder({
          borrowerId: row.id,
          loanId: row.loanId,
          monthsDue: row.monthsDue,
        }))
      );
      alert("Reminders sent to all overdue borrowers.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to send reminders.");
    } finally {
      setRemindingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-gray-900">Alerts</h2>
          <p className="text-sm text-gray-600">
            Payment reminders for {user.role.replace("_", " ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Borrowers with overdue loans
          </div>
          <button
            onClick={handleRemindAll}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            disabled={rows.length === 0 || remindingAll}
          >
            <Mail className="h-4 w-4" />
            {remindingAll ? "Sending..." : "Send reminders to all"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Borrower</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Address</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-sm text-gray-500" colSpan={5}>
                    No overdue borrowers found.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {row.firstName} {row.lastName}
                    </div>
                    <div className="text-xs text-gray-500">{row.id}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>{row.phone}</div>
                    <div className="text-xs text-gray-500">{row.email}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{row.address}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-2 px-2 py-1 rounded text-xs bg-yellow-50 text-yellow-700">
                      Has due loans · {row.monthsDue} month(s) due
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleRemind(row.id, row.loanId, row.monthsDue)}
                      className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50"
                      disabled={remindingId === row.id}
                    >
                      <Mail className="h-4 w-4" />
                      {remindingId === row.id ? "Sending..." : "Send Reminder"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}