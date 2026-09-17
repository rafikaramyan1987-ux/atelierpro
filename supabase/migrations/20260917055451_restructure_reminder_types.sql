-- A. Replace generic interval with reminder_type enum
ALTER TABLE canned_tasks
  ADD COLUMN IF NOT EXISTS reminder_type TEXT NOT NULL DEFAULT 'none'
    CHECK (reminder_type IN ('none', 'interval', 'seasonal'));

-- Seasonal months (array of month numbers, e.g. [4, 10] for April/October)
ALTER TABLE canned_tasks
  ADD COLUMN IF NOT EXISTS seasonal_months INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- B. Service group for combined reminders
ALTER TABLE canned_tasks
  ADD COLUMN IF NOT EXISTS service_group TEXT;

-- Set interval defaults to NULL instead of 12/15000
ALTER TABLE canned_tasks
  ALTER COLUMN interval_months SET DEFAULT NULL,
  ALTER COLUMN interval_km SET DEFAULT NULL;

-- D. Tyre storage (gardiennage) on vehicles
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS tyres_stored BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stored_tyre_set TEXT CHECK (stored_tyre_set IN ('summer', 'winter'));

-- Gardiennage enabled on garages
ALTER TABLE garages
  ADD COLUMN IF NOT EXISTS gardiennage_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: existing tasks default to 'none' (no reminders unless explicitly configured)
UPDATE canned_tasks SET reminder_type = 'none' WHERE reminder_type IS NULL;
