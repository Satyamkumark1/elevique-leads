// Times are stored UTC and shown in IST.
const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatIST(value: string | Date) {
  return `${IST.format(new Date(value))} IST`;
}
