-- =============================================================
-- 1) garages_public view + restrict garages table SELECT
-- =============================================================

CREATE OR REPLACE VIEW public.garages_public
WITH (security_invoker = off) AS
SELECT
  id,
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
  is_published
FROM public.garages
WHERE is_published = true AND subscription_status <> 'suspended';

GRANT SELECT ON public.garages_public TO anon, authenticated;

-- Replace public_select_garages: only authenticated staff of the garage or super_admin
DROP POLICY IF EXISTS "public_select_garages" ON garages;
CREATE POLICY "staff_select_own_garages" ON garages FOR SELECT
  TO authenticated
  USING (id = current_user_garage_id() OR is_super_admin());

-- =============================================================
-- 2) Only admin may UPDATE garages; protect sensitive columns
-- =============================================================

DROP POLICY IF EXISTS "admin_update_own_garage" ON garages;
CREATE POLICY "admin_update_own_garage" ON garages FOR UPDATE
  TO authenticated
  USING (id = current_user_garage_id() AND current_user_role() = 'admin')
  WITH CHECK (id = current_user_garage_id() AND current_user_role() = 'admin');

-- Trigger: block subscription_status / commission_rate changes by non-super-admin
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

DROP TRIGGER IF EXISTS trg_protect_garage_finance ON garages;
CREATE TRIGGER trg_protect_garage_finance
  BEFORE UPDATE ON garages
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_garage_finance_columns();

-- =============================================================
-- 3) Close cross-garage client takeover on INSERT
-- =============================================================

-- appointments
DROP POLICY IF EXISTS "staff_insert_appointments" ON appointments;
CREATE POLICY "staff_insert_appointments" ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    garage_id = current_user_garage_id()
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = appointments.client_id
      AND (c.garage_id = current_user_garage_id() OR garage_has_client(c.id))
    )
  );

-- service_requests
DROP POLICY IF EXISTS "staff_insert_service_requests" ON service_requests;
CREATE POLICY "staff_insert_service_requests" ON service_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    garage_id = current_user_garage_id()
    AND (
      client_id IS NULL
      OR EXISTS (
        SELECT 1 FROM clients c
        WHERE c.id = service_requests.client_id
        AND (c.garage_id = current_user_garage_id() OR garage_has_client(c.id))
      )
    )
  );

-- invoices
DROP POLICY IF EXISTS "staff_insert_invoices" ON invoices;
CREATE POLICY "staff_insert_invoices" ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    garage_id = current_user_garage_id()
    AND current_user_role() IN ('admin', 'secretaire')
    AND (
      client_id IS NULL
      OR EXISTS (
        SELECT 1 FROM clients c
        WHERE c.id = invoices.client_id
        AND (c.garage_id = current_user_garage_id() OR garage_has_client(c.id))
      )
    )
  );

-- repair_orders
DROP POLICY IF EXISTS "staff_insert_repair_orders" ON repair_orders;
CREATE POLICY "staff_insert_repair_orders" ON repair_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    garage_id = current_user_garage_id()
    AND (
      client_id IS NULL
      OR EXISTS (
        SELECT 1 FROM clients c
        WHERE c.id = repair_orders.client_id
        AND (c.garage_id = current_user_garage_id() OR garage_has_client(c.id))
      )
    )
  );

-- vehicles
DROP POLICY IF EXISTS "staff_insert_vehicles" ON vehicles;
CREATE POLICY "staff_insert_vehicles" ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    garage_id = current_user_garage_id()
    AND (
      client_id IS NULL
      OR EXISTS (
        SELECT 1 FROM clients c
        WHERE c.id = vehicles.client_id
        AND (c.garage_id = current_user_garage_id() OR garage_has_client(c.id))
      )
    )
  );

-- =============================================================
-- 4) Restrict finance to admin and secretaire
-- =============================================================

-- invoices UPDATE/DELETE
DROP POLICY IF EXISTS "staff_update_invoices" ON invoices;
CREATE POLICY "staff_update_invoices" ON invoices FOR UPDATE
  TO authenticated
  USING (garage_id = current_user_garage_id() AND current_user_role() IN ('admin', 'secretaire'))
  WITH CHECK (garage_id = current_user_garage_id() AND current_user_role() IN ('admin', 'secretaire'));

DROP POLICY IF EXISTS "staff_delete_invoices" ON invoices;
CREATE POLICY "staff_delete_invoices" ON invoices FOR DELETE
  TO authenticated
  USING (garage_id = current_user_garage_id() AND current_user_role() IN ('admin', 'secretaire'));

-- invoice_items INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "staff_insert_invoice_items" ON invoice_items;
CREATE POLICY "staff_insert_invoice_items" ON invoice_items FOR INSERT
  TO authenticated
  WITH CHECK (garage_id = current_user_garage_id() AND current_user_role() IN ('admin', 'secretaire'));

DROP POLICY IF EXISTS "staff_update_invoice_items" ON invoice_items;
CREATE POLICY "staff_update_invoice_items" ON invoice_items FOR UPDATE
  TO authenticated
  USING (garage_id = current_user_garage_id() AND current_user_role() IN ('admin', 'secretaire'))
  WITH CHECK (garage_id = current_user_garage_id() AND current_user_role() IN ('admin', 'secretaire'));

DROP POLICY IF EXISTS "staff_delete_invoice_items" ON invoice_items;
CREATE POLICY "staff_delete_invoice_items" ON invoice_items FOR DELETE
  TO authenticated
  USING (garage_id = current_user_garage_id() AND current_user_role() IN ('admin', 'secretaire'));

-- twint_payments INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "staff_insert_twint_payments" ON twint_payments;
CREATE POLICY "staff_insert_twint_payments" ON twint_payments FOR INSERT
  TO authenticated
  WITH CHECK (garage_id = current_user_garage_id() AND current_user_role() IN ('admin', 'secretaire'));

DROP POLICY IF EXISTS "staff_update_twint_payments" ON twint_payments;
CREATE POLICY "staff_update_twint_payments" ON twint_payments FOR UPDATE
  TO authenticated
  USING (garage_id = current_user_garage_id() AND current_user_role() IN ('admin', 'secretaire'))
  WITH CHECK (garage_id = current_user_garage_id() AND current_user_role() IN ('admin', 'secretaire'));

DROP POLICY IF EXISTS "staff_delete_twint_payments" ON twint_payments;
CREATE POLICY "staff_delete_twint_payments" ON twint_payments FOR DELETE
  TO authenticated
  USING (garage_id = current_user_garage_id() AND current_user_role() IN ('admin', 'secretaire'));

-- =============================================================
-- 5) Add updated_at to invoices for client_declare_payment
-- =============================================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- =============================================================
-- 6) Stop fake reviews: require completed appointment
-- =============================================================

DROP POLICY IF EXISTS "client_insert_garage_reviews" ON garage_reviews;
CREATE POLICY "client_insert_garage_reviews" ON garage_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    appointment_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = garage_reviews.appointment_id
        AND a.client_id = current_user_client_id()
        AND a.garage_id = garage_reviews.garage_id
        AND a.status = 'termine'
    )
  );

-- =============================================================
-- 7) Put missing objects in version control
-- =============================================================

CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recipient text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

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
    );
  END IF;

  RETURN false;
END;
$function$;
