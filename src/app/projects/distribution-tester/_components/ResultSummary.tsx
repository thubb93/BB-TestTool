import type { DistributionVerifyResult } from "@/lib/distribution-verify-types";
import { CheckCircle, XCircle, AlertTriangle, Clock } from "lucide-react";

const CASE_LABELS: Record<string, string> = {
  A: "Case A (≤24h)",
  B: "Case B (24–48h)",
  C: "Case C (≥48h)",
};

interface Props {
  result: DistributionVerifyResult;
}

export default function ResultSummary({ result }: Props) {
  const { post, assignedCount, checks } = result;
  const passed = checks.filter(c => c.status === 'pass').length;
  const failed = checks.filter(c => c.status === 'fail').length;
  const warned = checks.filter(c => c.status === 'warn').length;
  const skipped = checks.filter(c => c.status === 'skip').length;

  const overall = failed > 0 ? 'fail' : warned > 0 ? 'warn' : 'pass';
  const Icon = overall === 'fail' ? XCircle : overall === 'warn' ? AlertTriangle : CheckCircle;
  const iconColor = overall === 'fail' ? 'text-red-500' : overall === 'warn' ? 'text-amber-500' : 'text-emerald-500';
  const bannerClass = overall === 'fail'
    ? 'bg-red-50 border-red-200'
    : overall === 'warn'
    ? 'bg-amber-50 border-amber-200'
    : 'bg-emerald-50 border-emerald-200';
  const labelColor = overall === 'fail' ? 'text-red-700' : overall === 'warn' ? 'text-amber-700' : 'text-emerald-700';
  const overallLabel = overall === 'fail' ? 'Verification Failed' : overall === 'warn' ? 'Passed with Warnings' : 'All Checks Passed';

  return (
    <div className="space-y-3">
      {/* Banner */}
      <div className={`card p-4 border ${bannerClass} flex items-center gap-3`}>
        <Icon className={`w-6 h-6 flex-shrink-0 ${iconColor}`} />
        <div>
          <div className={`text-[14px] font-semibold ${labelColor}`}>{overallLabel}</div>
          <div className="text-[12px] text-gray-500 mt-0.5">
            {passed} passed · {failed} failed · {warned} warned · {skipped} skipped
          </div>
        </div>
      </div>

      {/* Post info */}
      <div className="card p-4 space-y-3">
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Post Info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
          <Row label="ID" value={`#${post.id}`} />
          <Row label="Name" value={post.name} />
          <Row label="Status" value={post.status} />
          <Row label="Window" value={`${post.windowHours}h — ${CASE_LABELS[post.windowCase]}`} />
          <Row label="Distribution" value={post.distributionType} />
          <Row label="Phase" value={post.phase} />
          <Row label="Post Type" value={post.postType} />
          <Row label="Assigned" value={`${assignedCount} users`} />
          <Row label="SNS" value={post.snsPlatforms.join(', ') || '—'} />
        </div>
        <div className="text-[11px] text-gray-400 flex items-center gap-1.5 pt-1 border-t border-gray-50">
          <Clock className="w-3 h-3" />
          <span>{new Date(post.startAt).toLocaleString()}</span>
          <span>→</span>
          <span>{new Date(post.endAt).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-400">{label}: </span>
      <span className="text-gray-800 font-medium">{value || '—'}</span>
    </div>
  );
}
