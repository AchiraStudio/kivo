-- 061_member_health.sql
-- Member health check records (blood sugar, cholesterol, etc.), the medicines
-- given at each check, and reusable medicine presets with their prices.
-- Data stays on the host device. LAN clients reach it through the host RPC.

CREATE TABLE IF NOT EXISTS health_records (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    checked_at TEXT NOT NULL DEFAULT (datetime('now')),
    blood_sugar REAL,
    blood_sugar_context TEXT,
    cholesterol_total REAL,
    cholesterol_hdl REAL,
    cholesterol_ldl REAL,
    triglycerides REAL,
    uric_acid REAL,
    systolic INTEGER,
    diastolic INTEGER,
    weight REAL,
    height REAL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_health_records_customer ON health_records(customer_id, checked_at);

CREATE TABLE IF NOT EXISTS health_record_medicines (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL REFERENCES health_records(id) ON DELETE CASCADE,
    item_id TEXT,
    name TEXT NOT NULL,
    qty REAL NOT NULL DEFAULT 1,
    unit TEXT,
    price REAL NOT NULL DEFAULT 0,
    instructions TEXT
);

CREATE INDEX IF NOT EXISTS idx_health_record_medicines_record ON health_record_medicines(record_id);

CREATE TABLE IF NOT EXISTS medicine_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_medicine_presets_name ON medicine_presets(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS medicine_preset_items (
    id TEXT PRIMARY KEY,
    preset_id TEXT NOT NULL REFERENCES medicine_presets(id) ON DELETE CASCADE,
    item_id TEXT,
    name TEXT NOT NULL,
    qty REAL NOT NULL DEFAULT 1,
    unit TEXT,
    price REAL NOT NULL DEFAULT 0,
    instructions TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_medicine_preset_items_preset ON medicine_preset_items(preset_id);
