/*
# Fix RLS recursion on profiles + allow super_admin role

## 1. Add is_super_admin() SECURITY DEFINER helper
   Avoids infinite recursion in policies that reference profiles from within profiles policies.

## 2. Drop & recreate profiles role CHECK constraint to include super_admin

## 3. Rewrite all policies that subquery on profiles to use is_super_admin()

## 4. Ensure change_user_role and create_employee reject super_admin
   (Already done in prior migration, but reassert here for safety.)
*/

-- 1. is_super_admin() helper
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  RETURN v_role = 'super_admin';
END;
$function$;

-- 2. Fix CHECK constraint on profiles.role
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check1;
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname, con.oid
    FROM pg_constraint con
    JOIN pg_class rel ON con.conrelid = rel.oid
    WHERE rel.relname = 'profiles' AND con.contype = 'c'
  LOOP
    IF pg_get_constraintdef(c.oid) LIKE '%role%' THEN
      EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', c.conname);
    END IF;
  END LOOP;
END $$;

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'mecanicien', 'secretaire', 'client'));

-- 3. Rewrite policies that subquery on profiles to use is_super_admin()

-- audit_log: super_admin read
DROP POLICY IF EXISTS "super_admin_read_audit_log" ON audit_log;
CREATE POLICY "super_admin_read_audit_log" ON audit_log FOR SELECT
  TO authenticated USING (public.is_super_admin());

-- support_access_requests: admin read own
DROP POLICY IF EXISTS "admin_read_own_support_requests" ON support_access_requests;
CREATE POLICY "admin_read_own_support_requests" ON support_access_requests FOR SELECT
  TO authenticated USING (
    public.current_user_role() = 'admin'
    AND public.current_user_garage_id() = support_access_requests.garage_id
  );

-- support_access_requests: admin create own
DROP POLICY IF EXISTS "admin_create_own_support_request" ON support_access_requests;
CREATE POLICY "admin_create_own_support_request" ON support_access_requests FOR INSERT
  TO authenticated WITH CHECK (
    public.current_user_role() = 'admin'
    AND public.current_user_garage_id() = support_access_requests.garage_id
  );

-- support_access_requests: super_admin read all
DROP POLICY IF EXISTS "super_admin_read_support_requests" ON support_access_requests;
CREATE POLICY "super_admin_read_support_requests" ON support_access_requests FOR SELECT
  TO authenticated USING (public.is_super_admin());

-- support_access_requests: super_admin update
DROP POLICY IF EXISTS "super_admin_update_support_requests" ON support_access_requests;
CREATE POLICY "super_admin_update_support_requests" ON support_access_requests FOR UPDATE
  TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- garages: super_admin read all
DROP POLICY IF EXISTS "super_admin_read_garages" ON garages;
CREATE POLICY "super_admin_read_garages" ON garages FOR SELECT
  TO authenticated USING (public.is_super_admin());

-- garages: super_admin update (subscription status)
DROP POLICY IF EXISTS "super_admin_update_garages" ON garages;
CREATE POLICY "super_admin_update_garages" ON garages FOR UPDATE
  TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- profiles: super_admin read all
DROP POLICY IF EXISTS "super_admin_read_profiles" ON profiles;
CREATE POLICY "super_admin_read_profiles" ON profiles FOR SELECT
  TO authenticated USING (public.is_super_admin());

-- clients: super_admin read all
DROP POLICY IF EXISTS "super_admin_read_clients" ON clients;
CREATE POLICY "super_admin_read_clients" ON clients FOR SELECT
  TO authenticated USING (public.is_super_admin());

-- invoices: super_admin read all
DROP POLICY IF EXISTS "super_admin_read_invoices" ON invoices;
CREATE POLICY "super_admin_read_invoices" ON invoices FOR SELECT
  TO authenticated USING (public.is_super_admin());

-- 4. Reassert change_user_role rejects super_admin
CREATE OR REPLACE FUNCTION public.change_user_role(p_target_user_id uuid, p_new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_garage_id UUID;
  v_target_garage_id UUID;
  v_target_current_role TEXT;
  v_admin_count INTEGER;
BEGIN
  IF p_new_role NOT IN ('admin', 'mecanicien', 'secretaire', 'client') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT garage_id INTO v_caller_garage_id FROM profiles WHERE id = v_caller_id;
  IF v_caller_garage_id IS NULL THEN
    RAISE EXCEPTION 'Caller has no garage';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_caller_id AND role = 'admin' AND garage_id = v_caller_garage_id
  ) THEN
    RAISE EXCEPTION 'Only admins can change roles';
  END IF;

  SELECT garage_id, role INTO v_target_garage_id, v_target_current_role
  FROM profiles WHERE id = p_target_user_id;

  IF v_target_garage_id IS DISTINCT FROM v_caller_garage_id THEN
    RAISE EXCEPTION 'Target user is not in your garage';
  END IF;

  IF v_target_current_role = 'admin' AND p_new_role != 'admin' THEN
    SELECT COUNT(*) INTO v_admin_count
    FROM profiles
    WHERE garage_id = v_caller_garage_id AND role = 'admin' AND id != p_target_user_id;

    IF v_admin_count = 0 THEN
      RAISE EXCEPTION 'Cannot demote the last admin';
    END IF;
  END IF;

  UPDATE profiles SET role = p_new_role WHERE id = p_target_user_id;
END;
$function$;
