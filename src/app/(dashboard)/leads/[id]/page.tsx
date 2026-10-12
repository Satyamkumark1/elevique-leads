import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ScoreBadge } from "@/components/badges";
import { formatIST } from "@/lib/time";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getEnv } from "@/server/env";
import { LeadActions, LeadControls, LeadNotes } from "./lead-controls";
import { Timeline, type TimelineItem } from "./timeline";

export default async function LeadDetailPage({ params }: PageProps<"/leads/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createSupabaseServer();

  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (!lead) notFound();

  const [{ data: events }, { data: messages }, { data: jobs }, { data: original }] = await Promise.all([
    supabase.from("events").select("id, type, description, created_at").eq("lead_id", id).order("created_at"),
    supabase
      .from("messages")
      .select("id, channel, direction, template_name, body, status, error, created_at")
      .eq("lead_id", id)
      .order("created_at"),
    supabase
      .from("jobs")
      .select("id, type, payload, status, run_at, last_error")
      .eq("lead_id", id)
      .eq("type", "followup")
      .order("run_at"),
    lead.duplicate_of
      ? supabase.from("leads").select("id, full_name").eq("id", lead.duplicate_of).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Messages already appear as their own rows; drop the matching send events.
  const timeline: TimelineItem[] = [
    ...(events ?? [])
      .filter((e) => e.type !== "message.sent")
      .map((e) => ({ kind: "event" as const, at: e.created_at, ...e })),
    ...(messages ?? []).map((m) => ({ kind: "message" as const, at: m.created_at, ...m })),
    ...(jobs ?? [])
      .filter((j) => j.status === "pending" || j.status === "cancelled")
      .map((j) => ({
        kind: "followup" as const,
        at: j.run_at,
        id: j.id,
        status: j.status,
        step: String((j.payload as { step?: string })?.step ?? "follow-up"),
        reason: j.last_error,
      })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const lastNoteAt = [...(events ?? [])].reverse().find((e) => e.type === "note.updated")?.created_at ?? null;
  const answers: [string, string | null][] = [
    ["Brand", lead.brand_name],
    ["Instagram / website", lead.brand_link],
    ["Category", lead.category],
    ["Monthly budget", lead.budget_range],
    ["Videos per month", lead.videos_per_month],
    ["Start", lead.start_timeline],
    ["Campaign", lead.campaign_name],
    ["Ad", lead.ad_name],
    ["Received", formatIST(lead.created_at)],
  ];
  const brandHref = lead.brand_link
    ? /^https?:\/\//.test(lead.brand_link)
      ? lead.brand_link
      : lead.brand_link.startsWith("@")
        ? `https://instagram.com/${lead.brand_link.slice(1)}`
        : `https://${lead.brand_link}`
    : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-serif text-3xl leading-tight break-words">
            {lead.full_name ?? "Unnamed lead"}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-text-muted">
            <span>{lead.brand_name ?? "No brand"}</span>
            {brandHref && (
              <a
                href={brandHref}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-accent hover:underline"
              >
                {lead.brand_link}
              </a>
            )}
            <ScoreBadge score={lead.score} />
            {original && (
              <Link
                href={`/leads/${original.id}`}
                className="rounded-md bg-surface-2 px-2 py-0.5 text-xs hover:text-text"
              >
                Duplicate of {original.full_name ?? "original"}
              </Link>
            )}
          </p>
        </div>
        <LeadControls id={lead.id} status={lead.status} paused={lead.automation_paused} />
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border bg-surface p-5" aria-labelledby="answers">
          <h3 id="answers" className="text-xs text-text-muted">
            Form answers
          </h3>
          <dl className="mt-3 space-y-2">
            {answers.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-text-muted">{k}</dt>
                <dd className="text-right break-words">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-xl border bg-surface p-5" aria-labelledby="ai">
          <h3 id="ai" className="text-xs text-text-muted">
            AI summary
          </h3>
          {lead.ai_summary ? (
            <>
              <p className="mt-3">{lead.ai_summary}</p>
              {lead.ai_reason && <p className="mt-2 text-text-muted">Reason: {lead.ai_reason}</p>}
            </>
          ) : (
            <p className="mt-3 text-text-muted">
              {lead.ai_status === "failed" ? "AI scoring failed; rule score kept." : "Not scored by AI yet."}
            </p>
          )}
          <p className="mt-3 text-xs text-text-muted">
            Scored by {lead.score_source === "ai" ? "AI" : "rules"}
          </p>
        </section>

        <section className="rounded-xl border bg-surface p-5" aria-labelledby="contact">
          <h3 id="contact" className="text-xs text-text-muted">
            Contact
          </h3>
          <dl className="mt-3 space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Phone</dt>
              <dd>{lead.phone_e164 ?? <span className="text-error-fg">Invalid or missing</span>}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Email</dt>
              <dd className="break-all">{lead.email ?? "—"}</dd>
            </div>
          </dl>
          <LeadActions
            id={lead.id}
            phone={lead.phone_e164}
            email={lead.email}
            bookingUrl={getEnv().BOOKING_URL}
            name={lead.full_name}
          />
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border bg-surface p-5 lg:col-span-2" aria-labelledby="timeline">
          <h3 id="timeline" className="text-xs text-text-muted">
            Timeline
          </h3>
          <Timeline items={timeline} />
        </section>
        <section className="rounded-xl border bg-surface p-5" aria-labelledby="notes">
          <h3 id="notes" className="text-xs text-text-muted">
            Notes
          </h3>
          <LeadNotes id={lead.id} notes={lead.notes ?? ""} lastEditedAt={lastNoteAt} />
        </section>
      </div>
    </div>
  );
}
