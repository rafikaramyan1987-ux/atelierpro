/*
# Replace permissive RLS policies with garage-scoped policies (retry)

Previous attempt failed because parts_orders had mismatched policy names.
That's been fixed. This migration now replaces all permissive policies on
all garage-owned tables with garage-scoped ones using current_user_garage_id().

A user whose garage_id is NULL sees nothing — current_user_garage_id() returns
NULL and NULL = anything is false, so no rows match.

Client portal access is preserved: clients see their own data via auth_user_id
linkage on clients, vehicles, invoices, appointments, service_requests,
devis_items, and twint_payments.

The garages table stays publicly readable for "Trouver un garage".
*/

-- ═══════════════════════════════════════════════════════════════
-- CLIENTS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "anon_select_unclaimed_clients" ON clients;
DROP POLICY IF EXISTS "anon_insert_clients_registration" ON clients;
DROP POLICY IF EXISTS "select_clients" ON clients;
DROP POLICY IF EXISTS "insert_clients" ON clients;
DROP POLICY IF EXISTS "update_clients" ON clients;
DROP POLICY IF EXISTS "delete_clients" ON clients;

CREATE POLICY "anon_insert_clients_registration" ON clients FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "client_select_own" ON clients FOR SELECT
  TO authenticated USING (auth_user_id = auth.uid());

CREATE POLICY "staff_select_clients" ON clients FOR SELECT
  TO authenticated USING (garage_id = current_user_garage_id());

CREATE POLICY "staff_insert_clients" ON clients FOR INSERT
  TO authenticated WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_update_clients" ON clients FOR UPDATE
  TO authenticated USING (garage_id = current_user_garage_id())
  WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_delete_clients" ON clients FOR DELETE
  TO authenticated USING (garage_id = current_user_garage_id());

-- ═══════════════════════════════════════════════════════════════
-- VEHICLES
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "anon_insert_vehicles_registration" ON vehicles;
DROP POLICY IF EXISTS "select_vehicles" ON vehicles;
DROP POLICY IF EXISTS "insert_vehicles" ON vehicles;
DROP POLICY IF EXISTS "update_vehicles" ON vehicles;
DROP POLICY IF EXISTS "delete_vehicles" ON vehicles;

CREATE POLICY "anon_insert_vehicles_registration" ON vehicles FOR INSERT
  TO anon, authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM clients c WHERE c.id = vehicles.client_id AND c.auth_user_id IS NULL)
  );

CREATE POLICY "client_select_own_vehicles" ON vehicles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM clients c WHERE c.id = vehicles.client_id AND c.auth_user_id = auth.uid())
  );

CREATE POLICY "staff_select_vehicles" ON vehicles FOR SELECT
  TO authenticated USING (garage_id = current_user_garage_id());

CREATE POLICY "staff_insert_vehicles" ON vehicles FOR INSERT
  TO authenticated WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_update_vehicles" ON vehicles FOR UPDATE
  TO authenticated USING (garage_id = current_user_garage_id())
  WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_delete_vehicles" ON vehicles FOR DELETE
  TO authenticated USING (garage_id = current_user_garage_id());

-- ═══════════════════════════════════════════════════════════════
-- INVOICES
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "select_invoices" ON invoices;
DROP POLICY IF EXISTS "select_invoices_garage" ON invoices;
DROP POLICY IF EXISTS "insert_invoices" ON invoices;
DROP POLICY IF EXISTS "update_invoices" ON invoices;
DROP POLICY IF EXISTS "delete_invoices" ON invoices;

CREATE POLICY "client_select_own_invoices" ON invoices FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM clients c WHERE c.id = invoices.client_id AND c.auth_user_id = auth.uid())
  );

CREATE POLICY "staff_select_invoices" ON invoices FOR SELECT
  TO authenticated USING (garage_id = current_user_garage_id());

CREATE POLICY "staff_insert_invoices" ON invoices FOR INSERT
  TO authenticated WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_update_invoices" ON invoices FOR UPDATE
  TO authenticated USING (garage_id = current_user_garage_id())
  WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_delete_invoices" ON invoices FOR DELETE
  TO authenticated USING (garage_id = current_user_garage_id());

-- ═══════════════════════════════════════════════════════════════
-- INVOICE_ITEMS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "select_invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "insert_invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "update_invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "delete_invoice_items" ON invoice_items;

CREATE POLICY "client_select_own_invoice_items" ON invoice_items FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN clients c ON c.id = i.client_id
      WHERE i.id = invoice_items.invoice_id AND c.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "staff_select_invoice_items" ON invoice_items FOR SELECT
  TO authenticated USING (garage_id = current_user_garage_id());

CREATE POLICY "staff_insert_invoice_items" ON invoice_items FOR INSERT
  TO authenticated WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_update_invoice_items" ON invoice_items FOR UPDATE
  TO authenticated USING (garage_id = current_user_garage_id())
  WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_delete_invoice_items" ON invoice_items FOR DELETE
  TO authenticated USING (garage_id = current_user_garage_id());

-- ═══════════════════════════════════════════════════════════════
-- PARTS (stock)
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "select_parts" ON parts;
DROP POLICY IF EXISTS "insert_parts" ON parts;
DROP POLICY IF EXISTS "update_parts" ON parts;
DROP POLICY IF EXISTS "delete_parts" ON parts;

CREATE POLICY "staff_select_parts" ON parts FOR SELECT
  TO authenticated USING (garage_id = current_user_garage_id());

CREATE POLICY "staff_insert_parts" ON parts FOR INSERT
  TO authenticated WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_update_parts" ON parts FOR UPDATE
  TO authenticated USING (garage_id = current_user_garage_id())
  WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_delete_parts" ON parts FOR DELETE
  TO authenticated USING (garage_id = current_user_garage_id());

-- ═══════════════════════════════════════════════════════════════
-- DEVIS_ITEMS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "client_read_devis_items" ON devis_items;
DROP POLICY IF EXISTS "staff_read_devis_items" ON devis_items;
DROP POLICY IF EXISTS "staff_insert_devis_items" ON devis_items;
DROP POLICY IF EXISTS "staff_update_devis_items" ON devis_items;
DROP POLICY IF EXISTS "staff_delete_devis_items" ON devis_items;

CREATE POLICY "client_select_own_devis_items" ON devis_items FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM service_requests sr
      JOIN clients c ON c.id = sr.client_id
      WHERE sr.id = devis_items.devis_id AND c.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "staff_select_devis_items" ON devis_items FOR SELECT
  TO authenticated USING (garage_id = current_user_garage_id());

CREATE POLICY "staff_insert_devis_items" ON devis_items FOR INSERT
  TO authenticated WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_update_devis_items" ON devis_items FOR UPDATE
  TO authenticated USING (garage_id = current_user_garage_id())
  WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_delete_devis_items" ON devis_items FOR DELETE
  TO authenticated USING (garage_id = current_user_garage_id());

-- ═══════════════════════════════════════════════════════════════
-- REPAIR_ORDER_ITEMS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "select_repair_order_items" ON repair_order_items;
DROP POLICY IF EXISTS "insert_repair_order_items" ON repair_order_items;
DROP POLICY IF EXISTS "update_repair_order_items" ON repair_order_items;
DROP POLICY IF EXISTS "delete_repair_order_items" ON repair_order_items;

CREATE POLICY "staff_select_repair_order_items" ON repair_order_items FOR SELECT
  TO authenticated USING (garage_id = current_user_garage_id());

CREATE POLICY "staff_insert_repair_order_items" ON repair_order_items FOR INSERT
  TO authenticated WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_update_repair_order_items" ON repair_order_items FOR UPDATE
  TO authenticated USING (garage_id = current_user_garage_id())
  WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_delete_repair_order_items" ON repair_order_items FOR DELETE
  TO authenticated USING (garage_id = current_user_garage_id());

-- ═══════════════════════════════════════════════════════════════
-- LOANER_ASSIGNMENTS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "select_loaner_assignments" ON loaner_assignments;
DROP POLICY IF EXISTS "insert_loaner_assignments" ON loaner_assignments;
DROP POLICY IF EXISTS "update_loaner_assignments" ON loaner_assignments;
DROP POLICY IF EXISTS "delete_loaner_assignments" ON loaner_assignments;

CREATE POLICY "staff_select_loaner_assignments" ON loaner_assignments FOR SELECT
  TO authenticated USING (garage_id = current_user_garage_id());

CREATE POLICY "staff_insert_loaner_assignments" ON loaner_assignments FOR INSERT
  TO authenticated WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_update_loaner_assignments" ON loaner_assignments FOR UPDATE
  TO authenticated USING (garage_id = current_user_garage_id())
  WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_delete_loaner_assignments" ON loaner_assignments FOR DELETE
  TO authenticated USING (garage_id = current_user_garage_id());

-- ═══════════════════════════════════════════════════════════════
-- TWINT_PAYMENTS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "select_twint_payments" ON twint_payments;
DROP POLICY IF EXISTS "insert_twint_payments" ON twint_payments;
DROP POLICY IF EXISTS "update_twint_payments" ON twint_payments;
DROP POLICY IF EXISTS "delete_twint_payments" ON twint_payments;

CREATE POLICY "client_select_own_twint_payments" ON twint_payments FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN clients c ON c.id = i.client_id
      WHERE i.id = twint_payments.invoice_id AND c.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "staff_select_twint_payments" ON twint_payments FOR SELECT
  TO authenticated USING (garage_id = current_user_garage_id());

CREATE POLICY "staff_insert_twint_payments" ON twint_payments FOR INSERT
  TO authenticated WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_update_twint_payments" ON twint_payments FOR UPDATE
  TO authenticated USING (garage_id = current_user_garage_id())
  WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_delete_twint_payments" ON twint_payments FOR DELETE
  TO authenticated USING (garage_id = current_user_garage_id());

-- ═══════════════════════════════════════════════════════════════
-- APPOINTMENTS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "select_appointments" ON appointments;
DROP POLICY IF EXISTS "insert_appointments" ON appointments;
DROP POLICY IF EXISTS "update_appointments" ON appointments;
DROP POLICY IF EXISTS "delete_appointments" ON appointments;

CREATE POLICY "client_select_own_appointments" ON appointments FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM clients c WHERE c.id = appointments.client_id AND c.auth_user_id = auth.uid())
  );

CREATE POLICY "staff_select_appointments" ON appointments FOR SELECT
  TO authenticated USING (garage_id = current_user_garage_id());

CREATE POLICY "client_insert_appointments" ON appointments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM clients c WHERE c.id = appointments.client_id AND c.auth_user_id = auth.uid())
  );

CREATE POLICY "staff_insert_appointments" ON appointments FOR INSERT
  TO authenticated WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "client_update_own_appointments" ON appointments FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM clients c WHERE c.id = appointments.client_id AND c.auth_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM clients c WHERE c.id = appointments.client_id AND c.auth_user_id = auth.uid()));

CREATE POLICY "staff_update_appointments" ON appointments FOR UPDATE
  TO authenticated
  USING (garage_id = current_user_garage_id())
  WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_delete_appointments" ON appointments FOR DELETE
  TO authenticated USING (garage_id = current_user_garage_id());

-- ═══════════════════════════════════════════════════════════════
-- SERVICE_REQUESTS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "select_service_requests" ON service_requests;
DROP POLICY IF EXISTS "select_service_requests_garage" ON service_requests;
DROP POLICY IF EXISTS "insert_service_requests" ON service_requests;
DROP POLICY IF EXISTS "update_service_requests" ON service_requests;
DROP POLICY IF EXISTS "delete_service_requests" ON service_requests;

CREATE POLICY "client_select_own_service_requests" ON service_requests FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM clients c WHERE c.id = service_requests.client_id AND c.auth_user_id = auth.uid())
  );

CREATE POLICY "staff_select_service_requests" ON service_requests FOR SELECT
  TO authenticated USING (garage_id = current_user_garage_id());

CREATE POLICY "client_insert_service_requests" ON service_requests FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM clients c WHERE c.id = service_requests.client_id AND c.auth_user_id = auth.uid())
  );

CREATE POLICY "staff_update_service_requests" ON service_requests FOR UPDATE
  TO authenticated
  USING (garage_id = current_user_garage_id())
  WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_delete_service_requests" ON service_requests FOR DELETE
  TO authenticated USING (garage_id = current_user_garage_id());

-- ═══════════════════════════════════════════════════════════════
-- REPAIR_ORDERS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "select_repair_orders" ON repair_orders;
DROP POLICY IF EXISTS "insert_repair_orders" ON repair_orders;
DROP POLICY IF EXISTS "update_repair_orders" ON repair_orders;
DROP POLICY IF EXISTS "delete_repair_orders" ON repair_orders;

CREATE POLICY "staff_select_repair_orders" ON repair_orders FOR SELECT
  TO authenticated USING (garage_id = current_user_garage_id());

CREATE POLICY "staff_insert_repair_orders" ON repair_orders FOR INSERT
  TO authenticated WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_update_repair_orders" ON repair_orders FOR UPDATE
  TO authenticated
  USING (garage_id = current_user_garage_id())
  WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_delete_repair_orders" ON repair_orders FOR DELETE
  TO authenticated USING (garage_id = current_user_garage_id());

-- ═══════════════════════════════════════════════════════════════
-- CANNED_TASKS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "staff_read_canned_tasks" ON canned_tasks;
DROP POLICY IF EXISTS "staff_insert_canned_tasks" ON canned_tasks;
DROP POLICY IF EXISTS "staff_update_canned_tasks" ON canned_tasks;
DROP POLICY IF EXISTS "staff_delete_canned_tasks" ON canned_tasks;

CREATE POLICY "staff_select_canned_tasks" ON canned_tasks FOR SELECT
  TO authenticated USING (garage_id = current_user_garage_id());

CREATE POLICY "staff_insert_canned_tasks" ON canned_tasks FOR INSERT
  TO authenticated WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_update_canned_tasks" ON canned_tasks FOR UPDATE
  TO authenticated
  USING (garage_id = current_user_garage_id())
  WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_delete_canned_tasks" ON canned_tasks FOR DELETE
  TO authenticated USING (garage_id = current_user_garage_id());

-- ═══════════════════════════════════════════════════════════════
-- LOANER_VEHICLES
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "select_loaner_vehicles" ON loaner_vehicles;
DROP POLICY IF EXISTS "insert_loaner_vehicles" ON loaner_vehicles;
DROP POLICY IF EXISTS "update_loaner_vehicles" ON loaner_vehicles;
DROP POLICY IF EXISTS "delete_loaner_vehicles" ON loaner_vehicles;

CREATE POLICY "staff_select_loaner_vehicles" ON loaner_vehicles FOR SELECT
  TO authenticated USING (garage_id = current_user_garage_id());

CREATE POLICY "staff_insert_loaner_vehicles" ON loaner_vehicles FOR INSERT
  TO authenticated WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_update_loaner_vehicles" ON loaner_vehicles FOR UPDATE
  TO authenticated
  USING (garage_id = current_user_garage_id())
  WITH CHECK (garage_id = current_user_garage_id());

CREATE POLICY "staff_delete_loaner_vehicles" ON loaner_vehicles FOR DELETE
  TO authenticated USING (garage_id = current_user_garage_id());

-- ═══════════════════════════════════════════════════════════════
-- GARAGE_REVIEWS — public read, client write
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "public_read_garage_reviews" ON garage_reviews;
DROP POLICY IF EXISTS "client_insert_garage_reviews" ON garage_reviews;
DROP POLICY IF EXISTS "client_update_garage_reviews" ON garage_reviews;
DROP POLICY IF EXISTS "client_delete_garage_reviews" ON garage_reviews;

CREATE POLICY "public_select_garage_reviews" ON garage_reviews FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "client_insert_garage_reviews" ON garage_reviews FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.client_id = garage_reviews.client_id)
  );

CREATE POLICY "client_update_garage_reviews" ON garage_reviews FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.client_id = garage_reviews.client_id))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.client_id = garage_reviews.client_id));

CREATE POLICY "client_delete_garage_reviews" ON garage_reviews FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.client_id = garage_reviews.client_id)
  );

-- ═══════════════════════════════════════════════════════════════
-- GARAGES — public read, admin update for own garage
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "anon_read_garages" ON garages;
DROP POLICY IF EXISTS "staff_insert_garages" ON garages;
DROP POLICY IF EXISTS "staff_update_garages" ON garages;
DROP POLICY IF EXISTS "staff_delete_garages" ON garages;

CREATE POLICY "public_select_garages" ON garages FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "admin_update_own_garage" ON garages FOR UPDATE
  TO authenticated
  USING (id = current_user_garage_id())
  WITH CHECK (id = current_user_garage_id());

-- ═══════════════════════════════════════════════════════════════
-- PROFILES — self read, same-garage colleagues read, admin update
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "select_profiles" ON profiles;
DROP POLICY IF EXISTS "select_profiles_self" ON profiles;
DROP POLICY IF EXISTS "update_profiles" ON profiles;
DROP POLICY IF EXISTS "insert_profiles_admin" ON profiles;
DROP POLICY IF EXISTS "delete_profiles_admin" ON profiles;

CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

CREATE POLICY "select_colleagues" ON profiles FOR SELECT
  TO authenticated USING (
    garage_id IS NOT NULL AND garage_id = current_user_garage_id()
  );

CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "admin_update_garage_profiles" ON profiles FOR UPDATE
  TO authenticated
  USING (
    garage_id IS NOT NULL AND garage_id = current_user_garage_id()
    AND current_user_role() = 'admin'
  )
  WITH CHECK (
    garage_id IS NOT NULL AND garage_id = current_user_garage_id()
    AND current_user_role() = 'admin'
  );
