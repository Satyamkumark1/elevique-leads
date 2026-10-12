import "server-only";
import { z } from "zod";
import { getEnv } from "../env";
import { PermanentJobError } from "../jobs/errors";

const graphLeadSchema = z.object({
  id: z.string(),
  created_time: z.string().optional(),
  ad_id: z.string().optional(),
  ad_name: z.string().optional(),
  campaign_id: z.string().optional(),
  campaign_name: z.string().optional(),
  form_id: z.string().optional(),
  field_data: z.array(z.object({ name: z.string(), values: z.array(z.string()) })).default([]),
});
export type GraphLead = z.infer<typeof graphLeadSchema>;

const FIELDS = "created_time,field_data,ad_id,ad_name,campaign_id,campaign_name,form_id";

/** GET /{leadgen_id} (FR-04). 4xx → permanent (dead job), 5xx/network → retryable. */
export async function fetchLead(leadgenId: string): Promise<GraphLead> {
  const env = getEnv();
  const url = `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${encodeURIComponent(leadgenId)}?fields=${FIELDS}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.META_PAGE_ACCESS_TOKEN}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const message = `graph lead fetch failed: HTTP ${res.status}`;
    if (res.status >= 400 && res.status < 500 && res.status !== 429) throw new PermanentJobError(message);
    throw new Error(message);
  }
  return graphLeadSchema.parse(await res.json());
}
