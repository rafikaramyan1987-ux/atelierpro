/*
# Fix parts_orders policy names and re-apply garage-scoped policies

The previous migration failed because parts_orders had existing policies
with different names (staff_read_parts_orders instead of select_parts_orders).
This migration drops the correct names and re-creates them.
*/

-- ═══════════════════════════════════════════════════════════════
-- PARTS_ORDERS — fix policy names
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "staff_read_parts_orders" ON parts_orders;
DROP POLICY IF EXISTS "staff_insert_parts_orders" ON parts_orders;
DROP POLICY IF EXISTS "staff_update_parts_orders" ON parts_orders;
DROP POLICY IF EXISTS "staff_delete_parts_orders" ON parts_orders;

CREATE POLICY "staff_select_parts_orders" ON parts_orders FOR SELECT
  TO authenticated USING (garage_id = current_user_garage_id());

CREATE POLICY "staff_insert_parts_orders" ON parts_orders FOR INSERT
  TO authenticated WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_update_parts_orders" ON parts_orders FOR UPDATE
  TO authenticated
  USING (garage_id = current_user_garage_id())
  WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_delete_parts_orders" ON parts_orders FOR DELETE
  TO authenticated USING (garage_id = current_user_garage_id());
