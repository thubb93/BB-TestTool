"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Square, Zap, CheckCircle, XCircle, Loader2 } from "lucide-react";

const BASE_URL = "https://uat-sns-batch.aiavatar.fun/api/test/distribution/execute";
const STEP_MS = 5 * 60 * 1000; // 5-minute steps

interface Props {
  /** Pre-populated from InputPanel after verification */
  startTime?: string;
  endTime?: string;
}

interface CallLog {
  time: Date;
  nowParam: string;
  status: "success" | "error";
  message: string;
}

/** Inject/replace a query param in a URL string */
function setParam(rawUrl: string, key: string, value: string): string {
  try {
    const u = new URL(rawUrl);
    u.searchParams.set(key, value);
    return u.toString();
  } catch {
    const sep = rawUrl.includes("?") ? "&" : "?";
    return `${rawUrl}${sep}${key}=${encodeURIComponent(value)}`;
  }
}

/** Build final URL with distributionMode + now injected */
function buildUrl(base: string, distributionMode: string, nowIso: string): string {
  let url = setParam(base, "distributionMode", distributionMode);
  url = setParam(url, "now", nowIso);
  return url;
}

/** Generate list of ISO timestamps from start to end, stepping by STEP_MS */
function buildSlots(startIso: string, endIso: string): string[] {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (isNaN(start) || isNaN(end) || start > end) return [];
  const slots: string[] = [];
  for (let t = start; t <= end; t += STEP_MS) {
    slots.push(new Date(t).toISOString());
  }
  return slots;
}

export default function TriggerPanel({ startTime = "", endTime = "" }: Props) {
  const [url, setUrl] = useState(BASE_URL);
  const [tenantCode, setTenantCode] = useState("BB");
  const [distributionMode, setDistributionMode] = useState("RANDOM_DELAY");

  // startTime/endTime are ISO strings from DB — used directly for slot generation

  // Assign-job sequential run state
  const [assignRunning, setAssignRunning] = useState(false);
  const [assignProgress, setAssignProgress] = useState<{ idx: number; total: number; nowIso: string } | null>(null);
  const abortRef = useRef(false);

  // Single trigger state
  const [singleLoading, setSingleLoading] = useState(false);
  const [lastLog, setLastLog] = useState<CallLog | null>(null);

  async function callApi(nowIso: string): Promise<CallLog> {
    const finalUrl = buildUrl(url.trim(), distributionMode.trim(), nowIso);
    try {
      const res = await fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: finalUrl,
          method: "POST",
          headers: {
            accept: "*/*",
            ...(tenantCode.trim() ? { "x-tenant-code": tenantCode.trim() } : {}),
          },
        }),
      });
      const data = await res.json();
      const httpStatus = data.status ?? (res.ok ? 200 : res.status);
      const ok = httpStatus >= 200 && httpStatus < 300;
      return {
        time: new Date(),
        nowParam: nowIso,
        status: ok ? "success" : "error",
        message: ok ? `HTTP ${httpStatus} OK` : `HTTP ${httpStatus} — ${data.statusText ?? data.error ?? "Error"}`,
      };
    } catch (err) {
      return {
        time: new Date(),
        nowParam: nowIso,
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Single manual trigger using current UTC time */
  async function handleTriggerNow() {
    setSingleLoading(true);
    const log = await callApi(new Date().toISOString());
    setLastLog(log);
    setSingleLoading(false);
  }

  /** Sequential trigger: iterate from localStart to localEnd in 5-min steps */
  async function handleAssignJob() {
    const slots = buildSlots(startTime, endTime);
    if (slots.length === 0) return;

    setAssignRunning(true);
    abortRef.current = false;
    setLastLog(null);

    for (let i = 0; i < slots.length; i++) {
      if (abortRef.current) break;
      setAssignProgress({ idx: i + 1, total: slots.length, nowIso: slots[i] });
      const log = await callApi(slots[i]);
      setLastLog(log);
    }

    setAssignRunning(false);
    setAssignProgress(null);
  }

  function stopAssign() {
    abortRef.current = true;
  }

  useEffect(() => () => { abortRef.current = true; }, []);

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const canAssign = !!startTime && !!endTime && !assignRunning;

  return (
    <div className="card p-5 space-y-4">
      <h2 className="text-[13px] font-semibold text-gray-700 flex items-center gap-1.5">
        <Zap className="w-4 h-4 text-amber-400" />
        Assign Job Trigger
      </h2>

      {/* Trigger URL */}
      <div>
        <label className="label">Trigger URL (base)</label>
        <input
          className="input font-mono text-[11px]"
          value={url}
          onChange={e => setUrl(e.target.value)}
          disabled={assignRunning}
        />
      </div>

      {/* distributionMode + tenant code */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">distributionMode</label>
          <select
            className="input"
            value={distributionMode}
            onChange={e => setDistributionMode(e.target.value)}
            disabled={assignRunning}
          >
            <option value="RANDOM_DELAY">RANDOM_DELAY</option>
            <option value="ROTATION">ROTATION</option>
            <option value="BOTH">BOTH</option>
          </select>
        </div>
        <div>
          <label className="label">x-tenant-code</label>
          <input
            className="input"
            value={tenantCode}
            onChange={e => setTenantCode(e.target.value)}
            disabled={assignRunning}
            placeholder="BB"
          />
        </div>
      </div>

      {/* Time range — auto-filled from DB after verification */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 space-y-1.5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Post Time Range (from DB)</p>
        {startTime && endTime ? (
          <>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div>
                <span className="text-gray-400">Start: </span>
                <span className="font-mono text-gray-700">{new Date(startTime).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-400">End: </span>
                <span className="font-mono text-gray-700">{new Date(endTime).toLocaleString()}</span>
              </div>
            </div>
            <p className="text-[11px] text-violet-500 font-medium">
              {buildSlots(startTime, endTime).length} calls × 5-min steps
            </p>
          </>
        ) : (
          <p className="text-[12px] text-gray-400 italic">Run verification first to load post times</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={singleLoading || assignRunning}
          onClick={handleTriggerNow}
          className="btn flex-1 justify-center border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          {singleLoading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Zap className="w-3.5 h-3.5" />}
          Trigger Now
        </button>

        {assignRunning ? (
          <button
            type="button"
            onClick={stopAssign}
            className="btn flex-1 justify-center bg-red-50 border border-red-200 text-red-600 hover:bg-red-100"
          >
            <Square className="w-3.5 h-3.5" /> Stop
          </button>
        ) : (
          <button
            type="button"
            disabled={!canAssign}
            onClick={handleAssignJob}
            className="btn-primary flex-1 justify-center disabled:opacity-40"
          >
            <Play className="w-3.5 h-3.5" /> Assign Job
          </button>
        )}
      </div>

      {/* Progress */}
      {assignProgress && (
        <div className="text-[12px] text-gray-600 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
          <span>
            <span className="font-medium text-violet-600">{assignProgress.idx}/{assignProgress.total}</span>
            {" — "}
            <span className="font-mono">{assignProgress.nowIso.replace("T", " ").slice(0, 19)}Z</span>
          </span>
        </div>
      )}

      {/* Last call result */}
      {lastLog && (
        <div className={`flex items-start gap-2 text-[12px] rounded-md px-3 py-2 ${
          lastLog.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
        }`}>
          {lastLog.status === "success"
            ? <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            : <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />}
          <div>
            <div className="font-medium">{lastLog.message}</div>
            <div className="opacity-70 font-mono">{lastLog.nowParam.slice(0, 19)}Z — {fmtTime(lastLog.time)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
