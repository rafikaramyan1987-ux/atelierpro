-- 1. Restore protect_garage_finance_columns to original (remove vat_rate/vat_liable checks)
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
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Recreate garages_public view with vat_rate and vat_liable added
CREATE OR REPLACE VIEW public.garages_public
WITH (security_invoker = off) AS
SELECT id,
    name,
    description,
    address,
    city,
    postal_code,
    phone,
    email,
    logo_url,
    services_offered,
    gardiennage_enabled,
    rating,
    review_count,
    is_published,
    vat_rate,
    vat_liable
FROM garages
WHERE is_published = true AND subscription_status <> 'suspended';

-- 3. Re-grant SELECT to anon and authenticated
GRANT SELECT ON public.garages_public TO anon;
GRANT SELECT ON public.garages_public TO authenticated;