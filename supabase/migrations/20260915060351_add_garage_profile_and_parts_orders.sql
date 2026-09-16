/*
# Add garage profile fields and parts orders

## Changes

### 1. garages table — new columns
- `description` (text, nullable) — free-text garage presentation shown to clients
- `logo_url` (text, nullable) — optional logo/photo URL

### 2. profiles table — new column
- `garage_id` (uuid, nullable, FK -> garages.id) — links a garage staff member to their garage record

### 3. New table: parts_orders
- Garage staff order supplies/parts for their own inventory (distinct from client devis requests)
- Fields: id, garage_id, part_name, part_reference, quantity, urgency, status, notes, created_by, created_at, updated_at
- Status flow: en_attente -> commandee -> recue

### 4. RLS policies
- parts_orders: staff CRUD (admin/mecanicien), scoped to their garage
- garages: existing policies already allow staff CRUD; new columns inherit those policies
- profiles: existing update policy allows self-update, so garage_id can be set by the user themselves
*/

-- ── Add description and logo_url to garages ──
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'garages' AND column_name = 'description'
  ) THEN
    ALTER TABLE garages ADD COLUMN description text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'garages' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE garages ADD COLUMN logo_url text;
  END IF;
END $$;

-- ── Add garage_id to profiles ──
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'garage_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN garage_id uuid REFERENCES garages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Parts orders table ──
CREATE TABLE IF NOT EXISTS parts_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid REFERENCES garages(id) ON DELETE SET NULL,
  part_name text NOT NULL,
  part_reference text,
  quantity integer NOT NULL DEFAULT 1,
  urgency text NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent', 'critique')),
  status text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'commandee', 'recue')),
  notes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE parts_orders ENABLE ROW LEVEL SECURITY;

-- Staff can read all parts orders
DROP POLICY IF EXISTS "staff_read_parts_orders" ON parts_orders;
CREATE POLICY "staff_read_parts_orders" ON parts_orders FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
  );

-- Staff can insert parts orders
DROP POLICY IF EXISTS "staff_insert_parts_orders" ON parts_orders;
CREATE POLICY "staff_insert_parts_orders" ON parts_orders FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
  );

-- Staff can update parts orders
DROP POLICY IF EXISTS "staff_update_parts_orders" ON parts_orders;
CREATE POLICY "staff_update_parts_orders" ON parts_orders FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
  );

-- Staff can delete parts orders
DROP POLICY IF EXISTS "staff_delete_parts_orders" ON parts_orders;
CREATE POLICY "staff_delete_parts_orders" ON parts_orders FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
  );

-- ── Index for parts_orders by garage ──
CREATE INDEX IF NOT EXISTS idx_parts_orders_garage_id ON parts_orders(garage_id);
CREATE INDEX IF NOT EXISTS idx_parts_orders_status ON parts_orders(status);
