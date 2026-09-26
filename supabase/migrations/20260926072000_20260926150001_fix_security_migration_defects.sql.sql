-- 1. Fix protect_devis_items_after_acceptance: proper TG_OP branching + is_super_admin()
CREATE OR REPLACE FUNCTION public.protect_devis_items_after_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_sr_status text;
  v_devis_id uuid;
  v_is_super_admin boolean;
BEGIN
  v_is_super_admin := public.is_super_admin();
  IF v_is_super_admin THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_devis_id := NEW.devis_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_devis_id := COALESCE(NEW.devis_id, OLD.devis_id);
  ELSIF TG_OP = 'DELETE' THEN
    v_devis_id := OLD.devis_id;
  END IF;

  SELECT status INTO v_sr_status
  FROM service_requests sr
  WHERE sr.id = v_devis_id;

  IF v_sr_status IN ('devis_accepte','devis_refuse') THEN
    RAISE EXCEPTION 'This quote has already been answered by the client';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Fix generate_invoice_number: use is_super_admin()
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_garage_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_year int;
  v_next int;
  v_is_super_admin boolean;
BEGIN
  v_is_super_admin := public.is_super_admin();
  IF NOT v_is_super_admin AND p_garage_id IS DISTINCT FROM public.current_user_garage_id() THEN
    RAISE EXCEPTION 'Cannot generate invoice number for another garage';
  END IF;
  v_year := EXTRACT(YEAR FROM now())::int;
  PERFORM pg_advisory_xact_lock(hashtext(p_garage_id::text || v_year::text));
  INSERT INTO invoice_counters (garage_id, year, last_number)
  VALUES (p_garage_id, v_year, 1)
  ON CONFLICT (garage_id, year)
  DO UPDATE SET last_number = invoice_counters.last_number + 1
  RETURNING last_number INTO v_next;
  RETURN 'FAC-' || v_year || '-' || lpad(v_next::text, 4, '0');
END;
$function$;

-- 3. Fix generate_devis_number: use is_super_admin()
CREATE OR REPLACE FUNCTION public.generate_devis_number(p_garage_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_year int;
  v_next int;
  v_is_super_admin boolean;
BEGIN
  v_is_super_admin := public.is_super_admin();
  IF NOT v_is_super_admin AND p_garage_id IS DISTINCT FROM public.current_user_garage_id() THEN
    RAISE EXCEPTION 'Cannot generate devis number for another garage';
  END IF;
  v_year := EXTRACT(YEAR FROM now())::int;
  PERFORM pg_advisory_xact_lock(hashtext(p_garage_id::text || v_year::text));
  INSERT INTO devis_counters (garage_id, year, last_number)
  VALUES (p_garage_id, v_year, 1)
  ON CONFLICT (garage_id, year)
  DO UPDATE SET last_number = devis_counters.last_number + 1
  RETURNING last_number INTO v_next;
  RETURN 'DEV-' || v_year || '-' || lpad(v_next::text, 4, '0');
END;
$function$;

-- 4. Recreate garage_reviews_public with garage visibility filter
CREATE OR REPLACE VIEW public.garage_reviews_public AS
SELECT gr.id, gr.garage_id, gr.rating, gr.comment, gr.reviewer_name, gr.created_at
FROM public.garage_reviews gr
JOIN public.garages g ON g.id = gr.garage_id
WHERE g.is_published = true AND g.subscription_status <> 'suspended';
ALTER VIEW public.garage_reviews_public SET (security_invoker = off);
GRANT SELECT ON public.garage_reviews_public TO anon, authenticated;