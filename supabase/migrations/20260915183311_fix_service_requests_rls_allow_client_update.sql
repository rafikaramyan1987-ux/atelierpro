-- Fix: Allow clients to update their own service_requests
-- This is needed for clients to accept/refuse devis and add signatures.
-- Previously only staff (admin/mecanicien) could update, so client
-- accept/refuse/signature actions silently failed (0 rows updated).

DROP POLICY IF EXISTS "update_service_requests" ON service_requests;

CREATE POLICY "update_service_requests" ON service_requests FOR UPDATE
  TO authenticated USING (
    -- Staff can update any service request
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
    OR
    -- Clients can update their own service requests
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = service_requests.client_id AND c.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
    OR
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = service_requests.client_id AND c.auth_user_id = auth.uid()
    )
  );