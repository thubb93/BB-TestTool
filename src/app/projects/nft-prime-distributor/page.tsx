"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Gem } from "lucide-react";
import { getSettings } from "@/lib/storage";
import type { DatabaseConnection } from "@/types";
import SetupPanel, { TEST_EMAILS, computeCronValue } from "./_components/setup-panel";
import OrderStatusTable from "./_components/order-status-table";

interface FetchResult {
  orders: unknown[];
  transactions: unknown[];
  cronValue: string | null;
  cronKeyCol: string | null;
  cronValCol: string | null;
}

export default function NftPrimeDistributorPage() {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [checkedEmails, setCheckedEmails] = useState<string[]>(TEST_EMAILS);
  const [mounted, setMounted] = useState(false);

  const [fetching, setFetching] = useState(false);
  const [updatingDates, setUpdatingDates] = useState(false);
  const [updatingCron, setUpdatingCron] = useState(false);

  const [result, setResult] = useState<FetchResult | null>(null);
  const [cronNext, setCronNext] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const dbs = getSettings().databases;
    setConnections(dbs);
    if (dbs.length) setConnectionId(dbs[0].id);
    setMounted(true);
  }, []);

  function getConn() {
    return connections.find(c => c.id === connectionId);
  }

  function dbPayload() {
    const c = getConn()!;
    return { driver: c.driver, host: c.host, port: c.port, database: c.database, username: c.username, password: c.password };
  }

  function showToast(ok: boolean, text: string) {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 4000);
  }

  function toggleEmail(email: string) {
    setCheckedEmails(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  }

  async function handleFetch() {
    setFetching(true);
    try {
      const res = await fetch("/api/nft-prime-fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dbPayload(), emails: checkedEmails }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setResult({ orders: data.orders, transactions: data.transactions, cronValue: data.cronValue, cronKeyCol: data.cronKeyCol ?? null, cronValCol: data.cronValCol ?? null });
    } catch (err) {
      showToast(false, err instanceof Error ? err.message : String(err));
    } finally {
      setFetching(false);
    }
  }

  async function handleUpdateDates() {
    setUpdatingDates(true);
    try {
      const res = await fetch("/api/nft-prime-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dbPayload(), action: "update_dates", emails: checkedEmails }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      showToast(true, data.message);
      // Refresh to show updated dates
      await handleFetch();
    } catch (err) {
      showToast(false, err instanceof Error ? err.message : String(err));
    } finally {
      setUpdatingDates(false);
    }
  }

  async function handleUpdateCron() {
    const cronValue = computeCronValue();
    setUpdatingCron(true);
    try {
      const res = await fetch("/api/nft-prime-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dbPayload(), action: "update_cron", cronValue, cronKeyCol: result?.cronKeyCol, cronValCol: result?.cronValCol }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setCronNext(cronValue);
      setResult(prev => prev ? { ...prev, cronValue: cronValue } : prev);
      showToast(true, data.message);
    } catch (err) {
      showToast(false, err instanceof Error ? err.message : String(err));
    } finally {
      setUpdatingCron(false);
    }
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="page-topbar">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0">
            <ChevronLeft className="w-3.5 h-3.5" />
            Projects
          </Link>
          <span className="text-gray-200">/</span>
          <div>
            <h1 className="text-[18px] font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Gem className="w-5 h-5 text-violet-500" />
              NFT Prime Distributor
            </h1>
            <p className="text-[11px] text-gray-400 leading-none mt-0.5">
              Set up end_date + cron to trigger Art Prime distribution
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 max-w-6xl mx-auto">
        {/* Toast */}
        {toast && (
          <div className={`mb-4 card p-3 text-[13px] border ${toast.ok ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
            {toast.text}
          </div>
        )}

        {connections.length === 0 ? (
          <div className="card p-10 text-center">
            <Gem className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="text-[14px] text-gray-600 font-medium">No database connections configured</p>
            <p className="text-[12px] text-gray-400 mt-1">
              Add a DB connection in{" "}
              <Link href="/settings" className="text-blue-500 hover:underline">Settings</Link> first.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
            <SetupPanel
              connections={connections}
              connectionId={connectionId}
              checkedEmails={checkedEmails}
              fetching={fetching}
              updatingDates={updatingDates}
              updatingCron={updatingCron}
              onConnectionChange={setConnectionId}
              onToggleEmail={toggleEmail}
              onFetch={handleFetch}
              onUpdateDates={handleUpdateDates}
              onUpdateCron={handleUpdateCron}
            />

            {result ? (
              <OrderStatusTable
                orders={result.orders as never[]}
                transactions={result.transactions as never[]}
                cronValue={result.cronValue}
                cronNext={cronNext}
              />
            ) : (
              <div className="card p-16 text-center text-gray-400">
                <Gem className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-[13px]">Select emails and click Fetch Orders to view current state.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
