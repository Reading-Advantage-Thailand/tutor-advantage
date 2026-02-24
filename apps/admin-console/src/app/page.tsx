"use client";

import { useEffect, useState } from "react";

// A simple dashboard overview using the API wrapper
export default function DashboardPage() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRole(localStorage.getItem("admin_role"));
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900">
          Welcome to Admin Console
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          You are currently logged in as{" "}
          <span className="font-bold text-indigo-600">{role || "ADMIN"}</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Total Settlements
          </h4>
          <p className="mt-2 text-3xl font-bold text-gray-900">--</p>
          <p className="mt-1 text-sm text-gray-500">Last 30 days</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Pending Approvals
          </h4>
          <p className="mt-2 text-3xl font-bold text-yellow-600">--</p>
          <p className="mt-1 text-sm text-gray-500">Requires Checker Action</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            System Health
          </h4>
          <p className="mt-2 text-3xl font-bold text-green-600">100%</p>
          <p className="mt-1 text-sm text-gray-500">All services operational</p>
        </div>
      </div>
    </div>
  );
}
