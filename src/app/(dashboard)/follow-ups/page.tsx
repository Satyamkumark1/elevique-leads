import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { JobButton } from "@/components/job-button";
import { formatIST } from "@/lib/time";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getSetting } from "@/server/settings";

export default async function FollowUpsPage() {
  const supabase = await createSupabaseServer();
  const [steps, { data: jobs }] = await Promise.all([
    getSetting("followup_steps"),
    supabase
      .from("jobs")
      .select("id, status, run_at, payload, last_error, lead_id, leads(full_name, brand_name)")
      .eq("type", "followup")
      .in("status", ["pending", "cancelled", "done", "dead"])
      .order("run_at", { ascending: true })
      .limit(200),
  ]);
  const rows = [...(jobs ?? [])].sort(
    (a, b) => Number(b.status === "pending") - Number(a.status === "pending"),
  );

  const sequence = [
    { day: "Day 0", channel: "WhatsApp + email", template: "welcome_samples / welcome" },
    ...steps.map((s) => ({ day: `Day ${s.delay_hours / 24}`, channel: "WhatsApp", template: s.template })),
  ];

  return (
    <div className="space-y-6">
      <section aria-label="Sequence" className="rounded-xl border bg-surface p-5">
        <ol className="flex flex-wrap items-center gap-3">
          {sequence.map((s, i) => (
            <li key={s.day} className="flex items-center gap-3">
              <div className="rounded-lg border bg-surface-2 px-4 py-3">
                <p className="font-medium">{s.day}</p>
                <p className="text-xs text-text-muted">
                  {s.channel} · {s.template}
                </p>
              </div>
              {i < sequence.length - 1 && <ArrowRight size={16} className="text-text-muted" aria-hidden />}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-text-muted">Sequences stop automatically when a lead replies or is paused.</p>
      </section>

      {rows.length === 0 ? (
        <EmptyState title="No follow-ups scheduled" body="Follow-ups appear here when new leads arrive." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-surface">
          <table className="w-full text-[13px]">
            <thead className="bg-surface-2 text-left text-xs text-text-muted">
              <tr>
                {["Lead", "Step", "Channel", "Scheduled (IST)", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => {
                const lead = j.leads as { full_name: string | null; brand_name: string | null } | null;
                const step = (j.payload as { step?: string; template?: string }) ?? {};
                return (
                  <tr key={j.id} className="border-t">
                    <td className="px-4 py-2.5">
                      <Link href={`/leads/${j.lead_id}`} className="hover:underline">
                        {lead?.full_name ?? "Unnamed"}
                      </Link>
                      <span className="block text-xs text-text-muted">{lead?.brand_name ?? ""}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {step.step} <span className="text-text-muted">· {step.template}</span>
                    </td>
                    <td className="px-4 py-2.5">WhatsApp</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatIST(j.run_at)}</td>
                    <td className="px-4 py-2.5">
                      <span className="capitalize">{j.status}</span>
                      {j.status === "cancelled" && j.last_error && (
                        <span className="block text-xs text-text-muted">{j.last_error}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {j.status === "pending" && (
                        <JobButton id={j.id} action="cancel" label="Cancel follow-up" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
