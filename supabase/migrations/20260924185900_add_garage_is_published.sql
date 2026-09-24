-- Add is_published column to garages
ALTER TABLE garages ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

-- Publish existing garages that already have a non-empty address AND city
UPDATE garages SET is_published = true WHERE address IS NOT NULL AND address <> '' AND city IS NOT NULL AND city <> '';

-- Replace the public SELECT policy so anon/client users only see published, active garages
DROP POLICY IF EXISTS "public_select_garages" ON garages;
CREATE POLICY "public_select_garages" ON garages FOR SELECT TO anon, authenticated
  USING (is_published = true AND subscription_status <> 'suspended');

-- Ensure staff can always read their own garage row
DROP POLICY IF EXISTS "garage_staff_select_own" ON garages;
CREATE POLICY "garage_staff_select_own" ON garages FOR SELECT
  TO authenticated USING (id = public.current_user_garage_id());

-- Super_admin can read all garages
DROP POLICY IF EXISTS "garage_super_admin_select_all" ON garages;
CREATE POLICY "garage_super_admin_select_all" ON garages FOR SELECT
  TO authenticated USING (public.is_super_admin());