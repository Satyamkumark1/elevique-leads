import { test as setup } from "@playwright/test";
import { signIn } from "./helpers";

export const STORAGE = "tests/e2e/.auth/team.json";

setup("sign in as team member", async ({ page }) => {
  await signIn(page, "you@elevique.in");
  await page.context().storageState({ path: STORAGE });
});
