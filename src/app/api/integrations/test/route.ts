import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { INTEGRATIONS, testIntegration } from "@/server/integrations";
import { requireTeam } from "@/server/session";

/** FR-34: "Test" button. Pings the provider only; never messages a lead. */
export async function POST(request: NextRequest) {
  const auth = await requireTeam();
  if ("response" in auth) return auth.response;
  const body = z
    .object({ integration: z.enum(INTEGRATIONS) })
    .safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  const result = await testIntegration(body.data.integration);
  return NextResponse.json({ ok: result.ok, detail: result.detail });
}
