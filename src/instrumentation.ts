// Validate env once at server boot so a missing var fails loudly (TECH_SPEC §4).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("./server/env");
    getEnv();
  }
}
