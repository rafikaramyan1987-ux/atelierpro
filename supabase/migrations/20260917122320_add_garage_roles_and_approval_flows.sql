-- =============================================================
-- PART A: Garage roles, approval flows, and security
-- =============================================================

-- 1. Add 'secretaire' role to profiles
-- The profiles.role column is TEXT with a CHECK constraint; we need to expand it
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'mecanicien', 'secretaire', 'client'));

-- 2. Add 'en_attente_validation' to service_requests status
-- service_requests.status is TEXT; add CHECK constraint to include new status
ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_status_check;
ALTER TABLE service_requests ADD CONSTRAINT service_requests_status_check
  CHECK (status IN ('en_attente', 'devis_recu', 'devis_accepte', 'devis_refuse', 'en_attente_validation'));

-- Add admin_comment column for rejection feedback
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS admin_comment TEXT;

-- 3. Add 'en_attente_validation' to invoices status (mechanic creates, secretaire issues)
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('brouillon', 'envoyee', 'payee', 'en_retard', 'en_attente_validation'));

-- 4. SECURITY DEFINER function: create_garage_as_admin
-- When a user creates a new garage, promote them to admin of that garage.
-- Only works if the user has no garage_id yet (first-time setup).
CREATE OR REPLACE FUNCTION create_garage_as_admin(
  p_name TEXT,
  p_address TEXT DEFAULT '',
  p_city TEXT DEFAULT '',
  p_postal_code TEXT DEFAULT '',
  p_phone TEXT DEFAULT '',
  p_email TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_garage_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only allow if user has no garage_id yet
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND garage_id IS NOT NULL) THEN
    RAISE EXCEPTION 'You already have a garage';
  END IF;

  -- Create the garage
  INSERT INTO garages (name, address, city, postal_code, phone, email, services_offered)
  VALUES (p_name, p_address, p_city, p_postal_code, p_phone, p_email, ARRAY[]::TEXT[])
  RETURNING id INTO v_garage_id;

  -- Promote user to admin and link garage
  UPDATE profiles
  SET role = 'admin', garage_id = v_garage_id
  WHERE id = v_user_id AND garage_id IS NULL;

  RETURN v_garage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. SECURITY DEFINER function: change_user_role
-- Only the garage's admin can change roles. Cannot demote the last admin.
CREATE OR REPLACE FUNCTION change_user_role(
  p_target_user_id UUID,
  p_new_role TEXT
)
RETURNS void AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_garage_id UUID;
  v_target_garage_id UUID;
  v_target_current_role TEXT;
  v_admin_count INTEGER;
BEGIN
  IF p_new_role NOT IN ('admin', 'mecanicien', 'secretaire', 'client') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  -- Get caller's garage_id
  SELECT garage_id INTO v_caller_garage_id FROM profiles WHERE id = v_caller_id;
  IF v_caller_garage_id IS NULL THEN
    RAISE EXCEPTION 'Caller has no garage';
  END IF;

  -- Caller must be admin of the same garage
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_caller_id AND role = 'admin' AND garage_id = v_caller_garage_id
  ) THEN
    RAISE EXCEPTION 'Only admins can change roles';
  END IF;

  -- Target must be in the same garage
  SELECT garage_id, role INTO v_target_garage_id, v_target_current_role
  FROM profiles WHERE id = p_target_user_id;

  IF v_target_garage_id IS DISTINCT FROM v_caller_garage_id THEN
    RAISE EXCEPTION 'Target user is not in your garage';
  END IF;

  -- Prevent demoting the last admin
  IF v_target_current_role = 'admin' AND p_new_role != 'admin' THEN
    SELECT COUNT(*) INTO v_admin_count
    FROM profiles
    WHERE garage_id = v_caller_garage_id AND role = 'admin' AND id != p_target_user_id;

    IF v_admin_count = 0 THEN
      RAISE EXCEPTION 'Cannot demote the last admin';
    END IF;
  END IF;

  UPDATE profiles SET role = p_new_role WHERE id = p_target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Update the prevent_profile_privilege_escalation trigger
-- to allow 'secretaire' as a valid non-admin role transition
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

-- 7. RLS: Role-based access control
-- Profiles: users can read their own profile + profiles in same garage
DROP POLICY IF EXISTS "select_profiles_self" ON profiles;
CREATE POLICY "select_profiles_self" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.garage_id IS NOT NULL
        AND p.garage_id = profiles.garage_id
    )
  ));

-- Invoices: garage staff can read invoices in their garage
-- mecanicien can create but not issue (en_attente_validation)
-- secretaire and admin can do everything
-- We enforce the "mechanic can't issue" rule in the application layer + via a trigger
DROP POLICY IF EXISTS "select_invoices_garage" ON invoices;
CREATE POLICY "select_invoices_garage" ON invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      JOIN profiles p ON p.id = auth.uid()
      WHERE c.id = invoices.client_id
        AND p.garage_id IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'client' AND p.client_id = invoices.client_id
    )
  );

-- Service requests: garage staff in the same garage can access
-- mecanicien can create devis (en_attente_validation) but only admin can approve
DROP POLICY IF EXISTS "select_service_requests_garage" ON service_requests;
CREATE POLICY "select_service_requests_garage" ON service_requests
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT c.auth_user_id FROM clients c WHERE c.id = service_requests.client_id
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.garage_id IS NOT NULL
    )
  );

-- 8. Trigger: prevent mechanic from issuing invoices directly
-- Only secretaire or admin can change invoice status to 'envoyee'
CREATE OR REPLACE FUNCTION prevent_mechanic_issue_invoice()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  IF NEW.status = 'envoyee' AND OLD.status != 'envoyee' THEN
    SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
    IF v_caller_role = 'mecanicien' THEN
      RAISE EXCEPTION 'Mechanics cannot issue invoices directly';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_mechanic_issue_invoice ON invoices;
CREATE TRIGGER trg_prevent_mechanic_issue_invoice
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION prevent_mechanic_issue_invoice();

-- 9. Trigger: prevent mechanic from sending devis to client
-- Only admin can change service_requests status from 'en_attente_validation' to 'devis_recu'
CREATE OR REPLACE FUNCTION prevent_mechanic_send_devis()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  IF NEW.status = 'devis_recu' AND OLD.status = 'en_attente_validation' THEN
    SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
    IF v_caller_role = 'mecanicien' THEN
      RAISE EXCEPTION 'Mechanics cannot send devis to clients directly';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_mechanic_send_devis ON service_requests;
CREATE TRIGGER trg_prevent_mechanic_send_devis
  BEFORE UPDATE ON service_requests
  FOR EACH ROW
  EXECUTE FUNCTION prevent_mechanic_send_devis();
