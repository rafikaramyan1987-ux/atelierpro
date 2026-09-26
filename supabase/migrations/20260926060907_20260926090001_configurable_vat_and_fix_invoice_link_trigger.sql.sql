-- 1. Add vat_rate and vat_liable columns to garages
ALTER TABLE garages ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) NOT NULL DEFAULT 8.10;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS vat_liable boolean NOT NULL DEFAULT true;

-- 2. Add vat_rate and vat_liable to the protect_garage_finance_columns trigger
CREATE OR REPLACE FUNCTION public.protect_garage_finance_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_super_admin() THEN
    IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
      RAISE EXCEPTION 'Seul un super administrateur peut modifier subscription_status';
    END IF;
    IF NEW.commission_rate IS DISTINCT FROM OLD.commission_rate THEN
      RAISE EXCEPTION 'Seul un super administrateur peut modifier commission_rate';
    END IF;
    IF NEW.vat_rate IS DISTINCT FROM OLD.vat_rate THEN
      RAISE EXCEPTION 'Seul un super administrateur peut modifier vat_rate';
    END IF;
    IF NEW.vat_liable IS DISTINCT FROM OLD.vat_liable THEN
      RAISE EXCEPTION 'Seul un super administrateur peut modifier vat_liable';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Fix protect_repair_order_invoice_link: allow ON DELETE SET NULL transition
CREATE OR REPLACE FUNCTION public.protect_repair_order_invoice_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND public.current_user_role() IS DISTINCT FROM 'super_admin' THEN
    IF OLD.invoice_id IS NOT NULL AND NEW.invoice_id IS NOT NULL AND NEW.invoice_id IS DISTINCT FROM OLD.invoice_id THEN
      RAISE EXCEPTION 'This repair order is already invoiced';
    END IF;
    IF OLD.status = 'facture' AND NEW.status <> 'facture' THEN
      RAISE EXCEPTION 'This repair order is already invoiced';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;