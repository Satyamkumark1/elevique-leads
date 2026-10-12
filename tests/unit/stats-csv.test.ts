import { describe, expect, it } from "vitest";
import { csvCell } from "@/lib/csv";
import { formatDuration, median, overviewStats } from "@/lib/stats";

describe("csvCell", () => {
  it.each([
    ["=1+1", `"'=1+1"`],
    ["+91 98765", `"'+91 98765"`],
    ["-5", `"'-5"`],
    ["@SUM(A1)", `"'@SUM(A1)"`],
    ['say "hi"', `"say ""hi"""`],
    [null, `""`],
  ])("%j → %s", (v, out) => expect(csvCell(v)).toBe(out));
});

describe("overview stats", () => {
  const now = new Date("2026-10-12T12:00:00+05:30");
  const lead = (createdIST: string, extra: object = {}) => ({
    created_at: new Date(`${createdIST}+05:30`).toISOString(),
    score: "warm",
    campaign_name: "A",
    first_response_at: null,
    last_reply_at: null,
    status: "new",
    ...extra,
  });

  it("counts today (IST), hot this week, reply rate and median response", () => {
    const s = overviewStats(
      [
        lead("2026-10-12T00:30:00", {
          score: "hot",
          first_response_at: new Date("2026-10-11T19:00:08Z").toISOString(),
          last_reply_at: "x",
        }),
        lead("2026-10-11T23:59:00", { first_response_at: new Date("2026-10-11T18:29:20Z").toISOString() }),
        lead("2026-10-01T10:00:00", { score: "hot", campaign_name: "B" }),
      ],
      now,
    );
    expect(s.leadsToday).toBe(1);
    expect(s.hotThisWeek).toBe(1);
    expect(s.replyRate).toBe(0.5);
    expect(s.medianFirstResponseMs).toBe(14_000);
    expect(s.perDay).toHaveLength(30);
    expect(s.perDay.at(-1)).toEqual({ day: "2026-10-12", leads: 1 });
    expect(s.byCampaign[0]).toEqual({ campaign: "A", count: 2 });
    expect(s.scoreSplit).toEqual({ hot: 2, warm: 1, cold: 0 });
  });

  it("median and duration formatting", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(formatDuration(8_000)).toBe("8s");
    expect(formatDuration(240_000)).toBe("4m");
    expect(formatDuration(null)).toBe("—");
  });
});
