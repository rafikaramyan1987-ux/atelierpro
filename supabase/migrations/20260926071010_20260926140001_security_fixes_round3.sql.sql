-- 1. Fix profile-insert hole: drop and recreate insert_profiles_admin
DROP POLICY IF EXISTS insert_profiles_admin ON public.profiles;
CREATE POLICY insert_profiles_admin ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() = 'admin'
    AND garage_id = public.current_user_garage_id()
    AND role IN ('admin','secretaire','mecanicien')
  );

-- 2. Restrict finance reads to admin and secretaire
DROP POLICY IF EXISTS staff_select_invoices ON public.invoices;
CREATE POLICY staff_select_invoices ON public.invoices FOR SELECT
  TO authenticated USING (
    garage_id = public.current_user_garage_id()
    AND public.current_user_role() IN ('admin','secretaire')
  );

DROP POLICY IF EXISTS staff_select_invoice_items ON public.invoice_items;
CREATE POLICY staff_select_invoice_items ON public.invoice_items FOR SELECT
  TO authenticated USING (
    garage_id = public.current_user_garage_id()
    AND public.current_user_role() IN ('admin','secretaire')
  );

DROP POLICY IF EXISTS staff_select_twint_payments ON public.twint_payments;
CREATE POLICY staff_select_twint_payments ON public.twint_payments FOR SELECT
  TO authenticated USING (
    garage_id = public.current_user_garage_id()
    AND public.current_user_role() IN ('admin','secretaire')
  );

-- 3. Restrict appointment writes to admin and secretaire
DROP POLICY IF EXISTS staff_insert_appointments ON public.appointments;
CREATE POLICY staff_insert_appointments ON public.appointments FOR INSERT
  TO authenticated WITH CHECK (
    garage_id = public.current_user_garage_id()
    AND public.current_user_role() IN ('admin','secretaire')
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = appointments.client_id
      AND (c.garage_id = public.current_user_garage_id() OR public.garage_has_client(c.id))
    )
  );

DROP POLICY IF EXISTS staff_update_appointments ON public.appointments;
CREATE POLICY staff_update_appointments ON public.appointments FOR UPDATE
  TO authenticated
  USING (
    garage_id = public.current_user_garage_id()
    AND public.current_user_role() IN ('admin','secretaire')
  )
  WITH CHECK (
    garage_id = public.current_user_garage_id()
    AND public.current_user_role() IN ('admin','secretaire')
  );

DROP POLICY IF EXISTS staff_delete_appointments ON public.appointments;
CREATE POLICY staff_delete_appointments ON public.appointments FOR DELETE
  TO authenticated USING (
    garage_id = public.current_user_garage_id()
    AND public.current_user_role() IN ('admin','secretaire')
  );

-- 4. Protect accepted quotes: trigger on devis_items
CREATE OR REPLACE FUNCTION public.protect_devis_items_after_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_sr_status text;
  v_is_super_admin boolean;
BEGIN
  SELECT role INTO v_is_super_admin FROM profiles WHERE id = auth.uid() AND role = 'super_admin';
  IF v_is_super_admin THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT status INTO v_sr_status
  FROM service_requests sr
  WHERE sr.id = NEW.devis_id OR sr.id = OLD.devis_id;

  IF v_sr_status IS NULL THEN
    SELECT status INTO v_sr_status
    FROM service_requests sr
    WHERE sr.id = COALESCE(NEW.devis_id, OLD.devis_id);
  END IF;

  IF v_sr_status IN ('devis_accepte','devis_refuse') THEN
    RAISE EXCEPTION 'This quote has already been answered by the client';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_devis_items ON public.devis_items;
CREATE TRIGGER trg_protect_devis_items
  BEFORE INSERT OR UPDATE OR DELETE ON public.devis_items
  FOR EACH ROW EXECUTE FUNCTION public.protect_devis_items_after_acceptance();

-- 5. Stop cross-garage counter tampering
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
  SELECT role INTO v_is_super_admin FROM profiles WHERE id = auth.uid() AND role = 'super_admin';
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
  SELECT role INTO v_is_super_admin FROM profiles WHERE id = auth.uid() AND role = 'super_admin';
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

-- 6. Scope email relay: restrict client branch to garages with a relationship
CREATE OR REPLACE FUNCTION public.can_email_recipient(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_garage_id uuid;
  v_client_id uuid;
BEGIN
  v_role := public.current_user_role();
  v_garage_id := public.current_user_garage_id();
  v_client_id := public.current_user_client_id();

  IF v_role IN ('admin', 'secretaire', 'mecanicien') AND v_garage_id IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM clients c
      WHERE lower(c.email) = lower(p_email)
      AND public.garage_has_client(c.id)
    );
  ELSIF v_client_id IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM garages g
      WHERE lower(g.email) = lower(p_email)
      AND (
        EXISTS (SELECT 1 FROM appointments a WHERE a.garage_id = g.id AND a.client_id = v_client_id)
        OR EXISTS (SELECT 1 FROM service_requests sr WHERE sr.garage_id = g.id AND sr.client_id = v_client_id)
        OR EXISTS (SELECT 1 FROM invoices i WHERE i.garage_id = g.id AND i.client_id = v_client_id)
        OR EXISTS (SELECT 1 FROM vehicles v WHERE v.garage_id = g.id AND v.client_id = v_client_id)
      )
    );
  END IF;

  RETURN false;
END;
$function$;

-- 7. Stop exposing client identifiers in reviews
-- Drop the public SELECT(true) policy on garage_reviews
DROP POLICY IF EXISTS public_select_garage_reviews ON public.garage_reviews;

-- Create a public view exposing only safe columns
CREATE OR REPLACE VIEW public.garage_reviews_public AS
SELECT id, garage_id, rating, comment, reviewer_name, created_at
FROM public.garage_reviews;
ALTER VIEW public.garage_reviews_public SET (security_invoker = off);
GRANT SELECT ON public.garage_reviews_public TO anon, authenticated;

-- Add policy for clients to read their own reviews on the table
CREATE POLICY client_select_own_garage_reviews ON public.garage_reviews FOR SELECT
  TO authenticated USING (
    client_id = public.current_user_client_id()
  );

-- 8. Add SET search_path = public to 5 SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.set_garage_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.garage_id IS NULL THEN
    NEW.garage_id := current_user_garage_id();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_mechanic_issue_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller_role TEXT;
BEGIN
  IF NEW.status = 'envoyee' AND OLD.status != 'envoyee' THEN
    SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
    IF v_caller_role = 'mecanicien' THEN
      RAISE EXCEPTION 'Mechanics cannot issue invoices directly';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_mechanic_send_devis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller_role TEXT;
BEGIN
  IF NEW.status = 'devis_recu' AND OLD.status != 'devis_recu' THEN
    SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
    IF v_caller_role = 'mecanicien' THEN
      RAISE EXCEPTION 'Mechanics cannot send devis directly';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_or_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  next_val bigint;
  year int;
BEGIN
  SELECT nextval('repair_order_seq') INTO next_val;
  SELECT EXTRACT(YEAR FROM now()) INTO year;
  RETURN 'OR-' || year || '-' || lpad(next_val::text, 4, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_devis_expiry_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'devis_recu' AND NEW.expiry_date IS NULL THEN
    NEW.expiry_date = CURRENT_DATE + COALESCE(NEW.valid_until_days, 30);
  END IF;
  RETURN NEW;
END;
$function$;