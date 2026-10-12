import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Verifies Meta's `X-Hub-Signature-256: sha256=<hex>` over the raw request body (FR-02). */
export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  const given = Buffer.from(header.slice("sha256=".length), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Constant-time string compare for verify tokens and bearer secrets. */
export function safeEqual(a: string | null, b: string): boolean {
  if (a === null) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
