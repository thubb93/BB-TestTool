"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Upload,
  Play,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  FileText,
  X,
  Download,
} from "lucide-react";

const API_URL = "https://uat-ai-api.bluebelt.asia/api/misc/article-interaction-content";
const APP_KEY = "20a69637-c731-46dc-b888-cfed06504238";

// CSV columns expected from the file
const CSV_INPUT_COLS = [
  "Persona",
  "output_network",
  "segment_age",
  "segment_gender",
  "occupation",
  "posting_type",
  "post_emojis",
  "interested_topic",
] as const;

type CsvRow = Record<(typeof CSV_INPUT_COLS)[number], string>;

interface RowResult {
  status: "idle" | "loading" | "success" | "error";
  theme?: string;
  output?: string;
  error?: string;
}

interface FixedParams {
  post_id: string;
  text: string;
  image_url: string;
  video_url: string;
  output_lang: string;
  output_type: string;
  min_words: string;
  max_words: string;
  userPrompt: string;
  postMode: string;
}

const DEFAULT_FIXED: FixedParams = {
  post_id: "influencer-post-001",
  text: "",
  image_url: "",
  video_url: "https://uat-sns-statics.aiavatar.fun/data/2026-03-05/Download_1_1772691019810.mp4",
  output_lang: "ja",
  output_type: "post",
  min_words: "10",
  max_words: "50",
  userPrompt: "",
  postMode: "company",
};

// Simple CSV parser that handles quoted fields
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === "," && !inQuote) {
        fields.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    rows.push(fields);
  }
  return rows;
}

function parseCsvToRows(text: string): { rows: CsvRow[]; error?: string } {
  const all = parseCsv(text);
  if (all.length < 2) return { rows: [], error: "CSV must have a header row and at least one data row." };

  const header = all[0].map((h) => h.trim());
  const missing = CSV_INPUT_COLS.filter((col) => !header.includes(col));
  if (missing.length > 0) {
    return { rows: [], error: `Missing columns: ${missing.join(", ")}` };
  }

  const rows: CsvRow[] = all.slice(1).map((fields) => {
    const obj: Partial<CsvRow> = {};
    CSV_INPUT_COLS.forEach((col) => {
      const idx = header.indexOf(col);
      obj[col] = idx >= 0 ? (fields[idx] ?? "") : "";
    });
    return obj as CsvRow;
  });

  return { rows };
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy output"
      className={`p-1.5 rounded transition-colors ${
        copied
          ? "text-emerald-600 bg-emerald-50"
          : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
      }`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function BuzznetPage() {
  const [fixed, setFixed] = useState<FixedParams>(DEFAULT_FIXED);
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [results, setResults] = useState<RowResult[]>([]);
  const [parseError, setParseError] = useState("");
  const [running, setRunning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      applyParse(text);
    };
    reader.readAsText(file);
  }

  function applyParse(text: string) {
    setParseError("");
    setResults([]);
    const { rows: parsed, error } = parseCsvToRows(text);
    if (error) {
      setParseError(error);
      setRows([]);
    } else {
      setRows(parsed);
      setResults(parsed.map(() => ({ status: "idle" })));
    }
  }

  function handleCsvChange(text: string) {
    setCsvText(text);
    if (!text.trim()) {
      setRows([]);
      setResults([]);
      setParseError("");
      return;
    }
    applyParse(text);
  }

  async function callApi(row: CsvRow): Promise<{ theme: string; output: string }> {
    const body = {
      post_id: fixed.post_id || null,
      text: fixed.text || null,
      image_url: fixed.image_url || null,
      video_url: fixed.video_url || null,
      output_lang: fixed.output_lang,
      output_type: fixed.output_type,
      segment_age: row.segment_age,
      segment_gender: row.segment_gender,
      output_network: row.output_network,
      min_words: fixed.min_words ? Number(fixed.min_words) : null,
      max_words: fixed.max_words ? Number(fixed.max_words) : null,
      occupation: row.occupation,
      posting_type: row.posting_type,
      post_emojis: row.post_emojis,
      interested_topic: row.interested_topic,
      userPrompt: fixed.userPrompt || null,
      postMode: fixed.postMode,
    };

    const res = await fetch("/api/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: API_URL,
        method: "POST",
        headers: {
          "x-app-key": APP_KEY,
          "x-version": "v1",
        },
        body,
      }),
    });

    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);

    const data: { theme: string; output: string }[] = json.data;
    if (!Array.isArray(data) || data.length === 0) throw new Error("Empty response");
    return data[0];
  }

  async function handleRun() {
    if (rows.length === 0 || running) return;
    abortRef.current = false;
    setRunning(true);
    setResults(rows.map(() => ({ status: "idle" })));

    for (let i = 0; i < rows.length; i++) {
      if (abortRef.current) break;
      setResults((prev) => {
        const next = [...prev];
        next[i] = { status: "loading" };
        return next;
      });
      try {
        const result = await callApi(rows[i]);
        setResults((prev) => {
          const next = [...prev];
          next[i] = { status: "success", theme: result.theme, output: result.output };
          return next;
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setResults((prev) => {
          const next = [...prev];
          next[i] = { status: "error", error: msg };
          return next;
        });
      }
    }

    setRunning(false);
  }

  function handleStop() {
    abortRef.current = true;
  }

  function handleExport() {
    const headers = [...CSV_INPUT_COLS, "theme", "output"];
    const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;

    const csvLines = [
      headers.join(","),
      ...rows.map((row, i) => {
        const result = results[i] ?? { status: "idle" };
        const theme = result.status === "success" ? (result.theme ?? "") : "";
        const output = result.status === "success" ? (result.output ?? "") : "";
        return [
          ...CSV_INPUT_COLS.map((col) => escape(row[col])),
          escape(theme),
          escape(output),
        ].join(",");
      }),
    ];

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `buzznet-output-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClearCsv() {
    setCsvText("");
    setRows([]);
    setResults([]);
    setParseError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const doneCount = results.filter((r) => r.status === "success" || r.status === "error").length;
  const totalCount = rows.length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="page-topbar">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Projects
            </Link>
            <span className="text-gray-200">/</span>
            <div className="min-w-0">
              <h1 className="text-[18px] font-bold text-gray-900 tracking-tight">Buzznet</h1>
              <p className="text-[11px] text-gray-400 leading-none mt-0.5">
                Article Interaction Content · batch via CSV
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {running ? (
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium border bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 transition-all"
              >
                <X className="w-3.5 h-3.5" />
                Stop
              </button>
            ) : (
              <button
                onClick={handleRun}
                disabled={rows.length === 0}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4" />
                Run {rows.length > 0 ? `(${rows.length} rows)` : ""}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Fixed params */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-[13px] font-semibold text-gray-700 mb-4">Fixed Parameters</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {(
              [
                { key: "post_id", label: "post_id" },
                { key: "video_url", label: "video_url" },
                { key: "image_url", label: "image_url" },
                { key: "text", label: "text" },
                { key: "output_lang", label: "output_lang" },
                { key: "output_type", label: "output_type" },
                { key: "min_words", label: "min_words" },
                { key: "max_words", label: "max_words" },
                { key: "postMode", label: "postMode" },
                { key: "userPrompt", label: "userPrompt" },
              ] as { key: keyof FixedParams; label: string }[]
            ).map(({ key, label }) => (
              <div key={key} className={key === "video_url" || key === "userPrompt" ? "col-span-2" : ""}>
                <label className="label">{label}</label>
                <input
                  className="input"
                  value={fixed[key]}
                  placeholder={`${label}...`}
                  onChange={(e) => setFixed((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>

        {/* CSV section */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[13px] font-semibold text-gray-700">CSV Input</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Required columns: Persona, output_network, segment_age, segment_gender, occupation, posting_type, post_emojis, interested_topic
              </p>
            </div>
            <div className="flex items-center gap-2">
              {csvText && (
                <button
                  onClick={handleClearCsv}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-gray-500 hover:text-rose-600 hover:bg-rose-50 border border-gray-200 transition-all"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload CSV
              </button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileUpload} />
            </div>
          </div>

          <textarea
            className="w-full h-36 text-[12px] font-mono border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 placeholder:text-gray-300"
            placeholder="Paste CSV content here, or upload a file above..."
            value={csvText}
            onChange={(e) => handleCsvChange(e.target.value)}
          />

          {parseError && (
            <div className="flex items-center gap-2 mt-2 text-[12px] text-rose-600">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {parseError}
            </div>
          )}

          {rows.length > 0 && !parseError && (
            <div className="flex items-center gap-1.5 mt-2 text-[12px] text-emerald-600">
              <FileText className="w-3.5 h-3.5" />
              {rows.length} row{rows.length !== 1 ? "s" : ""} parsed successfully
              {running && ` · ${doneCount}/${totalCount} done`}
            </div>
          )}
        </div>

        {/* Results table */}
        {rows.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-gray-700">Results</h2>
              {results.some((r) => r.status === "success") && (
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap">#</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap">Persona</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap">Network</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap">Age</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap">Gender</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap">Occupation</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap">Posting Type</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap">Emojis</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap">Topics</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap min-w-[180px]">Theme</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap min-w-[240px]">Output</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const result = results[i] ?? { status: "idle" };
                    return (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors align-top">
                        <td className="px-4 py-3 text-gray-400 font-mono">{i + 1}</td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap font-medium">{row.Persona}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.output_network}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.segment_age}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.segment_gender}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.occupation}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.posting_type}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.post_emojis}</td>
                        <td className="px-4 py-3 text-gray-600">{row.interested_topic}</td>

                        {/* Theme */}
                        <td className="px-4 py-3 text-gray-600 min-w-[180px]">
                          {result.status === "loading" && (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                          )}
                          {result.status === "success" && (
                            <span className="text-[11px] text-gray-500 leading-relaxed line-clamp-4 whitespace-pre-wrap">
                              {result.theme}
                            </span>
                          )}
                          {result.status === "error" && (
                            <span className="text-[11px] text-rose-500 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 flex-shrink-0" />
                              {result.error}
                            </span>
                          )}
                        </td>

                        {/* Output */}
                        <td className="px-4 py-3 min-w-[240px]">
                          {result.status === "success" && result.output && (
                            <span className="text-[12px] text-gray-800 whitespace-pre-wrap leading-relaxed">
                              {result.output}
                            </span>
                          )}
                        </td>

                        {/* Copy button */}
                        <td className="px-3 py-3">
                          {result.status === "success" && result.output && (
                            <CopyButton text={result.output} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
