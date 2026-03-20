"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Database } from "lucide-react";

interface Props {
  rows: Record<string, unknown>[];
  totalCount: number; // includes CANCELLED, all statuses
}

const PRIORITY_COLS = ["id", "account_id", "assigned_at", "status", "is_deleted"];

/** Format a cell value for display */
function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return s.length > 60 ? s.slice(0, 60) + "…" : s;
}

/** Return badge class based on status/is_deleted value */
function statusClass(col: string, v: unknown): string {
  if (col === "status") {
    if (v === "CANCELLED") return "bg-red-100 text-red-600";
    if (v === "COMPLETED") return "bg-emerald-100 text-emerald-600";
    if (v === "ASSIGNED") return "bg-blue-100 text-blue-600";
  }
  if (col === "is_deleted" && (v === 1 || v === "1" || v === true)) return "bg-orange-100 text-orange-600";
  return "";
}

export default function RawDataTable({ rows, totalCount }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (rows.length === 0) return null;

  // Derive column order: priority cols first, then alphabetical remainder
  const allCols = Object.keys(rows[0]);
  const priorityCols = PRIORITY_COLS.filter(c => allCols.includes(c));
  const restCols = allCols.filter(c => !PRIORITY_COLS.includes(c)).sort();
  const cols = [...priorityCols, ...restCols];

  const visibleRows = expanded ? rows : rows.slice(0, 20);

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-400" />
          <span className="text-[13px] font-semibold text-gray-700">
            Raw DB Rows
          </span>
          <span className="badge bg-gray-100 text-gray-500 text-[11px]">
            {totalCount} total
          </span>
        </div>
        <p className="text-[11px] text-gray-400 font-mono truncate max-w-xs">
          SELECT * FROM user_influencer_post ORDER BY id DESC
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {cols.map(col => (
                <th
                  key={col}
                  className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60">
                {cols.map(col => {
                  const v = row[col];
                  const badge = statusClass(col, v);
                  return (
                    <td key={col} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">
                      {badge ? (
                        <span className={`badge text-[11px] ${badge}`}>{formatCell(v)}</span>
                      ) : (
                        formatCell(v)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expand/collapse */}
      {rows.length > 20 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full px-4 py-2 text-[12px] text-gray-500 hover:text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1 transition-colors border-t border-gray-100"
        >
          {expanded ? (
            <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
          ) : (
            <><ChevronDown className="w-3.5 h-3.5" /> Show all {rows.length} rows</>
          )}
        </button>
      )}
    </div>
  );
}
