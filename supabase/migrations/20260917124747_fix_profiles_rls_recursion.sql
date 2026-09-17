-- Fix infinite recursion in profiles RLS policies
-- The select_profiles_self, update_profiles, and delete_profiles_admin policies
-- all contain EXISTS (SELECT 1 FROM profiles p ...) which queries the same table
-- the policy is defined on, causing "infinite recursion detected in policy".

-- 1. SECURITY DEFINER helper functions that bypass RLS
CREATE OR REPLACE FUNCTION current_user_garage_id()
RETURNS UUID AS $$
DECLARE
  v_garage_id UUID;
BEGIN
  SELECT garage_id INTO v_garage_id FROM profiles WHERE id = auth.uid();
  RETURN v_garage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Rewrite select_profiles_self to use the helper function
DROP POLICY IF EXISTS "select_profiles_self" ON profiles;
CREATE POLICY "select_profiles_self" ON profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR (garage_id IS NOT NULL AND garage_id = current_user_garage_id())
  );

-- 3. Rewrite update_profiles to use the helper function
DROP POLICY IF EXISTS "update_profiles" ON profiles;
CREATE POLICY "update_profiles" ON profiles
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = id
    OR current_user_role() = 'admin'
  )
  WITH CHECK (
    auth.uid() = id
    OR current_user_role() = 'admin'
  );

-- 4. Rewrite delete_profiles_admin to use the helper function
DROP POLICY IF EXISTS "delete_profiles_admin" ON profiles;
CREATE POLICY "delete_profiles_admin" ON profiles
  FOR DELETE TO authenticated
  USING (current_user_role() = 'admin');
