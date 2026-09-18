# Motor Hub

A vehicle management platform built around a complete, structured record of
every part and modification ever fitted to a vehicle — a living build sheet and
maintenance record rather than a notes field.

Open a vehicle years later and you can see exactly what was installed, when,
what it cost, who installed it, what it replaced, and what needs servicing next.

## What it does

**Parts & modifications.** Every part carries name, category, manufacturer,
part number, description, install date, mileage and/or engine hours at install,
who installed it (self / shop / dealer / factory …) with full installer contact
details, part cost, labor, shipping and tax with a computed total installed
cost, warranty terms, purchase vendor and order number, receipts, invoices and
photos, notes, and a current status.

**Nothing is overwritten.** Replacing a part creates a new record and closes out
the old one with its removal date, reason and disposition. The two are linked,
so the part detail page shows the replacement chain and the vehicle history
keeps both entries forever.

```
OEM Battery        installed: factory   removed: 6/14/26   reason: Failed
Odyssey Battery    installed: 6/14/26   18,242 mi   $289   warranty: 4 years
```

**Service & inspection tracking.** Any part can carry one or more maintenance
schedules. Intervals trigger on mileage, engine hours, calendar months, or any
combination — due at whichever comes first, or only once all have elapsed. The
next service is calculated from the install point and rebased every time the
work is logged.

```
Method Wheels     installed at 42 engine hours, inspect every 100 hours
                  -> next inspection at 142 hours
K&N Air Filter    installed at 2,400 miles, clean every 5,000 miles
                  -> next service at 7,400 miles
UTV Drive Belt    installed at 72 hours, inspect every 50 hours
                  -> next inspection at 122 hours
Boat Impeller     installed June 2026, replace every 12 months
                  -> next replacement June 2027
```

**Build sheet.** Per-vehicle view of everything currently installed, grouped
into sections (Wheels & Tires, Suspension & Chassis, Performance & Drivetrain,
Lighting & Electrical …), with running costs. Every entry links back to its full
installation and service history. Maintenance consumables are kept off the build
sheet by default and can be toggled in.

**History.** A chronological timeline per vehicle of every install, removal,
replacement, service and meter reading.

**Dashboard.** Parts needing attention across the whole fleet (overdue first,
then due soon), total modification cost, parts installed, upcoming part
maintenance, and recently installed parts.

## Running it locally

```bash
npm install
npm run seed      # optional: loads a demo fleet (UTV, car, boat)
npm run dev
```

With no environment variables set the app runs unauthenticated against a SQLite
file in `data/`, with uploads on local disk. That is the intended development
setup — nothing to configure.

```bash
npm run build && npm start   # production build
npm run typecheck            # tsc --noEmit
npm test                     # due-engine unit tests
npm run seed:reset           # wipe and reload the demo fleet
npm run backup               # dump the database to ./backups
```

## Deploying

Runs on free tiers end to end: Vercel for the app, Turso for the database,
Cloudflare R2 for receipts and photos. Copy `.env.example` and work through it —
every value is explained there.

1. **Database — [Turso](https://turso.tech).** Create a database, then set
   `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. The schema is applied
   automatically on first connect. The free tier is 5 GB and does not pause on
   inactivity.

2. **File storage — [Cloudflare R2](https://developers.cloudflare.com/r2/).**
   Create a bucket and an API token, then set `R2_ACCOUNT_ID`, `R2_BUCKET`,
   `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. Files are proxied through the
   app rather than served from public URLs, so receipts stay private; R2 charges
   nothing for egress. Set none of these and uploads fall back to local disk.

3. **Access — set `MOTOR_HUB_PASSWORD`** to a shared passphrase. This turns on
   the sign-in screen. Also set `MOTOR_HUB_SESSION_SECRET` to any long random
   string so that changing the passphrase later does not sign everyone out.

4. **Deploy to Vercel**, either from the dashboard (import the repo, paste the
   variables above) or from the CLI, which is bundled as a dev dependency:

   ```bash
   npm run vercel:login    # once, opens a browser
   npm run vercel:link     # once, connects this folder to a Vercel project
   npm run deploy          # production deploy
   npm run deploy:preview  # a throwaway preview URL
   ```

   Once the variables are set in Vercel, `npm run env:pull` writes them into a
   local `.env.local`, so development runs against the same database without
   copying secrets around by hand.

R2 is optional for a first deploy: leave it unset and the app runs normally but
refuses uploads with a clear message, rather than writing receipts to a disk the
host wipes between requests. Add it whenever you like.

`npm run build` runs `scripts/check-env.mjs` first, which **fails the build** on
a hosted deploy with no passphrase (the data would be public) or no database
(the data would silently vanish). Check a configuration without deploying using
`npm run check:env`.

## Backups

`npm run backup` writes a timestamped `.sql` file of every table, against either
the local or the hosted database. Restoring is: let the app create the schema,
then replay the file.

Nothing on a free tier backs this up for you, and the whole point of the app is
that the record survives for years — so put it on a schedule, either a cron job
on a machine you own or a scheduled GitHub Action with the Turso credentials as
secrets. Note that it covers the database, not the uploaded files; R2 has its
own bucket versioning if you want that too.

## How it is put together

- **Next.js App Router** with server components for reads and server actions for
  writes; no separate API layer apart from the file route.
- **SQLite via libSQL.** The same client and the same SQL run against a local
  file in development and a hosted Turso database in production, so deploying is
  an environment variable rather than a code change. The schema lives in
  `src/lib/schema.sql` and is applied on connect, so there is no migration step.
- **Pluggable file storage** (`src/lib/storage.ts`): local disk or Cloudflare R2,
  chosen by whether the bucket is configured.
- **One shared passphrase** (`src/lib/auth.ts`) exchanged for an HMAC-signed,
  HttpOnly session cookie, enforced in middleware across every route including
  uploaded files. There are no per-person accounts because nothing in the app
  differs per person; adding them later means a user table and an owner column.
- **`src/lib/due.ts`** is the maintenance engine. It is pure — schedule plus a
  usage snapshot in, next-due and remaining out — so the arithmetic is covered
  by unit tests without a database.
- **`src/lib/queries.ts`** holds reads; `src/lib/actions/` holds writes.
- Money is stored as integer cents, calendar dates as `YYYY-MM-DD` strings
  handled in UTC so intervals never drift a day across timezones.

### Data model

| Table | Purpose |
| --- | --- |
| `vehicle` | The machine, which meters it has, and its current readings |
| `usage_reading` | Odometer / hour-meter history |
| `part` | Every part ever fitted, including ones long since removed |
| `maintenance_schedule` | Intervals attached to a part |
| `service_record` | Work performed; logging it rebases the schedule |
| `attachment` | Receipts, invoices, manuals and photos |

### Tests

`npm test` covers the due engine: engine-hour, mileage and calendar intervals,
combined triggers in both modes, month-end clamping, missing readings, and
urgency ordering.

Two browser suites cover what unit tests cannot, both needing a running server
and `npm i --no-save playwright` (see each file's header):

- `tests/browser-smoke.mjs` — the write paths: create a part with a schedule,
  log a service and confirm the interval restarts, replace a part and confirm
  both records survive and stay linked, form validation, recording a reading,
  uploading and serving a receipt, rejecting a disallowed file type.
- `tests/auth-smoke.mjs` — the passphrase gate: redirects when signed out,
  deep links preserved, uploaded files protected, wrong passphrase rejected,
  cookie is HttpOnly, forged signatures rejected, sign-out clears the session.
