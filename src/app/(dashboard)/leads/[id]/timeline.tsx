import { ArrowDownLeft, ArrowUpRight, CalendarClock, CircleDot, Mail, MessageCircle } from "lucide-react";
import { MessageState } from "@/components/badges";
import { Time } from "@/components/time";

export type TimelineItem =
  | { kind: "event"; at: string; id: string; type: string; description: string | null }
  | {
      kind: "message";
      at: string;
      id: string;
      channel: string;
      direction: string;
      template_name: string | null;
      body: string | null;
      status: string;
      error: string | null;
    }
  | { kind: "followup"; at: string; id: string; status: string; step: string; reason: string | null };

/** Events, messages and follow-ups, oldest first; inbound messages stand out (UI_SPEC 3.3). */
export function Timeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return <p className="mt-3 text-text-muted">Nothing yet.</p>;
  return (
    <ol className="mt-4 space-y-4">
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`} className="flex gap-3">
          {item.kind === "message" ? (
            <MessageItem m={item} />
          ) : item.kind === "followup" ? (
            <FollowupItem f={item} />
          ) : (
            <EventItem e={item} />
          )}
        </li>
      ))}
    </ol>
  );
}

function EventItem({ e }: { e: Extract<TimelineItem, { kind: "event" }> }) {
  return (
    <>
      <CircleDot size={16} className="mt-0.5 shrink-0 text-text-muted" aria-hidden />
      <div className="min-w-0">
        <p>{e.description ?? e.type}</p>
        <p className="text-xs text-text-muted">
          <Time value={e.at} />
        </p>
      </div>
    </>
  );
}

function MessageItem({ m }: { m: Extract<TimelineItem, { kind: "message" }> }) {
  const inbound = m.direction === "in";
  const Icon = m.channel === "email" ? Mail : MessageCircle;
  const Dir = inbound ? ArrowDownLeft : ArrowUpRight;
  return (
    <>
      <Icon
        size={16}
        className={`mt-0.5 shrink-0 ${inbound ? "text-accent" : "text-text-muted"}`}
        aria-hidden
      />
      <div
        className={`min-w-0 flex-1 rounded-lg border p-3 ${inbound ? "border-accent/40 bg-accent/5" : "bg-surface-2"}`}
      >
        <p className="flex items-center gap-2 text-xs text-text-muted">
          <Dir size={12} aria-hidden />
          {inbound ? "Lead replied" : `Sent ${m.channel === "email" ? "email" : "WhatsApp"}`}
          {m.template_name && <span>· {m.template_name}</span>}
          {!inbound && (
            <MessageState status={m.status} channel={m.channel === "email" ? "Email" : "WhatsApp"} />
          )}
          <span className="ml-auto">
            <Time value={m.at} />
          </span>
        </p>
        {m.body && <p className="mt-1 break-words whitespace-pre-wrap">{m.body}</p>}
        {m.error && <p className="mt-1 text-xs text-error-fg">{m.error}</p>}
      </div>
    </>
  );
}

function FollowupItem({ f }: { f: Extract<TimelineItem, { kind: "followup" }> }) {
  const cancelled = f.status === "cancelled";
  return (
    <>
      <CalendarClock size={16} className="mt-0.5 shrink-0 text-text-muted" aria-hidden />
      <div>
        <p className={cancelled ? "text-text-muted line-through" : ""}>
          Follow-up {f.step} {cancelled ? "cancelled" : "scheduled"}
        </p>
        <p className="text-xs text-text-muted">
          {cancelled ? (f.reason ?? "cancelled") : <Time value={f.at} />}
        </p>
      </div>
    </>
  );
}
