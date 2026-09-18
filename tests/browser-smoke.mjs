/**
 * End-to-end smoke test of the write paths that unit tests cannot reach:
 * creating a part with a schedule, logging a service, replacing a part, form
 * validation, recording a reading, and file upload.
 *
 * Requires a running server and a seeded database:
 *
 *   npm run seed:reset
 *   npm run build && npm start -- -p 3111 &
 *   npm i --no-save playwright
 *   VEH=<vehicle id> BASE=http://localhost:3111 node tests/browser-smoke.mjs
 *
 * Re-seed between runs: the test mutates the vehicle's readings as it goes.
 */

import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3111";
const VEH = process.env.VEH;
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });

async function step(name, fn) {
  try { await fn(); console.log(`PASS  ${name}`); }
  catch (e) { console.log(`FAIL  ${name}: ${e.message}`); process.exitCode = 1; }
}

// 1. Create a part with a maintenance schedule and check the calculation.
await step("create part with schedule", async () => {
  await page.goto(`${BASE}/vehicles/${VEH}/parts/new`, { waitUntil: "networkidle" });
  await page.fill("#name", "Smoke Test Winch");
  await page.selectOption("#category", "RECOVERY");
  await page.fill("#manufacturer", "Warn");
  await page.fill("#part_number", "101040");
  await page.fill("#installed_hours", "100");
  await page.fill("#part_cost", "699.99");
  await page.fill("#labor_cost", "150");
  await page.click('summary:has-text("Maintenance schedule")');
  await page.fill("#schedule_interval_hours", "25");
  await page.click('button[type=submit]:has-text("Save part")');
  await page.waitForURL(/\/parts\/prt_[a-z0-9]+$/, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  const body = await page.textContent("body");
  if (!body.includes("Smoke Test Winch")) throw new Error("part name missing");
  if (!body.includes("$849.99")) throw new Error(`total installed cost missing; got no $849.99`);
  // Installed at 100 hr, inspect every 25 hr, vehicle reads 116 hr -> due 125, 9 remaining.
  if (!body.includes("9 hours remaining")) throw new Error("expected '9 hours remaining'");
  if (!body.includes("125 hr")) throw new Error("expected next due at 125 hr");
});

const partUrl = page.url();

// 2. Log a service against the schedule; the interval must restart.
await step("log service restarts interval", async () => {
  await page.selectOption("#schedule_id", { index: 1 });
  await page.fill("#service_hours", "116");
  await page.fill("#service_cost", "25");
  await page.fill("#outcome", "Cable inspected, no fraying");
  await page.click('button[type=submit]:has-text("Log service")');
  await page.waitForTimeout(2500);
  await page.goto(partUrl, { waitUntil: "networkidle" });
  const body = await page.textContent("body");
  if (!body.includes("141 hr")) throw new Error("schedule base did not advance to 116 hr (expected next 141 hr)");
  if (!body.includes("Cable inspected, no fraying")) throw new Error("service record not listed");
});

// 3. Replace the part; both records must survive and be linked.
await step("replace part keeps both records", async () => {
  await page.goto(`${partUrl}/replace`, { waitUntil: "networkidle" });
  await page.fill("#removal_reason", "Upgraded to synthetic rope");
  await page.fill("#name", "Smoke Test Winch Mk2");
  await page.fill("#installed_hours", "116");
  await page.fill("#part_cost", "899");
  await page.click('button[type=submit]:has-text("Record replacement")');
  await page.waitForURL(/\/parts\/prt_[a-z0-9]+$/, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  const body = await page.textContent("body");
  if (!body.includes("Replacement chain")) throw new Error("no replacement chain banner");
  if (!body.includes("Replaced Smoke Test Winch")) throw new Error("does not link back to the old part");
  // Schedules were copied and rebased to 116 hr -> next at 141 hr.
  if (!body.includes("141 hr")) throw new Error("copied schedule not rebased");
});

// 4. The old part is still there, marked replaced.
await step("old part retained as Replaced", async () => {
  await page.goto(partUrl, { waitUntil: "networkidle" });
  const body = await page.textContent("body");
  if (!body.includes("Replaced")) throw new Error("old part is not marked Replaced");
  if (!body.includes("Upgraded to synthetic rope")) throw new Error("removal reason missing");
  if (!body.includes("Replaced by Smoke Test Winch Mk2")) throw new Error("no forward link");
});

// 5. Validation surfaces rather than crashing.
await step("validation error is shown", async () => {
  await page.goto(`${BASE}/vehicles/${VEH}/parts/new`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.querySelector("#name").removeAttribute("required"));
  await page.click('button[type=submit]:has-text("Save part")');
  await page.waitForTimeout(2000);
  const body = await page.textContent("body");
  if (!body.includes("Part name is required")) throw new Error("validation message not rendered");
});

// 6. Recording a reading updates every due calculation.
await step("usage reading updates due state", async () => {
  await page.goto(`${BASE}/vehicles/${VEH}/maintenance`, { waitUntil: "networkidle" });
  await page.fill("#engine_hours", "150");
  await page.click('button[type=submit]:has-text("Record reading")');
  await page.waitForTimeout(2500);
  await page.goto(`${BASE}/vehicles/${VEH}/maintenance`, { waitUntil: "networkidle" });
  const body = await page.textContent("body");
  if (!body.includes("Overdue")) throw new Error("drive belt should now be overdue at 150 hr");
});

// 7. Receipt upload is stored and served back.
await step("upload receipt and serve it", async () => {
  await page.goto(`${BASE}/vehicles/${VEH}/parts`, { waitUntil: "networkidle" });
  const link = await page.getAttribute('a[href*="/parts/prt_"]', "href");
  await page.goto(`${BASE}${link}`, { waitUntil: "networkidle" });
  await page.selectOption("#attachment_kind", "RECEIPT");
  await page.fill("#attachment_caption", "Invoice 8842");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.setInputFiles("#attachment_files", { name: "receipt.png", mimeType: "image/png", buffer: png });
  await page.click('button[type=submit]:has-text("Upload")');
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: "networkidle" });
  const src = await page.getAttribute('img[src^="/api/files/"]', "src");
  if (!src) throw new Error("uploaded image not rendered");
  const res = await page.request.get(`${BASE}${src}`);
  if (res.status() !== 200) throw new Error(`file route returned ${res.status()}`);
  if (res.headers()["content-type"] !== "image/png") throw new Error("wrong content type");
});

// 8. Non-image, non-PDF uploads are rejected.
await step("rejects a disallowed upload type", async () => {
  await page.setInputFiles("#attachment_files", {
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });
  await page.click('button[type=submit]:has-text("Upload")');
  await page.waitForTimeout(2000);
  const body = await page.textContent("body");
  if (!body.includes("Upload an image or PDF")) throw new Error("rejection message not shown");
});

if (errors.length) { console.log("BROWSER ERRORS:\n" + errors.join("\n")); process.exitCode = 1; }
else console.log("no browser errors");
await browser.close();
