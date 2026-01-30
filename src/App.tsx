import { useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { BorrowerManagement } from "./components/BorrowerManagement";
import { LoanApplications } from "./components/LoanApplications";
import { Disbursements } from "./components/Disbursements";
import { RepaymentTracking } from "./components/RepaymentTracking";
import { Reports } from "./components/Reports";
import { Login } from "./components/Login";
import { UserManagement } from "./components/UserManagement";
import { BorrowerProfile } from "./components/BorrowerProfile";
import { BorrowerLoanHistory } from "./components/BorrowerLoanHistory";
import { BorrowerPaymentHistory } from "./components/BorrowerPaymentHistory";
import logoUrl from "../logo.png";
import {
  LayoutDashboard,
  Users,
  FileText,
  Wallet,
  CreditCard,
  BarChart3,
  UserCog,
  UserCircle,
  ListChecks,
  Receipt,
  LogOut,
} from "lucide-react";

export type UserRole =
  | "admin"
  | "loan_officer"
  | "cashier"
  | "borrower"
  | "auditor";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

type View =
  | "dashboard"
  | "borrowers"
  | "applications"
  | "disbursements"
  | "repayments"
  | "reports"
  | "user-management"
  | "profile"
  | "borrower-loans"
  | "borrower-payments";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(
    null,
  );
  const [currentView, setCurrentView] =
    useState<View>("dashboard");

  const handleLogin = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView("dashboard");
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  const menuItems = [
    {
      id: "dashboard" as View,
      label: "Dashboard",
      icon: LayoutDashboard,
      roles: ["admin", "loan_officer", "cashier", "auditor", "borrower"],
    },
    {
      id: "borrowers" as View,
      label: "Borrowers",
      icon: Users,
      roles: ["admin", "loan_officer"],
    },
    {
      id: "user-management" as View,
      label: "User Management",
      icon: UserCog,
      roles: ["admin"],
    },
    {
      id: "applications" as View,
      label: "Loan Applications",
      icon: FileText,
      roles: ["admin", "loan_officer"],
    },
    {
      id: "disbursements" as View,
      label: "Disbursements",
      icon: Wallet,
      roles: ["admin", "cashier"],
    },
    {
      id: "repayments" as View,
      label: "Repayments",
      icon: CreditCard,
      roles: ["admin", "cashier", "loan_officer"],
    },
    {
      id: "reports" as View,
      label: "Reports",
      icon: BarChart3,
      roles: ["admin", "auditor", "loan_officer"],
    },
    {
      id: "profile" as View,
      label: "My Profile",
      icon: UserCircle,
      roles: ["borrower"],
    },
    {
      id: "borrower-loans" as View,
      label: "Loan History",
      icon: ListChecks,
      roles: ["borrower"],
    },
    {
      id: "borrower-payments" as View,
      label: "Payment History",
      icon: Receipt,
      roles: ["borrower"],
    },
  ].filter((item) => item.roles.includes(currentUser.role));

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt="Loan Management System logo"
              className="w-8 h-8 object-contain"
              loading="eager"
            />
            <h1 className="font-semibold text-gray-900 leading-tight">
              Loan Management System
            </h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {currentUser.name}
          </p>
          <p className="text-xs text-gray-400 capitalize">
            {currentUser.role.replace("_", " ")}
          </p>
        </div>

        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  currentView === item.id
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {currentView === "dashboard" && (
            <Dashboard user={currentUser} />
          )}
          {currentView === "borrowers" && (
            <BorrowerManagement user={currentUser} />
          )}
          {currentView === "user-management" && (
            <UserManagement user={currentUser} />
          )}
          {currentView === "applications" && (
            <LoanApplications user={currentUser} />
          )}
          {currentView === "disbursements" && (
            <Disbursements user={currentUser} />
          )}
          {currentView === "repayments" && (
            <RepaymentTracking user={currentUser} />
          )}
          {currentView === "reports" && (
            <Reports user={currentUser} />
          )}
          {currentView === "profile" && (
            <BorrowerProfile user={currentUser} />
          )}
          {currentView === "borrower-loans" && (
            <BorrowerLoanHistory user={currentUser} />
          )}
          {currentView === "borrower-payments" && (
            <BorrowerPaymentHistory user={currentUser} />
          )}
        </div>
      </main>
    </div>
  );
}