/*
# Add garage reviews system and garage_id on appointments

## Changes

### 1. appointments table — new column
- `garage_id` (uuid, nullable, FK -> garages.id) — links an appointment to the garage that handled it, so reviews can be associated

### 2. New table: garage_reviews
- Clients leave a rating (1-5 stars) and optional written review for a garage after a completed appointment
- Fields: id, garage_id, client_id, appointment_id (unique), rating (1-5), comment, reviewer_name, created_at
- One review per appointment (enforced by unique constraint on appointment_id)
- RLS: clients can insert their own reviews; anyone can read reviews (public for search page); clients can update/delete their own reviews

### 3. RLS policies
- garage_reviews SELECT: public (TO anon, authenticated) — needed so the search page can display reviews
- garage_reviews INSERT: authenticated clients only, scoped to their own client_id
- garage_reviews UPDATE/DELETE: owner only (client_id matches their profile)
*/

-- ── Add garage_id to appointments ──
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'garage_id'
  ) THEN
    ALTER TABLE appointments ADD COLUMN garage_id uuid REFERENCES garages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Garage reviews table ──
CREATE TABLE IF NOT EXISTS garage_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid NOT NULL REFERENCES garages(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  appointment_id uuid UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  reviewer_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE garage_reviews ENABLE ROW LEVEL SECURITY;

-- Public read: anyone (including anon) can read reviews — needed for the search page
DROP POLICY IF EXISTS "public_read_garage_reviews" ON garage_reviews;
CREATE POLICY "public_read_garage_reviews" ON garage_reviews FOR SELECT
  TO anon, authenticated USING (true);

-- Clients can insert their own reviews
DROP POLICY IF EXISTS "client_insert_garage_reviews" ON garage_reviews;
CREATE POLICY "client_insert_garage_reviews" ON garage_reviews FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.client_id = garage_reviews.client_id)
  );

-- Clients can update their own reviews
DROP POLICY IF EXISTS "client_update_garage_reviews" ON garage_reviews;
CREATE POLICY "client_update_garage_reviews" ON garage_reviews FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.client_id = garage_reviews.client_id)
  );

-- Clients can delete their own reviews
DROP POLICY IF EXISTS "client_delete_garage_reviews" ON garage_reviews;
CREATE POLICY "client_delete_garage_reviews" ON garage_reviews FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.client_id = garage_reviews.client_id)
  );

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_garage_reviews_garage_id ON garage_reviews(garage_id);
CREATE INDEX IF NOT EXISTS idx_appointments_garage_id ON appointments(garage_id);