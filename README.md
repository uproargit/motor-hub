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

## Running it

```bash
npm install
npm run seed      # optional: loads a demo fleet (UTV, car, boat)
npm run dev
```

The database is a SQLite file and uploads are plain files, both under `data/`,
which is gitignored. Point `MOTOR_HUB_DATA_DIR` elsewhere to relocate them.

```bash
npm run build && npm start   # production
npm run typecheck            # tsc --noEmit
npm test                     # due-engine unit tests
npm run seed:reset           # wipe and reload the demo fleet
```

## How it is put together

- **Next.js App Router** with server components for reads and server actions for
  writes; no separate API layer apart from the file route.
- **SQLite via `better-sqlite3`.** The schema lives in `src/lib/schema.sql` and
  is applied on connect, so there is no migration step to run.
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

`tests/browser-smoke.mjs` drives the write paths in a real browser (create a
part with a schedule, log a service, replace a part, form validation, record a
reading, upload and serve a receipt, reject a disallowed file type). It needs a
running server and `npm i --no-save playwright`; see the header of that file.
