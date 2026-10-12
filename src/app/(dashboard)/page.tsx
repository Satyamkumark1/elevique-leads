import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Time } from "@/components/time";
import { SCORE_LABEL, SCORES } from "@/lib/labels";
import { formatDuration, overviewStats } from "@/lib/stats";
import { createSupabaseServer } from "@/lib/supabase/server";
import { LeadsByCampaign, LeadsPerDay } from "./overview-charts";

export default async function OverviewPage() {
  const supabase = await createSupabaseServer();
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  const [{ data: leads, error }, { data: attention }, { data: events }] = await Promise.all([
    supabase
      .from("leads")
      .select("created_at, score, campaign_name, first_response_at, last_reply_at, status")
      .gte("created_at", since),
    // Replied and not yet moved on by the team = waiting for a human.
    supabase
      .from("leads")
      .select("id, full_name, brand_name, phone_e164, last_reply_at")
      .eq("status", "replied")
      .order("last_reply_at", { ascending: false, nullsFirst: false })
      .limit(10),
    supabase
      .from("events")
      .select("id, lead_id, type, description, created_at")
      .not("type", "like", "webhook.%")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (error) throw new Error("Could not load overview");

  if ((leads ?? []).length === 0 && (events ?? []).length === 0) {
    return (
      <EmptyState
        title="No leads yet"
        body="Connect your Meta Page to start receiving leads."
        href="/integrations"
        cta="Go to Integrations"
      />
    );
  }

  const s = overviewStats(leads ?? [], now);
  const splitMax = Math.max(1, ...SCORES.map((k) => s.scoreSplit[k]));

  return (
    <div className="space-y-6">
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Leads today" value={String(s.leadsToday)} />
        <Stat label="Hot leads this week" value={String(s.hotThisWeek)} />
        <Stat
          label="Reply rate (7d)"
          value={s.replyRate === null ? "—" : `${Math.round(s.replyRate * 100)}%`}
        />
        <Stat label="Median first response" value={formatDuration(s.medianFirstResponseMs)} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Leads per day (30d)" className="lg:col-span-2">
          <LeadsPerDay data={s.perDay} />
        </Card>
        <Card title="Score split (30d)">
          {/* Labelled bars, not a stack: hot/warm tokens are too close to tell apart adjacent. */}
          <ul className="mt-2 space-y-3">
            {SCORES.map((k) => (
              <li key={k}>
                <div className="flex justify-between text-[13px]">
                  <span>{SCORE_LABEL[k]}</span>
                  <span>{s.scoreSplit[k]}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-surface-2">
                  <div
                    className={`h-2 rounded-full ${k === "hot" ? "bg-hot" : k === "warm" ? "bg-warm" : "bg-cold"}`}
                    style={{ width: `${(s.scoreSplit[k] / splitMax) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Leads by campaign (30d)">
          <LeadsByCampaign data={s.byCampaign} />
        </Card>

        <Card title="Needs your attention">
          {(attention ?? []).length === 0 ? (
            <p className="text-text-muted">No replies waiting.</p>
          ) : (
            <ul className="divide-y">
              {attention!.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/leads/${l.id}`} className="min-w-0 hover:underline">
                    <span className="block truncate font-medium">{l.full_name ?? "Unnamed"}</span>
                    <span className="block truncate text-xs text-text-muted">
                      {l.brand_name ?? "—"} · {l.last_reply_at ? <Time value={l.last_reply_at} /> : "replied"}
                    </span>
                  </Link>
                  {l.phone_e164 && (
                    <a
                      href={`https://wa.me/${l.phone_e164.slice(1)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-surface-2"
                    >
                      <MessageCircle size={14} aria-hidden /> Open in WhatsApp
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Activity">
          <ul className="space-y-3">
            {(events ?? []).map((e) => (
              <li key={e.id} className="text-[13px]">
                {e.lead_id ? (
                  <Link href={`/leads/${e.lead_id}`} className="hover:underline">
                    {e.description ?? e.type}
                  </Link>
                ) : (
                  (e.description ?? e.type)
                )}
                <span className="block text-xs text-text-muted">
                  <Time value={e.created_at} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-surface p-5">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-2 font-serif text-4xl text-accent">{value}</p>
    </div>
  );
}

function Card({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border bg-surface p-5 ${className}`}>
      <h2 className="mb-3 text-xs text-text-muted">{title}</h2>
      {children}
    </section>
  );
}
