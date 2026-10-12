import { Check, CheckCheck, Clock, Flame, Snowflake, Sun, X, type LucideIcon } from "lucide-react";
import { SCORE_LABEL, STATUS_LABEL, type Score, type Status } from "@/lib/labels";

// Token at ~15% opacity behind token-coloured text (UI_SPEC §1). Always icon or text too, never colour alone.
const SCORE_STYLE: Record<Score, { cls: string; icon: LucideIcon }> = {
  hot: { cls: "bg-hot/15 text-hot", icon: Flame },
  warm: { cls: "bg-warm/15 text-warm", icon: Sun },
  cold: { cls: "bg-cold/15 text-cold-fg", icon: Snowflake },
};

export function ScoreBadge({ score }: { score: Score | null }) {
  if (!score) return <span className="text-text-muted">—</span>;
  const { cls, icon: Icon } = SCORE_STYLE[score];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}>
      <Icon size={12} aria-hidden />
      {SCORE_LABEL[score]}
    </span>
  );
}

const STATUS_CLS: Record<Status, string> = {
  new: "bg-surface-2 text-text",
  contacted: "bg-cold/15 text-cold-fg",
  replied: "bg-accent/15 text-accent",
  meeting_booked: "bg-success/15 text-success",
  won: "bg-success/15 text-success",
  lost: "bg-surface-2 text-text-muted",
  opted_out: "bg-error/15 text-error-fg",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_CLS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const MSG_STATE: Record<string, { cls: string; icon: LucideIcon; label: string }> = {
  queued: { cls: "text-text-muted", icon: Clock, label: "Queued" },
  sent: { cls: "text-text-muted", icon: Check, label: "Sent" },
  delivered: { cls: "text-success", icon: CheckCheck, label: "Delivered" },
  read: { cls: "text-accent", icon: CheckCheck, label: "Read" },
  received: { cls: "text-accent", icon: CheckCheck, label: "Received" },
  failed: { cls: "text-error-fg", icon: X, label: "Failed" },
  bounced: { cls: "text-error-fg", icon: X, label: "Bounced" },
};

/** WhatsApp / Email column cell: icon + accessible label + tooltip. */
export function MessageState({ status, channel }: { status: string | null; channel: string }) {
  if (!status)
    return (
      <span role="img" className="text-text-muted" aria-label={`${channel}: not sent`} title="Not sent">
        —
      </span>
    );
  const s = MSG_STATE[status] ?? MSG_STATE.sent;
  return (
    <span
      role="img"
      className={`inline-flex ${s.cls}`}
      title={`${channel}: ${s.label}`}
      aria-label={`${channel}: ${s.label}`}
    >
      <s.icon size={16} aria-hidden />
    </span>
  );
}
