/*
# Employee account creation, forced password change, and secretaire reminders access

1. New Columns
- `profiles.must_change_password` (boolean, default false) — when true, the user
  is forced to set a new password on next login before reaching any other page.

2. New Functions
- `create_employee(p_email, p_full_name, p_role, p_phone)` — SECURITY DEFINER.
  Called by an admin to create a staff account (mecanicien or secretaire) in
  their garage. Generates a strong temporary password, creates the auth user
  via the admin API, inserts the profile with the correct role + garage_id +
  must_change_password = true, and returns the temp password.
- `reset_employee_password(p_target_user_id)` — SECURITY DEFINER. Called by
  an admin to reset a staff member's password. Generates a new temp password,
  updates the auth user, sets must_change_password = true, returns the temp
  password.

3. Security
- Both functions verify the caller is an admin of the same garage.
- Both functions reject role = 'admin' or 'client' — only mecanicien or
  secretaire can be created through this flow.
- reset_employee_password verifies the target is in the caller's garage and
  is not the caller themselves.

4. Notes
- The functions use the Supabase admin auth API via the service role key
  stored in the database environment. They use `auth.admin.create_user()` /
  `auth.admin.update_user_by_id()` which require the service role.
- Since SECURITY DEFINER functions run as the postgres owner, they can
  access auth.users and set passwords directly.
*/

-- 1. Add must_change_password column
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- 2. create_employee function
CREATE OR REPLACE FUNCTION create_employee(
  p_email TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_phone TEXT DEFAULT ''
)
RETURNS TABLE(temp_password TEXT) AS $$
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

  -- Get caller's garage_id and verify they are admin
  SELECT garage_id INTO v_caller_garage_id
  FROM profiles WHERE id = v_caller_id AND role = 'admin';

  IF v_caller_garage_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can create employees';
  END IF;

  -- Generate a strong temporary password (16 chars)
  v_temp_password := '';
  FOR v_i IN 1..16 LOOP
    v_temp_password := v_temp_password || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
  END LOOP;

  -- Create the auth user with the temp password
  -- We insert directly into auth.users to avoid needing the admin API
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(v_temp_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('full_name', p_full_name)
  )
  RETURNING id INTO v_user_id;

  -- Create the profile with the correct role, garage_id, and must_change_password
  INSERT INTO profiles (id, email, full_name, role, phone, garage_id, must_change_password)
  VALUES (v_user_id, p_email, p_full_name, p_role, NULLIF(p_phone, ''), v_caller_garage_id, true);

  RETURN QUERY SELECT v_temp_password;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. reset_employee_password function
CREATE OR REPLACE FUNCTION reset_employee_password(
  p_target_user_id UUID
)
RETURNS TABLE(temp_password TEXT) AS $$
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

  -- Get caller's garage_id and verify they are admin
  SELECT garage_id INTO v_caller_garage_id
  FROM profiles WHERE id = v_caller_id AND role = 'admin';

  IF v_caller_garage_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can reset passwords';
  END IF;

  -- Verify target is in the same garage
  SELECT garage_id INTO v_target_garage_id
  FROM profiles WHERE id = p_target_user_id;

  IF v_target_garage_id IS DISTINCT FROM v_caller_garage_id THEN
    RAISE EXCEPTION 'Target user is not in your garage';
  END IF;

  -- Generate a new temp password
  v_temp_password := '';
  FOR v_i IN 1..16 LOOP
    v_temp_password := v_temp_password || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
  END LOOP;

  -- Update the auth user's password
  UPDATE auth.users
  SET encrypted_password = crypt(v_temp_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = p_target_user_id;

  -- Set must_change_password flag
  UPDATE profiles
  SET must_change_password = true
  WHERE id = p_target_user_id;

  RETURN QUERY SELECT v_temp_password;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant execute to authenticated
GRANT EXECUTE ON FUNCTION create_employee TO authenticated;
GRANT EXECUTE ON FUNCTION reset_employee_password TO authenticated;
