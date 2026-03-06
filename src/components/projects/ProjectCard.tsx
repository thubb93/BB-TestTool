"use client";

import { Project } from "@/types";
import { formatDate } from "@/lib/utils";
import { MoreVertical, Pencil, Trash2, Calendar, ArrowUpRight } from "lucide-react";
import { useState, useRef, useEffect } from "react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ACCENT_COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#6366f1", // indigo
  "#84cc16", // lime
  "#f97316", // orange
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

const statusConfig = {
  active: {
    label: "Active",
    dot: "bg-emerald-400",
    className: "text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200/70",
  },
  inactive: {
    label: "Inactive",
    dot: "bg-gray-300",
    className: "text-gray-500 bg-gray-50 ring-1 ring-gray-200/70",
  },
  archived: {
    label: "Archived",
    dot: "bg-amber-400",
    className: "text-amber-700 bg-amber-50 ring-1 ring-amber-200/70",
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (id: string) => void;
}

export default function ProjectCard({ project, onEdit, onDelete }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const accent = getAccentColor(project.id);
  const initials = getInitials(project.name);
  const status = statusConfig[project.status];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="group bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden">
      {/* Top accent stripe */}
      <div className="h-[3px]" style={{ backgroundColor: accent }} />

      <div className="flex flex-col flex-1 p-5 gap-3.5">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Initials avatar */}
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm"
            style={{ backgroundColor: accent }}
          >
            {initials}
          </div>

          {/* Name + status + menu */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <h3 className="text-[13px] font-semibold text-gray-900 leading-tight line-clamp-1">
                {project.name}
              </h3>

              {/* Kebab menu */}
              <div className="relative flex-shrink-0" ref={menuRef}>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                  className="p-1 rounded-md text-gray-300 hover:text-gray-500 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all duration-100"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-7 w-40 bg-white border border-gray-100 rounded-xl shadow-xl shadow-gray-200/60 z-20 overflow-hidden animate-fade-in py-1">
                    <button
                      onClick={() => { onEdit(project); setMenuOpen(false); }}
                      className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-gray-700 hover:bg-gray-50 font-medium"
                    >
                      <Pencil className="w-3.5 h-3.5 text-gray-400" />
                      Edit project
                    </button>
                    <div className="h-px bg-gray-100 mx-3" />
                    <button
                      onClick={() => { onDelete(project.id); setMenuOpen(false); }}
                      className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Status badge */}
            <span className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold mt-1.5 ${status.className}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className={`text-[12px] leading-relaxed line-clamp-2 ${project.description ? "text-gray-500" : "text-gray-300 italic"}`}>
          {project.description || "No description provided"}
        </p>

        {/* Tags */}
        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium bg-gray-50 text-gray-500 ring-1 ring-gray-100"
              >
                {tag}
              </span>
            ))}
            {project.tags.length > 3 && (
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium bg-gray-50 text-gray-400 ring-1 ring-gray-100">
                +{project.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <Calendar className="w-3 h-3" />
            <span>{formatDate(project.updatedAt)}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-gray-300 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            Open
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </div>
  );
}
