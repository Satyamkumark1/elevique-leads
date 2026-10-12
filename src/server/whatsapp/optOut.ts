// TECH_SPEC §7.4. "no" only counts as the whole message; the others count anywhere as whole words.
const PHRASES = ["stop", "unsubscribe", "band karo", "not interested"];

export function isOptOut(text: string | null | undefined): boolean {
  const t = (text ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t === "no") return true;
  return PHRASES.some((p) => new RegExp(`(^| )${p}( |$)`).test(t));
}
