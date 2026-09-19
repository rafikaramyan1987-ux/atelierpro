/*
# Client portal RLS rewrite + SECURITY DEFINER functions + trigger hardening

## Summary
Rewrites all client-facing RLS policies to use new helper functions
(current_user_client_id, garage_has_client) preventing RLS recursion.
Adds SECURITY DEFINER functions for client actions (respond to devis,
cancel appointment, declare payment). Adds register_client function.
Hardens the privilege trigger with last-admin protection, active=false
checks, and app.registering_client flag. Adds paiement_declare invoice
status. Drops anon insert policies on clients and vehicles.

## New Functions
- current_user_client_id(): returns clients.id for auth.uid(), or NULL
- garage_has_client(p_client_id): true if caller's garage has rows
  with that client in appointments, service_requests, invoices, repair_orders
- register_client(...): creates clients row + optional vehicle, sets
  profile to role=client, client_id. Uses app.registering_client flag.
- client_respond_devis(p_request_id, p_accept, p_signature): accepts
  or refuses a devis when status is devis_recu and not expired.
- client_cancel_appointment(p_appointment_id): cancels when en_attente
  or confirme.
- client_declare_payment(p_invoice_id, p_method): declares payment when
  status is envoyee or en_retard. Sets paiement_declare, never payee.

## Modified Functions
- current_user_garage_id(): returns NULL when profile.active = false
- current_user_role(): returns NULL when profile.active = false
- prevent_profile_privilege_escalation(): rewritten with last-admin
  protection, active=false blocking, app.registering_client flag,
  restricted self-update fields, removed mecanicien→client exception

## Policy Changes
- clients: drop anon_insert, rewrite staff SELECT/UPDATE with garage_has_client
- vehicles: drop anon_insert, add client CRUD, staff SELECT with garage_has_client
- appointments: client SELECT own, client INSERT own with garage_id NOT NULL,
  drop client UPDATE (use client_cancel_appointment RPC)
- service_requests: client SELECT own, client INSERT own with garage_id NOT NULL,
  drop client UPDATE (use client_respond_devis RPC)
- invoices: drop client UPDATE (use client_declare_payment RPC)

## Schema Changes
- invoices status constraint: add 'paiement_declare'
*/

-- ═══════════════════════════════════════════════════════════════
-- A. Helper functions
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.current_user_client_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_client_id uuid;
BEGIN
  SELECT id INTO v_client_id FROM clients WHERE auth_user_id = auth.uid() LIMIT 1;
  RETURN v_client_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.garage_has_client(p_client_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_garage_id uuid;
BEGIN
  v_garage_id := public.current_user_garage_id();
  IF v_garage_id IS NULL THEN
    RETURN false;
  END IF;
  PERFORM 1 FROM appointments WHERE garage_id = v_garage_id AND client_id = p_client_id LIMIT 1;
  IF FOUND THEN RETURN true; END IF;
  PERFORM 1 FROM service_requests WHERE garage_id = v_garage_id AND client_id = p_client_id LIMIT 1;
  IF FOUND THEN RETURN true; END IF;
  PERFORM 1 FROM invoices WHERE garage_id = v_garage_id AND client_id = p_client_id LIMIT 1;
  IF FOUND THEN RETURN true; END IF;
  PERFORM 1 FROM repair_orders WHERE garage_id = v_garage_id AND client_id = p_client_id LIMIT 1;
  IF FOUND THEN RETURN true; END IF;
  RETURN false;
END;
$function$;

-- Modify current_user_garage_id and current_user_role to return NULL when active = false
CREATE OR REPLACE FUNCTION public.current_user_garage_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_rec record;
BEGIN
  SELECT garage_id, active INTO v_rec FROM profiles WHERE id = auth.uid() LIMIT 1;
  IF NOT FOUND OR v_rec.active = false THEN
    RETURN NULL;
  END IF;
  RETURN v_rec.garage_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_rec record;
BEGIN
  SELECT role, active INTO v_rec FROM profiles WHERE id = auth.uid() LIMIT 1;
  IF NOT FOUND OR v_rec.active = false THEN
    RETURN NULL;
  END IF;
  RETURN v_rec.role;
END;
$function$;

-- ═══════════════════════════════════════════════════════════════
-- B. Client policies
-- ═══════════════════════════════════════════════════════════════

-- CLIENTS: drop anon insert, rewrite staff SELECT/UPDATE with garage_has_client
DROP POLICY IF EXISTS "anon_insert_clients_registration" ON clients;
DROP POLICY IF EXISTS "client_select_own" ON clients;
DROP POLICY IF EXISTS "staff_select_clients" ON clients;
DROP POLICY IF EXISTS "staff_update_clients" ON clients;

CREATE POLICY "client_select_own" ON clients FOR SELECT
  TO authenticated USING (auth_user_id = auth.uid());

CREATE POLICY "staff_select_clients" ON clients FOR SELECT
  TO authenticated USING (
    garage_id = current_user_garage_id() OR garage_has_client(id)
  );

CREATE POLICY "staff_update_clients" ON clients FOR UPDATE
  TO authenticated
  USING (garage_id = current_user_garage_id() OR garage_has_client(id))
  WITH CHECK (garage_id = current_user_garage_id() OR garage_has_client(id));

-- VEHICLES: drop anon insert, add client CRUD, staff SELECT with garage_has_client
DROP POLICY IF EXISTS "anon_insert_vehicles_registration" ON vehicles;
DROP POLICY IF EXISTS "client_select_own_vehicles" ON vehicles;
DROP POLICY IF EXISTS "staff_select_vehicles" ON vehicles;
DROP POLICY IF EXISTS "staff_insert_vehicles" ON vehicles;
DROP POLICY IF EXISTS "staff_update_vehicles" ON vehicles;
DROP POLICY IF EXISTS "staff_delete_vehicles" ON vehicles;

CREATE POLICY "client_select_own_vehicles" ON vehicles FOR SELECT
  TO authenticated USING (client_id = current_user_client_id());

CREATE POLICY "client_insert_own_vehicles" ON vehicles FOR INSERT
  TO authenticated WITH CHECK (client_id = current_user_client_id());

CREATE POLICY "client_update_own_vehicles" ON vehicles FOR UPDATE
  TO authenticated
  USING (client_id = current_user_client_id())
  WITH CHECK (client_id = current_user_client_id());

CREATE POLICY "client_delete_own_vehicles" ON vehicles FOR DELETE
  TO authenticated USING (client_id = current_user_client_id());

CREATE POLICY "staff_select_vehicles" ON vehicles FOR SELECT
  TO authenticated USING (
    garage_id = current_user_garage_id() OR garage_has_client(client_id)
  );

CREATE POLICY "staff_insert_vehicles" ON vehicles FOR INSERT
  TO authenticated WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_update_vehicles" ON vehicles FOR UPDATE
  TO authenticated
  USING (garage_id = current_user_garage_id())
  WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_delete_vehicles" ON vehicles FOR DELETE
  TO authenticated USING (garage_id = current_user_garage_id());

-- APPOINTMENTS: client SELECT own, client INSERT own with garage_id NOT NULL,
-- drop client UPDATE (use client_cancel_appointment RPC)
DROP POLICY IF EXISTS "client_select_own_appointments" ON appointments;
DROP POLICY IF EXISTS "client_insert_appointments" ON appointments;
DROP POLICY IF EXISTS "client_update_own_appointments" ON appointments;

CREATE POLICY "client_select_own_appointments" ON appointments FOR SELECT
  TO authenticated USING (client_id = current_user_client_id());

CREATE POLICY "client_insert_appointments" ON appointments FOR INSERT
  TO authenticated WITH CHECK (
    client_id = current_user_client_id()
    AND garage_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM garages WHERE id = appointments.garage_id)
  );

-- SERVICE_REQUESTS: client SELECT own, client INSERT own with garage_id NOT NULL,
-- drop client UPDATE (use client_respond_devis RPC)
DROP POLICY IF EXISTS "client_select_own_service_requests" ON service_requests;
DROP POLICY IF EXISTS "client_insert_service_requests" ON service_requests;

CREATE POLICY "client_select_own_service_requests" ON service_requests FOR SELECT
  TO authenticated USING (client_id = current_user_client_id());

CREATE POLICY "client_insert_service_requests" ON service_requests FOR INSERT
  TO authenticated WITH CHECK (
    client_id = current_user_client_id()
    AND garage_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM garages WHERE id = service_requests.garage_id)
  );

-- INVOICES: drop client UPDATE (use client_declare_payment RPC)
-- Client SELECT already exists and is fine
-- No client UPDATE policy at all

-- ═══════════════════════════════════════════════════════════════
-- C. Client action functions (SECURITY DEFINER)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.client_respond_devis(
  p_request_id uuid,
  p_accept boolean,
  p_signature text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_client_id uuid;
  v_request record;
BEGIN
  v_client_id := public.current_user_client_id();
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Client record not found';
  END IF;

  SELECT * INTO v_request FROM service_requests WHERE id = p_request_id AND client_id = v_client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not yours';
  END IF;

  IF v_request.status IS DISTINCT FROM 'devis_recu' THEN
    RAISE EXCEPTION 'Devis is not in receivable state';
  END IF;

  IF v_request.expiry_date IS NOT NULL AND v_request.expiry_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Devis has expired';
  END IF;

  IF p_accept THEN
    UPDATE service_requests
    SET status = 'devis_accepte',
        signature_data = p_signature,
        signature_date = CASE WHEN p_signature IS NOT NULL THEN now() ELSE signature_date END,
        updated_at = now()
    WHERE id = p_request_id;
  ELSE
    UPDATE service_requests
    SET status = 'devis_refuse',
        updated_at = now()
    WHERE id = p_request_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.client_cancel_appointment(
  p_appointment_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_client_id uuid;
  v_appt record;
BEGIN
  v_client_id := public.current_user_client_id();
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Client record not found';
  END IF;

  SELECT status INTO v_appt FROM appointments WHERE id = p_appointment_id AND client_id = v_client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found or not yours';
  END IF;

  IF v_appt.status NOT IN ('en_attente', 'confirme') THEN
    RAISE EXCEPTION 'Cannot cancel appointment in current state';
  END IF;

  UPDATE appointments SET status = 'annule', updated_at = now() WHERE id = p_appointment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.client_declare_payment(
  p_invoice_id uuid,
  p_method text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_client_id uuid;
  v_inv record;
BEGIN
  v_client_id := public.current_user_client_id();
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Client record not found';
  END IF;

  SELECT status INTO v_inv FROM invoices WHERE id = p_invoice_id AND client_id = v_client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found or not yours';
  END IF;

  IF v_inv.status NOT IN ('envoyee', 'en_retard') THEN
    RAISE EXCEPTION 'Cannot declare payment for invoice in current state';
  END IF;

  UPDATE invoices
  SET status = 'paiement_declare',
      payment_method = p_method,
      updated_at = now()
  WHERE id = p_invoice_id;
END;
$function$;

-- ═══════════════════════════════════════════════════════════════
-- D. Invoice status constraint: add paiement_declare
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('brouillon', 'envoyee', 'payee', 'en_retard', 'en_attente_validation', 'paiement_declare'));

-- ═══════════════════════════════════════════════════════════════
-- E. register_client function
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.register_client(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_brand text DEFAULT NULL,
  p_model text DEFAULT NULL,
  p_plate text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid;
  v_client_id uuid;
  v_existing_client_id uuid;
  v_profile_garage_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Refuse if caller already has a client record or has a garage_id
  SELECT id INTO v_existing_client_id FROM clients WHERE auth_user_id = v_user_id LIMIT 1;
  IF v_existing_client_id IS NOT NULL THEN
    RAISE EXCEPTION 'You already have a client record';
  END IF;

  SELECT garage_id INTO v_profile_garage_id FROM profiles WHERE id = v_user_id;
  IF v_profile_garage_id IS NOT NULL THEN
    RAISE EXCEPTION 'Garage staff cannot register as clients';
  END IF;

  INSERT INTO clients (first_name, last_name, phone, auth_user_id, garage_id)
  VALUES (p_first_name, p_last_name, p_phone, v_user_id, NULL)
  RETURNING id INTO v_client_id;

  IF p_brand IS NOT NULL AND p_model IS NOT NULL AND p_plate IS NOT NULL THEN
    INSERT INTO vehicles (client_id, brand, model, license_plate, garage_id)
    VALUES (v_client_id, p_brand, p_model, p_plate, NULL);
  END IF;

  PERFORM set_config('app.registering_client', 'true', true);

  UPDATE profiles
  SET role = 'client', client_id = v_client_id
  WHERE id = v_user_id;

  RETURN v_client_id;
END;
$function$;

-- ═══════════════════════════════════════════════════════════════
-- F. Privilege trigger rewrite
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller_role text;
  v_caller_garage_id uuid;
  v_admin_count int;
BEGIN
  -- Server-side operations (no authenticated user) bypass all checks
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- INSERT: block super_admin assignment by non-super-admin
  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'super_admin' THEN
      SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
      IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION 'Cannot assign super_admin role';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  SELECT role, garage_id INTO v_caller_role, v_caller_garage_id
  FROM profiles WHERE id = auth.uid();

  -- Last admin protection: before any bypass, if OLD.role = 'admin'
  -- and the update removes admin rights, check another active admin exists
  IF OLD.role = 'admin' AND OLD.garage_id IS NOT NULL THEN
    IF (NEW.role IS DISTINCT FROM 'admin')
       OR (NEW.active = false)
       OR (NEW.garage_id IS DISTINCT FROM OLD.garage_id) THEN
      SELECT COUNT(*) INTO v_admin_count
      FROM profiles
      WHERE garage_id = OLD.garage_id
        AND role = 'admin'
        AND active = true
        AND id <> OLD.id;
      IF v_admin_count = 0 THEN
        RAISE EXCEPTION 'Cannot remove the last admin of this garage';
      END IF;
    END IF;
  END IF;

  -- Block any attempt to set role to super_admin via UPDATE
  IF NEW.role = 'super_admin' AND OLD.role IS DISTINCT FROM 'super_admin' THEN
    IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
      RAISE EXCEPTION 'Cannot escalate to super_admin role';
    END IF;
  END IF;

  -- Block removing super_admin
  IF OLD.role = 'super_admin' AND NEW.role IS DISTINCT FROM 'super_admin' THEN
    IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
      RAISE EXCEPTION 'Cannot demote super_admin';
    END IF;
  END IF;

  -- super_admin caller: allowed
  IF v_caller_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  -- Admin changing a user in their own garage
  IF v_caller_role = 'admin' AND v_caller_garage_id IS NOT NULL THEN
    IF NEW.garage_id IS DISTINCT FROM v_caller_garage_id THEN
      RAISE EXCEPTION 'Admin can only modify users in own garage';
    END IF;
    IF NEW.role NOT IN ('admin', 'mecanicien', 'secretaire') THEN
      RAISE EXCEPTION 'Admin can only set roles to admin, mecanicien or secretaire';
    END IF;
    RETURN NEW;
  END IF;

  -- Self-update (NEW.id = auth.uid())
  IF NEW.id = auth.uid() THEN
    -- Allow create_garage_as_admin flow
    IF current_setting('app.creating_garage', true) = 'true'
       AND OLD.garage_id IS NULL AND NEW.garage_id IS NOT NULL
       AND NEW.role = 'admin' AND OLD.role IS DISTINCT FROM 'admin' THEN
      RETURN NEW;
    END IF;

    -- Allow register_client flow
    IF current_setting('app.registering_client', true) = 'true'
       AND OLD.role IS DISTINCT FROM 'client' AND NEW.role = 'client'
       AND NEW.garage_id IS NULL AND OLD.garage_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Block role change
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'You cannot change your own role';
    END IF;

    -- Block garage_id change
    IF NEW.garage_id IS DISTINCT FROM OLD.garage_id THEN
      RAISE EXCEPTION 'You cannot change your own garage_id';
    END IF;

    -- Block active change
    IF NEW.active IS DISTINCT FROM OLD.active THEN
      RAISE EXCEPTION 'You cannot change your own active status';
    END IF;

    -- Block client_id change
    IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
      RAISE EXCEPTION 'You cannot change your own client_id';
    END IF;

    -- Block email change
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'You cannot change your own email';
    END IF;

    -- must_change_password: only allow true → false
    IF NEW.must_change_password = true AND OLD.must_change_password = false THEN
      RAISE EXCEPTION 'You cannot set must_change_password to true on yourself';
    END IF;

    RETURN NEW;
  END IF;

  -- Any other update: denied
  RAISE EXCEPTION 'Not authorized to modify this profile';
END;
$function$;

-- ═══════════════════════════════════════════════════════════════
-- Grant execute on new functions
-- ═══════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION public.current_user_client_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.garage_has_client(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_respond_devis(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_cancel_appointment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_declare_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_client(text, text, text, text, text, text) TO authenticated;
