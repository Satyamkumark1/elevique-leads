"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV, isActive } from "./nav";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <aside
        className={`hidden shrink-0 flex-col border-r bg-surface md:flex ${collapsed ? "w-16" : "w-60"}`}
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center justify-between px-4">
          {!collapsed && <span className="font-serif text-xl">Elevique</span>}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-md p-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <nav className="flex flex-col py-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? label : undefined}
                className={`flex h-10 items-center gap-3 border-l-2 px-4 ${
                  active
                    ? "border-accent text-text"
                    : "border-transparent text-text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                <Icon size={18} aria-hidden />
                {!collapsed && label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-10 flex border-t bg-surface md:hidden"
      >
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 border-t-2 py-2 text-[11px] ${
                active ? "border-accent text-text" : "border-transparent text-text-muted"
              }`}
            >
              <Icon size={18} aria-hidden />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
