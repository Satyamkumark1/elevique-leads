export const SCORES = ["hot", "warm", "cold"] as const;
export const STATUSES = [
  "new",
  "contacted",
  "replied",
  "meeting_booked",
  "won",
  "lost",
  "opted_out",
] as const;
export const CATEGORIES = [
  "Fashion",
  "Beauty & personal care",
  "Food & beverage",
  "Electronics",
  "Home & living",
  "Other",
] as const;
export const TIMELINES = ["This week", "This month", "In 1–3 months", "Just exploring"] as const;
export const BUDGETS = [
  { label: "Under ₹25k", min: 0 },
  { label: "₹25k–50k", min: 25000 },
  { label: "₹50k–1L", min: 50000 },
  { label: "₹1L–2L", min: 100000 },
  { label: "₹2L+", min: 200000 },
] as const;

export type Score = (typeof SCORES)[number];
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  new: "New",
  contacted: "Contacted",
  replied: "Replied",
  meeting_booked: "Meeting booked",
  won: "Won",
  lost: "Lost",
  opted_out: "Opted out",
};

export const SCORE_LABEL: Record<Score, string> = { hot: "Hot", warm: "Warm", cold: "Cold" };
