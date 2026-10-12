const IST_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

/** IST calendar day (YYYY-MM-DD) of an instant. */
export const istDay = (d: Date | string) =>
  new Date(new Date(d).getTime() + IST_MS).toISOString().slice(0, 10);

type StatLead = {
  created_at: string;
  score: string | null;
  campaign_name: string | null;
  first_response_at: string | null;
  last_reply_at: string | null;
  status: string;
};

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** "8s", "4m", "2h", "3d". */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

/** Overview numbers (FR-29) from the last 30 days of leads. */
export function overviewStats(leads: StatLead[], now: Date) {
  const today = istDay(now);
  const weekAgo = now.getTime() - 7 * DAY_MS;
  const last7 = leads.filter((l) => new Date(l.created_at).getTime() >= weekAgo);
  const contacted7 = last7.filter((l) => l.first_response_at);
  const replied7 = contacted7.filter((l) => l.last_reply_at);

  const days: { day: string; leads: number }[] = [];
  for (let i = 29; i >= 0; i--) days.push({ day: istDay(new Date(now.getTime() - i * DAY_MS)), leads: 0 });
  const byDay = new Map(days.map((d) => [d.day, d]));
  for (const l of leads) {
    const d = byDay.get(istDay(l.created_at));
    if (d) d.leads++;
  }

  const campaigns = new Map<string, number>();
  for (const l of leads)
    campaigns.set(l.campaign_name ?? "Unknown", (campaigns.get(l.campaign_name ?? "Unknown") ?? 0) + 1);

  return {
    leadsToday: leads.filter((l) => istDay(l.created_at) === today).length,
    hotThisWeek: last7.filter((l) => l.score === "hot").length,
    replyRate: contacted7.length ? replied7.length / contacted7.length : null,
    medianFirstResponseMs: median(
      leads
        .filter((l) => l.first_response_at)
        .map((l) => new Date(l.first_response_at!).getTime() - new Date(l.created_at).getTime()),
    ),
    perDay: days,
    byCampaign: [...campaigns]
      .map(([campaign, count]) => ({ campaign, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    scoreSplit: {
      hot: leads.filter((l) => l.score === "hot").length,
      warm: leads.filter((l) => l.score === "warm").length,
      cold: leads.filter((l) => l.score === "cold").length,
    },
  };
}
