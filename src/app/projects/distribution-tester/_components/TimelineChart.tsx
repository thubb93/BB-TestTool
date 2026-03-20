import type { DistributionVerifyResult } from "@/lib/distribution-verify-types";

interface Props {
  result: DistributionVerifyResult;
}

const BLOCKS = [
  { key: "morning" as const, label: "Morning", sub: "07:00–09:00", color: "bg-sky-400",    expected: null },
  { key: "lunch"   as const, label: "Lunch",   sub: "12:00–13:30", color: "bg-amber-400",  expected: null },
  { key: "evening" as const, label: "Evening", sub: "18:00–21:00", color: "bg-violet-400", expected: null },
  { key: "other"   as const, label: "Other",   sub: "outside blocks", color: "bg-gray-300", expected: null },
];

export default function TimelineChart({ result }: Props) {
  const { timeOfDayStats, post, antiBurstViolations } = result;

  return (
    <div className="card p-4 space-y-4">
      {/* Time-of-day bars */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold text-gray-700">Time-of-Day Distribution</h3>
          <span className="text-[11px] text-gray-400">
            Case {post.windowCase} · {post.windowHours}h window
          </span>
        </div>
        <div className="space-y-2.5">
          {BLOCKS.map(({ key, label, sub, color }) => {
            const value = timeOfDayStats[key];
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-[12px] mb-1">
                  <span className="text-gray-700">
                    {label} <span className="text-gray-400">{sub}</span>
                  </span>
                  <span className="text-gray-600 font-medium tabular-nums">{value.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color} transition-all duration-500`}
                    style={{ width: `${Math.min(100, value)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Case C rotation reference lines */}
        {post.windowCase === 'C' && (
          <p className="text-[11px] text-gray-400 mt-2">
            Expected for ROTATION: Morning 20% · Lunch 20% · Evening 60%
          </p>
        )}
      </div>

      {/* Anti-burst violations table */}
      {antiBurstViolations.length > 0 && (
        <div className="pt-3 border-t border-gray-100">
          <h4 className="text-[12px] font-semibold text-red-600 mb-2">
            Anti-burst Violations ({antiBurstViolations.length})
          </h4>
          <div className="space-y-1">
            {antiBurstViolations.slice(0, 12).map((v, i) => (
              <div key={i} className="flex items-center gap-3 text-[11px]">
                <span className={`badge font-bold ${v.type === '1min' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                  {v.type}
                </span>
                <span className="text-gray-500 font-mono">{new Date(v.windowStart).toLocaleTimeString()}</span>
                <span className="text-gray-700">{v.count} users (limit: {v.limit})</span>
              </div>
            ))}
            {antiBurstViolations.length > 12 && (
              <p className="text-[11px] text-gray-400">+{antiBurstViolations.length - 12} more violations</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
