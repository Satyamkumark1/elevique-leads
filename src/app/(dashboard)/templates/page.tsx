import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { CATEGORIES } from "@/lib/labels";
import { db } from "@/server/db";
import { welcomeEmail } from "@/server/email/welcome";
import { getEnv } from "@/server/env";
import { getSetting } from "@/server/settings";
import { TEMPLATES } from "@/server/whatsapp/templates";
import { addReel, deleteReel, moveReel, saveEmailContent } from "./actions";

const input = "h-9 w-full rounded-md border bg-surface-2 px-3 text-[13px]";
const button = "h-9 rounded-md border bg-surface-2 px-3 text-[13px] font-medium hover:border-text-muted";

export default async function TemplatesPage() {
  const supabase = db();
  const [content, { data: reels }] = await Promise.all([
    getSetting("email_content"),
    supabase.from("sample_reels").select("*").order("category").order("sort"),
  ]);
  const preview = welcomeEmail(
    { full_name: "Asha Verma", brand_name: "Kesar Threads" },
    content,
    getEnv().BOOKING_URL,
  );
  const incomplete =
    !content.showreel_url || !content.starting_price_line || content.case_studies.length === 0;

  return (
    <div className="space-y-8">
      <section aria-labelledby="wa">
        <h2 id="wa" className="font-serif text-2xl">
          WhatsApp templates
        </h2>
        <p className="mt-1 text-text-muted">
          Text must match what Meta approved. Check approval status in WhatsApp Manager; a rejected template
          makes its jobs fail and show in Integrations.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {Object.entries(TEMPLATES).map(([name, t]) => (
            <article key={name} className="rounded-xl border bg-surface p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">{name}</h3>
                <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-text-muted">
                  {t.category}
                </span>
              </div>
              <p className="mt-3 leading-relaxed">
                {t.text.split(/(\{\{\d+\}\})/).map((part, i) =>
                  /^\{\{\d+\}\}$/.test(part) ? (
                    <mark key={i} className="rounded bg-accent/15 px-1 text-accent">
                      {part}
                    </mark>
                  ) : (
                    part
                  ),
                )}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="email" className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 id="email" className="font-serif text-2xl">
            Welcome email
          </h2>
          {incomplete && (
            <p role="alert" className="mt-2 text-error-fg">
              Fill in all fields below. Until then welcome emails are not sent (jobs show as failed).
            </p>
          )}
          <form action={saveEmailContent} className="mt-4 space-y-4 rounded-xl border bg-surface p-5">
            <label className="block">
              <span className="text-xs text-text-muted">Showreel URL</span>
              <input name="showreel_url" type="url" defaultValue={content.showreel_url} className={input} />
            </label>
            <label className="block">
              <span className="text-xs text-text-muted">Starting price line</span>
              <input
                name="starting_price_line"
                defaultValue={content.starting_price_line}
                className={input}
              />
            </label>
            <label className="block">
              <span className="text-xs text-text-muted">Case studies (one per line: Title | URL)</span>
              <textarea
                name="case_studies"
                rows={4}
                defaultValue={content.case_studies.map((c) => `${c.title} | ${c.url}`).join("\n")}
                className="w-full rounded-md border bg-surface-2 p-3 text-[13px]"
              />
            </label>
            <button type="submit" className={button}>
              Save email content
            </button>
          </form>
        </div>
        <div>
          <p className="text-xs text-text-muted">Preview · Subject: {preview.subject}</p>
          <iframe
            title="Welcome email preview"
            srcDoc={preview.html}
            sandbox=""
            className="mt-2 h-[560px] w-full rounded-xl border bg-white"
          />
        </div>
      </section>

      <section aria-labelledby="reels">
        <h2 id="reels" className="font-serif text-2xl">
          Sample reels
        </h2>
        <p className="mt-1 text-text-muted">
          The first reel in a lead&apos;s category goes in the welcome WhatsApp; &quot;Other&quot; is the
          fallback.
        </p>
        <form
          action={addReel}
          className="mt-4 grid gap-3 rounded-xl border bg-surface p-5 sm:grid-cols-[1fr_1fr_2fr_auto]"
        >
          <label>
            <span className="text-xs text-text-muted">Category</span>
            <select name="category" className={input}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs text-text-muted">Title</span>
            <input name="title" className={input} />
          </label>
          <label>
            <span className="text-xs text-text-muted">URL</span>
            <input name="url" type="url" required className={input} />
          </label>
          <button type="submit" className={`${button} self-end`}>
            Add reel
          </button>
        </form>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((cat) => {
            const list = (reels ?? []).filter((r) => r.category === cat);
            return (
              <div key={cat} className="rounded-xl border bg-surface p-5">
                <h3 className="font-medium">{cat}</h3>
                {list.length === 0 ? (
                  <p className="mt-2 text-text-muted">No reels. Falls back to Other.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {list.map((r, i) => (
                      <li key={r.id} className="flex items-center gap-2">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 flex-1 truncate hover:underline"
                        >
                          {r.title || r.url}
                        </a>
                        <ReelButton action={moveReel} id={r.id} dir="up" disabled={i === 0} label="Move up">
                          <ArrowUp size={14} aria-hidden />
                        </ReelButton>
                        <ReelButton
                          action={moveReel}
                          id={r.id}
                          dir="down"
                          disabled={i === list.length - 1}
                          label="Move down"
                        >
                          <ArrowDown size={14} aria-hidden />
                        </ReelButton>
                        <ReelButton action={deleteReel} id={r.id} label="Delete reel">
                          <Trash2 size={14} aria-hidden />
                        </ReelButton>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ReelButton({
  action,
  id,
  dir,
  disabled,
  label,
  children,
}: {
  action: (f: FormData) => Promise<void>;
  id: string;
  dir?: string;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {dir && <input type="hidden" name="dir" value={dir} />}
      <button
        type="submit"
        disabled={disabled}
        aria-label={label}
        className="rounded-md p-1.5 text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30"
      >
        {children}
      </button>
    </form>
  );
}
