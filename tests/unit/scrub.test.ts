import { describe, expect, it } from "vitest";
import { scrubEvent, scrubFields, scrubText } from "@/server/lib/scrub";

describe("PII scrubbing (SECURITY.md: no PII in logs or Sentry)", () => {
  it("redacts emails and phone numbers in text", () => {
    expect(scrubText("send to asha@example.com at +91 98765-43210 failed")).toBe(
      "send to [email] at [phone] failed",
    );
    expect(scrubText("job 7f3c failed: HTTP 500")).toBe("job 7f3c failed: HTTP 500");
    expect(scrubText("9876543210")).toBe("[phone]");
  });

  it("never mangles UUIDs or numeric IDs", () => {
    const ids = "lead d4957b12-3456-4a4d-b850-72edf6bb1234 job 12345678-1234-4123-8123-123456789012";
    expect(scrubText(ids)).toBe(ids);
    expect(scrubFields({ lead_id: "12345678-1234-4123-8123-123456789012" })).toEqual({
      lead_id: "12345678-1234-4123-8123-123456789012",
    });
  });

  it("drops PII-named log fields and keeps IDs", () => {
    expect(
      scrubFields({
        lead_id: "L1",
        job_id: "J1",
        phone: "+919876543210",
        email: "a@b.co",
        full_name: "Asha",
        code: 400,
      }),
    ).toEqual({ lead_id: "L1", job_id: "J1", code: 400 });
  });

  it("strips request bodies, headers, cookies and user from Sentry events", () => {
    const event = scrubEvent({
      message: "failed for asha@example.com",
      user: { email: "asha@example.com" },
      request: {
        url: "/api/webhooks/meta",
        data: '{"phone":"9876543210"}',
        headers: { cookie: "x" },
        cookies: {},
      },
      exception: { values: [{ value: "invalid number 9876543210" }] },
      breadcrumbs: [{ message: "POST asha@example.com", data: { body: "x" } }],
    });
    expect(event).toEqual({
      message: "failed for [email]",
      request: { url: "/api/webhooks/meta" },
      exception: { values: [{ value: "invalid number [phone]" }] },
      breadcrumbs: [{ message: "POST [email]" }],
    });
  });
});
