/**
 * Verifies that the passphrase gate actually gates.
 *
 *   MOTOR_HUB_PASSWORD=<pass> npm start -- -p 3112 &
 *   PASSWORD=<pass> BASE=http://localhost:3112 node tests/auth-smoke.mjs
 */

import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3112";
const PASSWORD = process.env.PASSWORD ?? "test-passphrase";

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

async function step(name, fn) {
  try { await fn(); console.log(`PASS  ${name}`); }
  catch (e) { console.log(`FAIL  ${name}: ${e.message}`); process.exitCode = 1; }
}

const page = await browser.newPage();

await step("dashboard redirects to login when signed out", async () => {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  if (!page.url().includes("/login")) throw new Error(`landed on ${page.url()}`);
  const body = await page.textContent("body");
  if (body.includes("Total modification cost")) throw new Error("dashboard content leaked to the login page");
});

await step("a deep link is remembered and returned to", async () => {
  await page.goto(`${BASE}/maintenance`, { waitUntil: "networkidle" });
  if (!page.url().includes("next=%2Fmaintenance")) throw new Error(`no next param: ${page.url()}`);
});

await step("uploaded files are protected too", async () => {
  const res = await page.request.get(`${BASE}/api/files/att_anything`, { maxRedirects: 0 });
  if (res.status() !== 307 && res.status() !== 302) {
    throw new Error(`expected a redirect to login, got ${res.status()}`);
  }
});

await step("a wrong passphrase is rejected", async () => {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#password", "not-the-passphrase");
  await page.click('form button:has-text("Sign in")');
  await page.waitForTimeout(1500);
  const body = await page.textContent("body");
  if (!body.includes("not right")) throw new Error("no rejection message");
  if (!page.url().includes("/login")) throw new Error("let through with a bad passphrase");
});

await step("the right passphrase signs in and returns to the deep link", async () => {
  await page.goto(`${BASE}/login?next=%2Fmaintenance`, { waitUntil: "networkidle" });
  await page.fill("#password", PASSWORD);
  await page.click('form button:has-text("Sign in")');
  await page.waitForURL(/\/maintenance$/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  const body = await page.textContent("body");
  if (!body.includes("Maintenance")) throw new Error("did not reach the maintenance page");
});

await step("the session persists across navigation", async () => {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const body = await page.textContent("body");
  if (!body.includes("Total modification cost")) throw new Error("dashboard did not render while signed in");
});

await step("the session cookie is HttpOnly", async () => {
  const cookie = (await page.context().cookies()).find((c) => c.name === "motor_hub_session");
  if (!cookie) throw new Error("no session cookie set");
  if (!cookie.httpOnly) throw new Error("session cookie is readable from JavaScript");
  if (cookie.sameSite !== "Lax") throw new Error(`unexpected SameSite: ${cookie.sameSite}`);
});

await step("a tampered session cookie is rejected", async () => {
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === "motor_hub_session");
  const [expires] = session.value.split(".");
  await page.context().clearCookies();
  await page.context().addCookies([{ ...session, value: `${expires}.forgedsignature` }]);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  if (!page.url().includes("/login")) throw new Error("a forged signature was accepted");
});

await step("sign out clears the session", async () => {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#password", PASSWORD);
  await page.click('form button:has-text("Sign in")');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
  await page.click('button:has-text("Sign out")');
  await page.waitForURL(/\/login/, { timeout: 15000 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  if (!page.url().includes("/login")) throw new Error("still signed in after sign out");
});

await browser.close();
