"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { parseTestCases, TestCase } from "@/lib/qe-markdown-parser";

type ResultType = "pending" | "pass" | "fail" | "blocked" | "na";

const RESULT_ICONS: Record<ResultType, string> = { pending: "·", pass: "✓", fail: "✗", blocked: "⊘", na: "—" };

function esc(str: string) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatText(text: string) {
  if (!text || text === "-" || text === "—") return '<span style="color:#9ca3af">—</span>';
  return esc(text).replace(/&lt;br&gt;/gi, "<br>").replace(/`([^`]+)`/g, "<code>$1</code>");
}

function storageKey(file: string, id: string, field: string) {
  return `qe|${file}|${id}|${field}`;
}

interface Props { filename: string; content: string; }

export default function QeTestViewer({ filename, content }: Props) {
  const parsed = useMemo(() => parseTestCases(content), [content]);

  const [results, setResults] = useState<Record<string, ResultType>>({});
  const [notes, setNotes]     = useState<Record<string, string>>({});
  const [activeModule, setActiveModule] = useState("all");
  const [search, setSearch]   = useState("");
  const [filterResult, setFilterResult]     = useState("");
  const [filterPriority, setFilterPriority] = useState("");

  // Load from sessionStorage when file changes
  useEffect(() => {
    const r: Record<string, ResultType> = {};
    const n: Record<string, string> = {};
    parsed.modules.flatMap(m => m.cases).forEach(tc => {
      r[tc.id] = (sessionStorage.getItem(storageKey(filename, tc.id, "r")) as ResultType) || "pending";
      n[tc.id] = sessionStorage.getItem(storageKey(filename, tc.id, "n")) || "";
    });
    setResults(r); setNotes(n);
    setActiveModule("all"); setSearch(""); setFilterResult(""); setFilterPriority("");
  }, [filename, parsed]);

  const allCases: TestCase[] = useMemo(
    () => parsed.modules.flatMap(m => m.cases),
    [parsed]
  );

  const setResult = useCallback((id: string, result: ResultType) => {
    setResults(prev => {
      const next = prev[id] === result ? "pending" : result;
      sessionStorage.setItem(storageKey(filename, id, "r"), next);
      return { ...prev, [id]: next };
    });
  }, [filename]);

  const setNote = useCallback((id: string, val: string) => {
    setNotes(prev => { sessionStorage.setItem(storageKey(filename, id, "n"), val); return { ...prev, [id]: val }; });
  }, [filename]);

  const resetAll = () => {
    if (!confirm("Reset all results and notes for this file?")) return;
    const r: Record<string, ResultType> = {};
    const n: Record<string, string> = {};
    allCases.forEach(tc => {
      r[tc.id] = "pending"; n[tc.id] = "";
      sessionStorage.removeItem(storageKey(filename, tc.id, "r"));
      sessionStorage.removeItem(storageKey(filename, tc.id, "n"));
    });
    setResults(r); setNotes(n);
  };

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return allCases.filter(tc => {
      if (activeModule !== "all" && tc.module !== activeModule) return false;
      if (filterResult && (results[tc.id] || "pending") !== filterResult) return false;
      if (filterPriority && tc.priority.toUpperCase() !== filterPriority) return false;
      if (q) return [tc.id, tc.title, tc.tags, tc.expected, tc.steps].some(f => f.toLowerCase().includes(q));
      return true;
    });
  }, [allCases, results, activeModule, filterResult, filterPriority, search]);

  // Stats
  const counts = useMemo(() => {
    const c = { pass: 0, fail: 0, blocked: 0, na: 0, pending: 0 };
    allCases.forEach(tc => { const r = (results[tc.id] || "pending") as ResultType; c[r] = (c[r] || 0) + 1; });
    return c;
  }, [allCases, results]);

  const total = allCases.length;
  const pct = (n: number) => total ? (n / total * 100) : 0;

  const exportCSV = () => {
    const headers = ["ID","Module","Title","Priority","Preconditions","Steps","Expected Result","Test Data","Tags","Result","Notes"];
    const cell = (v: string) => `"${String(v||"").replace(/"/g,'""').replace(/<br>/gi," | ")}"`;
    const rows = allCases.map(tc => [
      tc.id, tc.module, tc.title, tc.priority, tc.preconditions,
      tc.steps, tc.expected, tc.testData, tc.tags,
      results[tc.id] || "pending", notes[tc.id] || "",
    ].map(v => cell(String(v))).join(","));
    const csv = "\uFEFF" + [headers.map(h => `"${h}"`).join(","), ...rows].join("\r\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })),
      download: filename.replace(".md", "") + "-results.csv",
    });
    a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex-shrink-0">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="text-base font-bold text-gray-900">{parsed.title || filename}</div>
            {parsed.feature && <div className="text-xs text-gray-500 mt-0.5">{parsed.feature}</div>}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={resetAll} className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-md hover:bg-gray-50">↺ Reset</button>
            <button onClick={exportCSV} className="px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-md hover:bg-green-700">⬇ Export CSV</button>
          </div>
        </div>
        {/* Stats */}
        <div className="flex gap-2 flex-wrap mb-2 text-xs font-semibold">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"/>Total: {total}</span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/>Pass: {counts.pass}</span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"/>Fail: {counts.fail}</span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-orange-700"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block"/>Blocked: {counts.blocked}</span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200"><span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block"/>Pending: {counts.pending}</span>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-gray-200 rounded-full flex overflow-hidden">
          <div style={{ width: `${pct(counts.pass)}%` }} className="bg-green-500"/>
          <div style={{ width: `${pct(counts.fail)}%` }} className="bg-red-500"/>
          <div style={{ width: `${pct(counts.blocked)}%` }} className="bg-orange-400"/>
          <div style={{ width: `${pct(counts.pending)}%` }} className="bg-gray-300"/>
        </div>
      </div>

      {/* Module tabs */}
      <div className="bg-white border-b border-gray-200 flex overflow-x-auto flex-shrink-0 px-5">
        {[{ name: "all", count: total }, ...parsed.modules.map(m => ({ name: m.name, count: m.cases.length }))].map(({ name, count }) => (
          <button key={name} onClick={() => setActiveModule(name)}
            className={`px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${activeModule === name ? "text-violet-600 border-violet-500" : "text-gray-500 border-transparent hover:text-gray-700"}`}>
            {name === "all" ? `All (${count})` : `${name} (${count})`}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-5 py-2 flex gap-2 flex-shrink-0">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search…" className="flex-1 max-w-xs text-xs border border-gray-200 rounded-md px-3 py-1.5 outline-none focus:border-violet-400"/>
        <select value={filterResult} onChange={e => setFilterResult(e.target.value)} className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white outline-none">
          <option value="">All Results</option>
          {["pending","pass","fail","blocked","na"].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white outline-none">
          <option value="">All Priorities</option>
          {["P0","P1","P2","P3","P4"].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <table className="w-full border-collapse text-xs" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              {["ID","Title","Priority","Tags","Test Data","Preconditions","Steps","Expected Result","Result","Notes"].map(h => (
                <th key={h} className="bg-gray-50 px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-gray-500 border-b-2 border-gray-200 sticky top-0 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(tc => {
              const res = (results[tc.id] || "pending") as ResultType;
              const rowColors: Record<ResultType, string> = {
                pass: "bg-green-50", fail: "bg-red-50", blocked: "bg-orange-50",
                na: "bg-gray-50 opacity-75", pending: "bg-white",
              };
              const borderColors: Record<ResultType, string> = {
                pass: "border-l-green-500", fail: "border-l-red-500",
                blocked: "border-l-orange-400", na: "border-l-gray-400", pending: "border-l-transparent",
              };
              return (
                <tr key={tc.id} className={`border-b border-gray-100 ${rowColors[res]}`}>
                  <td className={`px-2 py-2 border-l-4 ${borderColors[res]}`}>
                    <span className="font-mono font-bold text-violet-600">{tc.id}</span>
                  </td>
                  <td className="px-2 py-2"><div className="font-semibold text-gray-900 max-w-[180px] leading-snug">{tc.title}</div></td>
                  <td className="px-2 py-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      tc.priority==="P0"?"bg-red-100 text-red-700":tc.priority==="P1"?"bg-orange-100 text-orange-700":
                      tc.priority==="P2"?"bg-yellow-100 text-yellow-700":tc.priority==="P3"?"bg-blue-100 text-blue-700":"bg-gray-100 text-gray-600"
                    }`}>{tc.priority}</span>
                  </td>
                  <td className="px-2 py-2">
                    {tc.tags && tc.tags !== "-" && tc.tags.split(",").map(t => t.trim()).filter(Boolean).map(t => (
                      <span key={t} className="inline-block px-1 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-semibold m-0.5">{t}</span>
                    ))}
                  </td>
                  {[tc.testData, tc.preconditions, tc.steps, tc.expected].map((txt, i) => (
                    <td key={i} className="px-2 py-2 max-w-[160px]">
                      <div className="leading-relaxed text-gray-600" dangerouslySetInnerHTML={{ __html: formatText(txt) }}/>
                    </td>
                  ))}
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      {(["pass","fail","blocked","na"] as ResultType[]).map(r => (
                        <button key={r} onClick={() => setResult(tc.id, r)} title={r}
                          className={`w-6 h-6 rounded text-xs flex items-center justify-center border transition-all ${
                            res === r
                              ? r==="pass"?"bg-green-500 border-green-600 text-white":
                                r==="fail"?"bg-red-500 border-red-600 text-white":
                                r==="blocked"?"bg-orange-400 border-orange-500 text-white":
                                "bg-gray-400 border-gray-500 text-white"
                              : "bg-gray-50 border-gray-200 hover:scale-110"
                          }`}>
                          {RESULT_ICONS[r]}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <textarea rows={2} value={notes[tc.id] || ""}
                      onChange={e => setNote(tc.id, e.target.value)}
                      placeholder="Notes…"
                      className="w-28 text-[11px] border border-gray-200 rounded px-1.5 py-1 resize-none bg-transparent focus:outline-none focus:border-violet-400 text-gray-700"/>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No test cases match the current filters.</div>
        )}
      </div>
    </div>
  );
}
