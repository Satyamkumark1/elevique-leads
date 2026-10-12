import { LayoutGrid, Users, CalendarClock, FileText, PlugZap, Settings, type LucideIcon } from "lucide-react";

export const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/follow-ups", label: "Follow-ups", icon: CalendarClock },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/integrations", label: "Integrations", icon: PlugZap },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function pageTitle(pathname: string) {
  if (/^\/leads\/[^/]+$/.test(pathname)) return "Lead";
  return NAV.find((n) => isActive(pathname, n.href))?.label ?? "";
}
