import { defineConfig } from "vitest/config";
import base from "./vitest.config.mjs";

// Same aliases/setup as the main config, but only the real-Groq eval.
export default defineConfig({ ...base, test: { ...base.test, include: ["tests/ai-eval/**/*.test.ts"] } });
