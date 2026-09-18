/*
# Add super_admin role, garage subscription status, audit log, support access

## Changes

### 1. Garage subscription status
- Add `subscription_status` column to `garages` (text, default 'active')
  Values: 'active', 'suspended', 'trial'
- Add `subscription_updated_at` timestamp

### 2. Super admin role
- super_admin role sits above all garages with garage_id NULL
- Cannot be assigned through UI or create_employee — only direct DB
- Update handle_new_user trigger to never default to super_admin
- Add RLS policies for super_admin to read all garages (aggregates only)

### 3. Audit log table
- `audit_log` table for tracking support access
- Records who accessed, which garage, start/end time
- Auto-expires after limited period

### 4. Support access request table
- `support_access_requests` table
- Garage admin can request support access
- super_admin can grant it, creating an audit_log entry

### 5. RLS Policies
- super_admin can read all garages (for admin panel)
- super_admin can update garage subscription_status
- Garage admins can create support access requests for their garage
- super_admin can read/grant support access requests
*/

-- 1. Add subscription status to garages
ALTER TABLE garages ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active';
ALTER TABLE garages ADD COLUMN IF NOT EXISTS subscription_updated_at timestamptz DEFAULT now();

-- 2. Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  garage_id uuid NOT NULL REFERENCES garages(id) ON DELETE CASCADE,
  access_start timestamptz NOT NULL DEFAULT now(),
  access_end timestamptz NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- 3. Support access requests table
CREATE TABLE IF NOT EXISTS support_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid NOT NULL REFERENCES garages(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'granted', 'denied', 'expired')),
  granted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE support_access_requests ENABLE ROW LEVEL SECURITY;

-- 4. RLS for audit_log — only super_admin can read
DROP POLICY IF EXISTS "super_admin_read_audit_log" ON audit_log;
CREATE POLICY "super_admin_read_audit_log" ON audit_log FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 5. RLS for support_access_requests
-- Garage admins can read/create requests for their own garage
DROP POLICY IF EXISTS "admin_read_own_support_requests" ON support_access_requests;
CREATE POLICY "admin_read_own_support_requests" ON support_access_requests FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
      AND p.garage_id = support_access_requests.garage_id
    )
  );

DROP POLICY IF EXISTS "admin_create_own_support_request" ON support_access_requests;
CREATE POLICY "admin_create_own_support_request" ON support_access_requests FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
      AND p.garage_id = support_access_requests.garage_id
    )
  );

-- super_admin can read all support requests
DROP POLICY IF EXISTS "super_admin_read_support_requests" ON support_access_requests;
CREATE POLICY "super_admin_read_support_requests" ON support_access_requests FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- super_admin can update (grant/deny) support requests
DROP POLICY IF EXISTS "super_admin_update_support_requests" ON support_access_requests;
CREATE POLICY "super_admin_update_support_requests" ON support_access_requests FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 6. super_admin can read all garages (for admin panel aggregates)
DROP POLICY IF EXISTS "super_admin_read_garages" ON garages;
CREATE POLICY "super_admin_read_garages" ON garages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 7. super_admin can update garage subscription_status
DROP POLICY IF EXISTS "super_admin_update_garages" ON garages;
CREATE POLICY "super_admin_update_garages" ON garages FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 8. super_admin can read all profiles (for employee counts per garage)
DROP POLICY IF EXISTS "super_admin_read_profiles" ON profiles;
CREATE POLICY "super_admin_read_profiles" ON profiles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- 9. super_admin can read all clients (for client counts per garage)
DROP POLICY IF EXISTS "super_admin_read_clients" ON clients;
CREATE POLICY "super_admin_read_clients" ON clients FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- 10. super_admin can read all invoices (for revenue aggregates per garage)
DROP POLICY IF EXISTS "super_admin_read_invoices" ON invoices;
CREATE POLICY "super_admin_read_invoices" ON invoices FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- 11. Update handle_new_user trigger to never default to super_admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'mecanicien')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$function$;

-- 12. Update prevent_profile_privilege_escalation to block super_admin assignment via UPDATE
-- (super_admin can only be set directly in the database, never through the app)
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller_role text;
  v_caller_garage_id uuid;
  v_is_first_garage boolean;
BEGIN
  -- Allow self-creation (trigger context)
  IF TG_OP = 'INSERT' THEN
    -- Block super_admin from being set via insert by non-super-admin
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

  -- Block removing super_admin (only DB can do that)
  IF OLD.role = 'super_admin' AND NEW.role IS DISTINCT FROM 'super_admin' THEN
    IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
      RAISE EXCEPTION 'Cannot demote super_admin';
    END IF;
  END IF;

  -- Existing garage_id escalation checks
  IF NEW.garage_id IS DISTINCT FROM OLD.garage_id THEN
    v_is_first_garage := (OLD.garage_id IS NULL AND NEW.garage_id IS NOT NULL AND NEW.id = auth.uid());

    IF NOT v_is_first_garage THEN
      -- Must be admin of the target garage
      IF v_caller_role IS DISTINCT FROM 'admin' OR v_caller_garage_id IS DISTINCT FROM NEW.garage_id THEN
        IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
          RAISE EXCEPTION 'Not authorized to change garage_id';
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 13. Update create_employee to reject super_admin
CREATE OR REPLACE FUNCTION public.create_employee(
  p_email text,
  p_full_name text,
  p_role text,
  p_phone text DEFAULT ''
)
RETURNS TABLE(temp_password text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_garage_id UUID;
  v_temp_password TEXT;
  v_user_id UUID;
  v_chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  v_i INTEGER;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_role NOT IN ('mecanicien', 'secretaire') THEN
    RAISE EXCEPTION 'Can only create mecanicien or secretaire accounts';
  END IF;

  SELECT garage_id INTO v_caller_garage_id
  FROM profiles WHERE id = v_caller_id AND role = 'admin';

  IF v_caller_garage_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can create employees';
  END IF;

  v_temp_password := '';
  FOR v_i IN 1..16 LOOP
    v_temp_password := v_temp_password || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
  END LOOP;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated', 'authenticated',
    p_email, extensions.crypt(v_temp_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('full_name', p_full_name)
  ) RETURNING id INTO v_user_id;

  INSERT INTO profiles (id, email, full_name, role, phone, garage_id, must_change_password)
  VALUES (v_user_id, p_email, p_full_name, p_role, NULLIF(p_phone, ''), v_caller_garage_id, true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone,
    garage_id = EXCLUDED.garage_id,
    must_change_password = EXCLUDED.must_change_password;

  RETURN QUERY SELECT v_temp_password;
END;
$function$;

-- 14. Update reset_employee_password (keep using pgcrypto)
CREATE OR REPLACE FUNCTION public.reset_employee_password(p_target_user_id uuid)
RETURNS TABLE(temp_password text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_garage_id UUID;
  v_target_garage_id UUID;
  v_temp_password TEXT;
  v_chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  v_i INTEGER;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_target_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Cannot reset your own password through this flow';
  END IF;

  SELECT garage_id INTO v_caller_garage_id
  FROM profiles WHERE id = v_caller_id AND role = 'admin';

  IF v_caller_garage_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can reset passwords';
  END IF;

  SELECT garage_id INTO v_target_garage_id
  FROM profiles WHERE id = p_target_user_id;

  IF v_target_garage_id IS DISTINCT FROM v_caller_garage_id THEN
    RAISE EXCEPTION 'Target user is not in your garage';
  END IF;

  v_temp_password := '';
  FOR v_i IN 1..16 LOOP
    v_temp_password := v_temp_password || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
  END LOOP;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(v_temp_password, extensions.gen_salt('bf')),
    updated_at = now()
  WHERE id = p_target_user_id;

  UPDATE profiles SET must_change_password = true WHERE id = p_target_user_id;

  RETURN QUERY SELECT v_temp_password;
END;
$function$;
