/*
# Fix privilege escalation at signup and restore profiles DELETE/INSERT policies

## 1. Block privilege escalation at signup
Rewrite public.handle_new_user() so the role is NEVER taken from raw_user_meta_data.
The inserted role is 'client' when raw_user_meta_data->>'account_type' = 'client',
and 'admin' otherwise (a person signing up creates their own garage).
Under no circumstances may it insert 'super_admin', 'secretaire', or 'mecanicien'.

## 2. BEFORE INSERT trigger on profiles to prevent super_admin escalation
Add function prevent_profile_role_insert_escalation() (SECURITY DEFINER, SET search_path = public)
that raises an exception if NEW.role = 'super_admin' and the current session is not already a super_admin.
Employees are created only through the manage-employee edge function, so this must not break it —
allow 'admin', 'secretaire', 'mecanicien', 'client'.

## 3. Restore missing DELETE and INSERT policies on public.profiles
- delete_profiles_admin: FOR DELETE TO authenticated USING (current_user_role() = 'admin' AND garage_id = current_user_garage_id() AND id <> auth.uid()).
- insert_profiles_admin: FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR (current_user_role() = 'admin' AND garage_id = current_user_garage_id())).

## 4. Drop obsolete functions
- public.set_own_garage_id(uuid)
- public.generate_invoice_number() (zero-arg legacy COUNT(*)+1 version)
Keep generate_invoice_number(p_garage_id uuid).
*/

-- ──────────────────────────────────────────────────────
-- 1. Rewrite handle_new_user() — never trust raw_user_meta_data for role
-- ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role text;
BEGIN
  IF NEW.raw_user_meta_data->>'account_type' = 'client' THEN
    v_role := 'client';
  ELSE
    v_role := 'admin';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    v_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;

  RETURN NEW;
END;
$function$;

-- ──────────────────────────────────────────────────────
-- 2. BEFORE INSERT trigger to prevent super_admin escalation
-- ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prevent_profile_role_insert_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.role = 'super_admin' AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Cannot create a super_admin profile';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_prevent_role_insert_escalation ON public.profiles;

CREATE TRIGGER profiles_prevent_role_insert_escalation
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_insert_escalation();

-- ──────────────────────────────────────────────────────
-- 3. Restore missing DELETE and INSERT policies on profiles
-- ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "delete_profiles_admin" ON public.profiles;
CREATE POLICY "delete_profiles_admin" ON public.profiles
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'admin'
    AND garage_id = public.current_user_garage_id()
    AND id <> auth.uid()
  );

DROP POLICY IF EXISTS "insert_profiles_admin" ON public.profiles;
CREATE POLICY "insert_profiles_admin" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    OR (
      public.current_user_role() = 'admin'
      AND garage_id = public.current_user_garage_id()
    )
  );

-- ──────────────────────────────────────────────────────
-- 4. Drop obsolete functions
-- ──────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.set_own_garage_id(uuid);
DROP FUNCTION IF EXISTS public.generate_invoice_number();
