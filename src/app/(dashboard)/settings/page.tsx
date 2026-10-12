import { BUDGETS, TIMELINES } from "@/lib/labels";
import { getEnv } from "@/server/env";
import { getSetting } from "@/server/settings";
import { saveQuietHours, saveScoring } from "./actions";

const input = "h-9 rounded-md border bg-surface-2 px-3 text-[13px]";
const button = "h-9 rounded-md border bg-surface-2 px-3 text-[13px] font-medium hover:border-text-muted";

export default async function SettingsPage() {
  const [rules, quiet] = await Promise.all([
    getSetting("scoring_rules"),
    getSetting("quiet_hours"),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="scoring" className="rounded-xl border bg-surface p-5 lg:row-span-2">
        <h2 id="scoring" className="font-serif text-2xl">
          Scoring rules
        </h2>
        <p className="mt-1 text-text-muted">Applies to new leads. AI may move a score by one level.</p>
        <form action={saveScoring} className="mt-4 space-y-6">
          {(["hot", "warm"] as const).map((level) => (
            <fieldset key={level} className="space-y-3">
              <legend className="font-medium capitalize">{level}</legend>
              <label className="flex items-center justify-between gap-4">
                <span className="text-text-muted">Minimum monthly budget</span>
                <select name={`${level}_min`} defaultValue={rules[level].min_budget_inr} className={input}>
                  {BUDGETS.map((b) => (
                    <option key={b.min} value={b.min}>
                      {b.label === "Under ₹25k" ? "Any" : `${b.label} or more`}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <p className="text-text-muted">
                  {level === "hot" ? "Timeline must be one of" : "…or timeline is one of"}
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {TIMELINES.map((t) => (
                    <label key={t} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name={`${level}_timelines`}
                        value={t}
                        defaultChecked={rules[level].timelines.includes(t)}
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              {level === "hot" && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="hot_requires_link"
                    defaultChecked={rules.hot.requires_brand_link}
                  />
                  Requires Instagram / website link
                </label>
              )}
            </fieldset>
          ))}
          <button type="submit" className={button}>
            Save scoring rules
          </button>
        </form>
      </section>

      <section aria-labelledby="alerts" className="rounded-xl border bg-surface p-5">
        <h2 id="alerts" className="font-serif text-2xl">
          Alerts and quiet hours
        </h2>
        <dl className="mt-4">
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Owner alert number</dt>
            <dd>{getEnv().OWNER_ALERT_PHONE}</dd>
          </div>
        </dl>
        <p className="mt-1 text-xs text-text-muted">Set OWNER_ALERT_PHONE in Vercel to change it.</p>
        <form action={saveQuietHours} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">No follow-ups from (IST)</span>
            <input name="start" type="time" defaultValue={quiet.start} required className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Until (IST)</span>
            <input name="end" type="time" defaultValue={quiet.end} required className={input} />
          </label>
          <button type="submit" className={button}>
            Save quiet hours
          </button>
        </form>
      </section>

    </div>
  );
}
