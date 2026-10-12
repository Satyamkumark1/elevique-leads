import { z } from "zod";

export const emailContentSchema = z.object({
  showreel_url: z.string(),
  starting_price_line: z.string(),
  case_studies: z.array(z.object({ title: z.string(), url: z.string() })),
});
export type EmailContent = z.infer<typeof emailContentSchema>;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Lead = { full_name: string | null; brand_name: string | null };

/** Welcome email (FR-11). Plain table HTML with inline styles: what email clients render reliably. */
export function welcomeEmail(lead: Lead, content: EmailContent, bookingUrl: string) {
  const name = lead.full_name?.trim().split(/\s+/)[0] || "there";
  const brand = lead.brand_name?.trim() || "your brand";
  const subject = `AI video ads for ${brand}`.replace(/[\r\n]+/g, " ");

  const cases = content.case_studies
    .map(
      (c) =>
        `<li style="margin:0 0 8px"><a href="${esc(c.url)}" style="color:#8a6a2f">${esc(c.title)}</a></li>`,
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#1c1c1f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e0d6;border-radius:12px">
<tr><td style="padding:32px">
<p style="font-family:Georgia,serif;font-size:24px;margin:0 0 24px">Elevique</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 16px">Hi ${esc(name)},</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 16px">Thanks for your interest in AI video ads for ${esc(brand)}. Here is a quick look at what we make.</p>
<p style="margin:0 0 24px"><a href="${esc(content.showreel_url)}" style="color:#8a6a2f;font-weight:bold">Watch our showreel</a></p>
<p style="font-size:15px;font-weight:bold;margin:0 0 8px">Recent work</p>
<ul style="font-size:15px;line-height:1.6;margin:0 0 24px;padding-left:20px">${cases}</ul>
<p style="font-size:15px;line-height:1.6;margin:0 0 24px">${esc(content.starting_price_line)}</p>
<p style="margin:0 0 24px"><a href="${esc(bookingUrl)}" style="display:inline-block;background:#1c1c1f;color:#f4f1ea;text-decoration:none;padding:12px 20px;border-radius:8px">Book a 15-minute call</a></p>
<p style="font-size:13px;line-height:1.6;color:#6b6862;margin:0">You are receiving this because you asked about Elevique on Instagram or Facebook. Reply STOP and we will not contact you again.</p>
</td></tr></table></td></tr></table></body></html>`;

  const text = [
    `Hi ${name},`,
    "",
    `Thanks for your interest in AI video ads for ${brand}.`,
    `Showreel: ${content.showreel_url}`,
    "",
    "Recent work:",
    ...content.case_studies.map((c) => `- ${c.title}: ${c.url}`),
    "",
    content.starting_price_line,
    `Book a 15-minute call: ${bookingUrl}`,
    "",
    "Reply STOP and we will not contact you again.",
  ].join("\n");

  return { subject, html, text };
}
