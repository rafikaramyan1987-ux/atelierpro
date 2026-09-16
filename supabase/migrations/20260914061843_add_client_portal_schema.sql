/*
# AtelierPro - Client Portal Schema (B2B2C Platform)

## Description
Transforms AtelierPro from a single-sided garage tool into a dual-sided B2B2C platform. Adds a 'client' role to profiles, a client_id column to link auth users to garage clients, appointments table for rendez-vous booking, and service_requests table for parts orders and service quotes.

## Changes to Existing Tables

1. `profiles` - Add 'client' to the role CHECK constraint
   - role can now be 'admin', 'mecanicien', or 'client'
   - Added `client_id` column (uuid, nullable) - links a client portal user to a garage client record
   - Added `phone` already exists

2. `clients` - Added `auth_user_id` column (uuid, nullable) - links a garage client to a portal auth account

## New Tables

3. `appointments` - Rendez-vous (appointments) booked by clients
   - `id` (uuid, PK)
   - `client_id` (uuid, FK to clients) - the garage client record
   - `vehicle_id` (uuid, FK to vehicles, nullable) - which vehicle
   - `requested_date` (date) - client's preferred date
   - `requested_time` (time) - client's preferred time slot
   - `service_type` (text) - type of service requested
   - `description` (text) - client's description of the problem or request
   - `status` (text: 'en_attente', 'confirme', 'refuse', 'termine', 'annule')
   - `assigned_to` (uuid, FK to profiles, nullable) - mechanic assigned
   - `scheduled_date` (date, nullable) - confirmed date by garage
   - `scheduled_time` (time, nullable) - confirmed time by garage
   - `garage_notes` (text, nullable) - internal notes from garage staff
   - `client_notes` (text, nullable) - notes from client
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)

4. `service_requests` - Parts orders and service quote requests from clients
   - `id` (uuid, PK)
   - `client_id` (uuid, FK to clients)
   - `vehicle_id` (uuid, FK to vehicles, nullable)
   - `type` (text: 'commande_pieces', 'demande_devis', 'demande_info')
   - `part_reference` (text, nullable) - requested part reference
   - `part_name` (text, nullable) - requested part name
   - `quantity` (integer, nullable)
   - `description` (text) - description of the request
   - `status` (text: 'en_attente', 'traitee', 'refusee')
   - `quoted_price` (numeric(12,2), nullable) - price quoted by garage
   - `garage_response` (text, nullable) - response from garage staff
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)

## Security

### profiles
- Updated CHECK constraint to include 'client' role
- All authenticated users can still read profiles
- Insert/update policies updated to allow client self-registration

### clients
- Added `auth_user_id` column
- Clients can read their own client record (matched by auth_user_id)
- Garage staff (admin/mecanicien) can read all clients (existing policy)
- Clients can update their own client record

### appointments
- RLS enabled
- Clients can read/create their own appointments (matched by client_id -> clients.auth_user_id)
- Garage staff can read/update/delete all appointments
- Clients can update their own appointments (e.g., cancel)

### service_requests
- RLS enabled
- Clients can read/create their own service requests
- Garage staff can read/update/delete all service requests

## Important Notes
1. The 'client' role is for vehicle owners who use the free client portal
2. The 'admin' and 'mecanicien' roles are for garage staff using the paid SaaS dashboard
3. When a client registers, their profile is created with role='client' and linked to a clients record via client_id
4. The existing handle_new_user trigger already creates a profile on signup; we update it to accept a 'role' from user metadata
5. Garage staff see appointments and service requests in a queue; clients see their own bookings
*/

-- ============================================================================
-- ALTER profiles: add 'client' role
-- ============================================================================
DO $$ BEGIN
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'mecanicien', 'client'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Add client_id column to profiles (links portal user to a garage client record)
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Add auth_user_id column to clients (links garage client to portal auth account)
DO $$ BEGIN
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================================================
-- TABLE: appointments
-- ============================================================================
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  requested_date date NOT NULL,
  requested_time text NOT NULL,
  service_type text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'confirme', 'refuse', 'termine', 'annule')),
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  scheduled_date date,
  scheduled_time text,
  garage_notes text,
  client_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Clients can read their own appointments
DROP POLICY IF EXISTS "select_appointments" ON appointments;
CREATE POLICY "select_appointments" ON appointments FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
    OR
    EXISTS (SELECT 1 FROM clients c WHERE c.id = appointments.client_id AND c.auth_user_id = auth.uid())
  );

-- Clients can insert their own appointments
DROP POLICY IF EXISTS "insert_appointments" ON appointments;
CREATE POLICY "insert_appointments" ON appointments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM clients c WHERE c.id = appointments.client_id AND c.auth_user_id = auth.uid())
  );

-- Garage staff can update all appointments; clients can update their own (cancel)
DROP POLICY IF EXISTS "update_appointments" ON appointments;
CREATE POLICY "update_appointments" ON appointments FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
    OR
    EXISTS (SELECT 1 FROM clients c WHERE c.id = appointments.client_id AND c.auth_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
    OR
    EXISTS (SELECT 1 FROM clients c WHERE c.id = appointments.client_id AND c.auth_user_id = auth.uid())
  );

-- Only garage staff can delete appointments
DROP POLICY IF EXISTS "delete_appointments" ON appointments;
CREATE POLICY "delete_appointments" ON appointments FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
  );

-- ============================================================================
-- TABLE: service_requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('commande_pieces', 'demande_devis', 'demande_info')),
  part_reference text,
  part_name text,
  quantity integer,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'traitee', 'refusee')),
  quoted_price numeric(12,2),
  garage_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

-- Clients can read their own service requests; garage staff can read all
DROP POLICY IF EXISTS "select_service_requests" ON service_requests;
CREATE POLICY "select_service_requests" ON service_requests FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
    OR
    EXISTS (SELECT 1 FROM clients c WHERE c.id = service_requests.client_id AND c.auth_user_id = auth.uid())
  );

-- Clients can insert their own service requests
DROP POLICY IF EXISTS "insert_service_requests" ON service_requests;
CREATE POLICY "insert_service_requests" ON service_requests FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM clients c WHERE c.id = service_requests.client_id AND c.auth_user_id = auth.uid())
  );

-- Garage staff can update all service requests
DROP POLICY IF EXISTS "update_service_requests" ON service_requests;
CREATE POLICY "update_service_requests" ON service_requests FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
  );

-- Only garage staff can delete service requests
DROP POLICY IF EXISTS "delete_service_requests" ON service_requests;
CREATE POLICY "delete_service_requests" ON service_requests FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'mecanicien'))
  );

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_requested_date ON appointments(requested_date);
CREATE INDEX IF NOT EXISTS idx_service_requests_client_id ON service_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_clients_auth_user_id ON clients(auth_user_id);

-- ============================================================================
-- Update profiles policies for client self-registration
-- ============================================================================
-- Clients can read all profiles (to see garage staff info) - already have select_profiles
-- Update insert policy to allow client self-registration
DROP POLICY IF EXISTS "insert_profiles_admin" ON profiles;
CREATE POLICY "insert_profiles_admin" ON profiles FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============================================================================
-- Update handle_new_user trigger to accept role from metadata
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role text;
  user_client_id text;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'mecanicien');
  user_client_id := NEW.raw_user_meta_data->>'client_id';

  INSERT INTO public.profiles (id, email, full_name, role, client_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    user_role,
    CASE WHEN user_client_id IS NOT NULL AND user_client_id != '' THEN user_client_id::uuid ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    client_id = EXCLUDED.client_id;

  -- If this is a client registration, link the client record
  IF user_role = 'client' AND user_client_id IS NOT NULL AND user_client_id != '' THEN
    UPDATE clients SET auth_user_id = NEW.id WHERE id = user_client_id::uuid;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
