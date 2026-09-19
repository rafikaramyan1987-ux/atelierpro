-- Fix: the postgres bypass was too broad — it also bypassed when a real user
-- was authenticated via JWT (because SECURITY DEFINER runs as postgres).
-- Only bypass when there is NO authenticated user (auth.uid() IS NULL),
-- meaning it's a true server-side operation, not a browser request.

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
  -- Service role (edge function) bypasses all checks when there is no user JWT.
  -- Edge functions using the service role key get auth.role() = 'service_role'
  -- and auth.uid() = NULL (they pass the user token separately).
  -- Server-side SQL (postgres, no JWT) also bypasses.
  -- But when a real user is authenticated (auth.uid() IS NOT NULL),
  -- the trigger must enforce rules regardless of current_user.
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
