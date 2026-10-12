import { formatIST, relativeTime } from "@/lib/time";

/** Relative time with the absolute IST time on hover. Server-rendered. */
export function Time({ value }: { value: string }) {
  return (
    <time dateTime={value} title={formatIST(value)}>
      {relativeTime(value)}
    </time>
  );
}
