import type { NextRequest } from "next/server";
import { toCsv } from "@/lib/csv";
import { istDay } from "@/lib/stats";
import { formatIST } from "@/lib/time";
import { db } from "@/server/db";
import { leadsQuery, parseLeadFilters } from "@/server/leadsQuery";

const HEADER = [
  "Lead ID",
  "Received (IST)",
  "Name",
  "Phone",
  "Email",
  "Brand",
  "Brand link",
  "Category",
  "Budget",
  "Videos/month",
  "Timeline",
  "Score",
  "Status",
  "Campaign",
  "Ad",
  "AI summary",
] as const;

/** FR-30: CSV of the filtered leads (same filters as the Leads page, or `ids` for a bulk selection). */
export async function GET(request: NextRequest) {

  const filters = parseLeadFilters(request.nextUrl.searchParams);
  const { data, error } = await leadsQuery(db(), filters).limit(10_000);
  if (error) return Response.json({ ok: false, error: "export failed" }, { status: 500 });

  const csv = toCsv(
    HEADER,
    data.map((l) => [
      l.id,
      formatIST(l.created_at),
      l.full_name,
      l.phone_e164,
      l.email,
      l.brand_name,
      l.brand_link,
      l.category,
      l.budget_range,
      l.videos_per_month,
      l.start_timeline,
      l.score,
      l.status,
      l.campaign_name,
      l.ad_name,
      l.ai_summary,
    ]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="elevique-leads-${istDay(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
