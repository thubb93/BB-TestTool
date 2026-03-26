"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Settings, FlaskConical, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Projects", icon: LayoutGrid },
  { href: "/testcase", label: "Testcase", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-gray-950 hidden md:flex flex-col z-30 border-r border-white/5">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/40 flex-shrink-0">
            <FlaskConical className="w-[18px] h-[18px] text-white" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-white tracking-tight">BB TestTool</p>
            <p className="text-[11px] text-gray-500 leading-none mt-0.5">Internal QA Platform</p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-white/5" />

      {/* Nav */}
      <div className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-bold text-gray-600 uppercase tracking-[0.12em]">
          Menu
        </p>
        <nav className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150",
                  active
                    ? "bg-white/10 text-white"
                    : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
                )}
              >
                {/* Active indicator */}
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-500 rounded-r-full" />
                )}
                <Icon
                  className={cn(
                    "w-[17px] h-[17px] flex-shrink-0",
                    active ? "text-blue-400" : "text-gray-600"
                  )}
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="mx-5 h-px bg-white/5" />
      <div className="px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex-shrink-0 shadow-sm" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-gray-300 truncate">Internal Team</p>
            <p className="text-[10px] text-gray-600 leading-tight">v0.1.0</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
