"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { formatIST } from "@/lib/time";
import { pageTitle } from "./nav";

export function TopBar({ lastWebhookAt }: { lastWebhookAt: string | null }) {
  const pathname = usePathname();
  // eslint-disable-next-line react-hooks/purity -- render-time "now" is fine for a 24h freshness dot
  const live = lastWebhookAt !== null && Date.now() - new Date(lastWebhookAt).getTime() < 24 * 3600 * 1000;
  const liveTitle = lastWebhookAt ? `Last webhook ${formatIST(lastWebhookAt)}` : "No webhooks received yet";

  return (
    <header className="flex h-16 items-center gap-4 border-b px-4 md:px-6">
      <h1 className="font-serif text-[28px] leading-none">{pageTitle(pathname)}</h1>

      <form action="/leads" className="ml-auto hidden sm:block" role="search">
        <label className="relative block">
          <span className="sr-only">Search leads by name, brand or phone</span>
          <Search
            size={16}
            aria-hidden
            className="absolute top-1/2 left-3 -translate-y-1/2 text-text-muted"
          />
          <input
            name="q"
            type="search"
            placeholder="Search name, brand, phone"
            className="h-9 w-64 rounded-md border bg-surface-2 pr-3 pl-9 text-[13px]"
          />
        </label>
      </form>

      <span title={liveTitle} className="flex items-center gap-2 text-xs text-text-muted max-sm:ml-auto">
        <span aria-hidden className={`size-2 rounded-full ${live ? "bg-success" : "bg-text-muted"}`} />
        {live ? "Live" : "Idle"}
      </span>

    </header>
  );
}
