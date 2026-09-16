-- Add "Numéro de réception par type" (Typengenehmigung) column to vehicles
-- This is field #24 on the Swiss permis de circulation / carte grise
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'type_approval_number'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN type_approval_number text;
  END IF;
END $$;
