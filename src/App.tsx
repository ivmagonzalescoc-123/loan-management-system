import { useEffect, useRef, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { BorrowerManagement } from "./components/BorrowerManagement";
import { LoanApplications } from "./components/LoanApplications";
import { Disbursements } from "./components/Disbursements";
import { RepaymentTracking } from "./components/RepaymentTracking";
import { LoanContinuityActions } from "./components/LoanContinuityActions";
import { Reports } from "./components/Reports";
import { Login } from "./components/Login";
import { UserManagement } from "./components/UserManagement";
import { PermissionSettings } from "./components/PermissionSettings";
import { BorrowerProfile } from "./components/BorrowerProfile";
import { UserProfile } from "./components/UserProfile";
import { BorrowerLoanHistory } from "./components/BorrowerLoanHistory";
import { BorrowerPaymentHistory } from "./components/BorrowerPaymentHistory";
import { NotificationsCenter } from "./components/NotificationsCenter";
import { AlertsCenter } from "./components/AlertsCenter.tsx";
import { AuditLogs } from "./components/AuditLogs";
import { SystemLogs } from "./components/SystemLogs";
import { WalletPage } from "./components/WalletPage.tsx";
import logoUrl from "../logo.png";
import {
  LayoutDashboard,
  Users,
  FileText,
  Wallet,
  CreditCard,
  Repeat,
  BarChart3,
  UserCog,
  ListChecks,
  ClipboardList,
  Receipt,
  Bell,
  Shield,
  Monitor,
  ChevronDown,
  User as UserIcon,
} from "lucide-react";
import { markNotificationRead } from "./lib/api";
import { useLoans, useNotifications } from "./lib/useApiData";
import { getPermissionSettings, isNavAllowed, type PermissionSettings as PermissionSettingsState } from "./lib/permissions";

export type UserRole =
  | "admin"
  | "manager"
  | "loan_officer"
  | "cashier"
  | "borrower";

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
  | "loan-continuity"
  | "wallet"
  | "alerts"
  | "reports"
  | "permissions"
  | "user-management"
  | "profile"
  | "notifications"
  | "audit-logs"
  | "system-logs"
  | "borrower-loans"
  | "borrower-payments";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [permissionsKey, setPermissionsKey] = useState(0);
  const [profileTab, setProfileTab] = useState<"details" | "security">(
    "details",
  );
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const [permissionSettings, setPermissionSettings] = useState<PermissionSettingsState>(() => getPermissionSettings());
  const [openNavGroups, setOpenNavGroups] = useState({
    "loan-management": false,
    finance: false,
    security: false,
  });
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationsMenuRef = useRef<HTMLDivElement | null>(null);
  const idleTimeoutRef = useRef<number | null>(null);
  const { data: notifications, refresh: refreshNotifications } =
    useNotifications();
  const { data: loans } = useLoans();

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    const first = parts[0][0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] || "" : "";
    return `${first}${last}`.toUpperCase();
  };

  const getLastName = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    return parts[parts.length - 1];
  };

  const clearSession = () => {
    sessionStorage.removeItem("lms-session-user");
  };

  const persistSession = (user: User | null) => {
    if (!user) {
      clearSession();
      return;
    }
    sessionStorage.setItem("lms-session-user", JSON.stringify(user));
  };

  const resetIdleTimer = () => {
    if (!currentUser) return;
    if (idleTimeoutRef.current) {
      window.clearTimeout(idleTimeoutRef.current);
    }
    idleTimeoutRef.current = window.setTimeout(() => {
      handleLogout();
    }, 15 * 60 * 1000);
  };

  useEffect(() => {
    const storedUser = sessionStorage.getItem("lms-session-user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as User;
        setCurrentUser(parsed);
      } catch {
        clearSession();
      }
    }
  }, []);

  useEffect(() => {
    if (!showProfileMenu && !showNotificationsMenu) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedProfile = profileMenuRef.current?.contains(target);
      const clickedNotifications =
        notificationsMenuRef.current?.contains(target);
      if (!clickedProfile && !clickedNotifications) {
        setShowProfileMenu(false);
        setShowNotificationsMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showProfileMenu, showNotificationsMenu]);

  useEffect(() => {
    setShowProfileMenu(false);
    setShowNotificationsMenu(false);
  }, [currentView]);

  useEffect(() => {
    if (!currentUser) return;
    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

    const handleActivity = () => {
      resetIdleTimer();
    };

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });

    resetIdleTimer();

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      if (idleTimeoutRef.current) {
        window.clearTimeout(idleTimeoutRef.current);
      }
    };
  }, [currentUser]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refreshNotifications();
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [refreshNotifications]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    persistSession(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView("dashboard");
    setPermissionsKey((prev) => prev + 1);
    clearSession();
  };

  useEffect(() => {
    if (currentView !== "permissions") {
      setPermissionsKey((prev) => prev + 1);
    }
  }, [currentView]);

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  const isBorrower = currentUser.role === "borrower";
  const isAdmin = currentUser.role === "admin";
  const borrowerLoanIds = new Set(
    loans
      .filter((loan) => loan.borrowerId === currentUser.id)
      .map((loan) => loan.id),
  );
  const visibleNotifications = notifications.filter((note) => {
    if (note.targetRole && note.targetRole !== currentUser.role) {
      return false;
    }
    if (!isBorrower) return true;
    return (
      (note.borrowerId && note.borrowerId === currentUser.id) ||
      (note.loanId && borrowerLoanIds.has(note.loanId))
    );
  });
  const sortedNotifications = [...visibleNotifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const headerNotifications = sortedNotifications.slice(0, 5);
  const unreadCount = sortedNotifications.filter(
    (note) => note.status !== "read",
  ).length;

  const handleMarkNotificationRead = async (id: string) => {
    await markNotificationRead(id);
    refreshNotifications();
  };

  const handleToggleNotifications = async () => {
    const nextOpen = !showNotificationsMenu;
    setShowNotificationsMenu(nextOpen);
    if (nextOpen && unreadCount > 0) {
      await Promise.all(
        sortedNotifications
          .filter((note) => note.status !== "read")
          .map((note) => markNotificationRead(note.id)),
      );
      refreshNotifications();
    }
  };

  const menuItems = [
    {
      id: "dashboard" as View,
      label: "Dashboard",
      icon: LayoutDashboard,
      roles: [
        "admin",
        "manager",
        "loan_officer",
        "cashier",
        "borrower",
      ],
    },
    {
      id: "alerts" as View,
      label: "Alerts",
      icon: Bell,
      roles: ["manager", "loan_officer", "cashier"],
    },
    {
      id: "borrowers" as View,
      label: "Borrowers",
      icon: Users,
      roles: ["admin", "manager", "loan_officer"],
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
      id: "wallet" as View,
      label: "Wallet",
      icon: Wallet,
      roles: ["manager"],
    },
    {
      id: "loan-continuity" as View,
      label: "Loan Continuity",
      icon: Repeat,
      roles: ["admin", "manager"],
    },
    {
      id: "user-management" as View,
      label: "User Management",
      icon: UserCog,
      roles: ["admin"],
    },
    {
      id: "permissions" as View,
      label: "Permissions",
      icon: Shield,
      roles: ["admin"],
    },
    {
      id: "reports" as View,
      label: "Reports",
      icon: BarChart3,
      roles: ["admin", "manager", "loan_officer"],
    },
    {
      id: "audit-logs" as View,
      label: "Audit Logs",
      icon: ClipboardList,
      roles: ["admin"],
    },
    {
      id: "system-logs" as View,
      label: "System Logs",
      icon: Monitor,
      roles: ["admin"],
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
  ].filter((item) => isNavAllowed(currentUser.role, item.id, permissionSettings));

  const adminPrimaryItems = [
    {
      id: "dashboard" as View,
      label: "Dashboard",
      icon: LayoutDashboard,
    },
  ].filter((item) => isNavAllowed(currentUser.role, item.id, permissionSettings));

  const adminAlertsItem = [
    {
      id: "alerts" as View,
      label: "Alerts",
      icon: Bell,
    },
  ].filter((item) => isNavAllowed(currentUser.role, item.id, permissionSettings));

  const adminSecondaryItems = [
    {
      id: "reports" as View,
      label: "Reports",
      icon: BarChart3,
    },
    {
      id: "user-management" as View,
      label: "User Management",
      icon: UserCog,
    },
  ].filter((item) => isNavAllowed(currentUser.role, item.id, permissionSettings));

  const adminNavGroups = [
    {
      id: "loan-management" as const,
      label: "Loan Management",
      icon: FileText,
      items: [
        {
          id: "applications" as View,
          label: "Loan Applications",
          icon: FileText,
        },
        {
          id: "borrowers" as View,
          label: "Borrowers",
          icon: Users,
        },
        {
          id: "loan-continuity" as View,
          label: "Loan Continuity",
          icon: Repeat,
        },
      ].filter((item) => isNavAllowed(currentUser.role, item.id, permissionSettings)),
    },
    {
      id: "finance" as const,
      label: "Finance",
      icon: Wallet,
      items: [
        {
          id: "disbursements" as View,
          label: "Disbursements",
          icon: Wallet,
        },
        {
          id: "repayments" as View,
          label: "Repayments",
          icon: CreditCard,
        },
        {
          id: "wallet" as View,
          label: "Wallet",
          icon: Wallet,
        },
      ].filter((item) => isNavAllowed(currentUser.role, item.id, permissionSettings)),
    },
    {
      id: "security" as const,
      label: "Security",
      icon: Shield,
      items: [
        {
          id: "permissions" as View,
          label: "Permissions",
          icon: Shield,
        },
        {
          id: "audit-logs" as View,
          label: "Audit Logs",
          icon: ClipboardList,
        },
        {
          id: "system-logs" as View,
          label: "System Logs",
          icon: Monitor,
        },
      ].filter((item) => isNavAllowed(currentUser.role, item.id, permissionSettings)),
    },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className="app-sidebar w-64"
      >
        <div className="p-6 border-b border-green-800">
          <div className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt="Loan Management System logo"
              className="w-8 h-8 object-contain"
              loading="eager"
            />
            <h1 className="font-semibold leading-tight">
              Gonzales LMS
            </h1>
          </div>

          <p className="text-xs uppercase text-center mt-2">
            {currentUser.role.replace("_", " ")}
          </p>
        </div>

        <nav className="p-4 space-y-1">
          {isAdmin ? (
            <>
              {adminPrimaryItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentView(item.id);
                      setShowProfileMenu(false);
                    }}
                    className={`app-nav-btn w-full flex items-center justify-start text-left rounded-lg ${
                      currentView === item.id ? "active" : ""
                    }`}
                  >
                    <Icon
                      className="app-nav-icon"
                      strokeWidth={1.5}
                    />
                    <span className="app-nav-label">{item.label}</span>
                  </button>
                );
              })}

              {adminNavGroups.slice(0, 2).map((group) => {
                if (group.items.length === 0) return null;
                const GroupIcon = group.icon;
                const isOpen = openNavGroups[group.id];
                return (
                  <div key={group.id} className="space-y-1">
                    <button
                      onClick={() =>
                        setOpenNavGroups((prev) => {
                          const nextOpen = !prev[group.id];
                          return {
                            "loan-management": false,
                            finance: false,
                            security: false,
                            [group.id]: nextOpen,
                          };
                        })
                      }
                      className="app-nav-btn w-full flex items-center justify-start text-left rounded-lg"
                      aria-expanded={isOpen}
                      aria-controls={`nav-${group.id}`}
                    >
                      <GroupIcon className="app-nav-icon" strokeWidth={1.5} />
                      <span className="app-nav-label flex-1">{group.label}</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div id={`nav-${group.id}`} className="ml-2 space-y-1">
                        {group.items.map((item) => {
                          const ItemIcon = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                setCurrentView(item.id);
                                setShowProfileMenu(false);
                              }}
                              className={`app-nav-sub-btn w-full flex items-center justify-start text-left rounded-lg ${
                                currentView === item.id ? "active" : ""
                              }`}
                            >
                              <ItemIcon className="app-nav-icon" strokeWidth={1.5} />
                              <span className="app-nav-label">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {adminAlertsItem.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentView(item.id);
                      setShowProfileMenu(false);
                    }}
                    className={`app-nav-btn w-full flex items-center justify-start text-left rounded-lg ${
                      currentView === item.id ? "active" : ""
                    }`}
                  >
                    <Icon className="app-nav-icon" strokeWidth={1.5} />
                    <span className="app-nav-label">{item.label}</span>
                  </button>
                );
              })}

              {adminSecondaryItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentView(item.id);
                      setShowProfileMenu(false);
                    }}
                    className={`app-nav-btn w-full flex items-center justify-start text-left rounded-lg ${
                      currentView === item.id ? "active" : ""
                    }`}
                  >
                    <Icon className="app-nav-icon" strokeWidth={1.5} />
                    <span className="app-nav-label">{item.label}</span>
                  </button>
                );
              })}

              {adminNavGroups.slice(2).map((group) => {
                if (group.items.length === 0) return null;
                const GroupIcon = group.icon;
                const isOpen = openNavGroups[group.id];
                return (
                  <div key={group.id} className="space-y-1">
                    <button
                      onClick={() =>
                        setOpenNavGroups((prev) => {
                          const nextOpen = !prev[group.id];
                          return {
                            "loan-management": false,
                            finance: false,
                            security: false,
                            [group.id]: nextOpen,
                          };
                        })
                      }
                      className="app-nav-btn w-full flex items-center justify-start text-left rounded-lg"
                      aria-expanded={isOpen}
                      aria-controls={`nav-${group.id}`}
                    >
                      <GroupIcon className="app-nav-icon" strokeWidth={1.5} />
                      <span className="app-nav-label flex-1">{group.label}</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div id={`nav-${group.id}`} className="ml-2 space-y-1">
                        {group.items.map((item) => {
                          const ItemIcon = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                setCurrentView(item.id);
                                setShowProfileMenu(false);
                              }}
                              className={`app-nav-sub-btn w-full flex items-center justify-start text-left rounded-lg ${
                                currentView === item.id ? "active" : ""
                              }`}
                            >
                              <ItemIcon className="app-nav-icon" strokeWidth={1.5} />
                              <span className="app-nav-label">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentView(item.id);
                    setShowProfileMenu(false);
                  }}
                  className={`app-nav-btn w-full flex items-center justify-start text-left rounded-lg ${
                    currentView === item.id ? "active" : ""
                  }`}
                >
                  <Icon
                    className="app-nav-icon"
                    strokeWidth={1.5}
                  />
                  <span className="app-nav-label">{item.label}</span>
                </button>
              );
            })
          )}
        </nav>

        <div className="absolute bottom-0 w-64 p-4 border-t border-green-800" />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div
          className="app-header sticky top-0 z-40 border-b px-6 flex items-center justify-end gap-3"
          style={{ height: '64px' }}
        >
          <div className="relative" ref={notificationsMenuRef}>
            <button
              onClick={handleToggleNotifications}
              className="relative flex items-center justify-center w-10 h-10 border border-green-700 rounded-lg"
              aria-label="Open notifications"
            >
              <Bell className="w-5 h-5 text-green-100" />
              {unreadCount > 0 && (
                <>
                  <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500" />
                  <span className="absolute top-0 right-0 translate-x-1/3 -translate-y-1/3 h-5 min-w-[22px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                    +{unreadCount > 9 ? "9" : unreadCount}
                  </span>
                </>
              )}
            </button>
            {showNotificationsMenu && (
              <div
                className="notifications-dropdown fixed top-20 -translate-x-1/2 w-[500px] bg-white border border-gray-200 rounded-lg shadow-lg z-50"
                style={{ left: "calc(50% + 10rem)" }}
              >
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="text-sm font-semibold text-black-100">
                    Notifications
                  </div>
                  <div className="text-xs text-black">Latest updates</div>
                </div>
                <div className="max-h-52 overflow-auto">
                  {headerNotifications.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-black text-center">
                      No notifications yet.
                    </div>
                  ) : (
                    headerNotifications.map((note) => (
                      <div key={note.id} className="px-4 py-2 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm text-black font-medium truncate">
                                {note.title}
                              </div>
                              {note.status === "unread" && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-black">
                                  New
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-black truncate">
                              {note.message}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <button
                  onClick={() => {
                    setCurrentView("notifications");
                    setShowNotificationsMenu(false);
                  }}
                  className="notifications-showall w-full text-sm px-4 py-3 text-center text-black"
                >
                  Show All Activities
                </button>
              </div>
            )}
          </div>
          <div className="relative inline-flex" ref={profileMenuRef}>
            <button
              onClick={() => setShowProfileMenu((prev) => !prev)}
              className="flex items-center gap-2 px-3 py-2 border border-green-700 rounded-lg width-auto"
            >
              {currentUser.profileImage ? (
                <img
                  src={currentUser.profileImage}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <span className="w-8 h-8 rounded-full bg-green-800 text-green-100 flex items-center justify-center border border-green-700">
                  <UserIcon className="w-4 h-4" />
                </span>
              )}
              <span className="text-sm text-green-100">
                {getLastName(currentUser.name)}
              </span>
            </button>
            {showProfileMenu && (
              <div className="profile-dropdown absolute right-0 top-full mt-2 w-full bg-white border rounded-lg shadow-lg z-40 flex flex-col">
                <button
                  onClick={() => {
                    setProfileTab("details");
                    setCurrentView("profile");
                    setShowProfileMenu(false);
                  }}
                  className="profile-action text-left px-4 py-2 text-sm whitespace-nowrap"
                >
                  Profile
                </button>
                <button
                  onClick={() => {
                    setProfileTab("security");
                    setCurrentView("profile");
                    setShowProfileMenu(false);
                  }}
                  className="profile-action text-left px-4 py-2 text-sm whitespace-nowrap"
                >
                  Account
                </button>
                <div className="border-t border-green-100" />
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    handleLogout();
                  }}
                  className="logout-btn text-left px-4 py-2 text-sm whitespace-nowrap"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="app-content p-8" style={{ paddingTop: '64px' }}>
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
          {currentView === "wallet" && (
            <WalletPage user={currentUser} />
          )}
          {currentView === "alerts" && (
            <AlertsCenter user={currentUser} />
          )}
          {currentView === "loan-continuity" && (
            <LoanContinuityActions user={currentUser} />
          )}
          {currentView === "reports" && (
            <Reports user={currentUser} />
          )}
          {currentView === "permissions" && (
            <PermissionSettings
              key={`permissions-${permissionsKey}`}
              onUpdated={(next) => setPermissionSettings(next)}
            />
          )}
          {currentView === "audit-logs" && (
            <AuditLogs />
          )}
          {currentView === "system-logs" && (
            <SystemLogs />
          )}
          {currentView === "notifications" && (
            <NotificationsCenter user={currentUser} />
          )}
          {currentView === "profile" &&
            (currentUser.role === "borrower" ? (
              <BorrowerProfile
                user={currentUser}
                initialTab={profileTab}
                onProfileUpdated={(updates) =>
                  setCurrentUser((prev) =>
                    prev ? { ...prev, ...updates } : prev,
                  )
                }
              />
            ) : (
              <UserProfile
                user={currentUser}
                initialTab={profileTab}
                onProfileUpdated={(updates) =>
                  setCurrentUser((prev) =>
                    prev ? { ...prev, ...updates } : prev,
                  )
                }
              />
            ))}
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
