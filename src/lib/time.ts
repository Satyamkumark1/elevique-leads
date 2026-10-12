// Times are stored UTC and shown in IST.
const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatIST(value: string | Date) {
  return `${IST.format(new Date(value))} IST`;
}

/** "4 min ago" — pair with formatIST in a title for the absolute time (UI_SPEC §4). */
export function relativeTime(value: string | Date, now = new Date()) {
  const s = Math.round((now.getTime() - new Date(value).getTime()) / 1000);
  const future = s < 0;
  const a = Math.abs(s);
  const text =
    a < 60
      ? `${a}s`
      : a < 3600
        ? `${Math.round(a / 60)} min`
        : a < 86400
          ? `${Math.round(a / 3600)} h`
          : `${Math.round(a / 86400)} d`;
  return future ? `in ${text}` : `${text} ago`;
}
