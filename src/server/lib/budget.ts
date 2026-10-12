/**
 * Lower bound in INR of a budget choice. Handles form labels ("₹50k–1L", "Under ₹25k", "₹2L+")
 * and Meta's snake-case option keys ("50k_1l", "under_25k", "2l_plus"). Unknown → null.
 */
export function parseBudgetMin(choice: string | null | undefined): number | null {
  const s = (choice ?? "").toLowerCase().replace(/[₹,\s]/g, "");
  if (!s) return null;
  if (/^(under|below|lessthan)/.test(s)) return 0;
  const m = s.match(/(\d+(?:\.\d+)?)(k|l|lakh|lac)?/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2] ?? "";
  if (unit === "k") return n * 1_000;
  if (unit.startsWith("l")) return n * 100_000;
  return n;
}
