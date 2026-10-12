import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { CATEGORIES, SCORES, SCORE_LABEL, STATUSES, STATUS_LABEL } from "@/lib/labels";
import { db } from "@/server/db";
import { leadsQuery, parseLeadFilters, type LeadRow } from "@/server/leadsQuery";
import { LeadsTable } from "./leads-table";

const PAGE_SIZE = 25;

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const filters = parseLeadFilters(await searchParams);
  const supabase = db();

  const from = (filters.page - 1) * PAGE_SIZE;
  const [{ data, count, error }, { data: campaignRows }] = await Promise.all([
    leadsQuery(supabase, filters, { count: true }).range(from, from + PAGE_SIZE - 1),
    supabase.from("leads").select("campaign_name").not("campaign_name", "is", null).limit(5000),
  ]);
  if (error) throw new Error("Could not load leads");
  const leads = (data ?? []) as LeadRow[];
  const campaigns = [...new Set((campaignRows ?? []).map((r) => r.campaign_name!))].sort();

  // Latest outbound message status per lead and channel.
  const { data: msgs } = leads.length
    ? await supabase
        .from("messages")
        .select("lead_id, channel, status, created_at")
        .in(
          "lead_id",
          leads.map((l) => l.id),
        )
        .eq("direction", "out")
        .order("created_at", { ascending: false })
    : { data: [] };
  const msgState: Record<string, { whatsapp?: string; email?: string }> = {};
  for (const m of msgs ?? []) {
    const s = (msgState[m.lead_id] ??= {});
    s[m.channel] ??= m.status;
  }

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const params = new URLSearchParams(
    Object.entries(filters).filter(([k, v]) => v !== undefined && k !== "page" && k !== "ids") as [
      string,
      string,
    ][],
  );
  const pageHref = (p: number) => `/leads?${new URLSearchParams([...params, ["page", String(p)]])}`;
  const filtered = params.size > 0;

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-3 rounded-xl border bg-surface p-4"
        aria-label="Filter leads"
      >
        <Field label="Search">
          <input
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Name, brand, phone"
            className={input}
          />
        </Field>
        <Select
          name="score"
          label="Score"
          value={filters.score}
          options={SCORES.map((s) => [s, SCORE_LABEL[s]])}
        />
        <Select
          name="status"
          label="Status"
          value={filters.status}
          options={STATUSES.map((s) => [s, STATUS_LABEL[s]])}
        />
        <Select
          name="category"
          label="Category"
          value={filters.category}
          options={CATEGORIES.map((c) => [c, c])}
        />
        <Select
          name="campaign"
          label="Campaign"
          value={filters.campaign}
          options={campaigns.map((c) => [c, c])}
        />
        <Field label="From">
          <input name="from" type="date" defaultValue={filters.from} className={input} />
        </Field>
        <Field label="To">
          <input name="to" type="date" defaultValue={filters.to} className={input} />
        </Field>
        <div className="flex gap-2">
          <button
            type="submit"
            className="h-9 rounded-md border bg-surface-2 px-3 font-medium hover:border-text-muted"
          >
            Apply
          </button>
          {filtered && (
            <Link href="/leads" className="flex h-9 items-center px-2 text-text-muted hover:text-text">
              Clear
            </Link>
          )}
        </div>
      </form>

      {leads.length === 0 ? (
        filtered ? (
          <EmptyState
            title="No matching leads"
            body="Try removing a filter."
            href="/leads"
            cta="Clear filters"
          />
        ) : (
          <EmptyState
            title="No leads yet"
            body="Connect your Meta Page to start receiving leads."
            href="/integrations"
            cta="Go to Integrations"
          />
        )
      ) : (
        <LeadsTable leads={leads} msgState={msgState} exportQuery={params.toString()} total={total} />
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-text-muted">
          <span>
            Page {filters.page} of {pages} · {total} leads
          </span>
          <span className="flex gap-2">
            {filters.page > 1 && (
              <Link
                href={pageHref(filters.page - 1)}
                className="rounded-md border px-3 py-1.5 hover:text-text"
              >
                Previous
              </Link>
            )}
            {filters.page < pages && (
              <Link
                href={pageHref(filters.page + 1)}
                className="rounded-md border px-3 py-1.5 hover:text-text"
              >
                Next
              </Link>
            )}
          </span>
        </nav>
      )}
    </div>
  );
}

const input = "h-9 rounded-md border bg-surface-2 px-3 text-[13px] text-text";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-text-muted">{label}</span>
      {children}
    </label>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: [string, string][];
}) {
  return (
    <Field label={label}>
      <select name={name} defaultValue={value ?? ""} className={input}>
        <option value="">All</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );
}
