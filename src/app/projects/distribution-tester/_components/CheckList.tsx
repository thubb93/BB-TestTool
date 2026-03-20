import type { CheckResult } from "@/lib/distribution-verify-types";
import { CheckCircle, XCircle, AlertTriangle, MinusCircle } from "lucide-react";

interface Props {
  checks: CheckResult[];
}

const STATUS_CONFIG = {
  pass: { Icon: CheckCircle, iconColor: "text-emerald-500", bg: "bg-white", badge: "bg-emerald-100 text-emerald-700", label: "PASS" },
  fail: { Icon: XCircle,    iconColor: "text-red-500",     bg: "bg-red-50",  badge: "bg-red-100 text-red-700",       label: "FAIL" },
  warn: { Icon: AlertTriangle, iconColor: "text-amber-500", bg: "bg-amber-50", badge: "bg-amber-100 text-amber-700", label: "WARN" },
  skip: { Icon: MinusCircle, iconColor: "text-gray-300",   bg: "bg-white",   badge: "bg-gray-100 text-gray-400",    label: "SKIP" },
};

export default function CheckList({ checks }: Props) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-[13px] font-semibold text-gray-700">Verification Checks</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {checks.map(check => {
          const { Icon, iconColor, bg, badge, label } = STATUS_CONFIG[check.status];
          return (
            <div key={check.id} className={`${bg} px-4 py-3.5 flex gap-3`}>
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColor}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-medium text-gray-800">{check.name}</span>
                  <span className={`badge ${badge} text-[10px] font-bold tracking-wide`}>{label}</span>
                </div>
                <p className="text-[12px] text-gray-600 mt-0.5">{check.message}</p>
                {check.details && (
                  <p className="text-[11px] text-gray-400 mt-0.5 font-mono">{check.details}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
