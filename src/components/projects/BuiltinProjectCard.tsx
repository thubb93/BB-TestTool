"use client";

import Link from "next/link";
import { BuiltinProject } from "@/lib/builtinProjects";
import { formatDate } from "@/lib/utils";
import { ArrowUpRight, Cpu, Calendar } from "lucide-react";

const ACCENT_COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#06b6d4", "#ec4899", "#6366f1",
];

function getAccentColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

export default function BuiltinProjectCard({ project }: { project: BuiltinProject }) {
  const accent = getAccentColor(project.id);
  const initials = getInitials(project.name);

  return (
    <Link href={`/projects/${project.slug}`} className="block group">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden">
        {/* Top accent stripe */}
        <div className="h-[3px]" style={{ backgroundColor: accent }} />

        <div className="flex flex-col flex-1 p-5 gap-3.5">
          {/* Header */}
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm"
              style={{ backgroundColor: accent }}
            >
              {initials}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1">
                <h3 className="text-[13px] font-semibold text-gray-900 leading-tight line-clamp-1">
                  {project.name}
                </h3>
                <ArrowUpRight
                  className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-0.5"
                />
              </div>

              {/* Built-in badge */}
              <span className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold mt-1.5 text-violet-700 bg-violet-50 ring-1 ring-violet-200/70">
                <Cpu className="w-2.5 h-2.5" />
                Built-in
              </span>
            </div>
          </div>

          {/* Description */}
          <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-2">
            {project.description}
          </p>

          {/* Tags */}
          {project.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {project.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium bg-gray-50 text-gray-500 ring-1 ring-gray-100"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(project.updatedAt)}</span>
            </div>
            <span className="text-[11px] text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Open tool →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
