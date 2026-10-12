"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageState, ScoreBadge, StatusBadge } from "@/components/badges";
import { toast } from "@/components/toaster";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/labels";
import { formatIST, relativeTime } from "@/lib/time";
import type { LeadRow } from "@/server/leadsQuery";

type Props = {
  leads: LeadRow[];
  msgState: Record<string, { whatsapp?: string; email?: string }>;
  exportQuery: string;
  total: number;
};

export function LeadsTable({ leads, msgState, exportQuery, total }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const allSelected = selected.size === leads.length;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function bulkStatus(status: Status) {
    setBusy(true);
    const results = await Promise.all(
      [...selected].map((id) =>
        fetch(`/api/leads/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }).then((r) => r.ok),
      ),
    );
    setBusy(false);
    const failed = results.filter((ok) => !ok).length;
    toast(failed ? `${failed} updates failed` : `${results.length} leads → ${STATUS_LABEL[status]}`, {
      error: !!failed,
    });
    setSelected(new Set());
    router.refresh();
  }

  const exportHref = selected.size
    ? `/api/leads/export?ids=${[...selected].join(",")}`
    : `/api/leads/export${exportQuery ? `?${exportQuery}` : ""}`;

  return (
    <div className="rounded-xl border bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <span className="text-text-muted">
          {selected.size ? `${selected.size} selected` : `${total} leads`}
        </span>
        {selected.size > 0 && (
          <label className="flex items-center gap-2">
            <span className="sr-only">Change status of selected leads</span>
            <select
              disabled={busy}
              defaultValue=""
              onChange={(e) => e.target.value && bulkStatus(e.target.value as Status)}
              className="h-8 rounded-md border bg-surface-2 px-2 text-[13px]"
            >
              <option value="" disabled>
                Change status…
              </option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        )}
        <a
          href={exportHref}
          className="ml-auto rounded-md border px-3 py-1.5 text-[13px] hover:bg-surface-2"
          download
        >
          Export CSV
        </a>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-[13px]">
          <thead className="bg-surface-2 text-left text-xs text-text-muted">
            <tr>
              <th className="w-10 px-4 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all leads on this page"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(leads.map((l) => l.id)))}
                />
              </th>
              {[
                "Name",
                "Brand",
                "Category",
                "Budget",
                "Score",
                "Status",
                "Source ad",
                "WhatsApp",
                "Email",
                "Received",
              ].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr
                key={l.id}
                className="cursor-pointer border-t hover:bg-surface-2"
                onClick={() => router.push(`/leads/${l.id}`)}
              >
                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${l.full_name ?? "lead"}`}
                    checked={selected.has(l.id)}
                    onChange={() => toggle(l.id)}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/leads/${l.id}`}
                    className="font-medium hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {l.full_name ?? "Unnamed"}
                  </Link>
                  {l.duplicate_of && <DuplicateTag originalId={l.duplicate_of} />}
                </td>
                <td className="px-3 py-2.5">{l.brand_name ?? "—"}</td>
                <td className="px-3 py-2.5">{l.category ?? "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{l.budget_range ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <ScoreBadge score={l.score} />
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={l.status} />
                </td>
                <td className="max-w-40 truncate px-3 py-2.5 text-text-muted" title={l.ad_name ?? ""}>
                  {l.ad_name ?? "—"}
                </td>
                <td className="px-3 py-2.5">
                  <MessageState status={msgState[l.id]?.whatsapp ?? null} channel="WhatsApp" />
                </td>
                <td className="px-3 py-2.5">
                  <MessageState status={msgState[l.id]?.email ?? null} channel="Email" />
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-text-muted" title={formatIST(l.created_at)}>
                  {relativeTime(l.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <ul className="divide-y md:hidden">
        {leads.map((l) => (
          <li key={l.id} className="flex items-start gap-3 px-4 py-3">
            <input
              type="checkbox"
              className="mt-1"
              aria-label={`Select ${l.full_name ?? "lead"}`}
              checked={selected.has(l.id)}
              onChange={() => toggle(l.id)}
            />
            <Link href={`/leads/${l.id}`} className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{l.full_name ?? "Unnamed"}</span>
                <ScoreBadge score={l.score} />
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[13px] text-text-muted">
                <span className="truncate">
                  {l.brand_name ?? "—"} · {l.budget_range ?? "—"}
                </span>
                <span className="whitespace-nowrap">{relativeTime(l.created_at)}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <StatusBadge status={l.status} />
                <MessageState status={msgState[l.id]?.whatsapp ?? null} channel="WhatsApp" />
                <MessageState status={msgState[l.id]?.email ?? null} channel="Email" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DuplicateTag({ originalId }: { originalId: string }) {
  return (
    <Link
      href={`/leads/${originalId}`}
      onClick={(e) => e.stopPropagation()}
      className="ml-2 rounded-md bg-surface-2 px-1.5 py-0.5 text-xs text-text-muted hover:text-text"
    >
      Duplicate
    </Link>
  );
}
