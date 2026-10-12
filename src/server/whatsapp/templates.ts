/**
 * WhatsApp templates (PRD §10). Text must match what Meta approved; `params` order is {{1}}, {{2}}, …
 * Edit here when a template's wording or variables change.
 */
export const TEMPLATES = {
  welcome_samples: {
    category: "MARKETING",
    text: "Hi {{1}}, thanks for your interest in AI video ads for {{2}}! Here are a few samples we made for {{3}} brands: {{4}}. Want a quick call to plan yours?",
  },
  followup_case_study: {
    category: "MARKETING",
    text: "Hi {{1}}, here is how we helped a D2C brand like {{2}} with AI video ads: {{3}}",
  },
  followup_free_sample: {
    category: "MARKETING",
    text: "Hi {{1}}, want a free 15-second AI sample video for {{2}}? Reply YES and we'll make one for your product.",
  },
  internal_hot_lead: {
    category: "UTILITY",
    text: "Hot lead: {{1}} from {{2}}. Budget {{3}}, start {{4}}. Open: {{5}}",
  },
  internal_lead_replied: {
    category: "UTILITY",
    text: "{{1}} from {{2}} replied on WhatsApp. Take over: {{3}}",
  },
} as const;

export type TemplateName = keyof typeof TEMPLATES;

export function renderTemplate(name: TemplateName, params: string[]): string {
  return TEMPLATES[name].text.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] ?? "");
}

type LeadLike = {
  id: string;
  full_name: string | null;
  brand_name: string | null;
  category: string | null;
  budget_range: string | null;
  start_timeline: string | null;
};
type Reel = { category: string; url: string; sort: number };

const firstName = (lead: LeadLike) => lead.full_name?.trim().split(/\s+/)[0] || "there";
const brand = (lead: LeadLike) => lead.brand_name?.trim() || "your brand";

/** Reel for the lead's category, else the "Other" reel, else the showreel. */
export function pickReel(category: string | null, reels: Reel[], fallbackUrl: string): string {
  const sorted = [...reels].sort((a, b) => a.sort - b.sort);
  return (
    sorted.find((r) => r.category === category)?.url ??
    sorted.find((r) => r.category === "Other")?.url ??
    fallbackUrl
  );
}

export function welcomeParams(lead: LeadLike, reels: Reel[], fallbackUrl: string): string[] {
  return [
    firstName(lead),
    brand(lead),
    lead.category?.toLowerCase() ?? "D2C",
    pickReel(lead.category, reels, fallbackUrl),
  ];
}

export function caseStudyParams(lead: LeadLike, caseStudyUrl: string): string[] {
  return [firstName(lead), brand(lead), caseStudyUrl];
}

export function freeSampleParams(lead: LeadLike): string[] {
  return [firstName(lead), brand(lead)];
}

export function hotLeadParams(lead: LeadLike, appUrl: string): string[] {
  return [
    lead.full_name ?? "Unknown",
    brand(lead),
    lead.budget_range ?? "n/a",
    lead.start_timeline ?? "n/a",
    `${appUrl}/leads/${lead.id}`,
  ];
}

export function replyAlertParams(lead: LeadLike, appUrl: string): string[] {
  return [lead.full_name ?? "A lead", brand(lead), `${appUrl}/leads/${lead.id}`];
}
