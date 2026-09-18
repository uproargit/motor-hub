/**
 * Fails the build when a hosted deploy is missing something that would make it
 * unsafe or broken. Deploying with no passphrase would put the whole garage
 * record on the public internet, so that is an error, not a warning.
 *
 * Only enforced on a hosting platform; local builds stay unauthenticated.
 */

const hosted = process.env.VERCEL === "1" || process.env.MOTOR_HUB_ENFORCE_ENV === "1";
if (!hosted) {
  process.exit(0);
}

const problems = [];

if (!process.env.MOTOR_HUB_PASSWORD) {
  problems.push(
    "MOTOR_HUB_PASSWORD is not set. Without it the app has no sign-in screen and\n" +
      "    anyone with the URL can read and edit your records.",
  );
}

if (!process.env.TURSO_DATABASE_URL) {
  problems.push(
    "TURSO_DATABASE_URL is not set. The app would fall back to a local SQLite\n" +
      "    file, which a serverless host wipes between requests — your data would\n" +
      "    silently disappear.",
  );
} else if (!process.env.TURSO_AUTH_TOKEN && !process.env.TURSO_DATABASE_URL.startsWith("file:")) {
  problems.push("TURSO_AUTH_TOKEN is not set, so the database connection will be rejected.");
}

const r2 = ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
const r2Set = r2.filter((name) => process.env[name]);

// Partly configured is a mistake worth stopping for; not configured at all is a
// deliberate state the app handles by refusing uploads with a clear message,
// so the rest of it can be deployed and used first.
const warnings = [];
if (r2Set.length === 0) {
  warnings.push(
    "No R2 bucket is configured, so uploading receipts and photos will be turned\n" +
      "    off. Everything else works. Set " + r2.join(", ") + "\n" +
      "    when you are ready.",
  );
} else if (r2Set.length < r2.length) {
  problems.push(`R2 is partly configured. Missing: ${r2.filter((name) => !process.env[name]).join(", ")}`);
}

if (problems.length > 0) {
  console.error("\n  Motor Hub cannot be deployed with this configuration:\n");
  for (const problem of problems) console.error(`  ✗ ${problem}\n`);
  console.error("  See .env.example for what each value is and where to get it.\n");
  process.exit(1);
}

for (const warning of warnings) console.warn(`\n  ! ${warning}\n`);

console.log(
  `Environment checks passed: passphrase set, Turso configured, ` +
    `file uploads ${r2Set.length === r2.length ? "configured" : "disabled"}.`,
);
