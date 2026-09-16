/*
# Create canned_tasks table

1. New Tables
- `canned_tasks`
  - `id` (uuid, primary key, auto-generated)
  - `garage_id` (uuid, nullable, references garages)
  - `name` (text, not null) — short label like "Vidange moteur"
  - `description` (text, nullable) — longer description of the service
  - `estimated_duration_minutes` (integer, nullable) — expected time in minutes
  - `default_price` (numeric(10,2), nullable) — default unit price in CHF
  - `created_at` (timestamptz, default now())
  - Purpose: Reusable service templates that speed up creating devis and repair orders

2. Security
- RLS enabled on `canned_tasks`
- Staff-only CRUD (same pattern as `parts_orders`): admin + mecanicien roles
- 4 separate policies: select, insert, update, delete

3. Notes
- The table is optional/nullable everywhere — existing flows are unaffected
- Frontend will add a management page and pickers in devis and repair order creation
*/

CREATE TABLE IF NOT EXISTS canned_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid REFERENCES garages(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  estimated_duration_minutes integer,
  default_price numeric(10,2),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE canned_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_canned_tasks" ON canned_tasks;
CREATE POLICY "staff_read_canned_tasks" ON canned_tasks FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
  );

DROP POLICY IF EXISTS "staff_insert_canned_tasks" ON canned_tasks;
CREATE POLICY "staff_insert_canned_tasks" ON canned_tasks FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
  );

DROP POLICY IF EXISTS "staff_update_canned_tasks" ON canned_tasks;
CREATE POLICY "staff_update_canned_tasks" ON canned_tasks FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
  );

DROP POLICY IF EXISTS "staff_delete_canned_tasks" ON canned_tasks;
CREATE POLICY "staff_delete_canned_tasks" ON canned_tasks FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
  );

CREATE INDEX IF NOT EXISTS idx_canned_tasks_garage_id ON canned_tasks(garage_id);