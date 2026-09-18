/*
# Fix: create_employee collides with handle_new_user trigger

## Problem
create_employee inserts into auth.users, which fires handle_new_user.
That trigger inserts a profiles row with role='mecanicien' and no
garage_id. create_employee then runs its own INSERT INTO profiles for
the same id → duplicate key violation on profiles_pkey.

## Fix
Change the INSERT to ON CONFLICT (id) DO UPDATE so the row created
by the trigger is updated with the correct role, garage_id, phone,
and must_change_password = true.

## Trigger compatibility
prevent_profile_privilege_escalation fires on this UPDATE:
  - NEW.garage_id IS DISTINCT FROM OLD.garage_id → TRUE (NULL → garage_id)
  - The first-garage exception does NOT match (NEW.id ≠ auth.uid())
  - The admin check: caller is admin of NEW.garage_id → TRUE
  → Allowed.
*/

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
    crypt(v_temp_password, gen_salt('bf')),
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
