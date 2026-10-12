import { expect, test } from "@playwright/test";
import { localSupabase } from "../support/supabase";
import { latestMagicLink } from "./helpers";

const { mailUrl } = localSupabase();
const TEAM_EMAIL = "you@elevique.in"; // allowlisted in seed.sql

test.beforeEach(async () => {
  await fetch(`${mailUrl}/api/v1/messages`, { method: "DELETE" });
});

test("unauthenticated visit redirects to login", async ({ page }) => {
  await page.goto("/leads");
  await expect(page).toHaveURL(/\/login$/);
});

test("TC-E-01: allowlisted email logs in and lands on Overview", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEAM_EMAIL);
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await expect(page.getByText("Check your inbox")).toBeVisible();

  await page.goto(await latestMagicLink(TEAM_EMAIL));
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();

  for (const name of ["Leads", "Follow-ups", "Templates", "Integrations", "Settings"]) {
    await page.getByRole("link", { name }).first().click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  }

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("TC-E-02: non-team email is told it is not authorised", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("stranger@example.com");
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await expect(page.getByText("Not authorised.")).toBeVisible();

  const search = await fetch(
    `${mailUrl}/api/v1/search?query=${encodeURIComponent("to:stranger@example.com")}`,
  );
  expect(((await search.json()) as { messages: unknown[] }).messages ?? []).toHaveLength(0);
});
