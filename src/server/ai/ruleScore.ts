import { z } from "zod";

export const scoringRulesSchema = z.object({
  hot: z.object({
    min_budget_inr: z.number(),
    timelines: z.array(z.string()),
    requires_brand_link: z.boolean().default(true),
  }),
  warm: z.object({ min_budget_inr: z.number(), timelines: z.array(z.string()) }),
});
export type ScoringRules = z.infer<typeof scoringRulesSchema>;

/** PRD §9 defaults; the live values come from settings.scoring_rules. */
export const DEFAULT_RULES: ScoringRules = {
  hot: { min_budget_inr: 50_000, timelines: ["This week", "This month"], requires_brand_link: true },
  warm: { min_budget_inr: 25_000, timelines: ["This week", "This month", "In 1–3 months"] },
};

export type Score = "hot" | "warm" | "cold";

type ScoreInput = {
  brand_name: string | null;
  brand_link: string | null;
  budget_min_inr: number | null;
  start_timeline: string | null;
  phone_valid: boolean;
  email: string | null;
};

// "In 1–3 months" and Meta's "in_1_3_months" compare equal.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Rule-based score (FR-18, PRD §9). */
export function ruleScore(lead: ScoreInput, rules: ScoringRules = DEFAULT_RULES): Score {
  if (!lead.phone_valid && !lead.email) return "cold"; // unreachable lead
  const budget = lead.budget_min_inr ?? 0;
  const timeline = lead.start_timeline ? norm(lead.start_timeline) : "";
  const inTimelines = (list: string[]) => timeline !== "" && list.some((t) => norm(t) === timeline);

  if (
    (!rules.hot.requires_brand_link || lead.brand_link) &&
    budget >= rules.hot.min_budget_inr &&
    inTimelines(rules.hot.timelines)
  ) {
    return "hot";
  }
  if (lead.brand_name && (budget >= rules.warm.min_budget_inr || inTimelines(rules.warm.timelines))) {
    return "warm";
  }
  return "cold";
}
