-- Prevent double invoicing of the same work

-- 1. Data cleanup: for duplicated service_request_id, keep oldest, NULL the rest
WITH duplicates AS (
  SELECT id, service_request_id, created_at,
    ROW_NUMBER() OVER (PARTITION BY service_request_id ORDER BY created_at) AS rn
  FROM repair_orders
  WHERE service_request_id IS NOT NULL
)
UPDATE repair_orders ro
SET service_request_id = NULL
FROM duplicates d
WHERE ro.id = d.id AND d.rn > 1;

-- 2. Data cleanup: for duplicated invoice_id, keep oldest, NULL the rest
WITH duplicates AS (
  SELECT id, invoice_id, created_at,
    ROW_NUMBER() OVER (PARTITION BY invoice_id ORDER BY created_at) AS rn
  FROM repair_orders
  WHERE invoice_id IS NOT NULL
)
UPDATE repair_orders ro
SET invoice_id = NULL
FROM duplicates d
WHERE ro.id = d.id AND d.rn > 1;

-- 3. Partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS repair_orders_service_request_unique
  ON repair_orders (service_request_id)
  WHERE service_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS repair_orders_invoice_unique
  ON repair_orders (invoice_id)
  WHERE invoice_id IS NOT NULL;

-- 4. Trigger function to protect repair order invoice link
CREATE OR REPLACE FUNCTION public.protect_repair_order_invoice_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND public.current_user_role() IS DISTINCT FROM 'super_admin' THEN
    IF OLD.invoice_id IS NOT NULL AND NEW.invoice_id IS DISTINCT FROM OLD.invoice_id THEN
      RAISE EXCEPTION 'This repair order is already invoiced';
    END IF;
    IF OLD.status = 'facture' AND NEW.status <> 'facture' THEN
      RAISE EXCEPTION 'This repair order is already invoiced';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_repair_order_invoice_link ON repair_orders;
CREATE TRIGGER protect_repair_order_invoice_link
  BEFORE UPDATE ON repair_orders
  FOR EACH ROW EXECUTE FUNCTION public.protect_repair_order_invoice_link();