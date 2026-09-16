-- Update the trigger function: allow non-admins to set garage_id from NULL (first-time setup),
-- but block changing it once already set, unless caller is admin.
CREATE OR REPLACE FUNCTION prevent_profile_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role AND NEW.role = 'admin')
     OR (NEW.garage_id IS DISTINCT FROM OLD.garage_id AND OLD.garage_id IS NOT NULL) THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Only admins can grant admin role or change an already-set garage_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;