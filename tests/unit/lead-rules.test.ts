import { describe, expect, it } from "vitest";
import { ruleScore } from "@/server/ai/ruleScore";
import { nextRetry } from "@/server/jobs/backoff";
import { parseBudgetMin } from "@/server/lib/budget";
import { duplicateWindowStart } from "@/server/lib/duplicate";
import { normalizeIndianPhone } from "@/server/lib/phone";

describe("normalizeIndianPhone", () => {
  it.each([
    ["TC-U-08", "9876543210"],
    ["TC-U-09", "+91 98765-43210"],
    ["TC-U-10", "09876543210"],
    ["TC-U-11", "919876543210"],
  ])("%s: %s → +919876543210", (_id, input) => {
    expect(normalizeIndianPhone(input)).toEqual({ e164: "+919876543210", valid: true });
  });

  it.each(["12345", "5876543210", "", null, "+1 415 555 0100"])("TC-U-12: %s is invalid", (input) => {
    expect(normalizeIndianPhone(input)).toEqual({ e164: null, valid: false });
  });
});

describe("parseBudgetMin (TC-U-13)", () => {
  it.each([
    ["Under ₹25k", 0],
    ["₹25k–50k", 25000],
    ["₹50k–1L", 50000],
    ["₹1L–2L", 100000],
    ["₹2L+", 200000],
    ["under_25k", 0],
    ["50k_1l", 50000],
    ["2l_plus", 200000],
  ])("%s → %d", (choice, expected) => {
    expect(parseBudgetMin(choice)).toBe(expected);
  });

  it("unknown → null", () => {
    expect(parseBudgetMin("not sure")).toBeNull();
    expect(parseBudgetMin(null)).toBeNull();
  });
});

describe("ruleScore", () => {
  const base = {
    brand_name: "Kesar",
    brand_link: "https://instagram.com/kesar",
    budget_min_inr: 50000,
    start_timeline: "This month",
    phone_valid: true,
    email: "a@b.co",
  };

  it("TC-U-14: link + ₹50k + this month → hot", () => {
    expect(ruleScore(base)).toBe("hot");
  });

  it("TC-U-15: link + ₹1L + just exploring → warm", () => {
    expect(ruleScore({ ...base, budget_min_inr: 100000, start_timeline: "Just exploring" })).toBe("warm");
  });

  it("TC-U-16: brand + ₹25k + in 1–3 months → warm (also Meta key form)", () => {
    const lead = { ...base, brand_link: null, budget_min_inr: 25000, start_timeline: "In 1–3 months" };
    expect(ruleScore(lead)).toBe("warm");
    expect(ruleScore({ ...lead, start_timeline: "in_1_3_months" })).toBe("warm");
  });

  it("TC-U-17: no brand, under ₹25k, exploring → cold", () => {
    expect(
      ruleScore({
        ...base,
        brand_name: null,
        brand_link: null,
        budget_min_inr: 0,
        start_timeline: "Just exploring",
      }),
    ).toBe("cold");
  });

  it("TC-U-18: invalid phone + no email → cold", () => {
    expect(ruleScore({ ...base, phone_valid: false, email: null })).toBe("cold");
  });
});

describe("nextRetry (TC-U-19)", () => {
  const now = new Date("2026-10-12T10:00:00Z");
  it("attempt 1 → +1 min, attempt 2 → +5 min, attempt 3 → dead", () => {
    expect(nextRetry(1, 3, now)).toEqual({ status: "pending", run_at: "2026-10-12T10:01:00.000Z" });
    expect(nextRetry(2, 3, now)).toEqual({ status: "pending", run_at: "2026-10-12T10:05:00.000Z" });
    expect(nextRetry(3, 3, now)).toEqual({ status: "dead" });
  });
});

describe("duplicate window (TC-U-20)", () => {
  const now = new Date("2026-10-12T10:00:00Z");
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400_000);
  it("10 days ago is a duplicate, 40 days ago is not", () => {
    expect(daysAgo(10) >= duplicateWindowStart(now)).toBe(true);
    expect(daysAgo(40) >= duplicateWindowStart(now)).toBe(false);
  });
});
