/*
# Fix RLS policies for client self-registration

## Problem
The client registration flow (handleClientRegister in app/login/page.tsx) inserts
into the `clients` and `vehicles` tables BEFORE the user is authenticated. The
existing RLS INSERT policies on both tables are scoped `TO authenticated` only,
so an anonymous visitor trying to register gets: "new row violates row-level
security policy for table 'clients'".

## Changes

### clients table
1. Add `anon` INSERT policy — allows unauthenticated visitors to create their
   client record during self-registration.
2. Add `anon` SELECT policy scoped to `auth_user_id IS NULL` — needed because
   the registration code uses `.insert().select().single()` to retrieve the
   newly created row. The scope ensures anon can only read unclaimed client
   records (not yet linked to an auth account). Once the trigger sets
   `auth_user_id`, the row becomes invisible to anon.

### vehicles table
3. Add `anon` INSERT policy scoped to unclaimed clients — allows an anonymous
   visitor to insert a vehicle only for a client record that has not yet been
   linked to an auth account (`auth_user_id IS NULL`).

## Security
- Anon can INSERT client records (necessary for registration).
- Anon can SELECT only client records where `auth_user_id IS NULL` (unclaimed).
- Anon can INSERT vehicles only for unclaimed clients.
- All existing authenticated policies remain unchanged.
- After registration completes and the trigger fires, the client record has
  `auth_user_id` set and becomes invisible to anon.
*/

-- ============================================================================
-- clients: allow anon INSERT for self-registration
-- ============================================================================
DROP POLICY IF EXISTS "anon_insert_clients_registration" ON clients;
CREATE POLICY "anon_insert_clients_registration" ON clients FOR INSERT
  TO anon WITH CHECK (true);

-- ============================================================================
-- clients: allow anon SELECT for unclaimed records only (needed by .insert().select())
-- ============================================================================
DROP POLICY IF EXISTS "anon_select_unclaimed_clients" ON clients;
CREATE POLICY "anon_select_unclaimed_clients" ON clients FOR SELECT
  TO anon USING (auth_user_id IS NULL);

-- ============================================================================
-- vehicles: allow anon INSERT for unclaimed clients only
-- ============================================================================
DROP POLICY IF EXISTS "anon_insert_vehicles_registration" ON vehicles;
CREATE POLICY "anon_insert_vehicles_registration" ON vehicles FOR INSERT
  TO anon WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = vehicles.client_id AND c.auth_user_id IS NULL
    )
  );
