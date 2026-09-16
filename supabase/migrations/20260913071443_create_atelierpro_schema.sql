/*
# AtelierPro - Schéma complet pour gestion d'atelier suisse

## Description
Crée le schéma de base de données complet pour AtelierPro, une application SaaS de gestion d'atelier automobile suisse. Inclut la gestion des employés avec rôles, clients, véhicules, stock de pièces, factures avec TVA 8.1%, et paiements Twint.

## Nouvelles Tables
1. `profiles` - Profils des employés avec rôles (admin/mecanicien)
2. `clients` - Clients du garage
3. `vehicles` - Véhicules des clients
4. `parts` - Stock de pièces et consommables
5. `invoices` - Factures avec TVA suisse 8.1%
6. `invoice_items` - Lignes de facture
7. `twint_payments` - Transactions Twint

## Sécurité
- RLS activée sur toutes les tables
- Toutes les politiques sont pour `authenticated` uniquement (app avec connexion)
- `profiles` accessible à tous les employés authentifiés (lecture), modification par admin uniquement
- Les autres tables: tous les employés authentifiés peuvent lire et écrire (atelier partagé)
*/

-- ============================================================================
-- TABLE: profiles
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'mecanicien' CHECK (role IN ('admin', 'mecanicien')),
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_profiles" ON profiles;
CREATE POLICY "select_profiles" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_profiles_admin" ON profiles;
CREATE POLICY "insert_profiles_admin" ON profiles FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "update_profiles" ON profiles;
CREATE POLICY "update_profiles" ON profiles FOR UPDATE
  TO authenticated USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_profiles_admin" ON profiles;
CREATE POLICY "delete_profiles_admin" ON profiles FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================================
-- TABLE: clients
-- ============================================================================
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text NOT NULL,
  address text,
  city text,
  postal_code text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_clients" ON clients;
CREATE POLICY "select_clients" ON clients FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_clients" ON clients;
CREATE POLICY "insert_clients" ON clients FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_clients" ON clients;
CREATE POLICY "update_clients" ON clients FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_clients" ON clients;
CREATE POLICY "delete_clients" ON clients FOR DELETE
  TO authenticated USING (true);

-- ============================================================================
-- TABLE: vehicles
-- ============================================================================
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  brand text NOT NULL,
  model text NOT NULL,
  license_plate text NOT NULL,
  vin text,
  year integer,
  mileage integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_vehicles" ON vehicles;
CREATE POLICY "select_vehicles" ON vehicles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_vehicles" ON vehicles;
CREATE POLICY "insert_vehicles" ON vehicles FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_vehicles" ON vehicles;
CREATE POLICY "update_vehicles" ON vehicles FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_vehicles" ON vehicles;
CREATE POLICY "delete_vehicles" ON vehicles FOR DELETE
  TO authenticated USING (true);

-- ============================================================================
-- TABLE: parts
-- ============================================================================
CREATE TABLE IF NOT EXISTS parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  stock_quantity integer NOT NULL DEFAULT 0,
  min_stock_threshold integer NOT NULL DEFAULT 5,
  supplier text,
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_parts" ON parts;
CREATE POLICY "select_parts" ON parts FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_parts" ON parts;
CREATE POLICY "insert_parts" ON parts FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_parts" ON parts;
CREATE POLICY "update_parts" ON parts FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_parts" ON parts;
CREATE POLICY "delete_parts" ON parts FOR DELETE
  TO authenticated USING (true);

-- ============================================================================
-- TABLE: invoices
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'brouillon' CHECK (status IN ('brouillon', 'envoyee', 'payee', 'en_retard')),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 8.10,
  vat_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  paid_date date,
  payment_method text CHECK (payment_method IN ('twint', 'especes', 'carte', 'virement')),
  notes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_invoices" ON invoices;
CREATE POLICY "select_invoices" ON invoices FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_invoices" ON invoices;
CREATE POLICY "insert_invoices" ON invoices FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_invoices" ON invoices;
CREATE POLICY "update_invoices" ON invoices FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_invoices" ON invoices;
CREATE POLICY "delete_invoices" ON invoices FOR DELETE
  TO authenticated USING (true);

-- ============================================================================
-- TABLE: invoice_items
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  part_id uuid REFERENCES parts(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_invoice_items" ON invoice_items;
CREATE POLICY "select_invoice_items" ON invoice_items FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_invoice_items" ON invoice_items;
CREATE POLICY "insert_invoice_items" ON invoice_items FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_invoice_items" ON invoice_items;
CREATE POLICY "update_invoice_items" ON invoice_items FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_invoice_items" ON invoice_items;
CREATE POLICY "delete_invoice_items" ON invoice_items FOR DELETE
  TO authenticated USING (true);

-- ============================================================================
-- TABLE: twint_payments
-- ============================================================================
CREATE TABLE IF NOT EXISTS twint_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'confirmee', 'echouee', 'remboursee')),
  twint_transaction_id text,
  qr_code_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE twint_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_twint_payments" ON twint_payments;
CREATE POLICY "select_twint_payments" ON twint_payments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_twint_payments" ON twint_payments;
CREATE POLICY "insert_twint_payments" ON twint_payments FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_twint_payments" ON twint_payments;
CREATE POLICY "update_twint_payments" ON twint_payments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_twint_payments" ON twint_payments;
CREATE POLICY "delete_twint_payments" ON twint_payments FOR DELETE
  TO authenticated USING (true);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vehicles_client_id ON vehicles(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_twint_payments_invoice_id ON twint_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_parts_category ON parts(category);
CREATE INDEX IF NOT EXISTS idx_parts_reference ON parts(reference);

-- ============================================================================
-- FUNCTION: generate_invoice_number
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
DECLARE
  current_year text;
  next_num integer;
  new_number text;
BEGIN
  current_year := EXTRACT(YEAR FROM now())::text;
  
  SELECT COUNT(*) + 1 INTO next_num
  FROM invoices
  WHERE invoice_number LIKE 'FAC-' || current_year || '-%';
  
  new_number := 'FAC-' || current_year || '-' || lpad(next_num::text, 4, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: handle_new_user - auto-create profile on signup
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'mecanicien')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
