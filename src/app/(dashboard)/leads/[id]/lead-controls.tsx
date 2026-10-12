"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Copy, Mail, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "@/components/toaster";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/labels";
import { formatIST } from "@/lib/time";

async function patch(id: string, body: object) {
  const res = await fetch(`/api/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export function LeadControls({ id, status, paused }: { id: string; status: Status; paused: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function update(body: object, message: string) {
    setBusy(true);
    const ok = await patch(id, body);
    setBusy(false);
    toast(ok ? message : "Could not save. Try again.", { error: !ok });
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2">
        <span className="text-xs text-text-muted">Status</span>
        <select
          value={status}
          disabled={busy}
          onChange={(e) =>
            update({ status: e.target.value }, `Status changed to ${STATUS_LABEL[e.target.value as Status]}`)
          }
          className="h-9 rounded-md border bg-surface-2 px-2"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        role="switch"
        aria-checked={!paused}
        disabled={busy}
        onClick={() =>
          update({ automation_paused: !paused }, paused ? "Automation resumed" : "Automation paused")
        }
        className="flex h-9 items-center gap-2 rounded-md border bg-surface-2 px-3"
      >
        <span aria-hidden className={`size-2 rounded-full ${paused ? "bg-warm" : "bg-success"}`} />
        Automation: {paused ? "Paused" : "On"}
      </button>
    </div>
  );
}

export function LeadNotes({
  id,
  notes,
  lastEditedAt,
}: {
  id: string;
  notes: string;
  lastEditedAt: string | null;
}) {
  const router = useRouter();
  const saved = useRef(notes);
  const [editedAt, setEditedAt] = useState(lastEditedAt);

  async function save(value: string) {
    if (value === saved.current) return;
    const ok = await patch(id, { notes: value });
    if (ok) {
      saved.current = value;
      setEditedAt(new Date().toISOString());
      toast("Notes saved");
      router.refresh();
    } else toast("Could not save notes", { error: true });
  }

  return (
    <div className="mt-3">
      <label htmlFor="lead-notes" className="sr-only">
        Notes
      </label>
      <textarea
        id="lead-notes"
        defaultValue={notes}
        onBlur={(e) => save(e.target.value)}
        rows={8}
        placeholder="Call notes, next steps…"
        className="w-full rounded-md border bg-surface-2 p-3"
      />
      <p className="mt-1 text-xs text-text-muted">
        {editedAt ? `Last edited ${formatIST(editedAt)}` : "Saves when you click away."}
      </p>
    </div>
  );
}

type ActionsProps = {
  id: string;
  phone: string | null;
  email: string | null;
  bookingUrl: string;
  name: string | null;
};

export function LeadActions({ id, phone, email, bookingUrl, name }: ActionsProps) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const action =
    "flex h-9 items-center gap-2 rounded-md border bg-surface-2 px-3 text-[13px] hover:border-text-muted";

  async function remove() {
    const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    dialog.current?.close();
    if (res.ok) {
      toast("Lead deleted");
      router.push("/leads");
      router.refresh();
    } else toast("Could not delete lead", { error: true });
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {phone && (
        <a
          href={`https://wa.me/${phone.slice(1)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={action}
        >
          <MessageCircle size={14} aria-hidden /> Open in WhatsApp
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className={action}>
          <Mail size={14} aria-hidden /> Send email
        </a>
      )}
      <button
        type="button"
        className={action}
        onClick={() => navigator.clipboard.writeText(bookingUrl).then(() => toast("Booking link copied"))}
      >
        <Copy size={14} aria-hidden /> Copy booking link
      </button>
      <button type="button" className={`${action} text-error`} onClick={() => dialog.current?.showModal()}>
        <Trash2 size={14} aria-hidden /> Delete lead
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="delete-title"
        className="m-auto max-w-sm rounded-xl border bg-surface p-6 text-text backdrop:bg-black/60"
      >
        <h2 id="delete-title" className="font-serif text-2xl">
          Delete this lead?
        </h2>
        <p className="mt-2 text-text-muted">
          {name ?? "This lead"}, their messages and scheduled jobs will be permanently removed. Use this for
          data deletion requests.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className={action} onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button type="button" className={`${action} border-error text-error`} onClick={remove}>
            Delete permanently
          </button>
        </div>
      </dialog>
    </div>
  );
}
