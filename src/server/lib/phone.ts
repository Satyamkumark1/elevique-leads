/** Normalises an Indian mobile number to E.164 (FR-08). Invalid → `{ e164: null, valid: false }`. */
export function normalizeIndianPhone(input: string | null | undefined): {
  e164: string | null;
  valid: boolean;
} {
  let digits = (input ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? { e164: `+91${digits}`, valid: true } : { e164: null, valid: false };
}
