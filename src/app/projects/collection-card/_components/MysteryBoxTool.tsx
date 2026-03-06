"use client";

import { useState, useEffect, useRef } from "react";
import type { DBDriver } from "@/types";
import { DatabaseConnection } from "@/types";
import { getSettings } from "@/lib/storage";
import {
  Play, Square, Loader2, CheckCircle2, AlertCircle,
  BarChart3, List, FileText, Settings, Trash2, ChevronDown, ChevronRight, ChevronLeft,
} from "lucide-react";
import Link from "next/link";

const MYSTERY_BOX_URL = "https://uat-api-wallet.aiavatar.fun/collection-card/v1/mystery-box/open";
const MANUAL_ID = "__manual__";
const STORAGE_KEY = "bb_mystery_box_config";
const LOG_PAGE_SIZE = 100;

const DEFAULT_SQL =
  `DELETE from UAT_SUZU_MYPAGE.card_spin_history csh where ticket_id in (Select id from UAT_SUZU_MYPAGE.card_spin_ticket where order_id = {order_id} and orders_item_id = {orders_item_id} and pack_id = {pack_id} );\nUpdate UAT_SUZU_MYPAGE.card_spin_ticket set status = 1 where order_id = {order_id} and orders_item_id = {orders_item_id} and pack_id = {pack_id} ;`;

function parseBoxId(id: string) {
  const parts = id.split("-");
  return { orderId: parts[0] ?? "", ordersItemId: parts[1] ?? "", packId: parts[2] ?? "" };
}

const DEFAULT_PORTS: Record<string, number> = {
  mysql: 3306, postgresql: 5432, mssql: 1433,
};

const RARITY_META: Record<string, { label: string; color: string; bar: string }> = {
  C:  { label: "Common",    color: "text-gray-600 bg-gray-100",    bar: "bg-gray-400"   },
  UC: { label: "Uncommon",  color: "text-green-600 bg-green-50",   bar: "bg-green-400"  },
  R:  { label: "Rare",      color: "text-blue-600 bg-blue-50",     bar: "bg-blue-400"   },
  E:  { label: "Epic",      color: "text-purple-600 bg-purple-50", bar: "bg-purple-400" },
  L:  { label: "Legendary", color: "text-amber-600 bg-amber-50",   bar: "bg-amber-400"  },
};

interface CardResult {
  iteration: number;
  id: number;
  name: string;
  sku: string;
  rarity: string;
}

interface IterationLog {
  iteration: number;
  status: "success" | "error";
  cardsCount: number;
  sqlOk: boolean;
  sqlSkipped: boolean;
  error?: string;
  responseBody?: unknown;
  duration?: number; // ms
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

interface EffectiveDb {
  driver: DBDriver;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

interface Props {
  authToken: string;
}

export default function MysteryBoxTool({ authToken }: Props) {
  // Saved connections from Settings
  const [databases, setDatabases] = useState<DatabaseConnection[]>([]);
  const [selectedDbId, setSelectedDbId] = useState("");

  // Manual connection fields (used when selectedDbId === MANUAL_ID)
  const [manualDriver, setManualDriver] = useState<"mysql" | "postgresql" | "mssql">("mysql");
  const [manualHost, setManualHost] = useState("localhost");
  const [manualPort, setManualPort] = useState(3306);
  const [manualDatabase, setManualDatabase] = useState("");
  const [manualUsername, setManualUsername] = useState("");
  const [manualPassword, setManualPassword] = useState("");

  // API config
  const [boxId, setBoxId] = useState("7055584985400-446443-1");
  const [numberTicketUse, setNumberTicketUse] = useState(1);
  const [iterations, setIterations] = useState(1);
  const [sqlTemplate, setSqlTemplate] = useState(DEFAULT_SQL);

  // Run state
  const [running, setRunning] = useState(false);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [allCards, setAllCards] = useState<CardResult[]>([]);
  const [logs, setLogs] = useState<IterationLog[]>([]);
  const [viewMode, setViewMode] = useState<"stats" | "cards" | "log">("stats");
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [logPage, setLogPage] = useState(1);

  const stopRef = useRef(false);
  const loadedRef = useRef(false);

  // ── Load from localStorage on mount ───────────────────────────────────────
  useEffect(() => {
    const settings = getSettings();
    setDatabases(settings.databases);

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const cfg = JSON.parse(raw);
        if (cfg.boxId !== undefined)         setBoxId(cfg.boxId);
        if (cfg.numberTicketUse !== undefined) setNumberTicketUse(cfg.numberTicketUse);
        if (cfg.iterations !== undefined)     setIterations(cfg.iterations);
        if (cfg.sqlTemplate !== undefined)    setSqlTemplate(cfg.sqlTemplate);
        if (cfg.selectedDbId)                 setSelectedDbId(cfg.selectedDbId);
        else if (settings.databases.length > 0) setSelectedDbId(settings.databases[0].id);
        if (cfg.manualDriver !== undefined)   setManualDriver(cfg.manualDriver);
        if (cfg.manualHost !== undefined)     setManualHost(cfg.manualHost);
        if (cfg.manualPort !== undefined)     setManualPort(cfg.manualPort);
        if (cfg.manualDatabase !== undefined) setManualDatabase(cfg.manualDatabase);
        if (cfg.manualUsername !== undefined) setManualUsername(cfg.manualUsername);
        if (cfg.manualPassword !== undefined) setManualPassword(cfg.manualPassword);
      } catch { /* ignore */ }
    } else {
      // No saved config — use first DB if available
      if (settings.databases.length > 0) setSelectedDbId(settings.databases[0].id);
    }

    loadedRef.current = true;
  }, []);

  // ── Auto-save config to localStorage on any change ────────────────────────
  useEffect(() => {
    if (!loadedRef.current) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      boxId, numberTicketUse, iterations, sqlTemplate,
      selectedDbId, manualDriver, manualHost, manualPort, manualDatabase, manualUsername, manualPassword,
    }));
  }, [boxId, numberTicketUse, iterations, sqlTemplate,
      selectedDbId, manualDriver, manualHost, manualPort, manualDatabase, manualUsername, manualPassword]);

  // ── Resolve effective DB config ────────────────────────────────────────────
  const effectiveDb: EffectiveDb | null = (() => {
    if (!selectedDbId) return null;
    if (selectedDbId === MANUAL_ID) {
      if (!manualDatabase.trim()) return null;
      return { driver: manualDriver, host: manualHost, port: manualPort, database: manualDatabase, username: manualUsername, password: manualPassword };
    }
    const saved = databases.find((d) => d.id === selectedDbId);
    return saved ? { driver: saved.driver, host: saved.host, port: saved.port, database: saved.database, username: saved.username, password: saved.password } : null;
  })();

  function extractCards(data: unknown, iteration: number): CardResult[] {
    let arr: unknown[] = [];
    if (Array.isArray(data)) {
      arr = data;
    } else if (data && typeof data === "object") {
      const d = data as Record<string, unknown>;
      if (Array.isArray(d.data)) arr = d.data;
      else if (d.data && typeof d.data === "object") {
        const inner = d.data as Record<string, unknown>;
        if (Array.isArray(inner.list)) arr = inner.list;
        else if (Array.isArray(inner.data)) arr = inner.data;
      }
    }
    return arr.map((item) => {
      const c = item as Record<string, unknown>;
      return {
        iteration,
        id: Number(c.id ?? 0),
        name: String(c.name ?? ""),
        sku: String(c.sku ?? ""),
        rarity: String(c.rarity ?? ""),
      };
    });
  }

  async function handleStart() {
    setRunning(true);
    stopRef.current = false;
    setAllCards([]);
    setLogs([]);
    setCurrentIteration(0);
    setExpandedLogs(new Set());
    setLogPage(1);

    for (let i = 1; i <= iterations; i++) {
      if (stopRef.current) break;
      setCurrentIteration(i);

      const t0 = Date.now();
      try {
        const proxyRes = await fetch("/api/proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: MYSTERY_BOX_URL,
            method: "POST",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            body: { boxId, numberTicketUse },
          }),
        });
        const proxyJson = await proxyRes.json();
        const cards = extractCards(proxyJson.data, i);

        let sqlOk = true;
        let sqlError: string | undefined;
        const sqlSkipped = !effectiveDb;

        if (effectiveDb && sqlTemplate.trim()) {
          const { orderId, ordersItemId, packId } = parseBoxId(boxId);
          const queries = sqlTemplate
            .split(";")
            .map((q) => q.trim())
            .filter(Boolean)
            .map((q) => q
              .replace(/\{order_id\}/g, orderId)
              .replace(/\{orders_item_id\}/g, ordersItemId)
              .replace(/\{pack_id\}/g, packId));

          const sqlRes = await fetch("/api/db-query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...effectiveDb, queries }),
          });
          const sqlJson = await sqlRes.json();
          sqlOk = sqlJson.success;
          sqlError = sqlJson.message;
        }

        const duration = Date.now() - t0;
        setAllCards((prev) => [...prev, ...cards]);
        setLogs((prev) => [...prev, { iteration: i, status: "success", cardsCount: cards.length, sqlOk, sqlSkipped, error: sqlError, responseBody: proxyJson, duration }]);
      } catch (err) {
        const duration = Date.now() - t0;
        setLogs((prev) => [...prev, { iteration: i, status: "error", cardsCount: 0, sqlOk: false, sqlSkipped: !effectiveDb, error: err instanceof Error ? err.message : String(err), duration }]);
      }

      if (i < iterations && !stopRef.current) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    setRunning(false);
  }

  function handleClearResults() {
    setAllCards([]);
    setLogs([]);
    setCurrentIteration(0);
  }

  // ── Derived stats ──────────────────────────────────────────────────────────
  const total = allCards.length;
  const rarityStats = allCards.reduce<Record<string, number>>((acc, c) => {
    acc[c.rarity] = (acc[c.rarity] ?? 0) + 1;
    return acc;
  }, {});
  const sortedRarities = Object.entries(rarityStats).sort((a, b) => b[1] - a[1]);
  const progress = iterations > 0 ? (currentIteration / iterations) * 100 : 0;
  const hasResults = allCards.length > 0 || logs.length > 0;
  const durations = logs.map((l) => l.duration).filter((d): d is number => d !== undefined);
  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const eta = avgDuration > 0 ? avgDuration * (iterations - currentIteration) : 0;
  const isManual = selectedDbId === MANUAL_ID;
  const sortedLogs = [...logs].sort((a, b) => {
    const aFailed = a.status === "error" || (!a.sqlOk && !a.sqlSkipped);
    const bFailed = b.status === "error" || (!b.sqlOk && !b.sqlSkipped);
    if (aFailed !== bFailed) return aFailed ? -1 : 1;
    return a.iteration - b.iteration;
  });
  const totalLogPages = Math.max(1, Math.ceil(sortedLogs.length / LOG_PAGE_SIZE));
  const pagedLogs = sortedLogs.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Config */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Mystery Box Configuration</span>
          <div className="flex items-center gap-2">
            {hasResults && !running && (
              <button onClick={handleClearResults} className="btn-secondary text-xs h-8 px-3 text-red-500 hover:text-red-600 hover:bg-red-50 border-red-100">
                <Trash2 className="w-3.5 h-3.5" />Clear Results
              </button>
            )}
            {running ? (
              <button onClick={() => { stopRef.current = true; }} className="btn-danger">
                <Square className="w-3.5 h-3.5" />Stop
              </button>
            ) : (
              <button onClick={handleStart} className="btn-primary">
                <Play className="w-4 h-4" />Start Test
              </button>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Row 1 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="label">Box ID <span className="text-gray-400 font-normal normal-case tracking-normal">— format: order_id-orders_item_id-pack_id</span></label>
              <input className="input font-mono text-[12px]" value={boxId} onChange={(e) => setBoxId(e.target.value)} disabled={running} placeholder="7055584985400-446443-1" />
              {(() => { const { orderId, ordersItemId, packId } = parseBoxId(boxId); return orderId ? (
                <p className="mt-1 text-[10px] font-mono text-gray-400">
                  order_id: <span className="text-gray-600">{orderId}</span>
                  {" · "}orders_item_id: <span className="text-gray-600">{ordersItemId}</span>
                  {" · "}pack_id: <span className="text-gray-600">{packId}</span>
                </p>
              ) : null; })()}
            </div>
            <div>
              <label className="label">Tickets per open</label>
              <input className="input" type="number" min={1} value={numberTicketUse} onChange={(e) => setNumberTicketUse(Number(e.target.value))} disabled={running} />
            </div>
            <div>
              <label className="label">Iterations</label>
              <input className="input" type="number" min={1} max={1000} value={iterations} onChange={(e) => setIterations(Number(e.target.value))} disabled={running} />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Database (SQL reset)</label>
                {databases.length === 0 && (
                  <Link href="/settings" className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700">
                    <Settings className="w-3 h-3" />Add in Settings
                  </Link>
                )}
              </div>
              <select
                className="input"
                value={selectedDbId}
                onChange={(e) => setSelectedDbId(e.target.value)}
                disabled={running}
              >
                <option value="">— Skip SQL —</option>
                {databases.map((db) => (
                  <option key={db.id} value={db.id}>{db.name}</option>
                ))}
                <option value={MANUAL_ID}>✎ Enter manually...</option>
              </select>
            </div>
          </div>

          {/* Manual DB fields */}
          {isManual && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div>
                <label className="label">Driver</label>
                <select
                  className="input"
                  value={manualDriver}
                  onChange={(e) => {
                    const d = e.target.value as "mysql" | "postgresql" | "mssql";
                    setManualDriver(d);
                    setManualPort(DEFAULT_PORTS[d] ?? 3306);
                  }}
                  disabled={running}
                >
                  <option value="mysql">MySQL</option>
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mssql">SQL Server</option>
                </select>
              </div>
              <div>
                <label className="label">Host</label>
                <input className="input" value={manualHost} onChange={(e) => setManualHost(e.target.value)} disabled={running} placeholder="localhost" />
              </div>
              <div>
                <label className="label">Port</label>
                <input className="input" type="number" value={manualPort} onChange={(e) => setManualPort(Number(e.target.value))} disabled={running} />
              </div>
              <div>
                <label className="label">Database</label>
                <input className="input" value={manualDatabase} onChange={(e) => setManualDatabase(e.target.value)} disabled={running} placeholder="database_name" />
              </div>
              <div>
                <label className="label">Username</label>
                <input className="input" value={manualUsername} onChange={(e) => setManualUsername(e.target.value)} disabled={running} placeholder="username" />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" value={manualPassword} onChange={(e) => setManualPassword(e.target.value)} disabled={running} placeholder="••••••••" />
              </div>
            </div>
          )}

          {/* SQL Template */}
          <div>
            <label className="label">
              SQL Reset Queries
              <span className="ml-1 text-gray-400 font-normal normal-case tracking-normal">
                — use <code className="bg-gray-100 px-1 rounded text-[10px]">{"{order_id}"}</code> <code className="bg-gray-100 px-1 rounded text-[10px]">{"{orders_item_id}"}</code> <code className="bg-gray-100 px-1 rounded text-[10px]">{"{pack_id}"}</code>, separate with <code className="bg-gray-100 px-1 rounded text-[10px]">;</code>
              </span>
            </label>
            <textarea
              className="input font-mono text-[11px] leading-relaxed resize-none w-full"
              rows={3}
              value={sqlTemplate}
              onChange={(e) => setSqlTemplate(e.target.value)}
              disabled={running}
              spellCheck={false}
            />
          </div>
        </div>
      </section>

      {/* Progress bar */}
      {(running || currentIteration > 0) && (
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in">
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {running && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
                <span className="text-[12px] font-medium text-gray-700">
                  {running
                    ? `Running iteration ${currentIteration} / ${iterations}…`
                    : `Completed ${currentIteration} / ${iterations} iterations`}
                </span>
              </div>
              <span className="text-[11px] text-gray-400 tabular-nums">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center gap-4 text-[11px] text-gray-400 flex-wrap">
              <span><strong className="text-gray-700 tabular-nums">{total}</strong> cards collected</span>
              <span><strong className="text-gray-700 tabular-nums">{logs.filter((l) => l.status === "error").length}</strong> errors</span>
              {avgDuration > 0 && <span>avg <strong className="text-gray-700">{formatDuration(avgDuration)}</strong> / iter</span>}
              {running && eta > 0 && <span className="text-blue-500">~{formatDuration(eta)} remaining</span>}
              {!effectiveDb && <span className="text-amber-600">SQL skipped (no database selected)</span>}
            </div>
          </div>
        </section>
      )}

      {/* Results */}
      {hasResults && (
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in">
          <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Results · {total} cards · {currentIteration} iterations
            </span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                {(["stats", "cards", "log"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      viewMode === mode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {mode === "stats" && <BarChart3 className="w-3.5 h-3.5" />}
                    {mode === "cards" && <List className="w-3.5 h-3.5" />}
                    {mode === "log"   && <FileText className="w-3.5 h-3.5" />}
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Stats */}
          {viewMode === "stats" && (
            <div className="p-5 space-y-4">
              {total === 0 ? (
                <p className="text-[12px] text-gray-400 text-center py-6">No cards collected yet.</p>
              ) : (
                <>
                  <p className="text-[12px] text-gray-500">
                    Rarity distribution across <strong className="text-gray-900">{currentIteration}</strong> iterations · <strong className="text-gray-900">{total}</strong> total cards
                  </p>
                  <div className="space-y-3">
                    {sortedRarities.map(([rarity, count]) => {
                      const meta = RARITY_META[rarity] ?? { label: rarity, color: "text-gray-600 bg-gray-100", bar: "bg-gray-400" };
                      const pct = (count / total) * 100;
                      return (
                        <div key={rarity} className="flex items-center gap-3">
                          <div className="w-28 flex-shrink-0 text-right">
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${meta.color}`}>
                              {meta.label} ({rarity})
                            </span>
                          </div>
                          <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${meta.bar}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="w-28 flex-shrink-0 text-right">
                            <span className="text-[12px] font-semibold text-gray-900 tabular-nums">{count}</span>
                            <span className="text-[11px] text-gray-400 ml-1.5">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Cards table */}
          {viewMode === "cards" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-10 text-right">#</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Iter.</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">SKU</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rarity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allCards.map((card, i) => {
                    const meta = RARITY_META[card.rarity] ?? { label: card.rarity, color: "text-gray-600 bg-gray-100", bar: "bg-gray-400" };
                    return (
                      <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-2.5 text-[11px] text-gray-300 text-right tabular-nums">{i + 1}</td>
                        <td className="px-4 py-2.5 text-[11px] text-gray-400 tabular-nums">{card.iteration}</td>
                        <td className="px-4 py-2.5 text-[11px] font-mono text-gray-600 tabular-nums">{card.id}</td>
                        <td className="px-4 py-2.5 text-[12px] text-gray-900">{card.name}</td>
                        <td className="px-4 py-2.5 text-[11px] font-mono text-gray-500">{card.sku}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ${meta.color}`}>{card.rarity}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Log */}
          {viewMode === "log" && (
            <div>
              {logs.length === 0 && (
                <p className="px-5 py-6 text-[12px] text-gray-400 text-center">No iterations run yet.</p>
              )}
              {/* Pagination controls */}
              {totalLogPages > 1 && (
                <div className="px-5 py-2.5 border-b border-gray-50 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">
                    Page <strong className="text-gray-700">{logPage}</strong> / {totalLogPages}
                    <span className="ml-2 text-gray-300">·</span>
                    <span className="ml-2">{(logPage - 1) * LOG_PAGE_SIZE + 1}–{Math.min(logPage * LOG_PAGE_SIZE, sortedLogs.length)} of {sortedLogs.length}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button disabled={logPage === 1} onClick={() => setLogPage((p) => p - 1)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft className="w-3.5 h-3.5" />Prev
                    </button>
                    <button disabled={logPage === totalLogPages} onClick={() => setLogPage((p) => p + 1)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      Next<ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
              <div className="divide-y divide-gray-50">
                {pagedLogs.map((log) => {
                  const expanded = expandedLogs.has(log.iteration);
                  const toggle = () => setExpandedLogs((prev) => {
                    const next = new Set(prev);
                    next.has(log.iteration) ? next.delete(log.iteration) : next.add(log.iteration);
                    return next;
                  });
                  const iterCards = allCards.filter((c) => c.iteration === log.iteration);
                  const iterRarities = iterCards.reduce<Record<string, number>>((acc, c) => {
                    acc[c.rarity] = (acc[c.rarity] ?? 0) + 1; return acc;
                  }, {});
                  return (
                    <div key={log.iteration} className="px-5 py-3">
                      {/* Row summary */}
                      <div className="flex items-center gap-3">
                        <button onClick={toggle} className="flex items-center gap-1 text-gray-400 hover:text-gray-700 flex-shrink-0">
                          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {log.status === "success"
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            : <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                          <span className="text-[11px] font-medium text-gray-500">#{log.iteration}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          {log.status === "error" ? (
                            <span className="text-[11px] text-red-500">{log.error}</span>
                          ) : (
                            <span className="text-[11px] text-gray-600">{log.cardsCount} cards</span>
                          )}
                        </div>
                        {/* Rarity preview */}
                        <div className="hidden md:flex items-center gap-1 flex-shrink-0">
                          {Object.entries(iterRarities).map(([rarity, count]) => {
                            const meta = RARITY_META[rarity] ?? { color: "text-gray-600 bg-gray-100" };
                            return (
                              <span key={rarity} className={`inline-flex items-center rounded px-1 py-0.5 text-[9px] font-bold ${meta.color}`}>
                                {rarity}{count > 1 ? `×${count}` : ""}
                              </span>
                            );
                          })}
                        </div>
                        <span className="text-[10px] flex-shrink-0 text-gray-400">
                          {log.sqlSkipped ? "—" : log.sqlOk ? <span className="text-emerald-600">SQL ✓</span> : <span className="text-amber-600">SQL ✗</span>}
                        </span>
                      </div>
                      {/* Expanded */}
                      {expanded && (
                        <div className="mt-3 ml-8 space-y-3">
                          {/* Card grid */}
                          {iterCards.length > 0 && (
                            <div className="grid grid-cols-10 gap-1.5">
                              {iterCards.map((c, idx) => {
                                const meta = RARITY_META[c.rarity] ?? { label: c.rarity, color: "text-gray-600 bg-gray-100" };
                                return (
                                  <div key={idx} title={c.name || c.sku}
                                    className="rounded p-1.5 text-center border bg-gray-50 border-gray-100">
                                    <div className="text-[8px] text-gray-400 mb-0.5">{idx + 1}</div>
                                    <span className={`inline-flex items-center rounded px-1 py-0.5 text-[9px] font-bold ${meta.color}`}>{c.rarity}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {/* Rarity distribution */}
                          {iterCards.length > 0 && (
                            <div className="flex gap-3 text-[10px] text-gray-500 flex-wrap">
                              {Object.entries(iterRarities).sort((a, b) => b[1] - a[1]).map(([rarity, count]) => {
                                const meta = RARITY_META[rarity] ?? { color: "text-gray-600 bg-gray-100" };
                                return (
                                  <span key={rarity} className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.color}`}>
                                    {rarity} × {count}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          {/* JSON response */}
                          {log.responseBody !== undefined && (
                            <details>
                              <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600 select-none">Response JSON</summary>
                              <pre className="mt-1 bg-gray-950 text-green-400 text-[10px] font-mono p-3 rounded-lg overflow-x-auto max-h-52 leading-relaxed">
                                {JSON.stringify(log.responseBody, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
