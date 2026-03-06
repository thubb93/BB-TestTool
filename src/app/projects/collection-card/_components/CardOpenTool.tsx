"use client";

import { useState, useEffect, useRef } from "react";
import type { DBDriver } from "@/types";
import { DatabaseConnection } from "@/types";
import { getSettings } from "@/lib/storage";
import {
  Play, Square, Loader2, CheckCircle2, AlertCircle,
  BarChart3, List, Settings, Trash2, ChevronDown, ChevronRight, ChevronLeft,
} from "lucide-react";
import Link from "next/link";

const API_URL = "https://uat-api-wallet.aiavatar.fun/collection-card/v1/mystery-box/open";
const HISTORY_PAGE_SIZE = 100;
const MANUAL_ID = "__manual__";
const DEFAULT_SQL = `DELETE from UAT_SUZU_MYPAGE.card_spin_history csh where ticket_id in (Select id from UAT_SUZU_MYPAGE.card_spin_ticket where order_id = {order_id} and orders_item_id = {orders_item_id} and pack_id = {pack_id} );\nUpdate UAT_SUZU_MYPAGE.card_spin_ticket set status = 1 where order_id = {order_id} and orders_item_id = {orders_item_id} and pack_id = {pack_id} ;`;

function parseBoxId(id: string) {
  const parts = id.split("-");
  return { orderId: parts[0] ?? "", ordersItemId: parts[1] ?? "", packId: parts[2] ?? "" };
}
const DEFAULT_PORTS: Record<string, number> = { mysql: 3306, postgresql: 5432, mssql: 1433 };

const RARITY_META: Record<string, { label: string; color: string; bar: string }> = {
  C:   { label: "Common",    color: "text-gray-600 bg-gray-100",    bar: "bg-gray-400"   },
  UC:  { label: "Uncommon",  color: "text-green-600 bg-green-50",   bar: "bg-green-400"  },
  R:   { label: "Rare",      color: "text-blue-600 bg-blue-50",     bar: "bg-blue-400"   },
  E:   { label: "Epic",      color: "text-purple-600 bg-purple-50", bar: "bg-purple-400" },
  L:   { label: "Legendary", color: "text-amber-600 bg-amber-50",   bar: "bg-amber-400"  },
  SS:  { label: "SS",        color: "text-rose-600 bg-rose-50",     bar: "bg-rose-400"   },
};

// ── Mode configuration ─────────────────────────────────────────────────────
interface ModeConfig {
  label: string;
  packSize: number;
  description: string;
  storageKey: string;
  classifyPos: (pos: number) => string;
  patterns: readonly string[];
  patternLabels: Record<string, string>;
  patternColors: Record<string, string>;
  gridCols: string;
}

const MODES: Record<"pack" | "box", ModeConfig> = {
  pack: {
    label: "Card Pack ×5",
    packSize: 5,
    description: "Positions 1–4 → Pattern A · Position 5 → Pattern B",
    storageKey: "bb_card_pack_config",
    classifyPos: (pos) => pos % 5 === 0 ? "B" : "A",
    patterns: ["A", "B"],
    patternLabels: { A: "Pattern A  ·  pos 1–4", B: "Pattern B  ·  pos 5 (pity)" },
    patternColors: { A: "text-blue-600 bg-blue-50", B: "text-purple-600 bg-purple-50" },
    gridCols: "md:grid-cols-2",
  },
  box: {
    label: "Card Box ×50",
    packSize: 50,
    description: "pos 5,10,…,45 → Pattern B (pity) · pos 50 → SS guaranteed · rest → Pattern A",
    storageKey: "bb_card_box_config",
    classifyPos: (pos) => pos === 50 ? "SS" : pos % 5 === 0 ? "B" : "A",
    patterns: ["A", "B", "SS"],
    patternLabels: { A: "Pattern A (normal)", B: "Pattern B (every 5th, pity)", SS: "Position 50 (guaranteed SS)" },
    patternColors: { A: "text-blue-600 bg-blue-50", B: "text-purple-600 bg-purple-50", SS: "text-rose-600 bg-rose-50" },
    gridCols: "md:grid-cols-3",
  },
};

// ── Types ──────────────────────────────────────────────────────────────────
interface OpenCard {
  position: number;
  pattern: string;
  id: number;
  name: string;
  sku: string;
  rarity: string;
}

interface Attempt {
  num: number;
  cards: OpenCard[];
  sqlOk: boolean;
  sqlSkipped: boolean;
  sqlError?: string;
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
  mode: "pack" | "box";
  authToken: string;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function CardOpenTool({ mode, authToken }: Props) {
  const cfg = MODES[mode];

  const [databases, setDatabases] = useState<DatabaseConnection[]>([]);
  const [selectedDbId, setSelectedDbId] = useState("");
  const [manualDriver, setManualDriver] = useState<"mysql" | "postgresql" | "mssql">("mysql");
  const [manualHost, setManualHost] = useState("localhost");
  const [manualPort, setManualPort] = useState(3306);
  const [manualDatabase, setManualDatabase] = useState("");
  const [manualUsername, setManualUsername] = useState("");
  const [manualPassword, setManualPassword] = useState("");

  const [boxId, setBoxId] = useState("7055584985400-446443-1");
  const [numberTicketUse, setNumberTicketUse] = useState(cfg.packSize);
  const [iterations, setIterations] = useState(1);
  const [sqlTemplate, setSqlTemplate] = useState(DEFAULT_SQL);

  const [running, setRunning] = useState(false);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [viewMode, setViewMode] = useState<"stats" | "history">("stats");
  const [expandedAttempts, setExpandedAttempts] = useState<Set<number>>(new Set());
  const [historyPage, setHistoryPage] = useState(1);

  const stopRef = useRef(false);
  const loadedRef = useRef(false);

  // ── Load config from localStorage ────────────────────────────────────────
  useEffect(() => {
    const settings = getSettings();
    setDatabases(settings.databases);

    const raw = localStorage.getItem(cfg.storageKey);
    if (raw) {
      try {
        const c = JSON.parse(raw);
        if (c.boxId !== undefined)            setBoxId(c.boxId);
        if (c.numberTicketUse !== undefined) setNumberTicketUse(c.numberTicketUse);
        if (c.iterations !== undefined)      setIterations(c.iterations);
        if (c.sqlTemplate !== undefined)    setSqlTemplate(c.sqlTemplate);
        if (c.selectedDbId)                 setSelectedDbId(c.selectedDbId);
        else if (settings.databases.length > 0) setSelectedDbId(settings.databases[0].id);
        if (c.manualDriver !== undefined)   setManualDriver(c.manualDriver);
        if (c.manualHost !== undefined)     setManualHost(c.manualHost);
        if (c.manualPort !== undefined)     setManualPort(c.manualPort);
        if (c.manualDatabase !== undefined) setManualDatabase(c.manualDatabase);
        if (c.manualUsername !== undefined) setManualUsername(c.manualUsername);
        if (c.manualPassword !== undefined) setManualPassword(c.manualPassword);
      } catch { /* ignore */ }
    } else {
      if (settings.databases.length > 0) setSelectedDbId(settings.databases[0].id);
    }
    loadedRef.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loadedRef.current) return;
    localStorage.setItem(cfg.storageKey, JSON.stringify({
      boxId, numberTicketUse, iterations, sqlTemplate,
      selectedDbId, manualDriver, manualHost, manualPort, manualDatabase, manualUsername, manualPassword,
    }));
  }, [boxId, numberTicketUse, iterations, sqlTemplate,
      selectedDbId, manualDriver, manualHost, manualPort, manualDatabase, manualUsername, manualPassword,
      cfg.storageKey]);

  // ── Resolve DB ────────────────────────────────────────────────────────────
  const effectiveDb: EffectiveDb | null = (() => {
    if (!selectedDbId) return null;
    if (selectedDbId === MANUAL_ID) {
      if (!manualDatabase.trim()) return null;
      return { driver: manualDriver, host: manualHost, port: manualPort, database: manualDatabase, username: manualUsername, password: manualPassword };
    }
    const saved = databases.find((d) => d.id === selectedDbId);
    return saved ? { driver: saved.driver, host: saved.host, port: saved.port, database: saved.database, username: saved.username, password: saved.password } : null;
  })();

  // ── Extract cards from API response ──────────────────────────────────────
  function extractRaw(data: unknown): Array<Record<string, unknown>> {
    let arr: unknown[] = [];
    if (Array.isArray(data)) arr = data;
    else if (data && typeof data === "object") {
      const d = data as Record<string, unknown>;
      if (Array.isArray(d.data)) arr = d.data;
      else if (d.data && typeof d.data === "object") {
        const inner = d.data as Record<string, unknown>;
        if (Array.isArray(inner.list)) arr = inner.list;
        else if (Array.isArray(inner.data)) arr = inner.data;
      }
    }
    return arr as Array<Record<string, unknown>>;
  }

  // ── Run ───────────────────────────────────────────────────────────────────
  async function handleStart() {
    setRunning(true);
    stopRef.current = false;
    setAttempts([]);
    setCurrentIteration(0);
    setExpandedAttempts(new Set());
    setHistoryPage(1);

    for (let i = 1; i <= iterations; i++) {
      if (stopRef.current) break;
      setCurrentIteration(i);

      const t0 = Date.now();
      try {
        const proxyRes = await fetch("/api/proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: API_URL,
            method: "POST",
            headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
            body: { boxId, numberTicketUse },
          }),
        });
        const proxyJson = await proxyRes.json();
        const rawCards = extractRaw(proxyJson.data);
        const cards: OpenCard[] = rawCards.map((c, idx) => ({
          position: idx + 1,
          pattern: cfg.classifyPos(idx + 1),
          id: Number(c.id ?? 0),
          name: String(c.name ?? ""),
          sku: String(c.sku ?? ""),
          rarity: String(c.rarity ?? ""),
        }));

        let sqlOk = true;
        let sqlError: string | undefined;
        const sqlSkipped = !effectiveDb;

        if (effectiveDb && sqlTemplate.trim()) {
          const { orderId, ordersItemId, packId } = parseBoxId(boxId);
          const queries = sqlTemplate.split(";").map((q) => q.trim()).filter(Boolean)
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
        setAttempts((prev) => [...prev, { num: i, cards, sqlOk, sqlSkipped, sqlError, responseBody: proxyJson, duration }]);
      } catch (err) {
        const duration = Date.now() - t0;
        setAttempts((prev) => [...prev, { num: i, cards: [], sqlOk: false, sqlSkipped: !effectiveDb, sqlError: err instanceof Error ? err.message : String(err), duration }]);
      }

      if (i < iterations && !stopRef.current) await new Promise((r) => setTimeout(r, 200));
    }

    setRunning(false);
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const allCards = attempts.flatMap((a) => a.cards);
  const totalCards = allCards.length;
  const progress = iterations > 0 ? (currentIteration / iterations) * 100 : 0;
  const hasResults = attempts.length > 0;
  const durations = attempts.map((a) => a.duration).filter((d): d is number => d !== undefined);
  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const eta = avgDuration > 0 ? avgDuration * (iterations - currentIteration) : 0;
  const isManual = selectedDbId === MANUAL_ID;
  const sortedAttempts = [...attempts].sort((a, b) => {
    const aFailed = (a.cards.length === 0 && !!a.sqlError) || (!a.sqlOk && !a.sqlSkipped);
    const bFailed = (b.cards.length === 0 && !!b.sqlError) || (!b.sqlOk && !b.sqlSkipped);
    if (aFailed !== bFailed) return aFailed ? -1 : 1;
    return a.num - b.num;
  });
  const totalHistoryPages = Math.max(1, Math.ceil(sortedAttempts.length / HISTORY_PAGE_SIZE));
  const pagedAttempts = sortedAttempts.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE);

  function patternCards(pattern: string) {
    return allCards.filter((c) => c.pattern === pattern);
  }

  function rarityDist(cards: OpenCard[]) {
    const dist: Record<string, number> = {};
    cards.forEach((c) => { dist[c.rarity] = (dist[c.rarity] ?? 0) + 1; });
    return Object.entries(dist).sort((a, b) => b[1] - a[1]);
  }

  function toggleAttempt(num: number) {
    setExpandedAttempts((prev) => {
      const next = new Set(prev);
      next.has(num) ? next.delete(num) : next.add(num);
      return next;
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Config */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{cfg.label}</span>
            <span className="ml-2 text-[10px] text-gray-300 hidden md:inline">{cfg.description}</span>
          </div>
          <div className="flex items-center gap-2">
            {hasResults && !running && (
              <button
                onClick={() => { setAttempts([]); setCurrentIteration(0); setExpandedAttempts(new Set()); }}
                className="btn-secondary text-xs h-8 px-3 text-red-500 hover:text-red-600 hover:bg-red-50 border-red-100"
              >
                <Trash2 className="w-3.5 h-3.5" />Clear
              </button>
            )}
            {running ? (
              <button onClick={() => { stopRef.current = true; }} className="btn-danger">
                <Square className="w-3.5 h-3.5" />Stop
              </button>
            ) : (
              <button onClick={handleStart} className="btn-primary">
                <Play className="w-4 h-4" />Open {mode === "pack" ? "Packs" : "Boxes"}
              </button>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Row 1 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="label">Box ID <span className="text-gray-400 font-normal normal-case tracking-normal">— order_id-orders_item_id-pack_id</span></label>
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
              <input className="input" type="number" min={1} max={1000} value={numberTicketUse} onChange={(e) => setNumberTicketUse(Number(e.target.value))} disabled={running} />
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
                    <Settings className="w-3 h-3" />Add
                  </Link>
                )}
              </div>
              <select className="input" value={selectedDbId} onChange={(e) => setSelectedDbId(e.target.value)} disabled={running}>
                <option value="">— Skip SQL —</option>
                {databases.map((db) => <option key={db.id} value={db.id}>{db.name}</option>)}
                <option value={MANUAL_ID}>✎ Enter manually...</option>
              </select>
            </div>
          </div>

          {/* Manual DB */}
          {isManual && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div>
                <label className="label">Driver</label>
                <select className="input" value={manualDriver} onChange={(e) => { const d = e.target.value as "mysql" | "postgresql" | "mssql"; setManualDriver(d); setManualPort(DEFAULT_PORTS[d] ?? 3306); }} disabled={running}>
                  <option value="mysql">MySQL</option>
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mssql">SQL Server</option>
                </select>
              </div>
              <div><label className="label">Host</label><input className="input" value={manualHost} onChange={(e) => setManualHost(e.target.value)} disabled={running} /></div>
              <div><label className="label">Port</label><input className="input" type="number" value={manualPort} onChange={(e) => setManualPort(Number(e.target.value))} disabled={running} /></div>
              <div><label className="label">Database</label><input className="input" value={manualDatabase} onChange={(e) => setManualDatabase(e.target.value)} disabled={running} /></div>
              <div><label className="label">Username</label><input className="input" value={manualUsername} onChange={(e) => setManualUsername(e.target.value)} disabled={running} /></div>
              <div><label className="label">Password</label><input className="input" type="password" value={manualPassword} onChange={(e) => setManualPassword(e.target.value)} disabled={running} /></div>
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
            <textarea className="input font-mono text-[11px] leading-relaxed resize-none w-full" rows={3} value={sqlTemplate} onChange={(e) => setSqlTemplate(e.target.value)} disabled={running} spellCheck={false} />
          </div>
        </div>
      </section>

      {/* Progress */}
      {(running || currentIteration > 0) && (
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in">
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {running && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
                <span className="text-[12px] font-medium text-gray-700">
                  {running
                    ? `Opening ${mode} ${currentIteration} / ${iterations}…`
                    : `Completed ${currentIteration} / ${iterations}`}
                </span>
              </div>
              <span className="text-[11px] text-gray-400 tabular-nums">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center gap-4 text-[11px] text-gray-400 flex-wrap">
              <span><strong className="text-gray-700 tabular-nums">{attempts.length}</strong> {mode === "pack" ? "packs" : "boxes"}</span>
              <span><strong className="text-gray-700 tabular-nums">{totalCards}</strong> total cards</span>
              {cfg.patterns.map((p) => (
                <span key={p}><strong className="text-gray-700 tabular-nums">{patternCards(p).length}</strong> {p}</span>
              ))}
              {avgDuration > 0 && <span>avg <strong className="text-gray-700">{formatDuration(avgDuration)}</strong> / iter</span>}
              {running && eta > 0 && <span className="text-blue-500">~{formatDuration(eta)} remaining</span>}
            </div>
          </div>
        </section>
      )}

      {/* Results */}
      {hasResults && (
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in">
          <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Results · {attempts.length} {mode === "pack" ? "packs" : "boxes"} · {totalCards} cards
            </span>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {(["stats", "history"] as const).map((m) => (
                <button key={m} onClick={() => setViewMode(m)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${viewMode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {m === "stats" ? <BarChart3 className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* ── Stats ── */}
          {viewMode === "stats" && (
            <div className={`p-5 grid gap-6 ${cfg.gridCols}`}>
              {cfg.patterns.map((pattern) => {
                const cards = patternCards(pattern);
                const dist = rarityDist(cards);
                const total = cards.length;
                return (
                  <div key={pattern}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${cfg.patternColors[pattern]}`}>
                        {pattern}
                      </span>
                      <span className="text-[11px] text-gray-400 leading-tight">{cfg.patternLabels[pattern]} · {total} cards</span>
                    </div>
                    {total === 0 ? (
                      <p className="text-[12px] text-gray-400">No data yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {dist.map(([rarity, count]) => {
                          const meta = RARITY_META[rarity] ?? { label: rarity, color: "text-gray-600 bg-gray-100", bar: "bg-gray-400" };
                          const pct = (count / total) * 100;
                          return (
                            <div key={rarity} className="flex items-center gap-2">
                              <div className="w-20 flex-shrink-0 text-right">
                                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold ${meta.color}`}>{meta.label}</span>
                              </div>
                              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-500 ${meta.bar}`} style={{ width: `${pct}%` }} />
                              </div>
                              <div className="w-20 flex-shrink-0 text-right">
                                <span className="text-[11px] font-semibold text-gray-900 tabular-nums">{count}</span>
                                <span className="text-[10px] text-gray-400 ml-1">{pct.toFixed(1)}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── History ── */}
          {viewMode === "history" && (
            <div>
              {/* Pagination controls */}
              {totalHistoryPages > 1 && (
                <div className="px-5 py-2.5 border-b border-gray-50 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">
                    Page <strong className="text-gray-700">{historyPage}</strong> / {totalHistoryPages}
                    <span className="ml-2 text-gray-300">·</span>
                    <span className="ml-2">{(historyPage - 1) * HISTORY_PAGE_SIZE + 1}–{Math.min(historyPage * HISTORY_PAGE_SIZE, sortedAttempts.length)} of {sortedAttempts.length}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={historyPage === 1}
                      onClick={() => setHistoryPage((p) => p - 1)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />Prev
                    </button>
                    <button
                      disabled={historyPage === totalHistoryPages}
                      onClick={() => setHistoryPage((p) => p + 1)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Next<ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            <div className="divide-y divide-gray-50">
              {pagedAttempts.map((attempt) => {
                const expanded = expandedAttempts.has(attempt.num);
                const patternCounts = cfg.patterns.reduce<Record<string, number>>((acc, p) => {
                  acc[p] = attempt.cards.filter((c) => c.pattern === p).length;
                  return acc;
                }, {});
                const hasError = attempt.cards.length === 0 && attempt.sqlError;

                return (
                  <div key={attempt.num} className="px-5 py-3">
                    {/* Row summary */}
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleAttempt(attempt.num)} className="flex items-center gap-1 text-gray-400 hover:text-gray-700 flex-shrink-0">
                        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>

                      {/* Attempt number + status */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {hasError
                          ? <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                          : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        <span className="text-[11px] font-medium text-gray-500">#{attempt.num}</span>
                      </div>

                      {/* Per-pattern counts */}
                      <div className="flex items-center gap-2 flex-1 flex-wrap">
                        {hasError ? (
                          <span className="text-[11px] text-red-500">{attempt.sqlError}</span>
                        ) : (
                          cfg.patterns.map((p) => (
                            <span key={p} className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${cfg.patternColors[p]}`}>
                              {p}: {patternCounts[p]}
                            </span>
                          ))
                        )}
                      </div>

                      {/* Rarity preview — compact badges for B and SS cards */}
                      <div className="hidden md:flex items-center gap-1 flex-shrink-0">
                        {attempt.cards.filter((c) => c.pattern !== "A").map((c) => {
                          const meta = RARITY_META[c.rarity] ?? { color: "text-gray-600 bg-gray-100" };
                          return (
                            <span key={c.position} title={`pos${c.position} · ${c.name}`}
                              className={`inline-flex items-center rounded px-1 py-0.5 text-[9px] font-bold ${meta.color}`}>
                              {c.rarity}
                            </span>
                          );
                        })}
                      </div>

                      {/* SQL status */}
                      <span className="text-[10px] flex-shrink-0 text-gray-400">
                        {attempt.sqlSkipped ? "—" : attempt.sqlOk ? <span className="text-emerald-600">SQL ✓</span> : <span className="text-amber-600">SQL ✗</span>}
                      </span>
                    </div>

                    {/* Expanded: card grid + JSON */}
                    {expanded && (
                      <div className="mt-3 ml-8 space-y-3">
                        {/* Card grid */}
                        {attempt.cards.length > 0 && (
                          <div className={`grid gap-1.5 ${mode === "pack" ? "grid-cols-5" : "grid-cols-10"}`}>
                            {attempt.cards.map((c) => {
                              const meta = RARITY_META[c.rarity] ?? { label: c.rarity, color: "text-gray-600 bg-gray-100" };
                              const isSpecial = c.pattern !== "A";
                              return (
                                <div key={c.position}
                                  title={`pos ${c.position} · ${c.name || c.sku}`}
                                  className={`rounded p-1.5 text-center border ${isSpecial ? "bg-purple-50 border-purple-100" : "bg-gray-50 border-gray-100"} ${c.pattern === "SS" ? "bg-rose-50 border-rose-200" : ""}`}>
                                  <div className="text-[8px] text-gray-400 mb-0.5">p{c.position}</div>
                                  <span className={`inline-flex items-center rounded px-1 py-0.5 text-[9px] font-bold ${meta.color}`}>{c.rarity}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Per-attempt rate */}
                        {attempt.cards.length > 0 && (
                          <div className="flex gap-4 text-[10px] text-gray-500 flex-wrap">
                            {cfg.patterns.map((p) => {
                              const pCards = attempt.cards.filter((c) => c.pattern === p);
                              const byRarity = pCards.reduce<Record<string, number>>((acc, c) => { acc[c.rarity] = (acc[c.rarity] ?? 0) + 1; return acc; }, {});
                              return (
                                <div key={p} className="flex items-center gap-1">
                                  <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${cfg.patternColors[p]}`}>{p}</span>
                                  <span>{Object.entries(byRarity).map(([r, n]) => `${r}×${n}`).join(", ") || "—"}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* JSON response */}
                        {attempt.responseBody !== undefined && (
                          <details>
                            <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600 select-none">Response JSON</summary>
                            <pre className="mt-1 bg-gray-950 text-green-400 text-[10px] font-mono p-3 rounded-lg overflow-x-auto max-h-52 leading-relaxed">
                              {JSON.stringify(attempt.responseBody, null, 2)}
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
