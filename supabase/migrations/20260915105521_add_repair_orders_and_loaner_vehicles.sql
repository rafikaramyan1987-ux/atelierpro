/*
# Add Repair Orders, Loaner Vehicles, and Multi-Payer Invoicing

1. New Tables
- `repair_orders` — Ordre de Réparation (OR) that sits between devis and invoice.
  - Links to service_request (devis), client, vehicle, assigned mechanic.
  - Status: en_cours, termine, facture.
  - Tracks start_time and end_time for work duration.
  - Links to invoice once converted.
- `repair_order_items` — line items carried over from devis_items when creating an OR.
  - description, quantity, unit_price, line_total.
- `loaner_vehicles` — garage's courtesy/loaner vehicles.
  - make, model, license_plate, status (available, in_use, maintenance).
- `loaner_assignments` — tracks which loaner is assigned to which client/appointment/OR.
  - loaner_vehicle_id, client_id, appointment_id, repair_order_id, start_date, end_date.

2. Modified Tables
- `invoices` — add payer_type (client, assurance, flotte), secondary_payer_type, secondary_payer_amount.

3. Security
- RLS enabled on all new tables with authenticated-only CRUD (same pattern as existing tables).
*/

-- ═══════════════════════════════════════════════════
-- REPAIR ORDERS
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS repair_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  or_number text NOT NULL,
  service_request_id uuid REFERENCES service_requests(id) ON DELETE SET NULL,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  assigned_mechanic_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'en_cours' CHECK (status IN ('en_cours', 'termine', 'facture')),
  start_time timestamptz,
  end_time timestamptz,
  notes text,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  garage_id uuid REFERENCES garages(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repair_orders_client ON repair_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_repair_orders_status ON repair_orders(status);
CREATE INDEX IF NOT EXISTS idx_repair_orders_mechanic ON repair_orders(assigned_mechanic_id);

ALTER TABLE repair_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_repair_orders" ON repair_orders;
CREATE POLICY "select_repair_orders" ON repair_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_repair_orders" ON repair_orders;
CREATE POLICY "insert_repair_orders" ON repair_orders FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_repair_orders" ON repair_orders;
CREATE POLICY "update_repair_orders" ON repair_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_repair_orders" ON repair_orders;
CREATE POLICY "delete_repair_orders" ON repair_orders FOR DELETE TO authenticated USING (true);

-- ═══════════════════════════════════════════════════
-- REPAIR ORDER ITEMS
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS repair_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_order_id uuid NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repair_order_items_ro ON repair_order_items(repair_order_id);

ALTER TABLE repair_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_repair_order_items" ON repair_order_items;
CREATE POLICY "select_repair_order_items" ON repair_order_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_repair_order_items" ON repair_order_items;
CREATE POLICY "insert_repair_order_items" ON repair_order_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_repair_order_items" ON repair_order_items;
CREATE POLICY "update_repair_order_items" ON repair_order_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_repair_order_items" ON repair_order_items;
CREATE POLICY "delete_repair_order_items" ON repair_order_items FOR DELETE TO authenticated USING (true);

-- ═══════════════════════════════════════════════════
-- LOANER VEHICLES
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS loaner_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid REFERENCES garages(id) ON DELETE SET NULL,
  make text NOT NULL,
  model text NOT NULL,
  license_plate text NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE loaner_vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_loaner_vehicles" ON loaner_vehicles;
CREATE POLICY "select_loaner_vehicles" ON loaner_vehicles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_loaner_vehicles" ON loaner_vehicles;
CREATE POLICY "insert_loaner_vehicles" ON loaner_vehicles FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_loaner_vehicles" ON loaner_vehicles;
CREATE POLICY "update_loaner_vehicles" ON loaner_vehicles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_loaner_vehicles" ON loaner_vehicles;
CREATE POLICY "delete_loaner_vehicles" ON loaner_vehicles FOR DELETE TO authenticated USING (true);

-- ═══════════════════════════════════════════════════
-- LOANER ASSIGNMENTS
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS loaner_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loaner_vehicle_id uuid NOT NULL REFERENCES loaner_vehicles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  repair_order_id uuid REFERENCES repair_orders(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned')),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loaner_assignments_vehicle ON loaner_assignments(loaner_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_loaner_assignments_status ON loaner_assignments(status);

ALTER TABLE loaner_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_loaner_assignments" ON loaner_assignments;
CREATE POLICY "select_loaner_assignments" ON loaner_assignments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_loaner_assignments" ON loaner_assignments;
CREATE POLICY "insert_loaner_assignments" ON loaner_assignments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_loaner_assignments" ON loaner_assignments;
CREATE POLICY "update_loaner_assignments" ON loaner_assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_loaner_assignments" ON loaner_assignments;
CREATE POLICY "delete_loaner_assignments" ON loaner_assignments FOR DELETE TO authenticated USING (true);

-- ═══════════════════════════════════════════════════
-- INVOICE PAYER FIELDS (Multi-payer invoicing)
-- ═══════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'payer_type'
  ) THEN
    ALTER TABLE invoices ADD COLUMN payer_type text NOT NULL DEFAULT 'client' CHECK (payer_type IN ('client', 'assurance', 'flotte'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'secondary_payer_type'
  ) THEN
    ALTER TABLE invoices ADD COLUMN secondary_payer_type text CHECK (secondary_payer_type IN ('client', 'assurance', 'flotte'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'secondary_payer_amount'
  ) THEN
    ALTER TABLE invoices ADD COLUMN secondary_payer_amount numeric(10,2);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════
-- OR NUMBER SEQUENCE
-- ═══════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_schema = 'public' AND sequence_name = 'repair_order_seq') THEN
    CREATE SEQUENCE repair_order_seq START 1;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION generate_or_number()
RETURNS text AS $$
DECLARE
  next_val bigint;
  year int;
BEGIN
  SELECT nextval('repair_order_seq') INTO next_val;
  SELECT EXTRACT(YEAR FROM now()) INTO year;
  RETURN 'OR-' || year || '-' || lpad(next_val::text, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;