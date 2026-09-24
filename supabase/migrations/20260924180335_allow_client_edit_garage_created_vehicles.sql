-- Allow clients to edit vehicles that a garage created for them.
-- The USING clause already allows any vehicle whose client_id matches;
-- the WITH CHECK only needs client_id = current_user_client_id()
-- (the prevent_vehicle_hijack trigger already blocks changing client_id/garage_id).

DROP POLICY IF EXISTS "client_update_own_vehicles" ON vehicles;

CREATE POLICY "client_update_own_vehicles" ON vehicles FOR UPDATE
  TO authenticated
  USING (client_id = current_user_client_id())
  WITH CHECK (client_id = current_user_client_id());
