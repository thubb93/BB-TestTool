"use client";

import { useState } from "react";
import {
  Play, Plus, Trash2, Loader2, AlertCircle, CheckCircle2,
  Clock, Table2, Braces, ChevronLeft, ChevronRight, ChevronDown,
} from "lucide-react";
import { ParsedCurl } from "@/lib/curlParser";

export interface SavedRequest {
  id: string;
  name: string;
  parsed: ParsedCurl;
}

interface ParamRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface ApiResult {
  status: number;
  statusText: string;
  duration: number;
  data: unknown;
}

export interface TabResultState {
  result: ApiResult | null;
  error: string | null;
  hasRun: boolean;
}

function extractList(data: unknown): unknown[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.list)) return d.list;
  if (Array.isArray(d.data)) return d.data;
  if (d.data && typeof d.data === "object") {
    const inner = d.data as Record<string, unknown>;
    if (Array.isArray(inner.list)) return inner.list;
    if (Array.isArray(inner.data)) return inner.data;
  }
  if (Array.isArray(data)) return data;
  return [];
}

function extractTotal(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.total === "number") return d.total;
  if (d.data && typeof d.data === "object") {
    const inner = d.data as Record<string, unknown>;
    if (typeof inner.total === "number") return inner.total;
  }
  return null;
}

function StatusBadge({ status }: { status: number }) {
  const ok = status >= 200 && status < 300;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
      ok ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-red-50 text-red-700 ring-1 ring-red-200"
    }`}>
      {ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
      {status}
    </span>
  );
}

function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-gray-300">—</span>;
  if (typeof value === "boolean")
    return <span className={value ? "text-emerald-600" : "text-red-500"}>{String(value)}</span>;
  if (typeof value === "object")
    return <span className="text-[10px] font-mono text-gray-400 truncate max-w-[120px] block">{JSON.stringify(value)}</span>;
  return <span>{String(value)}</span>;
}

interface Props {
  request: SavedRequest;
  authToken: string;
  savedResult?: TabResultState;
  onResultChange?: (state: TabResultState) => void;
}

export default function RequestPanel({ request, authToken, savedResult, onResultChange }: Props) {
  const [params, setParams] = useState<ParamRow[]>(() =>
    Object.entries(request.parsed.params).map(([key, value], i) => ({
      id: `${i}`,
      key,
      value,
      enabled: true,
    }))
  );
  const [body, setBody] = useState(() => {
    const raw = request.parsed.body ?? "";
    try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
  });
  const [showParams, setShowParams] = useState(false);
  const [showHeaders, setShowHeaders] = useState(false);
  const [showBody, setShowBody] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(savedResult?.result ?? null);
  const [error, setError] = useState<string | null>(savedResult?.error ?? null);
  const [viewMode, setViewMode] = useState<"table" | "json">("json");
  const [hasRun, setHasRun] = useState(savedResult?.hasRun ?? false);

  function addParam() {
    setParams((p) => [...p, { id: String(Date.now()), key: "", value: "", enabled: true }]);
  }

  function removeParam(id: string) {
    setParams((p) => p.filter((r) => r.id !== id));
  }

  function updateParam(id: string, field: "key" | "value" | "enabled", value: string | boolean) {
    setParams((p) => p.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function buildActiveParams(rows: ParamRow[]): Record<string, string> {
    const active: Record<string, string> = {};
    rows.filter((r) => r.enabled && r.key.trim()).forEach((r) => {
      active[r.key.trim()] = r.value;
    });
    return active;
  }

  async function runWithParams(activeParams: Record<string, string>) {
    setLoading(true);
    setError(null);
    setHasRun(true);

    try {
      const requestBody: Record<string, unknown> = {
        url: request.parsed.baseUrl,
        method: request.parsed.method,
        headers: {
          ...request.parsed.headers,
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        params: activeParams,
      };

      if (body.trim() && request.parsed.method !== "GET") {
        try {
          requestBody.body = JSON.parse(body);
        } catch {
          requestBody.body = body;
        }
      }

      const res = await fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Proxy error: ${res.status}`);
      setResult(json);
      onResultChange?.({ result: json, error: null, hasRun: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      onResultChange?.({ result: null, error: msg, hasRun: true });
    } finally {
      setLoading(false);
    }
  }

  function handleRun() {
    runWithParams(buildActiveParams(params));
  }

  function navigatePage(delta: number) {
    const newParams = params.map((r) => {
      if (r.key.trim() === "page" && r.enabled) {
        const curr = parseInt(r.value, 10) || 1;
        const next = Math.max(1, curr + delta);
        if (totalPages !== null && next > totalPages) return r;
        return { ...r, value: String(next) };
      }
      return r;
    });
    setParams(newParams);
    runWithParams(buildActiveParams(newParams));
  }

  const list = result ? extractList(result.data) : [];
  const total = result ? extractTotal(result.data) : null;
  const columns = list.length > 0 ? Object.keys(list[0] as object) : [];
  const pageSizeRow = params.find((r) => r.key.trim() === "pageSize" && r.enabled);
  const pageSize = pageSizeRow ? parseInt(pageSizeRow.value, 10) : null;
  const totalPages = total !== null && pageSize ? Math.ceil(total / pageSize) : null;
  const currentPage = parseInt(params.find((r) => r.key.trim() === "page" && r.enabled)?.value ?? "1", 10) || 1;
  const hasPagination = params.some((r) => r.key.trim() === "page" && r.enabled);

  const headerEntries = Object.entries(request.parsed.headers);

  const previewUrl = (() => {
    try {
      const u = new URL(request.parsed.baseUrl);
      Object.entries(buildActiveParams(params)).forEach(([k, v]) => u.searchParams.set(k, v));
      return u.toString();
    } catch {
      return request.parsed.baseUrl;
    }
  })();

  return (
    <div className="space-y-5">
      {/* Params section */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* URL preview — always visible */}
        <div className="px-5 py-3 flex items-center gap-2 overflow-x-auto">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono flex-shrink-0 ${
            request.parsed.method === "GET" ? "bg-blue-50 text-blue-600" :
            request.parsed.method === "POST" ? "bg-green-50 text-green-600" :
            request.parsed.method === "DELETE" ? "bg-red-50 text-red-600" :
            "bg-gray-100 text-gray-600"
          }`}>{request.parsed.method}</span>
          <code className="text-[11px] text-gray-600 font-mono whitespace-nowrap flex-1 truncate">{previewUrl}</code>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <button
              onClick={() => setShowParams((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showParams ? "rotate-180" : ""}`} />
              Params{params.filter((r) => r.enabled).length > 0 && (
                <span className="ml-0.5 text-blue-500">{params.filter((r) => r.enabled).length}</span>
              )}
            </button>
            {showParams && (
              <button onClick={addParam} className="btn-ghost text-xs py-1 px-2">
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            )}
            <button onClick={handleRun} disabled={loading} className="btn-primary">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {loading ? "Running..." : "Run"}
            </button>
          </div>
        </div>

        {showParams && (
          <>
            <div className="border-t border-gray-50">
              {params.length > 0 ? (
                <div className="divide-y divide-gray-50">
                  {params.map((row) => (
                    <div key={row.id} className="flex items-center gap-2 px-4 py-2 group">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) => updateParam(row.id, "enabled", e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 cursor-pointer flex-shrink-0"
                      />
                      <input
                        className={`input flex-1 text-[12px] py-1.5 ${!row.enabled ? "opacity-40" : ""}`}
                        placeholder="key"
                        value={row.key}
                        onChange={(e) => updateParam(row.id, "key", e.target.value)}
                      />
                      <span className="text-gray-300 text-[11px] flex-shrink-0">=</span>
                      <input
                        className={`input flex-1 text-[12px] py-1.5 ${!row.enabled ? "opacity-40" : ""}`}
                        placeholder="value"
                        value={row.value}
                        onChange={(e) => updateParam(row.id, "value", e.target.value)}
                      />
                      <button
                        onClick={() => removeParam(row.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded opacity-0 group-hover:opacity-100 flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-4 text-center">
                  <p className="text-[12px] text-gray-400">
                    No parameters.{" "}
                    <button className="text-blue-500 hover:underline" onClick={addParam}>Add one</button>
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* Headers section */}
      {(headerEntries.length > 0 || authToken) && (
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowHeaders((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Headers</span>
              <span className="text-[11px] text-gray-400">
                {(authToken ? 1 : 0) + headerEntries.length}
              </span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showHeaders ? "rotate-180" : ""}`} />
          </button>
          {showHeaders && (
            <div className="divide-y divide-gray-50 border-t border-gray-50">
              {authToken && (
                <div className="flex items-center gap-3 px-5 py-2.5">
                  <span className="text-[11px] text-blue-600 font-mono w-36 flex-shrink-0">Authorization</span>
                  <span className="text-[11px] text-gray-400 font-mono flex-1 truncate">
                    Bearer {authToken.length > 24 ? `${authToken.slice(0, 24)}…` : authToken}
                  </span>
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5 font-medium flex-shrink-0">
                    global
                  </span>
                </div>
              )}
              {headerEntries.map(([key, value]) => (
                <div key={key} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="text-[11px] text-gray-600 font-mono w-36 flex-shrink-0 truncate">{key}</span>
                  <span className="text-[11px] text-gray-400 font-mono flex-1 truncate">{value}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Body section — shown for non-GET methods */}
      {request.parsed.method !== "GET" && (
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowBody((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Request Body</span>
              {body.trim() && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showBody ? "rotate-180" : ""}`} />
          </button>
          {showBody && (
            <div className="border-t border-gray-50">
              <div className="flex items-center justify-end px-5 py-2 border-b border-gray-50">
                <button
                  type="button"
                  onClick={() => {
                    try { setBody(JSON.stringify(JSON.parse(body), null, 2)); } catch { /* not valid JSON */ }
                  }}
                  className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Format JSON
                </button>
              </div>
              <div className="p-5">
                <textarea
                  className="input font-mono text-[11px] leading-relaxed resize-none w-full"
                  rows={8}
                  placeholder={"{\n  \"key\": \"value\"\n}"}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  spellCheck={false}
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* Results */}
      {(hasRun || result) && (
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in">
          <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Results</span>
              {result && (
                <>
                  <StatusBadge status={result.status} />
                  <span className="flex items-center gap-1 text-[11px] text-gray-400">
                    <Clock className="w-3 h-3" />{result.duration}ms
                  </span>
                  {total !== null && (
                    <span className="text-[11px] text-gray-500">
                      <strong className="text-gray-900 tabular-nums">{total}</strong> total
                      {totalPages && ` · page ${currentPage}/${totalPages}`}
                    </span>
                  )}
                </>
              )}
            </div>
            {result && (
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("table")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    viewMode === "table" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Table2 className="w-3.5 h-3.5" />Table
                </button>
                <button
                  onClick={() => setViewMode("json")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    viewMode === "json" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Braces className="w-3.5 h-3.5" />JSON
                </button>
              </div>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-[13px]">Fetching data...</span>
            </div>
          )}

          {!loading && error && (
            <div className="p-5">
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-semibold text-red-700">Request failed</p>
                  <p className="text-[12px] text-red-600 mt-0.5 font-mono">{error}</p>
                </div>
              </div>
            </div>
          )}

          {!loading && result && viewMode === "table" && (
            <>
              {list.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-[13px] text-gray-400">No items found in response.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-10 text-right">#</th>
                        {columns.map((col) => (
                          <th key={col} className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {list.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3 text-[11px] text-gray-300 text-right tabular-nums">{i + 1}</td>
                          {columns.map((col) => (
                            <td key={col} className="px-4 py-3 text-[12px] text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                              <CellValue value={(row as Record<string, unknown>)[col]} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {hasPagination && list.length > 0 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
                  <p className="text-[11px] text-gray-400">
                    {total !== null
                      ? <><strong className="text-gray-600">{total}</strong> total items</>
                      : <>{list.length} items</>}
                    {totalPages && ` · page ${currentPage} / ${totalPages}`}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigatePage(-1)}
                      disabled={currentPage <= 1}
                      className="btn-secondary px-2 py-1.5 text-xs disabled:opacity-40"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />Prev
                    </button>
                    <span className="px-3 py-1.5 text-xs text-gray-600 tabular-nums">
                      {currentPage}{totalPages ? ` / ${totalPages}` : ""}
                    </span>
                    <button
                      onClick={() => navigatePage(1)}
                      disabled={totalPages !== null && currentPage >= totalPages}
                      className="btn-secondary px-2 py-1.5 text-xs disabled:opacity-40"
                    >
                      Next<ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {!loading && result && viewMode === "json" && (
            <div className="p-5">
              <pre className="bg-gray-950 text-gray-100 rounded-xl p-5 text-[11px] font-mono leading-relaxed overflow-auto max-h-[500px]">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          )}
        </section>
      )}

      {!hasRun && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
          <div className="w-14 h-14 bg-white border border-gray-100 shadow-sm rounded-2xl flex items-center justify-center mb-4">
            <Play className="w-6 h-6 text-gray-300" />
          </div>
          <h3 className="text-[14px] font-semibold text-gray-900 mb-1.5">Ready to fetch</h3>
          <p className="text-[13px] text-gray-400 max-w-xs leading-relaxed">
            Configure the parameters above, then click <strong>Run</strong> to call the API.
          </p>
        </div>
      )}
    </div>
  );
}
