import { readFileSync } from "node:fs";
import { expect, request, test } from "@playwright/test";
import { admin, seedLead } from "./helpers";

test("TC-E-03: Overview shows 4 stat cards and charts", async ({ page }) => {
  await page.goto("/");
  for (const label of ["Leads today", "Hot leads this week", "Reply rate (7d)", "Median first response"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("Median first response").locator("..").getByText("8s")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Leads per day, last 30 days" }).locator("svg").first(),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Leads by campaign, last 30 days" }).locator("svg").first(),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Needs your attention" })).toBeVisible();
});

test("TC-E-04: filter Hot + Fashion shows only matching rows", async ({ page }) => {
  await page.goto("/leads");
  await page.getByLabel("Score").selectOption("hot");
  await page.getByLabel("Category").selectOption("Fashion");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/score=hot/);
  await expect(page).toHaveURL(/category=Fashion/);

  const rows = page.locator("table tbody tr");
  const { count } = await admin
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("score", "hot")
    .eq("category", "Fashion");
  await expect(rows).toHaveCount(Math.min(count!, 25));
  for (const row of await rows.all()) {
    await expect(row).toContainText("Hot");
    await expect(row).toContainText("Fashion");
  }
});

test("TC-E-05: search by brand finds the row", async ({ page }) => {
  await page.goto("/leads");
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("Brand 12");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator("table tbody tr")).toHaveCount(1);
  await expect(page.locator("table tbody tr")).toContainText("Test Lead 12");
});

test("TC-E-06: lead detail shows answers, AI summary and an ordered timeline", async ({ page }) => {
  const lead = await seedLead("test_2"); // replied lead with outbound + inbound messages
  await page.goto(`/leads?q=${encodeURIComponent(lead.brand_name!)}&status=replied`);
  await page.getByRole("link", { name: lead.full_name!, exact: true }).click(); // row click → detail
  await expect(page).toHaveURL(`/leads/${lead.id}`);
  await expect(page.getByRole("heading", { name: "Form answers" })).toBeVisible();
  await expect(page.getByText(lead.budget_range!).first()).toBeVisible();
  await expect(page.getByText(lead.ai_summary!)).toBeVisible();

  const items = page.locator('section[aria-labelledby="timeline"] ol > li');
  const texts = await items.allInnerTexts();
  const created = texts.findIndex((t) => t.includes("Lead received"));
  const replied = texts.findIndex((t) => t.includes("Lead replied"));
  expect(created).toBeGreaterThanOrEqual(0);
  expect(replied).toBeGreaterThan(created);
});

test("TC-E-07: change status to Meeting booked", async ({ page }) => {
  const lead = await seedLead("test_3");
  await admin.from("leads").update({ status: "contacted" }).eq("id", lead.id);
  await page.goto(`/leads/${lead.id}`);
  await page.getByLabel("Status").selectOption("meeting_booked");
  await expect(
    page.getByRole("status").filter({ hasText: "Status changed to Meeting booked" }),
  ).toBeVisible();
  await expect(page.getByText(/Status Contacted → Meeting booked/).last()).toBeVisible();
  await expect(page.getByLabel("Status")).toHaveValue("meeting_booked");
});

test("TC-E-08: note persists after reload", async ({ page }) => {
  const lead = await seedLead("test_4");
  await admin.from("leads").update({ notes: null }).eq("id", lead.id);
  const note = `Call on Tuesday ${Date.now()}`;
  await page.goto(`/leads/${lead.id}`);
  await page.getByRole("textbox", { name: "Notes" }).fill(note);
  await page.getByRole("heading", { name: "Notes" }).click(); // blur saves
  await expect(page.getByRole("status").filter({ hasText: "Notes saved" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Notes" })).toHaveValue(note);
  await expect(page.getByText(/Last edited/)).toBeVisible();
});

test("TC-E-09: pausing automation persists and cancels pending follow-ups", async ({ page }) => {
  const { data: job } = await admin
    .from("jobs")
    .select("id, lead_id")
    .eq("type", "followup")
    .in("status", ["pending", "cancelled"])
    .limit(1)
    .single();
  await admin.from("leads").update({ automation_paused: false }).eq("id", job!.lead_id!);
  await admin.from("jobs").update({ status: "pending", last_error: null }).eq("id", job!.id);

  await page.goto(`/leads/${job!.lead_id}`);
  await expect(page.getByText("Follow-up day2 scheduled")).toBeVisible();
  await page.getByRole("switch", { name: /Automation: On/ }).click();
  await expect(page.getByRole("switch", { name: /Automation: Paused/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("switch", { name: /Automation: Paused/ })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(page.getByText("Follow-up day2 cancelled")).toBeVisible();
});

test("TC-E-10: export CSV downloads the filtered rows", async ({ page }) => {
  await page.goto("/leads?score=hot");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  const file = await (await download).path();
  const lines = readFileSync(file, "utf8").trim().split("\r\n");
  const { count } = await admin.from("leads").select("*", { count: "exact", head: true }).eq("score", "hot");
  expect(lines[0]).toContain('"Lead ID"');
  expect(lines).toHaveLength(count! + 1);
  expect(lines.slice(1).every((l) => l.includes('"hot"'))).toBe(true);
});

test("TC-E-11: retry a dead job from Integrations", async ({ page }) => {
  await admin
    .from("jobs")
    .update({ status: "dead", attempts: 3, last_error: "whatsapp send failed: HTTP 400 code 131026" })
    .eq("idempotency_key", "send_whatsapp:welcome:seed-dead");
  await page.goto("/integrations?tab=dead");
  await page.getByRole("button", { name: "Retry send_whatsapp" }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Job queued for retry" })).toBeVisible();
  const { data } = await admin
    .from("jobs")
    .select("status, attempts")
    .eq("idempotency_key", "send_whatsapp:welcome:seed-dead")
    .single();
  expect(data).toEqual({ status: "pending", attempts: 0 }); // AUTOMATION_ENABLED=false locally: stays pending
});

test("TC-E-12: 375 px wide — leads list and detail have no horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const noHorizontalScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

  await page.goto("/leads");
  await expect(page.getByRole("link", { name: /Test Lead/ }).first()).toBeVisible();
  expect(await noHorizontalScroll()).toBe(true);

  await page
    .getByRole("link", { name: /Test Lead/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Form answers" })).toBeVisible();
  expect(await noHorizontalScroll()).toBe(true);
});

test("dashboard and its API are available without authentication", async () => {
  const anon = await request.newContext({
    baseURL: "http://localhost:3000",
    storageState: { cookies: [], origins: [] }, // no session
  });
  const lead = await seedLead("test_5");
  expect((await anon.patch(`/api/leads/${lead.id}`, { data: { notes: "Public dashboard note" } })).status()).toBe(200);
  expect((await anon.get("/api/leads/export")).status()).toBe(200);
  await anon.dispose();
});

test("all dashboard pages render without errors", async ({ page }) => {
  for (const [path, heading] of [
    ["/follow-ups", "Follow-ups"],
    ["/templates", "Templates"],
    ["/integrations", "Integrations"],
    ["/settings", "Settings"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  }
});
