import "server-only";
import { z } from "zod";
import { scoringRulesSchema } from "./ai/ruleScore";
import { db } from "./db";
import { emailContentSchema } from "./email/welcome";

const schemas = {
  scoring_rules: scoringRulesSchema,
  followup_steps: z.array(z.object({ step: z.string(), template: z.string(), delay_hours: z.number() })),
  quiet_hours: z.object({ start: z.string(), end: z.string(), tz: z.string() }),
  allowed_emails: z.array(z.string()),
  email_content: emailContentSchema,
};
type Key = keyof typeof schemas;

export async function getSetting<K extends Key>(key: K): Promise<z.infer<(typeof schemas)[K]>> {
  const { data, error } = await db().from("settings").select("value").eq("key", key).single();
  if (error) throw new Error(`setting ${key} missing: ${error.code}`);
  return schemas[key].parse(data.value) as z.infer<(typeof schemas)[K]>;
}
