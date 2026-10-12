// ponytail: fixed IST offset (no DST in India). Other time zones would need Intl-based offsets.
const IST_OFFSET_MIN = 330;
const DAY_MIN = 24 * 60;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * FR-27: if `now` is inside quiet hours (default 21:00–09:00 IST), return the next end-of-quiet time;
 * otherwise return `now` unchanged.
 */
export function nextAllowedTime(now: Date, quiet: { start: string; end: string }): Date {
  const start = toMin(quiet.start);
  const end = toMin(quiet.end);
  const localMs = now.getTime() + IST_OFFSET_MIN * 60_000;
  const minuteOfDay = Math.floor(localMs / 60_000) % DAY_MIN;

  const wraps = start > end;
  const inQuiet = wraps
    ? minuteOfDay >= start || minuteOfDay < end
    : minuteOfDay >= start && minuteOfDay < end;
  if (!inQuiet) return now;

  const localMidnight = localMs - (localMs % (DAY_MIN * 60_000));
  const dayOffset = wraps && minuteOfDay >= start ? DAY_MIN : 0;
  return new Date(localMidnight + (dayOffset + end) * 60_000 - IST_OFFSET_MIN * 60_000);
}
