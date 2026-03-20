"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, GitBranch } from "lucide-react";
import { getSettings } from "@/lib/storage";
import type { DatabaseConnection } from "@/types";
import type { DistributionVerifyResult } from "@/lib/distribution-verify-types";
import InputPanel, { VerifyRequest } from "./_components/InputPanel";
import ResultSummary from "./_components/ResultSummary";
import CheckList from "./_components/CheckList";
import TimelineChart from "./_components/TimelineChart";
import RawDataTable from "./_components/RawDataTable";
import TriggerPanel from "./_components/TriggerPanel";

export default function DistributionTesterPage() {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [result, setResult] = useState<DistributionVerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [triggerStartTime, setTriggerStartTime] = useState("");
  const [triggerEndTime, setTriggerEndTime] = useState("");

  useEffect(() => {
    setConnections(getSettings().databases);
    setMounted(true);
  }, []);

  async function handleClear({ postId, connection }: VerifyRequest) {
    setClearing(true);
    setClearMsg(null);
    try {
      const res = await fetch("/api/distribution-clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          driver: connection.driver,
          host: connection.host,
          port: connection.port,
          database: connection.database,
          username: connection.username,
          password: connection.password,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Clear failed");
      setClearMsg({ ok: true, text: `Deleted ${data.deleted} row(s) for post #${postId}` });
      // Reset results since data is now cleared
      setResult(null);
      setError(null);
    } catch (err) {
      setClearMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setClearing(false);
    }
  }

  async function handleVerify({ postId, simulatedNow, connection }: VerifyRequest) {
    setClearMsg(null);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/distribution-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          simulatedNow,
          driver: connection.driver,
          host: connection.host,
          port: connection.port,
          database: connection.database,
          username: connection.username,
          password: connection.password,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Verification failed");
      setResult(data.result);
      // Auto-fill trigger time range from post data
      if (data.result.post.startAt) setTriggerStartTime(data.result.post.startAt);
      if (data.result.post.endAt) setTriggerEndTime(data.result.post.endAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="page-topbar">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Projects
          </Link>
          <span className="text-gray-200">/</span>
          <div>
            <h1 className="text-[18px] font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-violet-500" />
              Distribution Engine Tester
            </h1>
            <p className="text-[11px] text-gray-400 leading-none mt-0.5">
              Verify influencer post distribution logic against database
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 max-w-6xl mx-auto">
        {connections.length === 0 ? (
          <div className="card p-10 text-center">
            <GitBranch className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="text-[14px] text-gray-600 font-medium">No database connections configured</p>
            <p className="text-[12px] text-gray-400 mt-1">
              Add a DB connection in{" "}
              <Link href="/settings" className="text-blue-500 hover:underline">Settings</Link>{" "}
              first.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] xl:grid-cols-[340px_1fr] gap-6 items-start">
            {/* Left: Input + Trigger */}
            <div className="space-y-4">
              <InputPanel connections={connections} loading={loading} clearing={clearing} onVerify={handleVerify} onClear={handleClear} />
              <TriggerPanel startTime={triggerStartTime} endTime={triggerEndTime} />
            </div>

            {/* Right: Results */}
            <div className="space-y-4 min-w-0">
              {clearMsg && (
                <div className={`card p-4 border text-[13px] ${clearMsg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                  {clearMsg.text}
                </div>
              )}
              {error && (
                <div className="card p-4 bg-red-50 border border-red-200 text-[13px] text-red-700">
                  <strong>Error:</strong> {error}
                </div>
              )}
              {result && (
                <>
                  <ResultSummary result={result} />
                  <CheckList checks={result.checks} />
                  <TimelineChart result={result} />
                  <RawDataTable rows={result.rawRows} totalCount={result.rawRows.length} />
                </>
              )}
              {!result && !error && !loading && (
                <div className="card p-16 text-center text-gray-400">
                  <GitBranch className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-[13px]">Enter a Post ID and run verification to see results.</p>
                </div>
              )}
              {loading && (
                <div className="card p-16 text-center text-gray-400">
                  <p className="text-[13px]">Querying database and running checks…</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
