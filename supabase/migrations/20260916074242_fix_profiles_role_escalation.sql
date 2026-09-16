/*
# Fix profiles role escalation vulnerability
## Problem
The "update_profiles" RLS policy allows any authenticated user to update
their own profile row (`auth.uid() = id`), with no restriction on which
columns can be changed. Since RLS policies apply at the row level, not the
column level, this means any signed-up user — including a client — can call:
  supabase.from('profiles').update({ role: 'admin' }).eq('id', myId)
directly from the browser and grant themselves admin access, or set
garage_id to link themselves to any garage's data.
## Fix
Add a BEFORE UPDATE trigger on `profiles` that:
  1. Blocks any self-promotion to the 'admin' role — the existing signup
     flow (auth-context.tsx) legitimately updates a brand-new user's role
     from the trigger default 'mecanicien' to 'client', so non-admin role
     transitions are still allowed. Only a jump to 'admin' requires the
     caller to already be an admin.
  2. Blocks any change to `garage_id` unless the caller is already an
     admin — no current signup or self-service flow sets this column, so
     this closes the hole with no impact on existing features.
Existing admin flows (managing team members, linking a garage) continue
to work unchanged since admins are exempt from both checks.
*/
CREATE OR REPLACE FUNCTION prevent_profile_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role AND NEW.role = 'admin')
     OR NEW.garage_id IS DISTINCT FROM OLD.garage_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Only admins can grant admin role or change garage_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_profile_privilege_escalation();