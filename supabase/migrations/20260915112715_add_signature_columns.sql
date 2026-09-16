-- Add signature columns to service_requests (devis) and repair_orders (OR)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service_requests' AND column_name = 'signature_data'
  ) THEN
    ALTER TABLE service_requests ADD COLUMN signature_data text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service_requests' AND column_name = 'signature_date'
  ) THEN
    ALTER TABLE service_requests ADD COLUMN signature_date timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'repair_orders' AND column_name = 'signature_data'
  ) THEN
    ALTER TABLE repair_orders ADD COLUMN signature_data text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'repair_orders' AND column_name = 'signature_date'
  ) THEN
    ALTER TABLE repair_orders ADD COLUMN signature_date timestamptz;
  END IF;
END $$;