import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mapFields } from "@/server/meta/mapFields";
import { verifySignature } from "@/server/meta/verifySignature";
import graphLead from "../fixtures/meta/graph-lead.json";

const SECRET = "test-app-secret";
const body = JSON.stringify({ object: "page", entry: [] });
const sign = (b: string) => `sha256=${createHmac("sha256", SECRET).update(b).digest("hex")}`;

describe("verifySignature", () => {
  it("TC-U-01: accepts a valid signature over the raw body", () => {
    expect(verifySignature(body, sign(body), SECRET)).toBe(true);
  });

  it("TC-U-02: rejects a body changed by one byte", () => {
    expect(verifySignature(body.replace("page", "pagf"), sign(body), SECRET)).toBe(false);
  });

  it("TC-U-03: rejects a missing header or wrong prefix", () => {
    expect(verifySignature(body, null, SECRET)).toBe(false);
    expect(verifySignature(body, sign(body).replace("sha256=", "sha1="), SECRET)).toBe(false);
    expect(verifySignature(body, "sha256=abc", SECRET)).toBe(false); // wrong length, no throw
  });

  // TC-U-04: implementation uses crypto.timingSafeEqual (see verifySignature.ts).
});

describe("mapFields", () => {
  it("TC-U-05: maps every PRD §8 field", () => {
    const lead = mapFields(graphLead);
    expect(lead).toMatchObject({
      leadgen_id: "LEADGEN_ID",
      full_name: "Asha Verma",
      phone_e164: "+919876543210",
      phone_valid: true,
      email: "asha@example.com",
      brand_name: "Kesar Threads",
      brand_link: "https://instagram.com/kesarthreads",
      category: "Fashion",
      budget_range: "₹50k–1L",
      budget_min_inr: 50000,
      videos_per_month: "3–5",
      start_timeline: "This month",
      campaign_name: "Diwali Fashion",
      ad_name: "Diwali Fashion — Reel 1",
      form_id: "130000000000001",
      meta_created_at: "2026-10-12T10:00:00.000Z",
    });
  });

  it("TC-U-06: keeps unknown fields in raw_fields", () => {
    const lead = mapFields({
      ...graphLead,
      field_data: [...graphLead.field_data, { name: "gst_number", values: ["07AAAAA0000A1Z5"] }],
    });
    expect(lead.raw_fields.gst_number).toBe("07AAAAA0000A1Z5");
  });

  it("TC-U-07: missing optional fields become null without throwing", () => {
    const lead = mapFields({ id: "X", field_data: [{ name: "full_name", values: ["A"] }] });
    expect(lead).toMatchObject({
      email: null,
      phone_e164: null,
      phone_valid: false,
      brand_link: null,
      budget_min_inr: null,
      campaign_id: null,
      meta_created_at: null,
    });
  });
});
