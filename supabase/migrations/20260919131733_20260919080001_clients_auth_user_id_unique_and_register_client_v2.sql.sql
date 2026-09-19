CREATE UNIQUE INDEX IF NOT EXISTS clients_auth_user_id_unique
  ON clients(auth_user_id) WHERE auth_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.register_client(
  p_first_name text, p_last_name text, p_phone text,
  p_brand text DEFAULT NULL, p_model text DEFAULT NULL, p_plate text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_client_id uuid;
  v_profile_garage_id uuid;
  v_profile_role text;
  v_email text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text));
  SELECT garage_id, role::text INTO v_profile_garage_id, v_profile_role FROM profiles WHERE id = v_user_id;
  IF v_profile_garage_id IS NOT NULL THEN RAISE EXCEPTION 'Garage staff cannot register as clients'; END IF;
  SELECT id INTO v_client_id FROM clients WHERE auth_user_id = v_user_id LIMIT 1;
  IF v_client_id IS NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
    INSERT INTO clients (first_name, last_name, email, phone, auth_user_id, garage_id)
    VALUES (p_first_name, p_last_name, v_email, p_phone, v_user_id, NULL)
    RETURNING id INTO v_client_id;
    IF p_brand IS NOT NULL AND p_model IS NOT NULL AND p_plate IS NOT NULL THEN
      INSERT INTO vehicles (client_id, brand, model, license_plate, garage_id)
      VALUES (v_client_id, p_brand, p_model, p_plate, NULL);
    END IF;
  END IF;
  IF v_profile_role IS DISTINCT FROM 'client' THEN
    PERFORM set_config('app.registering_client', 'true', true);
    UPDATE profiles SET role = 'client', client_id = v_client_id WHERE id = v_user_id;
  END IF;
  RETURN v_client_id;
END;
$function$;