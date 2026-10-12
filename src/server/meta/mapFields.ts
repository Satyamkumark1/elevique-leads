import { parseBudgetMin } from "../lib/budget";
import { normalizeIndianPhone } from "../lib/phone";
import type { GraphLead } from "./fetchLead";

export type MappedLead = {
  leadgen_id: string;
  full_name: string | null;
  phone_e164: string | null;
  phone_valid: boolean;
  email: string | null;
  brand_name: string | null;
  brand_link: string | null;
  category: string | null;
  budget_range: string | null;
  budget_min_inr: number | null;
  videos_per_month: string | null;
  start_timeline: string | null;
  raw_fields: Record<string, string>;
  campaign_id: string | null;
  campaign_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  form_id: string | null;
  meta_created_at: string | null;
};

/** Maps Graph `field_data` (PRD §8 keys) to lead columns (FR-05). Every field is kept in raw_fields. */
export function mapFields(lead: GraphLead): MappedLead {
  const raw: Record<string, string> = {};
  for (const f of lead.field_data) raw[f.name] = f.values.join(", ");
  const get = (key: string) => raw[key]?.trim() || null;
  const phone = normalizeIndianPhone(get("phone_number"));

  return {
    leadgen_id: lead.id,
    full_name: get("full_name"),
    phone_e164: phone.e164,
    phone_valid: phone.valid,
    email: get("email")?.toLowerCase() ?? null,
    brand_name: get("brand_name"),
    brand_link: get("brand_link"),
    category: get("category"),
    budget_range: get("monthly_budget"),
    budget_min_inr: parseBudgetMin(get("monthly_budget")),
    videos_per_month: get("videos_per_month"),
    start_timeline: get("start_timeline"),
    raw_fields: raw,
    campaign_id: lead.campaign_id ?? null,
    campaign_name: lead.campaign_name ?? null,
    ad_id: lead.ad_id ?? null,
    ad_name: lead.ad_name ?? null,
    form_id: lead.form_id ?? null,
    meta_created_at: lead.created_time ? new Date(lead.created_time).toISOString() : null,
  };
}
