/*
# Fix handle_new_user trigger
#
# Problem: Supabase GoTrue strips custom options.data (full_name, role, client_id)
# from raw_user_meta_data before the AFTER INSERT trigger fires.
# The trigger was reading these fields and always getting NULL, causing
# profiles to be created with wrong defaults (email as name, mecanicien as role).
#
# Fix: The trigger now creates a minimal profile with email as full_name
# and default role 'mecanicien'. The frontend updates the profile with
# the correct role, full_name, and client_id AFTER signup completes.
#
# Also: Set a safe search_path to prevent injection.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'mecanicien'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;

  RETURN NEW;
END;
$function$;
