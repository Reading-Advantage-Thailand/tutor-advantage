"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LayoutDashboard, ReceiptText, LogOut } from "lucide-react";

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("admin_token");
      const savedRole = localStorage.getItem("admin_role");
      if (!token && pathname !== "/login") {
        router.push("/login");
      } else {
        setRole(savedRole);
      }
    }
  }, [pathname, router]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_role");
    router.push("/login");
  };

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex w-full min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold tracking-tight text-white">
            Tutor Advantage
          </h1>
          <p className="text-sm text-slate-400 mt-1">Admin Console</p>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <Link
            href="/"
            className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
              pathname === "/"
                ? "bg-indigo-600 text-white"
                : "hover:bg-slate-800 text-slate-300"
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Dashboard</span>
          </Link>

          <Link
            href="/settlements"
            className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
              pathname?.startsWith("/settlements")
                ? "bg-indigo-600 text-white"
                : "hover:bg-slate-800 text-slate-300"
            }`}
          >
            <ReceiptText size={20} />
            <span className="font-medium">Settlements</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center space-x-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold">
              {role ? role[0] : "A"}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{role || "Admin"}</span>
              <span className="text-xs text-slate-400 text-green-400">
                ● Active
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center space-x-2 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Top Header Placeholder */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 shrink-0">
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">
            {pathname === "/"
              ? "Overview"
              : pathname?.split("/")[1]?.charAt(0).toUpperCase() +
                pathname?.substring(2)}
          </h2>
        </header>

        <div className="flex-1 p-8 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
