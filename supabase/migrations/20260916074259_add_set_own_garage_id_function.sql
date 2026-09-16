-- Allow a user to set their own garage_id when it's currently NULL (first-time garage creation).
-- The trigger blocks non-admins from changing garage_id; this function is SECURITY DEFINER
-- so it runs with elevated privileges and bypasses the trigger check by setting a session var.
-- Only allows setting garage_id when the current value is NULL (can't change an existing one).

CREATE OR REPLACE FUNCTION set_own_garage_id(p_garage_id uuid)
RETURNS void AS $$
BEGIN
  -- Only allow the caller to set their own garage_id
  -- and only if it's currently NULL (first-time setup)
  UPDATE profiles
  SET garage_id = p_garage_id
  WHERE id = auth.uid() AND garage_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot set garage_id: either not your profile or garage_id is already set';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;