"use client";

import { useState } from "react";
import { fetchWithAuth } from "../../lib/api";

export interface SettlementPreview {
  snapshotId: string;
  periodMonth: string;
  totalPayoutSatang: number;
  status: string;
}

export default function SettlementsPage() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)); // default to YYYY-MM
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SettlementPreview | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handlePreview = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    setResult(null);

    try {
      const data = await fetchWithAuth("/v1/settlements/preview", {
        method: "POST",
        body: JSON.stringify({ periodMonth: period }),
      });
      setResult(data.preview);
    } catch (error) {
      const err = error as Error;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!result?.snapshotId) return;

    setLoading(true);
    setError("");

    try {
      await fetchWithAuth(`/v1/settlements/${result.snapshotId}/approve`, {
        method: "POST",
      });
      setSuccess("Settlement approved successfully!");
      setResult({ ...result, status: "APPROVED" });
    } catch (error) {
      const err = error as Error;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Run Monthly Settlement
          </h3>
          <p className="text-sm text-gray-500">
            Preview and approve payouts for tutors based on their MLM tree
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border px-3 py-2"
          />
          <button
            onClick={handlePreview}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Processing..." : "Generate Preview"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Snapshot: {result.snapshotId}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Period: {result.periodMonth}
              </p>
            </div>
            <div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  result.status === "APPROVED"
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {result.status}
              </span>
            </div>
          </div>

          <div className="px-4 py-5 sm:p-6 flex flex-col items-center justify-center my-8">
            <div className="text-center">
              <dt className="text-sm font-medium text-gray-500 truncate">
                Total Payout Volume
              </dt>
              <dd className="mt-1 text-5xl font-semibold text-gray-900 border-b-4 border-indigo-500 pb-2">
                {(result.totalPayoutSatang / 100).toLocaleString("th-TH", {
                  style: "currency",
                  currency: "THB",
                })}
              </dd>
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-4 sm:px-6 flex justify-end">
            <button
              onClick={handleApprove}
              disabled={loading || result.status !== "DRAFT"}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              Approve & Execute Settlement
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
