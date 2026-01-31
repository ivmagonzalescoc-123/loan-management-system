import { useEffect, useRef, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { BorrowerManagement } from "./components/BorrowerManagement";
import { LoanApplications } from "./components/LoanApplications";
import { Disbursements } from "./components/Disbursements";
import { RepaymentTracking } from "./components/RepaymentTracking";
import { Reports } from "./components/Reports";
import { Login } from "./components/Login";
import { UserManagement } from "./components/UserManagement";
import { BorrowerProfile } from "./components/BorrowerProfile";
import { UserProfile } from "./components/UserProfile";
import { BorrowerLoanHistory } from "./components/BorrowerLoanHistory";
import { BorrowerPaymentHistory } from "./components/BorrowerPaymentHistory";
import { NotificationsCenter } from "./components/NotificationsCenter";
import { AuditLogs } from "./components/AuditLogs";
import logoUrl from "../logo.png";
import {
  LayoutDashboard,
  Users,
  FileText,
  Wallet,
  CreditCard,
  BarChart3,
  UserCog,
  ListChecks,
  Receipt,
  Bell,
  Shield,
} from "lucide-react";
import { markNotificationRead } from "./lib/api";
import { useLoans, useNotifications } from "./lib/useApiData";

export type UserRole =
  | "admin"
  | "manager"
  | "loan_officer"
  | "cashier"
  | "borrower"
  | "auditor";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  profileImage?: string;
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
  | "notifications"
  | "audit-logs"
  | "borrower-loans"
  | "borrower-payments";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(
    null,
  );
  const [currentView, setCurrentView] =
    useState<View>("dashboard");
  const [profileTab, setProfileTab] = useState<'details' | 'security'>('details');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationsMenuRef = useRef<HTMLDivElement | null>(null);
  const { data: notifications, refresh: refreshNotifications } = useNotifications();
  const { data: loans } = useLoans();

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    const first = parts[0][0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] || '' : '';
    return `${first}${last}`.toUpperCase();
  };

  const getLastName = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    return parts[parts.length - 1];
  };

  useEffect(() => {
    if (!showProfileMenu && !showNotificationsMenu) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedProfile = profileMenuRef.current?.contains(target);
      const clickedNotifications = notificationsMenuRef.current?.contains(target);
      if (!clickedProfile && !clickedNotifications) {
        setShowProfileMenu(false);
        setShowNotificationsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showProfileMenu, showNotificationsMenu]);

  useEffect(() => {
    setShowProfileMenu(false);
    setShowNotificationsMenu(false);
  }, [currentView]);

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

  const isBorrower = currentUser.role === 'borrower';
  const borrowerLoanIds = new Set(
    loans.filter((loan) => loan.borrowerId === currentUser.id).map((loan) => loan.id)
  );
  const visibleNotifications = isBorrower
    ? notifications.filter(
        (note) =>
          (note.borrowerId && note.borrowerId === currentUser.id) ||
          (note.loanId && borrowerLoanIds.has(note.loanId))
      )
    : notifications;
  const sortedNotifications = [...visibleNotifications].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const headerNotifications = sortedNotifications.slice(0, 5);
  const unreadCount = sortedNotifications.filter((note) => note.status === 'unread').length;

  const handleMarkNotificationRead = async (id: string) => {
    await markNotificationRead(id);
    refreshNotifications();
  };

  const menuItems = [
    {
      id: "dashboard" as View,
      label: "Dashboard",
      icon: LayoutDashboard,
      roles: ["admin", "manager", "loan_officer", "cashier", "auditor", "borrower"],
    },
    {
      id: "borrowers" as View,
      label: "Borrowers",
      icon: Users,
      roles: ["admin", "manager", "loan_officer"],
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
      roles: ["admin", "manager", "loan_officer"],
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
      roles: ["admin", "manager", "cashier", "loan_officer"],
    },
    {
      id: "reports" as View,
      label: "Reports",
      icon: BarChart3,
      roles: ["admin", "manager", "auditor", "loan_officer"],
    },
    {
      id: "audit-logs" as View,
      label: "Audit Logs",
      icon: Shield,
      roles: ["admin", "auditor"],
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
              Gonzales LMS
            </h1>
          </div>

          <p className="text-xs text-gray-400 uppercase text-center mt-2">
            {currentUser.role.replace("_", " ")}
          </p>
        </div>

        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
                  setShowProfileMenu(false);
                }}
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

        <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200" />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="sticky top-0 z-30 border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-end gap-3">
          <div className="relative" ref={notificationsMenuRef}>
            <button
              onClick={() => setShowNotificationsMenu((prev) => !prev)}
              className="relative flex items-center justify-center w-10 h-10 border border-gray-200 rounded-lg hover:bg-gray-50"
              aria-label="Open notifications"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotificationsMenu && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="text-sm font-semibold text-gray-900">Notifications</div>
                  <div className="text-xs text-gray-500">Latest updates</div>
                </div>
                <div className="max-h-80 overflow-auto">
                  {headerNotifications.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-gray-500 text-center">
                      No notifications yet.
                    </div>
                  ) : (
                    headerNotifications.map((note) => (
                      <div key={note.id} className="px-4 py-3 border-b border-gray-100">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm text-gray-900 font-medium">
                              {note.title}
                            </div>
                            <div className="text-xs text-gray-500 line-clamp-2">
                              {note.message}
                            </div>
                            <div className="text-[11px] text-gray-400 mt-1">
                              {new Date(note.createdAt).toLocaleString()}
                            </div>
                          </div>
                          {note.status === 'unread' && (
                            <button
                              onClick={() => handleMarkNotificationRead(note.id)}
                              className="text-[11px] text-blue-600 hover:text-blue-700"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <button
                  onClick={() => {
                    setCurrentView('notifications');
                    setShowNotificationsMenu(false);
                  }}
                  className="w-full text-sm text-blue-600 hover:text-blue-700 px-4 py-3 text-center"
                >
                  View all
                </button>
              </div>
            )}
          </div>
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setShowProfileMenu(prev => !prev)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              {currentUser.profileImage ? (
                <img
                  src={currentUser.profileImage}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <span className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-semibold">
                  {getInitials(currentUser.name)}
                </span>
              )}
              <span className="text-sm text-gray-700">{getLastName(currentUser.name)}</span>
            </button>
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                <button
                  onClick={() => {
                    setProfileTab('details');
                    setCurrentView('profile');
                    setShowProfileMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Profile
                </button>
                <button
                  onClick={() => {
                    setProfileTab('security');
                    setCurrentView('profile');
                    setShowProfileMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Account
                </button>
                <div className="border-t border-gray-200" />
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    handleLogout();
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
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
          {currentView === "audit-logs" && (
            <AuditLogs />
          )}
          {currentView === "notifications" && (
            <NotificationsCenter user={currentUser} />
          )}
          {currentView === "profile" && (
                currentUser.role === "borrower" ? (
                  <BorrowerProfile
                    user={currentUser}
                    initialTab={profileTab}
                    onProfileUpdated={(updates) =>
                      setCurrentUser((prev) => (prev ? { ...prev, ...updates } : prev))
                    }
                  />
                ) : (
                  <UserProfile
                    user={currentUser}
                    initialTab={profileTab}
                    onProfileUpdated={(updates) =>
                      setCurrentUser((prev) => (prev ? { ...prev, ...updates } : prev))
                    }
                  />
                )
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