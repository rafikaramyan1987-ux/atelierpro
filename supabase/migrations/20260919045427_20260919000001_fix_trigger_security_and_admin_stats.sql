/*
 * 1. Rewrite prevent_profile_privilege_escalation:
 *    - service_role bypasses all checks (edge function uses service role)
 *    - super_admin caller: allowed (existing protections kept)
 *    - admin changing role of user in their own garage: allowed, only
 *      admin/mecanicien/secretaire, garage_id must stay same
 *    - self-update: may change name/phone/must_change_password only;
 *      may NOT change role or garage_id, except the signup transition
 *      mecanicien→client while garage_id is NULL
 *    - first-garage creation: only via create_garage_as_admin using
 *      a transaction-local flag app.creating_garage
 *
 * 2. Drop super_admin_read_clients and super_admin_read_invoices policies.
 *    super_admin sees aggregates only via admin_garage_stats().
 *
 * 3. Create admin_garage_stats() SECURITY DEFINER function.
 *
 * 4. Drop old create_employee and reset_employee_password functions.
 *
 * 5. Update create_garage_as_admin to set app.creating_garage flag.
 */

-- ═══════════════════════════════════════════════════════════════
-- 1. Rewrite the trigger function
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
BEGIN
  -- Service role (edge function) bypasses all checks.
  -- The edge function already verifies the caller is an admin of the garage.
  IF auth.role() = 'service_role' THEN
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

  -- super_admin caller: allowed (existing protections above still apply)
  IF v_caller_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  -- Admin changing a user in their own garage:
  --   role must stay within admin/mecanicien/secretaire
  --   garage_id must not change
  IF v_caller_role = 'admin' AND v_caller_garage_id IS NOT NULL THEN
    IF NEW.garage_id IS DISTINCT FROM v_caller_garage_id THEN
      RAISE EXCEPTION 'Admin can only modify users in own garage';
    END IF;
    IF NEW.role NOT IN ('admin', 'mecanicien', 'secretaire') THEN
      RAISE EXCEPTION 'Admin can only set roles to admin, mecanicien or secretaire';
    END IF;
    RETURN NEW;
  END IF;

  -- Self-update (NEW.id = auth.uid()):
  --   May change name, phone, must_change_password.
  --   May NOT change role or garage_id, except the signup transition
  --   mecanicien→client while garage_id is NULL.
  IF NEW.id = auth.uid() THEN
    -- Allow the signup-flow transition: mecanicien → client, garage_id stays NULL
    IF OLD.role = 'mecanicien' AND NEW.role = 'client'
       AND OLD.garage_id IS NULL AND NEW.garage_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Block role change
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'You cannot change your own role';
    END IF;

    -- Block garage_id change unless via create_garage_as_admin flag
    IF NEW.garage_id IS DISTINCT FROM OLD.garage_id THEN
      IF current_setting('app.creating_garage', true) = 'true'
         AND OLD.garage_id IS NULL AND NEW.garage_id IS NOT NULL
         AND NEW.role = 'admin' THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'You cannot change your own garage_id';
    END IF;

    RETURN NEW;
  END IF;

  -- Any other update: denied
  RAISE EXCEPTION 'Not authorized to modify this profile';
END;
$function$;

-- ═══════════════════════════════════════════════════════════════
-- 2. Update create_garage_as_admin to set the transaction flag
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_garage_as_admin(
  p_name TEXT,
  p_address TEXT DEFAULT '',
  p_city TEXT DEFAULT '',
  p_postal_code TEXT DEFAULT '',
  p_phone TEXT DEFAULT '',
  p_email TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_garage_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND garage_id IS NOT NULL) THEN
    RAISE EXCEPTION 'You already have a garage';
  END IF;

  INSERT INTO garages (name, address, city, postal_code, phone, email, services_offered)
  VALUES (p_name, p_address, p_city, p_postal_code, p_phone, p_email, ARRAY[]::TEXT[])
  RETURNING id INTO v_garage_id;

  -- Set transaction-local flag so the trigger allows this transition
  PERFORM set_config('app.creating_garage', 'true', true);

  UPDATE profiles
  SET role = 'admin', garage_id = v_garage_id
  WHERE id = v_user_id AND garage_id IS NULL;

  RETURN v_garage_id;
END;
$function$;

-- ═══════════════════════════════════════════════════════════════
-- 3. Drop super_admin read policies on clients and invoices
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "super_admin_read_clients" ON clients;
DROP POLICY IF EXISTS "super_admin_read_invoices" ON invoices;

-- ═══════════════════════════════════════════════════════════════
-- 4. Create admin_garage_stats() SECURITY DEFINER function
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_garage_stats()
RETURNS TABLE(
  garage_id uuid,
  garage_name text,
  subscription_status text,
  created_at timestamptz,
  employee_count bigint,
  client_count bigint,
  invoice_count bigint,
  total_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only super_admin can access garage stats';
  END IF;

  RETURN QUERY
  SELECT
    g.id AS garage_id,
    g.name AS garage_name,
    g.subscription_status,
    g.created_at,
    COALESCE(emp.cnt, 0) AS employee_count,
    COALESCE(cli.cnt, 0) AS client_count,
    COALESCE(inv.cnt, 0) AS invoice_count,
    COALESCE(inv.rev, 0) AS total_revenue
  FROM garages g
  LEFT JOIN (
    SELECT garage_id, COUNT(*) AS cnt
    FROM profiles
    WHERE role IN ('admin', 'mecanicien', 'secretaire')
    GROUP BY garage_id
  ) emp ON emp.garage_id = g.id
  LEFT JOIN (
    SELECT garage_id, COUNT(*) AS cnt
    FROM clients
    GROUP BY garage_id
  ) cli ON cli.garage_id = g.id
  LEFT JOIN (
    SELECT garage_id, COUNT(*) AS cnt, COALESCE(SUM(total), 0) AS rev
    FROM invoices
    WHERE status = 'payee'
    GROUP BY garage_id
  ) inv ON inv.garage_id = g.id
  ORDER BY g.created_at DESC;
END;
$function$;

-- Grant execute to authenticated so the function can be called via RPC
GRANT EXECUTE ON FUNCTION public.admin_garage_stats() TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 5. Drop old SQL functions that insert into auth.users directly
-- ═══════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.create_employee(text, text, text, text);
DROP FUNCTION IF EXISTS public.reset_employee_password(uuid);
