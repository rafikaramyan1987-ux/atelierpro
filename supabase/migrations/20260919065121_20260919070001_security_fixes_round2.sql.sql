-- ═══════════════════════════════════════════════════════════════
-- Fix 2: BEFORE UPDATE trigger on clients to block auth_user_id/garage_id changes
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.prevent_client_hijack()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Server-side operations (no authenticated user) bypass
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Block auth_user_id changes
  IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
    RAISE EXCEPTION 'Cannot change auth_user_id on clients';
  END IF;

  -- Block garage_id changes
  IF NEW.garage_id IS DISTINCT FROM OLD.garage_id THEN
    RAISE EXCEPTION 'Cannot change garage_id on clients';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_client_hijack ON clients;
CREATE TRIGGER prevent_client_hijack
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION public.prevent_client_hijack();

-- ═══════════════════════════════════════════════════════════════
-- Fix 4: register_client stores email from auth.users in clients.email
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
  v_email text;
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

  -- Get email from auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO clients (first_name, last_name, email, phone, auth_user_id, garage_id)
  VALUES (p_first_name, p_last_name, v_email, p_phone, v_user_id, NULL)
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
-- Fix 5: Hardcode status and garage_id in client insert policies
-- ═══════════════════════════════════════════════════════════════

-- Appointments: force status = 'en_attente'
DROP POLICY IF EXISTS "client_insert_appointments" ON appointments;
CREATE POLICY "client_insert_appointments" ON appointments FOR INSERT
  TO authenticated WITH CHECK (
    client_id = current_user_client_id()
    AND garage_id IS NOT NULL
    AND status = 'en_attente'
    AND EXISTS (SELECT 1 FROM garages WHERE id = appointments.garage_id)
  );

-- Service requests: force status = 'en_attente'
DROP POLICY IF EXISTS "client_insert_service_requests" ON service_requests;
CREATE POLICY "client_insert_service_requests" ON service_requests FOR INSERT
  TO authenticated WITH CHECK (
    client_id = current_user_client_id()
    AND garage_id IS NOT NULL
    AND status = 'en_attente'
    AND EXISTS (SELECT 1 FROM garages WHERE id = service_requests.garage_id)
  );

-- Vehicles: client inserts/updates must have garage_id IS NULL
DROP POLICY IF EXISTS "client_insert_own_vehicles" ON vehicles;
CREATE POLICY "client_insert_own_vehicles" ON vehicles FOR INSERT
  TO authenticated WITH CHECK (
    client_id = current_user_client_id()
    AND garage_id IS NULL
  );

DROP POLICY IF EXISTS "client_update_own_vehicles" ON vehicles;
CREATE POLICY "client_update_own_vehicles" ON vehicles FOR UPDATE
  TO authenticated
  USING (client_id = current_user_client_id())
  WITH CHECK (client_id = current_user_client_id() AND garage_id IS NULL);

-- ═══════════════════════════════════════════════════════════════
-- Fix 6a: Use current_user_role() in trigger instead of reading profiles.role
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
      v_caller_role := public.current_user_role();
      IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION 'Cannot assign super_admin role';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: use current_user_role() so deactivated admins can't use admin branch
  v_caller_role := public.current_user_role();
  SELECT garage_id INTO v_caller_garage_id FROM profiles WHERE id = auth.uid();

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
-- Fix 6b: staff_update_vehicles also allows garage_has_client
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "staff_update_vehicles" ON vehicles;
CREATE POLICY "staff_update_vehicles" ON vehicles FOR UPDATE
  TO authenticated
  USING (
    garage_id = current_user_garage_id() OR garage_has_client(client_id)
  )
  WITH CHECK (
    garage_id = current_user_garage_id() OR garage_has_client(client_id)
  );

-- ═══════════════════════════════════════════════════════════════
-- Fix 6c: BEFORE UPDATE trigger on vehicles to block client_id/garage_id changes
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.prevent_vehicle_hijack()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Server-side operations (no authenticated user) bypass
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Block client_id changes
  IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'Cannot change client_id on vehicles';
  END IF;

  -- Block garage_id changes
  IF NEW.garage_id IS DISTINCT FROM OLD.garage_id THEN
    RAISE EXCEPTION 'Cannot change garage_id on vehicles';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_vehicle_hijack ON vehicles;
CREATE TRIGGER prevent_vehicle_hijack
  BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_vehicle_hijack();

-- Grant execute on new functions
GRANT EXECUTE ON FUNCTION public.prevent_client_hijack() TO authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_vehicle_hijack() TO authenticated;
