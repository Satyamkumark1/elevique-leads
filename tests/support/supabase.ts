import { execSync } from "node:child_process";

/** Reads URLs and keys from the running local stack (`supabase start`). */
export function localSupabase() {
  const out = execSync("supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const v = Object.fromEntries([...out.matchAll(/^(\w+)="(.*)"$/gm)].map((m) => [m[1], m[2]]));
  return {
    url: v.API_URL,
    anonKey: v.ANON_KEY,
    serviceKey: v.SERVICE_ROLE_KEY,
    mailUrl: v.MAILPIT_URL ?? v.INBUCKET_URL,
  };
}
