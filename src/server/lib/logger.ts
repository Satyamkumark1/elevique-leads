import "server-only";

// IDs and codes only — never phone, email or name (SECURITY.md).
type Fields = Record<string, string | number | boolean | null | undefined>;

function write(level: "info" | "warn" | "error", msg: string, fields: Fields = {}) {
  console[level](JSON.stringify({ level, msg, ...fields, ts: new Date().toISOString() }));
}

export const logger = {
  info: (msg: string, fields?: Fields) => write("info", msg, fields),
  warn: (msg: string, fields?: Fields) => write("warn", msg, fields),
  error: (msg: string, fields?: Fields) => write("error", msg, fields),
};
