import { existsSync } from "node:fs";

// Integration tests read the same .env.local the app uses (written by scripts/dev-env.sh).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
