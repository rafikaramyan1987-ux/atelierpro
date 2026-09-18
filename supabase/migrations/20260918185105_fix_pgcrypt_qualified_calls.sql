/*
# Fix: gen_salt/crypt not found in create_employee and reset_employee_password

## Problem
Both functions call crypt() and gen_salt() from pgcrypto, which lives
in the extensions schema. With search_path = public, these functions
are unresolvable → "function gen_salt(unknown) does not exist".

## Fix
Use fully-qualified extensions.crypt() and extensions.gen_salt().
Also add SET search_path = public to reset_employee_password for
consistency and security.
*/

-- Ensure pgcrypto is installed in extensions schema
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Recreate create_employee with fully-qualified pgcrypto calls
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
    extensions.crypt(v_temp_password, extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('full_name', p_full_name)
  )
  RETURNING id INTO v_user_id;

  -- Upsert the profile: handle_new_user already inserted a row with
  -- role='mecanicien' and no garage_id. Update it with the correct
  -- role, garage_id, phone, and must_change_password.
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

-- Recreate reset_employee_password with fully-qualified pgcrypto calls
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
  SET encrypted_password = extensions.crypt(v_temp_password, extensions.gen_salt('bf')),
    updated_at = now()
  WHERE id = p_target_user_id;

  -- Set must_change_password flag
  UPDATE profiles
  SET must_change_password = true
  WHERE id = p_target_user_id;

  RETURN QUERY SELECT v_temp_password;
END;
$function$;
