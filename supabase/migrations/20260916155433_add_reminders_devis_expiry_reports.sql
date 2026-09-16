-- Feature 1: Service reminder intervals on canned_tasks
ALTER TABLE canned_tasks
  ADD COLUMN IF NOT EXISTS interval_months INTEGER DEFAULT 12,
  ADD COLUMN IF NOT EXISTS interval_km INTEGER DEFAULT 15000;

-- Feature 3: Devis expiry on service_requests
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS valid_until_days INTEGER DEFAULT 30;

-- Auto-set expiry_date when a devis is sent (status -> devis_recu) if not already set
CREATE OR REPLACE FUNCTION set_devis_expiry_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'devis_recu' AND NEW.expiry_date IS NULL THEN
    NEW.expiry_date = CURRENT_DATE + COALESCE(NEW.valid_until_days, 30);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_devis_expiry ON service_requests;
CREATE TRIGGER trg_set_devis_expiry
  BEFORE UPDATE ON service_requests
  FOR EACH ROW EXECUTE FUNCTION set_devis_expiry_date();

-- RLS: allow clients to read expiry columns (they already have SELECT on their own rows)
-- No policy change needed — existing SELECT policy covers all columns
