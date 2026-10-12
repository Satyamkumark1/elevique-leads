// Real Groq call (not in CI): `pnpm test:ai-eval` with GROQ_API_KEY and GROQ_MODEL set.
import { expect, it } from "vitest";
import { aiScore, capOneLevel } from "@/server/ai/aiScore";
import { ruleScore, type Score } from "@/server/ai/ruleScore";
import { parseBudgetMin } from "@/server/lib/budget";
import cases from "../fixtures/ai-eval.json";

const LEVEL = { cold: 0, warm: 1, hot: 2 } as const;
const hasKey = !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "gsk_local";

it.skipIf(!hasKey)(
  "AI scoring agreement ≥ 90%, 100% valid JSON, never > 1 level from rules",
  async () => {
    let agree = 0;
    let invalid = 0;
    const mismatches: string[] = [];
    for (const c of cases) {
      const rule = ruleScore({
        ...c.lead,
        budget_min_inr: parseBudgetMin(c.lead.budget_range),
        phone_valid: true,
        email: "x@y.z",
      });
      const result = await aiScore(c.lead, rule, { timeoutMs: 20_000 });
      if (result.status === "failed") {
        invalid++;
        mismatches.push(`${c.note}: FAILED (${result.error})`);
        continue;
      }
      expect(Math.abs(LEVEL[result.score] - LEVEL[rule])).toBeLessThanOrEqual(1);
      expect(capOneLevel(rule, result.score as Score)).toBe(result.score);
      if (result.score === c.expected) agree++;
      else
        mismatches.push(
          `${c.note}: expected ${c.expected}, got ${result.score} (rule ${rule}) — ${result.reason}`,
        );
    }
    const pct = (agree / cases.length) * 100;
    console.log(`AI eval: ${agree}/${cases.length} agree (${pct.toFixed(1)}%), invalid ${invalid}`);
    if (mismatches.length) console.log(mismatches.join("\n"));
    expect(invalid).toBe(0);
    expect(pct).toBeGreaterThanOrEqual(90);
  },
  300_000,
);
