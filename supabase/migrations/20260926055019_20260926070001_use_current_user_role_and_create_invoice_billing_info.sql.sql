/*
# 1. Use current_user_role() in prevent_profile_privilege_escalation()
# 2. Create invoice_billing_info() in version control
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
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'super_admin' THEN
      v_caller_role := public.current_user_role();
      IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION 'Cannot assign super_admin role';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  v_caller_role := public.current_user_role();
  SELECT garage_id INTO v_caller_garage_id
  FROM profiles WHERE id = auth.uid();

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

  IF NEW.role = 'super_admin' AND OLD.role IS DISTINCT FROM 'super_admin' THEN
    IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
      RAISE EXCEPTION 'Cannot escalate to super_admin role';
    END IF;
  END IF;

  IF OLD.role = 'super_admin' AND NEW.role IS DISTINCT FROM 'super_admin' THEN
    IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
      RAISE EXCEPTION 'Cannot demote super_admin';
    END IF;
  END IF;

  IF v_caller_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  IF v_caller_role = 'admin' AND v_caller_garage_id IS NOT NULL THEN
    IF NEW.garage_id IS DISTINCT FROM v_caller_garage_id THEN
      RAISE EXCEPTION 'Admin can only modify users in own garage';
    END IF;
    IF NEW.role NOT IN ('admin', 'mecanicien', 'secretaire') THEN
      RAISE EXCEPTION 'Admin can only set roles to admin, mecanicien or secretaire';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id = auth.uid() THEN
    IF current_setting('app.creating_garage', true) = 'true'
       AND OLD.garage_id IS NULL AND NEW.garage_id IS NOT NULL
       AND NEW.role = 'admin' AND OLD.role IN ('admin', 'mecanicien') THEN
      RETURN NEW;
    END IF;

    IF current_setting('app.registering_client', true) = 'true'
       AND NEW.role = 'client' AND OLD.role IN ('client', 'mecanicien')
       AND NEW.garage_id IS NULL AND OLD.garage_id IS NULL THEN
      IF NEW.client_id IS NOT NULL AND OLD.client_id IS NULL THEN
        RETURN NEW;
      END IF;
      RETURN NEW;
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'You cannot change your own role';
    END IF;
    IF NEW.garage_id IS DISTINCT FROM OLD.garage_id THEN
      RAISE EXCEPTION 'You cannot change your own garage_id';
    END IF;
    IF NEW.active IS DISTINCT FROM OLD.active THEN
      RAISE EXCEPTION 'You cannot change your own active status';
    END IF;
    IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
      RAISE EXCEPTION 'You cannot change your own client_id';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'You cannot change your own email';
    END IF;
    IF NEW.must_change_password = true AND OLD.must_change_password = false THEN
      RAISE EXCEPTION 'You cannot set must_change_password to true on yourself';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not authorized to modify this profile';
END;
$function$;

CREATE OR REPLACE FUNCTION public.invoice_billing_info(p_invoice_id uuid)
RETURNS TABLE (
  name text,
  address text,
  postal_code text,
  city text,
  phone text,
  email text,
  vat_number text,
  iban text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $function$
DECLARE
  v_garage_id uuid;
  v_client_id uuid;
BEGIN
  SELECT i.garage_id, i.client_id INTO v_garage_id, v_client_id
  FROM invoices i WHERE i.id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF (v_garage_id IS NOT NULL AND public.current_user_garage_id() = v_garage_id)
     OR (v_client_id IS NOT NULL AND public.current_user_client_id() = v_client_id)
  THEN
    RETURN QUERY
    SELECT
      g.name,
      g.address,
      g.postal_code,
      g.city,
      g.phone,
      g.email,
      g.vat_number,
      g.iban
    FROM garages g
    WHERE g.id = v_garage_id;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.invoice_billing_info(uuid) TO authenticated;