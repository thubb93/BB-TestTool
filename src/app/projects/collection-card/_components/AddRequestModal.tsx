"use client";

import { useState } from "react";
import { X, Terminal, CheckCircle2, AlertCircle, Plus, Wand2 } from "lucide-react";
import { parseCurl, ParsedCurl } from "@/lib/curlParser";

export interface NewRequestData {
  name: string;
  parsed: ParsedCurl;
  /** Authorization token extracted from curl, if present */
  detectedToken?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (data: NewRequestData) => void;
}

export default function AddRequestModal({ open, onClose, onAdd }: Props) {
  const [name, setName] = useState("");
  const [curlText, setCurlText] = useState("");
  const [parsed, setParsed] = useState<ParsedCurl | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  if (!open) return null;

  function handleParse() {
    setParseError(null);
    if (!curlText.trim()) { setParseError("Please paste a curl command."); return; }
    try {
      const result = parseCurl(curlText);
      if (!result.baseUrl) { setParseError("Could not extract URL from curl. Make sure it's a valid curl command."); return; }
      setParsed(result);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Parse failed");
    }
  }

  function handleAdd() {
    if (!parsed) return;
    const detectedToken = parsed.headers["Authorization"]?.replace(/^Bearer\s+/i, "");
    // Remove auth header from request headers (managed globally)
    const { Authorization, authorization, ...restHeaders } = parsed.headers as Record<string, string>;
    void Authorization; void authorization;

    onAdd({
      name: name.trim() || `Request ${Date.now()}`,
      parsed: { ...parsed, headers: restHeaders },
      detectedToken,
    });
    handleClose();
  }

  function handleClose() {
    setName("");
    setCurlText("");
    setParsed(null);
    setParseError(null);
    onClose();
  }

  const paramCount = parsed ? Object.keys(parsed.params).length : 0;
  const headerCount = parsed
    ? Object.keys(parsed.headers).filter((k) => !/^authorization$/i.test(k)).length
    : 0;
  const hasAuthHeader = parsed
    ? Object.keys(parsed.headers).some((k) => /^authorization$/i.test(k))
    : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-[2px] animate-fade-in" onClick={handleClose} />

      <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl shadow-gray-900/20 animate-scale-in overflow-hidden">
        {/* Accent */}
        <div className="h-[3px] bg-gradient-to-r from-blue-500 to-violet-500" />

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Terminal className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-[14px] font-semibold text-gray-900">Add New Request</h2>
            <p className="text-[11px] text-gray-400">Paste a cURL command to import the request</p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="label">Request Name</label>
            <input
              className="input"
              placeholder="e.g. List Cards, Get Detail..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Curl input */}
          <div>
            <label className="label">cURL Command</label>
            <div className="relative">
              <textarea
                className="input font-mono text-[11px] leading-relaxed resize-none"
                rows={7}
                placeholder={`curl --location 'https://api.example.com/endpoint?param=value' \\\n--header 'Authorization: Bearer TOKEN' \\\n--header 'Content-Type: application/json'`}
                value={curlText}
                onChange={(e) => { setCurlText(e.target.value); setParsed(null); setParseError(null); }}
              />
            </div>
          </div>

          {/* Parse button */}
          {!parsed && (
            <button
              type="button"
              onClick={handleParse}
              disabled={!curlText.trim()}
              className="btn-secondary w-full justify-center disabled:opacity-40"
            >
              <Wand2 className="w-4 h-4" />
              Parse cURL
            </button>
          )}

          {/* Parse error */}
          {parseError && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-red-600">{parseError}</p>
            </div>
          )}

          {/* Preview */}
          {parsed && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="text-[12px] font-semibold text-emerald-700">Parsed successfully</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Method</p>
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${
                    parsed.method === "GET" ? "bg-blue-50 text-blue-700" :
                    parsed.method === "POST" ? "bg-green-50 text-green-700" :
                    parsed.method === "DELETE" ? "bg-red-50 text-red-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {parsed.method}
                  </span>
                </div>
                <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Params</p>
                  <p className="text-[12px] font-semibold text-gray-900">{paramCount} detected</p>
                </div>
              </div>

              <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">URL</p>
                <code className="text-[11px] text-gray-700 font-mono break-all">{parsed.baseUrl}</code>
              </div>

              {headerCount > 0 && (
                <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Headers</p>
                  <p className="text-[12px] text-gray-600">{headerCount} custom header{headerCount !== 1 ? "s" : ""}</p>
                </div>
              )}

              {hasAuthHeader && (
                <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700">
                    Authorization header detected — it will be managed by the global <strong>Auth</strong> button instead.
                  </p>
                </div>
              )}

              {parsed.body && (
                <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Body</p>
                  <code className="text-[11px] text-gray-600 font-mono line-clamp-2">{parsed.body}</code>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button type="button" onClick={handleClose} className="btn-secondary">Cancel</button>
          {!parsed ? (
            <button type="button" onClick={handleParse} disabled={!curlText.trim()} className="btn-primary disabled:opacity-40">
              <Wand2 className="w-4 h-4" />
              Parse cURL
            </button>
          ) : (
            <button type="button" onClick={handleAdd} className="btn-primary">
              <Plus className="w-4 h-4" />
              Add Request
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
