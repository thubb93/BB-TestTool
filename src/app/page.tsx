"use client";

import { BUILTIN_PROJECTS } from "@/lib/builtinProjects";
import BuiltinProjectCard from "@/components/projects/BuiltinProjectCard";
import { Cpu } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky top bar */}
      <div className="page-topbar">
        <div>
          <h1 className="text-[18px] font-bold text-gray-900 tracking-tight">Projects</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">
            {BUILTIN_PROJECTS.length} tool{BUILTIN_PROJECTS.length !== 1 ? "s" : ""} available
          </p>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Section label */}
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-3.5 h-3.5 text-violet-500" />
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            Built-in Tools
          </span>
          <span className="text-[10px] text-gray-300 bg-gray-100 rounded-full px-2 py-0.5 tabular-nums">
            {BUILTIN_PROJECTS.length}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
          {BUILTIN_PROJECTS.map((p) => (
            <BuiltinProjectCard key={p.id} project={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
