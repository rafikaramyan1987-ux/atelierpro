-- Fix: the self-update path in the trigger blocks the role change
-- before the app.creating_garage flag check runs.
-- Reorder: check the create_garage flag FIRST for self-updates,
-- before checking role/garage_id changes.

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
  -- Server-side operations (no authenticated user) bypass all checks.
  -- Edge functions using service role get auth.uid() = NULL.
  -- Server-side SQL (postgres, no JWT) also has auth.uid() = NULL.
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
  -- Check the create_garage_as_admin flag FIRST, before any other
  -- self-update restrictions, because that function sets both
  -- role = 'admin' and garage_id simultaneously.
  IF NEW.id = auth.uid() THEN
    -- Allow first-garage creation via create_garage_as_admin:
    --   transition from NULL garage to a new garage + promotion to admin
    --   Only allowed when the app.creating_garage flag is set
    IF current_setting('app.creating_garage', true) = 'true'
       AND OLD.garage_id IS NULL AND NEW.garage_id IS NOT NULL
       AND NEW.role = 'admin' AND OLD.role IS DISTINCT FROM 'admin' THEN
      RETURN NEW;
    END IF;

    -- Allow the signup-flow transition: mecanicien → client, garage_id stays NULL
    IF OLD.role = 'mecanicien' AND NEW.role = 'client'
       AND OLD.garage_id IS NULL AND NEW.garage_id IS NULL THEN
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

    RETURN NEW;
  END IF;

  -- Any other update: denied
  RAISE EXCEPTION 'Not authorized to modify this profile';
END;
$function$;
