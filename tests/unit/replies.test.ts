import { describe, expect, it } from "vitest";
import { nextAllowedTime } from "@/server/lib/quietHours";
import { isOptOut } from "@/server/whatsapp/optOut";

const QUIET = { start: "21:00", end: "09:00" };
const ist = (iso: string) => new Date(`${iso}+05:30`);

describe("quiet hours", () => {
  it("TC-U-29: due 22:30 IST → next 09:00 IST", () => {
    expect(nextAllowedTime(ist("2026-10-12T22:30:00"), QUIET)).toEqual(ist("2026-10-13T09:00:00"));
  });

  it("after midnight (02:00 IST) → 09:00 the same day", () => {
    expect(nextAllowedTime(ist("2026-10-13T02:00:00"), QUIET)).toEqual(ist("2026-10-13T09:00:00"));
  });

  it("TC-U-30: due 10:00 IST → unchanged", () => {
    const t = ist("2026-10-12T10:00:00");
    expect(nextAllowedTime(t, QUIET)).toBe(t);
  });

  it("boundaries: 09:00 allowed, 21:00 quiet", () => {
    const nine = ist("2026-10-12T09:00:00");
    expect(nextAllowedTime(nine, QUIET)).toBe(nine);
    expect(nextAllowedTime(ist("2026-10-12T21:00:00"), QUIET)).toEqual(ist("2026-10-13T09:00:00"));
  });
});

describe("opt-out", () => {
  it.each(["STOP", " stop ", "Band karo", "No", "no.", "Unsubscribe me", "I'm not interested", "STOP!!"])(
    "TC-U-31: %j opts out",
    (text) => expect(isOptOut(text)).toBe(true),
  );

  it.each(["No problem, call me", "Hi", "nope I mean yes", "Stopwatch brand", "", null])(
    "TC-U-32: %j does not opt out",
    (text) => expect(isOptOut(text)).toBe(false),
  );
});
