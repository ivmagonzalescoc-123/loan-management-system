import { useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Plus, Wallet } from "lucide-react";
import { User } from "../App";
import { useLoans } from "../lib/useApiData";
import { formatPhp } from "../lib/currency";
import { loginUser } from "../lib/api";

interface WalletPageProps {
  user: User;
}

export function WalletPage({ user }: WalletPageProps) {
  const { data: loans } = useLoans();
    const [showBalances, setShowBalances] = useState(false);
    const [showAuthPrompt, setShowAuthPrompt] = useState(false);
    const [authPassword, setAuthPassword] = useState("");
    const [authError, setAuthError] = useState<string | null>(null);
    const revealTimeoutRef = useRef<number | null>(null);
  const [bankAccounts, setBankAccounts] = useState([
    {
      id: "BANK-001",
      bankName: "MetroBank",
      accountName: "GLMS Inc Holdings",
      accountNumber: "123456789012",
      balance: 12500000,
    },
    {
      id: "BANK-002",
      bankName: "BDO",
      accountName: "GLMS Inc Operations",
      accountNumber: "987654321098",
      balance: 7500000,
    },
  ]);
  const [showAddBank, setShowAddBank] = useState(false);
  const [bankForm, setBankForm] = useState({
    bankName: "",
    accountName: "",
    accountNumber: "",
    balance: "",
  });
  const totalDisbursed = loans
    .filter((loan) => loan.disbursedDate)
    .reduce((sum, loan) => sum + Number(loan.principalAmount || 0), 0);

  const totalBankBalance = useMemo(
    () => bankAccounts.reduce((sum, account) => sum + Number(account.balance || 0), 0),
    [bankAccounts],
  );

  const currentBalance = Math.max(totalBankBalance - totalDisbursed, 0);

  const hideBalances = () => {
    setShowBalances(false);
    if (revealTimeoutRef.current) {
      window.clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }
  };

  const handleReveal = async () => {
    if (user.role !== "admin" && user.role !== "manager") return;
    setAuthError(null);
    if (!authPassword) {
      setAuthError("Password is required.");
      return;
    }
    try {
      await loginUser({ email: user.email, password: authPassword });
      setShowBalances(true);
      setShowAuthPrompt(false);
      setAuthPassword("");
      if (revealTimeoutRef.current) {
        window.clearTimeout(revealTimeoutRef.current);
      }
      revealTimeoutRef.current = window.setTimeout(() => {
        hideBalances();
      }, 30000);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Invalid password.");
    }
  };

  const maskedAmount = "•••••";
  const displayAmount = (value: number) => (showBalances ? formatPhp(value) : maskedAmount);


  const maskAccountNumber = (value: string) => {
    const trimmed = value.replace(/\s+/g, "");
    const last4 = trimmed.slice(-4);
    return last4 ? `•••• •••• •••• ${last4}` : "—";
  };

  const handleAddBank = () => {
    const balanceValue = Number(bankForm.balance || 0);
    if (!bankForm.bankName || !bankForm.accountName || !bankForm.accountNumber) {
      alert("Please complete all bank details.");
      return;
    }
    const newAccount = {
      id: `BANK-${String(bankAccounts.length + 1).padStart(3, "0")}`,
      bankName: bankForm.bankName.trim(),
      accountName: bankForm.accountName.trim(),
      accountNumber: bankForm.accountNumber.trim(),
      balance: Number.isNaN(balanceValue) ? 0 : balanceValue,
    };
    setBankAccounts((prev) => [...prev, newAccount]);
    setBankForm({ bankName: "", accountName: "", accountNumber: "", balance: "" });
    setShowAddBank(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900 mb-1">Wallet</h2>
          <p className="text-sm text-gray-600">
            Overview of digital wallet activity and balances.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <Wallet className="h-4 w-4 text-gray-500" />
          <span className="capitalize">{user.role.replace("_", " ")}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">Company Bank Balance</div>
            <button
              onClick={() => {
                if (showBalances) {
                  hideBalances();
                } else {
                  setShowAuthPrompt(true);
                }
              }}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              aria-label={showBalances ? "Hide balances" : "Reveal balances"}
            >
              {showBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showBalances ? "Hide" : "View"}
            </button>
          </div>
          <div className="text-2xl text-gray-900">{displayAmount(totalBankBalance)}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Total Disbursed</div>
          <div className="text-2xl text-gray-900">{displayAmount(totalDisbursed)}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Remaining Buffer</div>
          <div className="text-2xl text-gray-900">{displayAmount(currentBalance)}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-gray-900">Company Bank Accounts</h3>
            <p className="text-sm text-gray-500">Balances roll up to total company balance.</p>
          </div>
          <button
            onClick={() => setShowAddBank((prev) => !prev)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            Add Bank
          </button>
        </div>

        {showAddBank && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 rounded-lg p-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Bank Name</label>
              <input
                value={bankForm.bankName}
                onChange={(e) => setBankForm((prev) => ({ ...prev, bankName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="e.g. BPI"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Account Name</label>
              <input
                value={bankForm.accountName}
                onChange={(e) => setBankForm((prev) => ({ ...prev, accountName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Company name"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Account Number</label>
              <input
                value={bankForm.accountNumber}
                onChange={(e) => setBankForm((prev) => ({ ...prev, accountNumber: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="0000 0000 0000"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Balance</label>
              <input
                type="number"
                value={bankForm.balance}
                onChange={(e) => setBankForm((prev) => ({ ...prev, balance: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="0"
              />
            </div>
            <div className="md:col-span-4 flex justify-end gap-2">
              <button
                onClick={() => setShowAddBank(false)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBank}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Bank
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Bank</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Account Name</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Account Number</th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {bankAccounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{account.bankName}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{account.accountName}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {maskAccountNumber(account.accountNumber)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {displayAmount(account.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-gray-900 mb-4">Recent Wallet Activity</h3>
        <div className="text-sm text-gray-500">
          Total disbursements are calculated from recorded loans.
        </div>
      </div>

      {showAuthPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xs">
            <h3 className="text-gray-900 mb-2">Verify to view balances</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter your password to reveal balances for 30 seconds.
            </p>
            <div className="space-y-3">
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Password"
              />
              {authError && <div className="text-xs text-red-600">{authError}</div>}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowAuthPrompt(false);
                    setAuthPassword("");
                    setAuthError(null);
                  }}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReveal}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Verify
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
