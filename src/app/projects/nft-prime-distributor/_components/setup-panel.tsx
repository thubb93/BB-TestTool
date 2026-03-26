"use client";

import { Search, RefreshCw, Clock, Loader2 } from "lucide-react";
import type { DatabaseConnection } from "@/types";

/** Hardcoded UAT test emails for Art Prime distribution testing */
export const TEST_EMAILS = [
  "thu.nguyen.outs+1@bluebelt.asia",
  "thu.nguyen.outs+2@bluebelt.asia",
  "thu.nguyen.outs+3@bluebelt.asia",
  "thu.nguyen.outs+6@bluebelt.asia",
];

/** Compute SCAN_NFT_CRON_SCHEDULE value: NOW+5min in GMT+9, format DD_HH:mm (e.g. 29_06:53) */
export function computeCronValue(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  // Shift to UTC+9 (JST)
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const d = String(jst.getUTCDate()).padStart(2, "0");
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const mi = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${d}_${h}:${mi}`;
}

interface Props {
  connections: DatabaseConnection[];
  connectionId: string;
  checkedEmails: string[];
  fetching: boolean;
  updatingDates: boolean;
  updatingCron: boolean;
  onConnectionChange: (id: string) => void;
  onToggleEmail: (email: string) => void;
  onFetch: () => void;
  onUpdateDates: () => void;
  onUpdateCron: () => void;
}

export default function SetupPanel({
  connections, connectionId, checkedEmails,
  fetching, updatingDates, updatingCron,
  onConnectionChange, onToggleEmail,
  onFetch, onUpdateDates, onUpdateCron,
}: Props) {
  const busy = fetching || updatingDates || updatingCron;
  const cronPreview = computeCronValue();

  return (
    <div className="card p-5 space-y-5">
      <h2 className="text-[13px] font-semibold text-gray-700">Setup</h2>

      {/* DB Connection */}
      <div>
        <label className="label">DB Connection</label>
        <select
          className="input"
          value={connectionId}
          onChange={e => onConnectionChange(e.target.value)}
          disabled={busy}
        >
          {connections.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.driver})</option>
          ))}
        </select>
      </div>

      {/* Email checkboxes */}
      <div>
        <label className="label mb-2">Test Emails</label>
        <div className="space-y-1.5">
          {TEST_EMAILS.map(email => (
            <label key={email} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={checkedEmails.includes(email)}
                onChange={() => onToggleEmail(email)}
                disabled={busy}
                className="rounded"
              />
              <span className="text-[12px] text-gray-700 font-mono">{email}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-1">
        <button
          onClick={onFetch}
          disabled={busy || !checkedEmails.length || !connectionId}
          className="btn-primary w-full justify-center"
        >
          {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {fetching ? "Fetching..." : "Fetch Orders"}
        </button>

        <button
          onClick={onUpdateDates}
          disabled={busy || !checkedEmails.length || !connectionId}
          className="btn w-full justify-center border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-40"
        >
          {updatingDates ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {updatingDates ? "Updating..." : "Set end_date = NOW()"}
        </button>

        <button
          onClick={onUpdateCron}
          disabled={busy || !connectionId}
          className="btn w-full justify-center border border-violet-300 text-violet-700 hover:bg-violet-50 disabled:opacity-40"
        >
          {updatingCron ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
          {updatingCron ? "Updating..." : "Set Cron = NOW()+5m"}
        </button>

        <p className="text-[11px] text-gray-400 text-center font-mono">{cronPreview} (GMT+9)</p>
      </div>

      {/* Manual verification note */}
      <div className="border-t pt-4">
        <p className="text-[11px] font-semibold text-gray-500 mb-1">Verification (manual)</p>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          After cron fires, check:<br />
          <span className="font-mono text-gray-600">AMS → Assets → Art Prime</span>
        </p>
      </div>
    </div>
  );
}
