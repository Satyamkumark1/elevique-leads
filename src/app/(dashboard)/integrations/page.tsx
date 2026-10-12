import Link from "next/link";
import { JobButton } from "@/components/job-button";
import { Time } from "@/components/time";
import { formatIST } from "@/lib/time";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";
import { TestButton } from "./test-button";

const CARDS = [
  { key: "meta", label: "Meta Page", jobTypes: ["fetch_lead"] },
  { key: "whatsapp", label: "WhatsApp Cloud API", jobTypes: ["send_whatsapp", "owner_alert", "followup"] },
  { key: "resend", label: "Resend (elevique.in)", jobTypes: ["send_email"] },
  { key: "sheets", label: "Google Sheets", jobTypes: ["sync_sheet"] },
  { key: "groq", label: "Groq", jobTypes: ["score_lead"] },
] as const;

export default async function IntegrationsPage({ searchParams }: PageProps<"/integrations">) {
  const tab = (await searchParams).tab === "dead" ? "dead" : "pending";
  const supabase = db();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
  const latest = <T,>(p: PromiseLike<{ data: T[] | null }>) =>
    Promise.resolve(p).then((r) => r.data?.[0] ?? null);

  const [lastLead, lastWa, lastEmail, lastSheet, lastAi, lastMetaHook, deadJobs, hooks24h, fetch24h, list] =
    await Promise.all([
      latest(
        supabase
          .from("events")
          .select("created_at")
          .eq("type", "lead.created")
          .order("created_at", { ascending: false })
          .limit(1),
      ),
      latest(
        supabase
          .from("messages")
          .select("created_at")
          .eq("channel", "whatsapp")
          .eq("direction", "out")
          .neq("status", "failed")
          .order("created_at", { ascending: false })
          .limit(1),
      ),
      latest(
        supabase
          .from("messages")
          .select("created_at")
          .eq("channel", "email")
          .order("created_at", { ascending: false })
          .limit(1),
      ),
      latest(
        supabase
          .from("jobs")
          .select("created_at:updated_at")
          .eq("type", "sync_sheet")
          .eq("status", "done")
          .order("updated_at", { ascending: false })
          .limit(1),
      ),
      latest(
        supabase
          .from("events")
          .select("created_at")
          .in("type", ["ai.scored", "score.changed"])
          .order("created_at", { ascending: false })
          .limit(1),
      ),
      latest(
        supabase
          .from("events")
          .select("created_at")
          .eq("type", "webhook.meta")
          .order("created_at", { ascending: false })
          .limit(1),
      ),
      supabase.from("jobs").select("type").eq("status", "dead"),
      supabase.from("events").select("type").like("type", "webhook.%").gte("created_at", dayAgo),
      supabase.from("jobs").select("status").eq("type", "fetch_lead").gte("created_at", dayAgo),
      supabase
        .from("jobs")
        .select(
          "id, type, status, run_at, updated_at, attempts, max_attempts, last_error, lead_id, leads(full_name)",
        )
        .eq("status", tab)
        .order(tab === "dead" ? "updated_at" : "run_at", { ascending: tab === "pending" })
        .limit(100),
    ]);

  const lastOk: Record<string, string | null> = {
    meta: lastLead?.created_at ?? null,
    whatsapp: lastWa?.created_at ?? null,
    resend: lastEmail?.created_at ?? null,
    sheets: lastSheet?.created_at ?? null,
    groq: lastAi?.created_at ?? null,
  };
  const deadByType = new Map<string, number>();
  for (const j of deadJobs.data ?? []) deadByType.set(j.type, (deadByType.get(j.type) ?? 0) + 1);
  const fetches = fetch24h.data ?? [];
  const fetchDone = fetches.filter((j) => j.status === "done").length;
  const fetchFinished = fetches.filter((j) => j.status === "done" || j.status === "dead").length;
  const automation = getEnv().AUTOMATION_ENABLED;

  return (
    <div className="space-y-6">
      <p
        role="status"
        className={`flex items-center gap-2 rounded-xl border p-4 ${automation ? "" : "border-warm text-warm"}`}
      >
        <span aria-hidden className={`size-2 rounded-full ${automation ? "bg-success" : "bg-warm"}`} />
        Automation {automation ? "enabled" : "disabled: leads are saved, no messages are sent"}{" "}
        (AUTOMATION_ENABLED, set in Vercel)
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => {
          const dead = c.jobTypes.reduce((n, t) => n + (deadByType.get(t) ?? 0), 0);
          return (
            <article key={c.key} className="rounded-xl border bg-surface p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-medium">{c.label}</h2>
                {dead > 0 ? (
                  <Link
                    href="/integrations?tab=dead"
                    className="rounded-md bg-error/15 px-2 py-0.5 text-xs text-error-fg"
                  >
                    {dead} failed
                  </Link>
                ) : (
                  <span className="rounded-md bg-success/15 px-2 py-0.5 text-xs text-success">
                    No failures
                  </span>
                )}
              </div>
              <p className="mt-2 text-text-muted">
                Last success: {lastOk[c.key] ? <Time value={lastOk[c.key]!} /> : "never"}
              </p>
              <div className="mt-4">
                <TestButton integration={c.key} label={c.label} />
              </div>
            </article>
          );
        })}

        <article className="rounded-xl border bg-surface p-5">
          <h2 className="font-medium">Webhook health</h2>
          <dl className="mt-2 space-y-1 text-text-muted">
            <div className="flex justify-between">
              <dt>Last Meta webhook</dt>
              <dd>{lastMetaHook ? <Time value={lastMetaHook.created_at} /> : "never"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Webhooks (24h)</dt>
              <dd>{(hooks24h.data ?? []).length}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Lead fetch success (24h)</dt>
              <dd>{fetchFinished ? `${Math.round((fetchDone / fetchFinished) * 100)}%` : "—"}</dd>
            </div>
          </dl>
        </article>
      </div>

      <section aria-labelledby="jobs" className="rounded-xl border bg-surface">
        <div className="flex items-center gap-4 border-b px-4">
          <h2 id="jobs" className="sr-only">
            Jobs
          </h2>
          {(["pending", "dead"] as const).map((t) => (
            <Link
              key={t}
              href={`/integrations?tab=${t}`}
              aria-current={tab === t ? "page" : undefined}
              className={`border-b-2 py-3 capitalize ${tab === t ? "border-accent text-text" : "border-transparent text-text-muted"}`}
            >
              {t}
            </Link>
          ))}
        </div>
        {(list.data ?? []).length === 0 ? (
          <p className="p-4 text-text-muted">No {tab} jobs.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-surface-2 text-left text-xs text-text-muted">
                <tr>
                  {["Type", "Lead", tab === "dead" ? "Failed" : "Runs at (IST)", "Attempts", "Error", ""].map(
                    (h) => (
                      <th key={h} className="px-4 py-2 font-medium">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {list.data!.map((j) => (
                  <tr key={j.id} className="border-t">
                    <td className="px-4 py-2.5 whitespace-nowrap">{j.type}</td>
                    <td className="px-4 py-2.5">
                      {j.lead_id ? (
                        <Link href={`/leads/${j.lead_id}`} className="hover:underline">
                          {(j.leads as { full_name: string | null } | null)?.full_name ?? "Lead"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {formatIST(tab === "dead" ? j.updated_at : j.run_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      {j.attempts}/{j.max_attempts}
                    </td>
                    <td className="max-w-80 px-4 py-2.5 break-words text-error-fg">{j.last_error ?? ""}</td>
                    <td className="px-4 py-2.5 text-right">
                      {tab === "dead" && <JobButton id={j.id} action="retry" label={`Retry ${j.type}`} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
