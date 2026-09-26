/*
# Fix prevent_profile_privilege_escalation bypass branches

## Problem
The previous migration changed handle_new_user() so a new signup already gets
its final role ('admin' for a garage owner, 'client' for a client). The two
bypass branches in prevent_profile_privilege_escalation() still require the
role to CHANGE (OLD.role IS DISTINCT FROM ...), which now never happens.

## Fix
Replace public.prevent_profile_privilege_escalation() keeping everything
identical except the two self-update bypass branches:

1. app.creating_garage bypass: now requires
   current_setting('app.creating_garage', true) = 'true'
   AND OLD.garage_id IS NULL AND NEW.garage_id IS NOT NULL
   AND NEW.role = 'admin' AND OLD.role IN ('admin', 'mecanicien')

2. app.registering_client bypass: now requires
   current_setting('app.registering_client', true) = 'true'
   AND NEW.role = 'client' AND OLD.role IN ('client', 'mecanicien')
   AND NEW.garage_id IS NULL AND OLD.garage_id IS NULL
   Also allows client_id to be set when OLD.client_id IS NULL.

No other check is weakened.
*/

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller_role text;
  v_caller_garage_id uuid;
  v_admin_count int;
BEGIN
  -- Server-side operations (no authenticated user) bypass all checks
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- INSERT: block super_admin assignment by non-super_admin
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

  -- Last admin protection: before any bypass, if OLD.role = 'admin'
  -- and the update removes admin rights, check another active admin exists
  IF OLD.role = 'admin' AND OLD.garage_id IS NOT NULL THEN
    IF (NEW.role IS DISTINCT FROM 'admin')
       OR (NEW.active = false)
       OR (NEW.garage_id IS DISTINCT FROM OLD.garage_id) THEN
      SELECT COUNT(*) INTO v_admin_count
      FROM profiles
      WHERE garage_id = OLD.garage_id
        AND role = 'admin'
        AND active = true
        AND id <> OLD.id;
      IF v_admin_count = 0 THEN
        RAISE EXCEPTION 'Cannot remove the last admin of this garage';
      END IF;
    END IF;
  END IF;

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

  -- super_admin caller: allowed
  IF v_caller_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  -- Admin changing a user in their own garage
  IF v_caller_role = 'admin' AND v_caller_garage_id IS NOT NULL THEN
    IF NEW.garage_id IS DISTINCT FROM v_caller_garage_id THEN
      RAISE EXCEPTION 'Admin can only modify users in own garage';
    END IF;
    IF NEW.role NOT IN ('admin', 'mecanicien', 'secretaire') THEN
      RAISE EXCEPTION 'Admin can only set roles to admin, mecanicien or secretaire';
    END IF;
    RETURN NEW;
  END IF;

  -- Self-update (NEW.id = auth.uid())
  IF NEW.id = auth.uid() THEN
    -- Allow create_garage_as_admin flow
    IF current_setting('app.creating_garage', true) = 'true'
       AND OLD.garage_id IS NULL AND NEW.garage_id IS NOT NULL
       AND NEW.role = 'admin' AND OLD.role IN ('admin', 'mecanicien') THEN
      RETURN NEW;
    END IF;

    -- Allow register_client flow
    IF current_setting('app.registering_client', true) = 'true'
       AND NEW.role = 'client' AND OLD.role IN ('client', 'mecanicien')
       AND NEW.garage_id IS NULL AND OLD.garage_id IS NULL THEN
      -- Allow client_id to be set when it was previously NULL
      IF NEW.client_id IS NOT NULL AND OLD.client_id IS NULL THEN
        RETURN NEW;
      END IF;
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

    -- Block active change
    IF NEW.active IS DISTINCT FROM OLD.active THEN
      RAISE EXCEPTION 'You cannot change your own active status';
    END IF;

    -- Block client_id change
    IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
      RAISE EXCEPTION 'You cannot change your own client_id';
    END IF;

    -- Block email change
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'You cannot change your own email';
    END IF;

    -- must_change_password: only allow true -> false
    IF NEW.must_change_password = true AND OLD.must_change_password = false THEN
      RAISE EXCEPTION 'You cannot set must_change_password to true on yourself';
    END IF;

    RETURN NEW;
  END IF;

  -- Any other update: denied
  RAISE EXCEPTION 'Not authorized to modify this profile';
END;
$function$;
