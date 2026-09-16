-- Add commission_rate to garages (default 10%)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'garages' AND column_name = 'commission_rate'
  ) THEN
    ALTER TABLE garages ADD COLUMN commission_rate numeric(5,2) NOT NULL DEFAULT 10.00;
  END IF;
END $$;

-- Add commission_amount to invoices
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'commission_amount'
  ) THEN
    ALTER TABLE invoices ADD COLUMN commission_amount numeric(10,2);
  END IF;
END $$;

-- Add commission_amount to twint_payments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'twint_payments' AND column_name = 'commission_amount'
  ) THEN
    ALTER TABLE twint_payments ADD COLUMN commission_amount numeric(10,2);
  END IF;
END $$;