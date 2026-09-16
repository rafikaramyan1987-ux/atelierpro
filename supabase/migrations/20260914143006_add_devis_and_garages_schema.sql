/*
# Add Devis (Quote) and Garages schema

## Changes

### 1. New table: garages
- Stores garage partner information visible to clients

### 2. New table: devis_items
- Itemized quote line items (services/parts with pricing)

### 3. Modify service_requests
- Add garage_id column (FK -> garages)
- Migrate old statuses and types BEFORE adding new constraints
- New status CHECK: en_attente, devis_recu, devis_accepte, devis_refuse
- New type CHECK: demande_devis only

### 4. RLS policies for garages and devis_items

### 5. Seed demo garage
*/

-- ── Drop old constraints FIRST so we can migrate data ──
ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_status_check;
ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_type_check;

-- ── Migrate old data ──
UPDATE service_requests SET type = 'demande_devis' WHERE type != 'demande_devis';
UPDATE service_requests SET status = 'devis_recu' WHERE status = 'traitee';
UPDATE service_requests SET status = 'devis_refuse' WHERE status = 'refusee';

-- ── Garages table ──
CREATE TABLE IF NOT EXISTS garages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  postal_code text NOT NULL,
  phone text NOT NULL,
  email text,
  services_offered text[] DEFAULT '{}',
  latitude double precision,
  longitude double precision,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE garages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_garages" ON garages;
CREATE POLICY "anon_read_garages" ON garages FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_garages" ON garages;
CREATE POLICY "staff_insert_garages" ON garages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
  );

DROP POLICY IF EXISTS "staff_update_garages" ON garages;
CREATE POLICY "staff_update_garages" ON garages FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
  );

DROP POLICY IF EXISTS "staff_delete_garages" ON garages;
CREATE POLICY "staff_delete_garages" ON garages FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
  );

-- ── Devis items table ──
CREATE TABLE IF NOT EXISTS devis_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE devis_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_read_devis_items" ON devis_items;
CREATE POLICY "client_read_devis_items" ON devis_items FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM service_requests sr
      JOIN clients c ON c.id = sr.client_id
      WHERE sr.id = devis_items.devis_id AND c.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "staff_read_devis_items" ON devis_items;
CREATE POLICY "staff_read_devis_items" ON devis_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
  );

DROP POLICY IF EXISTS "staff_insert_devis_items" ON devis_items;
CREATE POLICY "staff_insert_devis_items" ON devis_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
  );

DROP POLICY IF EXISTS "staff_update_devis_items" ON devis_items;
CREATE POLICY "staff_update_devis_items" ON devis_items FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
  );

DROP POLICY IF EXISTS "staff_delete_devis_items" ON devis_items;
CREATE POLICY "staff_delete_devis_items" ON devis_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
  );

-- ── Add garage_id to service_requests ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service_requests' AND column_name = 'garage_id'
  ) THEN
    ALTER TABLE service_requests ADD COLUMN garage_id uuid REFERENCES garages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Add new constraints ──
ALTER TABLE service_requests ADD CONSTRAINT service_requests_status_check
  CHECK (status IN ('en_attente', 'devis_recu', 'devis_accepte', 'devis_refuse'));

ALTER TABLE service_requests ADD CONSTRAINT service_requests_type_check
  CHECK (type = 'demande_devis');

-- ── Seed demo garage ──
INSERT INTO garages (name, address, city, postal_code, phone, email, services_offered, latitude, longitude)
VALUES (
  'AtelierPro Lausanne',
  'Route de l''Atelier 12',
  'Lausanne',
  '1000',
  '+41 21 555 12 34',
  'contact@atelierpro.ch',
  ARRAY['Vidange', 'Freinage', 'Pneus', 'Diagnostic', 'Révision générale', 'Suspension', 'Électricité', 'Carrosserie'],
  46.5197,
  6.6323
)
ON CONFLICT DO NOTHING;
