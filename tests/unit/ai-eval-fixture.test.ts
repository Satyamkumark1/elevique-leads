import { describe, expect, it } from "vitest";
import { capOneLevel } from "@/server/ai/aiScore";
import { ruleScore } from "@/server/ai/ruleScore";
import { parseBudgetMin } from "@/server/lib/budget";
import cases from "../fixtures/ai-eval.json";

describe("AI eval fixture (TEST_PLAN §6)", () => {
  it("has ≥ 30 cases with ≥ 10 per score", () => {
    expect(cases.length).toBeGreaterThanOrEqual(30);
    for (const s of ["hot", "warm", "cold"]) {
      expect(cases.filter((c) => c.expected === s).length).toBeGreaterThanOrEqual(10);
    }
  });

  it.each(cases.map((c) => [c.note, c] as const))("label reachable within one level: %s", (_note, c) => {
    const rule = ruleScore({
      ...c.lead,
      budget_min_inr: parseBudgetMin(c.lead.budget_range),
      phone_valid: true,
      email: "x@y.z",
    });
    expect(capOneLevel(rule, c.expected as "hot" | "warm" | "cold")).toBe(c.expected);
  });
});
