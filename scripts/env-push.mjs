/**
 * Copies the values in .env.production.local up to Vercel, so the secrets are
 * typed once into a gitignored file instead of once per `vercel env add`
 * prompt. Values never touch the repo: .env* is ignored.
 *
 * Usage: npm run env:push [-- production preview]
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const FILE = ".env.production.local";
const targets = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
const environments = targets.length > 0 ? targets : ["production"];

let contents;
try {
  contents = readFileSync(FILE, "utf8");
} catch {
  console.error(`\n  ${FILE} does not exist. Nothing to push.\n`);
  process.exit(1);
}

const values = new Map();
for (const line of contents.split("\n")) {
  const trimmed = line.trim();
  if (trimmed === "" || trimmed.startsWith("#")) continue;
  const at = trimmed.indexOf("=");
  if (at === -1) continue;
  const name = trimmed.slice(0, at).trim();
  const value = trimmed.slice(at + 1).trim();
  if (value !== "") values.set(name, value);
}

const required = ["MOTOR_HUB_PASSWORD", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"];
const missing = required.filter((name) => !values.has(name));
if (missing.length > 0) {
  console.error(`\n  Still blank in ${FILE}: ${missing.join(", ")}\n`);
  console.error("  The build fails without these. Fill them in and run again.\n");
  process.exit(1);
}

if (values.size === 0) {
  console.error(`\n  Every value in ${FILE} is blank. Nothing to push.\n`);
  process.exit(1);
}

const vercel = (args, input) =>
  spawnSync("npx", ["vercel", ...args], { input, encoding: "utf8" });

for (const environment of environments) {
  for (const [name, value] of values) {
    // Vercel rejects an add when the name already exists in that environment,
    // so replace rather than fail on a re-run.
    vercel(["env", "rm", name, environment, "--yes"], "");
    const added = vercel(["env", "add", name, environment], `${value}\n`);
    if (added.status === 0) {
      console.log(`  set ${name} (${environment})`);
    } else {
      console.error(`  FAILED ${name} (${environment})`);
      console.error((added.stderr || added.stdout || "").trim());
      process.exit(1);
    }
  }
}

console.log("\n  Done. Verify with: npx vercel env ls\n");
