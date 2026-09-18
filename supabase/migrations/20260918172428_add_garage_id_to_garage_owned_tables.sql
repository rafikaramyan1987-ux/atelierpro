/*
# Add garage_id to garage-owned tables and backfill

## Problem
The app was originally built for a single garage. Tables like clients, vehicles,
invoices, invoice_items, parts, devis_items, loaner_assignments, twint_payments,
and repair_order_items have no garage_id column. RLS policies use USING (true),
so any authenticated user sees every garage's data.

## Changes

### 1. New columns added (all nullable uuid, FK to garages.id)
- `clients.garage_id` — which garage owns this client record
- `vehicles.garage_id` — which garage owns this vehicle record
- `invoices.garage_id` — which garage issued this invoice
- `invoice_items.garage_id` — which garage owns this line item
- `parts.garage_id` — which garage's stock this part belongs to
- `devis_items.garage_id` — which garage owns this devis item
- `loaner_assignments.garage_id` — which garage owns this assignment
- `twint_payments.garage_id` — which garage owns this payment
- `repair_order_items.garage_id` — which garage owns this repair line item

### 2. Backfill
All existing rows are backfilled with the single existing garage_id
(075acc9a-4951-4c64-a33a-62d85cd29168) since there is currently only one
garage with data. For child tables (invoice_items, devis_items, etc.), the
garage_id is derived from the parent row.

### 3. Indexes
Added an index on garage_id for each table to support efficient filtering.

### Security
No policy changes in this migration — policies are updated in the next
migration. The columns are added first so data can be backfilled safely.
*/

-- ─── clients ───
ALTER TABLE clients ADD COLUMN IF NOT EXISTS garage_id uuid REFERENCES garages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_clients_garage_id ON clients(garage_id);

-- ─── vehicles ───
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS garage_id uuid REFERENCES garages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_garage_id ON vehicles(garage_id);

-- ─── invoices ───
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS garage_id uuid REFERENCES garages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_garage_id ON invoices(garage_id);

-- ─── invoice_items ───
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS garage_id uuid REFERENCES garages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_items_garage_id ON invoice_items(garage_id);

-- ─── parts ───
ALTER TABLE parts ADD COLUMN IF NOT EXISTS garage_id uuid REFERENCES garages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_parts_garage_id ON parts(garage_id);

-- ─── devis_items ───
ALTER TABLE devis_items ADD COLUMN IF NOT EXISTS garage_id uuid REFERENCES garages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_devis_items_garage_id ON devis_items(garage_id);

-- ─── loaner_assignments ───
ALTER TABLE loaner_assignments ADD COLUMN IF NOT EXISTS garage_id uuid REFERENCES garages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_loaner_assignments_garage_id ON loaner_assignments(garage_id);

-- ─── twint_payments ───
ALTER TABLE twint_payments ADD COLUMN IF NOT EXISTS garage_id uuid REFERENCES garages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_twint_payments_garage_id ON twint_payments(garage_id);

-- ─── repair_order_items ───
ALTER TABLE repair_order_items ADD COLUMN IF NOT EXISTS garage_id uuid REFERENCES garages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_repair_order_items_garage_id ON repair_order_items(garage_id);

-- ─── Backfill: set garage_id on all existing rows ───
-- There is currently only one garage with staff/data, so we use that garage_id.
-- For tables that already have garage_id (appointments, service_requests, etc.),
-- we leave existing values as-is.

-- Backfill top-level tables
UPDATE clients SET garage_id = '075acc9a-4951-4c64-a33a-62d85cd29168' WHERE garage_id IS NULL;
UPDATE vehicles SET garage_id = '075acc9a-4951-4c64-a33a-62d85cd29168' WHERE garage_id IS NULL;
UPDATE invoices SET garage_id = '075acc9a-4951-4c64-a33a-62d85cd29168' WHERE garage_id IS NULL;
UPDATE parts SET garage_id = '075acc9a-4951-4c64-a33a-62d85cd29168' WHERE garage_id IS NULL;

-- Backfill child tables from their parent
UPDATE invoice_items ii SET garage_id = i.garage_id
FROM invoices i WHERE ii.invoice_id = i.id AND ii.garage_id IS NULL;

UPDATE devis_items di SET garage_id = sr.garage_id
FROM service_requests sr WHERE di.devis_id = sr.id AND di.garage_id IS NULL;

UPDATE repair_order_items roi SET garage_id = ro.garage_id
FROM repair_orders ro WHERE roi.repair_order_id = ro.id AND roi.garage_id IS NULL;

UPDATE twint_payments tp SET garage_id = i.garage_id
FROM invoices i WHERE tp.invoice_id = i.id AND tp.garage_id IS NULL;

UPDATE loaner_assignments la SET garage_id = lv.garage_id
FROM loaner_vehicles lv WHERE la.loaner_vehicle_id = lv.id AND la.garage_id IS NULL;

-- Backfill any remaining NULL loaner_assignments from appointment or repair_order
UPDATE loaner_assignments la SET garage_id = a.garage_id
FROM appointments a WHERE la.appointment_id = a.id AND la.garage_id IS NULL;

UPDATE loaner_assignments la SET garage_id = ro.garage_id
FROM repair_orders ro WHERE la.repair_order_id = ro.id AND la.garage_id IS NULL;

-- Backfill vehicles from their client's garage_id
UPDATE vehicles v SET garage_id = c.garage_id
FROM clients c WHERE v.client_id = c.id AND v.garage_id IS NULL AND c.garage_id IS NOT NULL;

-- Backfill appointments, service_requests, repair_orders, canned_tasks, loaner_vehicles, parts_orders
-- These already have garage_id columns but some rows may be NULL
UPDATE appointments SET garage_id = '075acc9a-4951-4c64-a33a-62d85cd29168' WHERE garage_id IS NULL;
UPDATE service_requests SET garage_id = '075acc9a-4951-4c64-a33a-62d85cd29168' WHERE garage_id IS NULL;
UPDATE repair_orders SET garage_id = '075acc9a-4951-4c64-a33a-62d85cd29168' WHERE garage_id IS NULL;
UPDATE canned_tasks SET garage_id = '075acc9a-4951-4c64-a33a-62d85cd29168' WHERE garage_id IS NULL;
UPDATE loaner_vehicles SET garage_id = '075acc9a-4951-4c64-a33a-62d85cd29168' WHERE garage_id IS NULL;
UPDATE parts_orders SET garage_id = '075acc9a-4951-4c64-a33a-62d85cd29168' WHERE garage_id IS NULL;
