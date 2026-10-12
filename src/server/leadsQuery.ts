import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { CATEGORIES, SCORES, STATUSES } from "@/lib/labels";

const optional = <T extends z.ZodType>(s: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), s.optional());

/** Leads filters as they appear in the URL (UI_SPEC 3.2). Invalid values are dropped, never trusted. */
export const leadFiltersSchema = z.object({
  q: optional(z.string().max(100)).catch(undefined),
  score: optional(z.enum(SCORES)).catch(undefined),
  status: optional(z.enum(STATUSES)).catch(undefined),
  category: optional(z.enum(CATEGORIES)).catch(undefined),
  campaign: optional(z.string().max(200)).catch(undefined),
  from: optional(z.iso.date()).catch(undefined),
  to: optional(z.iso.date()).catch(undefined),
  ids: optional(z.string().max(20_000)).catch(undefined),
  page: z.coerce.number().int().min(1).catch(1).default(1),
});
export type LeadFilters = z.infer<typeof leadFiltersSchema>;

export function parseLeadFilters(params: URLSearchParams | Record<string, string | string[] | undefined>) {
  const entries =
    params instanceof URLSearchParams
      ? Object.fromEntries(params)
      : Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  return leadFiltersSchema.parse(entries);
}

const LEAD_COLUMNS =
  "id, created_at, full_name, phone_e164, email, brand_name, brand_link, category, budget_range, start_timeline, videos_per_month, score, score_source, status, campaign_name, ad_name, duplicate_of, ai_summary, automation_paused";

/** Applies filters to a leads select. Dates are IST calendar days. */
export function leadsQuery(client: SupabaseClient<Database>, f: LeadFilters, opts: { count?: boolean } = {}) {
  let q = client
    .from("leads")
    .select(LEAD_COLUMNS, opts.count ? { count: "exact" } : undefined)
    .order("created_at", { ascending: false });
  if (f.score) q = q.eq("score", f.score);
  if (f.status) q = q.eq("status", f.status);
  if (f.category) q = q.eq("category", f.category);
  if (f.campaign) q = q.eq("campaign_name", f.campaign);
  if (f.from) q = q.gte("created_at", `${f.from}T00:00:00+05:30`);
  if (f.to) q = q.lte("created_at", `${f.to}T23:59:59.999+05:30`);
  if (f.ids)
    q = q.in(
      "id",
      f.ids.split(",").filter((id) => z.uuid().safeParse(id).success),
    );
  if (f.q) {
    // Strip PostgREST filter syntax characters before building the OR filter.
    const term = f.q.replace(/[,()*%\\:"']/g, " ").trim();
    if (term) q = q.or(`full_name.ilike.%${term}%,brand_name.ilike.%${term}%,phone_e164.ilike.%${term}%`);
  }
  return q;
}

export type LeadRow = {
  id: string;
  created_at: string;
  full_name: string | null;
  phone_e164: string | null;
  email: string | null;
  brand_name: string | null;
  brand_link: string | null;
  category: string | null;
  budget_range: string | null;
  start_timeline: string | null;
  videos_per_month: string | null;
  score: Database["public"]["Enums"]["lead_score"] | null;
  score_source: string | null;
  status: Database["public"]["Enums"]["lead_status"];
  campaign_name: string | null;
  ad_name: string | null;
  duplicate_of: string | null;
  ai_summary: string | null;
  automation_paused: boolean;
};
