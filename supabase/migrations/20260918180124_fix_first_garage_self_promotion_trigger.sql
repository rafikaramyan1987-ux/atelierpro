/*
# Fix: allow first-garage self-promotion in prevent_profile_privilege_escalation

## Problem
create_garage_as_admin() promotes the creator to admin and sets their
garage_id. But the prevent_profile_privilege_escalation trigger blocks
any promotion to admin or garage_id change unless the caller is already
an admin. A brand new garage owner is not yet an admin, so the trigger
blocks the very operation that should make them one.

## Fix
Add an explicit exception to the trigger for the first-garage-creation
case: when the update targets the caller's own profile (NEW.id = auth.uid()),
the old garage_id was NULL, the new garage_id is non-NULL, and the new
role is 'admin'. This is the only legitimate self-promotion path.

All other promotions to admin remain blocked unless the caller is already
an admin of the same garage. Changing an already-set garage_id remains
blocked for non-admins.
*/

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role AND NEW.role = 'admin')
  OR NEW.garage_id IS DISTINCT FROM OLD.garage_id THEN

    -- Allow first-garage self-promotion: user with no garage creates their
    -- first garage and is promoted to admin of it. This is the only
    -- legitimate self-promotion path.
    IF NEW.id = auth.uid()
       AND OLD.garage_id IS NULL
       AND NEW.garage_id IS NOT NULL
       AND NEW.role = 'admin'
       AND OLD.role IS DISTINCT FROM 'admin' THEN
      RETURN NEW;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND p.garage_id = NEW.garage_id
    ) THEN
      RAISE EXCEPTION 'Only admins can grant admin role or change garage_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
