-- Motor Hub schema.
-- Money is stored in integer cents. Dates are ISO 'YYYY-MM-DD' strings.
-- Timestamps are ISO-8601 UTC strings.
-- libSQL enforces foreign keys by default, so no PRAGMA is needed.

CREATE TABLE IF NOT EXISTS vehicle (
  id                   TEXT PRIMARY KEY,
  nickname             TEXT,
  year                 INTEGER,
  make                 TEXT NOT NULL,
  model                TEXT NOT NULL,
  trim                 TEXT,
  vehicle_type         TEXT NOT NULL DEFAULT 'CAR',
  vin                  TEXT,
  plate                TEXT,
  color                TEXT,
  purchased_on         TEXT,
  purchase_price_cents INTEGER,

  -- Which usage meters this vehicle actually has. A UTV or boat may have only
  -- an hour meter; a truck only an odometer; some machines have both.
  tracks_mileage       INTEGER NOT NULL DEFAULT 1,
  tracks_engine_hours  INTEGER NOT NULL DEFAULT 0,
  current_mileage      INTEGER,
  current_engine_hours REAL,
  usage_updated_on     TEXT,

  -- A trailer belongs to the boat it carries, a tender to its yacht. One level
  -- deep and optional; clearing the parent leaves the vehicle standing alone
  -- rather than deleting it with the other.
  parent_vehicle_id    TEXT REFERENCES vehicle(id) ON DELETE SET NULL,

  notes                TEXT,
  archived             INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

-- Chronological log of odometer / hour-meter readings so usage has a history
-- rather than a single overwritten number.
CREATE TABLE IF NOT EXISTS usage_reading (
  id           TEXT PRIMARY KEY,
  vehicle_id   TEXT NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,
  recorded_on  TEXT NOT NULL,
  mileage      INTEGER,
  engine_hours REAL,
  source       TEXT NOT NULL DEFAULT 'MANUAL',
  notes        TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_reading_vehicle ON usage_reading(vehicle_id, recorded_on DESC);

-- The core entity: every part or modification ever fitted to a vehicle.
-- Rows are never overwritten when a part is replaced; the old row is retained
-- with a terminal status and the new row points back at it.
CREATE TABLE IF NOT EXISTS part (
  id                TEXT PRIMARY KEY,
  vehicle_id        TEXT NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,

  name              TEXT NOT NULL,
  category          TEXT NOT NULL DEFAULT 'OTHER',
  manufacturer      TEXT,
  part_number       TEXT,
  description       TEXT,
  quantity          REAL NOT NULL DEFAULT 1,

  -- A modification changes the vehicle from stock and belongs on the build
  -- sheet. Maintenance items (filters, fluids, belts) are tracked identically
  -- but are not build-sheet entries.
  is_modification   INTEGER NOT NULL DEFAULT 1,
  is_oem            INTEGER NOT NULL DEFAULT 0,

  status            TEXT NOT NULL DEFAULT 'INSTALLED',

  installed_on      TEXT,
  installed_mileage INTEGER,
  installed_hours   REAL,
  installed_by      TEXT NOT NULL DEFAULT 'SELF',
  installer_name    TEXT,
  installer_phone   TEXT,
  installer_email   TEXT,
  installer_address TEXT,
  install_notes     TEXT,

  part_cost_cents     INTEGER,
  labor_cost_cents    INTEGER,
  shipping_cost_cents INTEGER,
  tax_cents           INTEGER,

  purchase_vendor   TEXT,
  purchase_location TEXT,
  purchased_on      TEXT,
  order_number      TEXT,

  warranty_type     TEXT NOT NULL DEFAULT 'NONE',
  warranty_provider TEXT,
  warranty_months   INTEGER,
  warranty_miles    INTEGER,
  warranty_hours    REAL,
  warranty_expires_on TEXT,
  warranty_notes    TEXT,

  -- End of life. Retained forever so the vehicle history stays complete.
  removed_on        TEXT,
  removed_mileage   INTEGER,
  removed_hours     REAL,
  removal_reason    TEXT,
  disposition       TEXT,
  sale_price_cents  INTEGER,

  -- Set on the *new* part, pointing at the part it superseded.
  replaces_part_id  TEXT REFERENCES part(id) ON DELETE SET NULL,

  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_part_vehicle  ON part(vehicle_id, status);
CREATE INDEX IF NOT EXISTS idx_part_category ON part(vehicle_id, category);
CREATE INDEX IF NOT EXISTS idx_part_replaces ON part(replaces_part_id);

-- An optional maintenance schedule attached to a part. A part may carry more
-- than one (e.g. inspect every 50 hours, replace every 200 hours).
CREATE TABLE IF NOT EXISTS maintenance_schedule (
  id             TEXT PRIMARY KEY,
  part_id        TEXT NOT NULL REFERENCES part(id) ON DELETE CASCADE,

  task_type      TEXT NOT NULL DEFAULT 'INSPECT',
  label          TEXT,

  -- Any combination may be set. NULL means that dimension does not trigger.
  interval_miles  INTEGER,
  interval_hours  REAL,
  interval_months INTEGER,

  -- FIRST: due when whichever interval arrives first elapses (the usual case).
  -- LAST:  due only once every configured interval has elapsed.
  trigger_mode   TEXT NOT NULL DEFAULT 'FIRST',

  -- The point the current interval counts from. Seeded from the install
  -- readings and advanced every time the task is performed.
  base_mileage   INTEGER,
  base_hours     REAL,
  base_on        TEXT,

  is_active      INTEGER NOT NULL DEFAULT 1,
  notes          TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_schedule_part ON maintenance_schedule(part_id, is_active);

-- A performed service or inspection. Logging one advances its schedule's base.
CREATE TABLE IF NOT EXISTS service_record (
  id            TEXT PRIMARY KEY,
  part_id       TEXT NOT NULL REFERENCES part(id) ON DELETE CASCADE,
  schedule_id   TEXT REFERENCES maintenance_schedule(id) ON DELETE SET NULL,

  task_type     TEXT NOT NULL DEFAULT 'INSPECT',
  performed_on  TEXT NOT NULL,
  mileage       INTEGER,
  engine_hours  REAL,

  performed_by  TEXT NOT NULL DEFAULT 'SELF',
  performer_name TEXT,
  cost_cents    INTEGER,
  outcome       TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_service_part     ON service_record(part_id, performed_on DESC);
CREATE INDEX IF NOT EXISTS idx_service_schedule ON service_record(schedule_id, performed_on DESC);

-- Receipts, invoices and photos. Exactly one owner column is set.
CREATE TABLE IF NOT EXISTS attachment (
  id                TEXT PRIMARY KEY,
  vehicle_id        TEXT REFERENCES vehicle(id) ON DELETE CASCADE,
  part_id           TEXT REFERENCES part(id) ON DELETE CASCADE,
  service_record_id TEXT REFERENCES service_record(id) ON DELETE CASCADE,

  kind        TEXT NOT NULL DEFAULT 'PHOTO',
  file_name   TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL,
  caption     TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attachment_part    ON attachment(part_id);
CREATE INDEX IF NOT EXISTS idx_attachment_vehicle ON attachment(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_attachment_service ON attachment(service_record_id);
