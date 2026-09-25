/*
# Fix client INSERT policies broken by garages RLS lockdown

## Problem
After tightening garages table RLS, clients lost SELECT access to the
`garages` table. Two client-side INSERT policies —
`appointments.client_insert_appointments` and
`service_requests.client_insert_service_requests` — used
`EXISTS (SELECT 1 FROM garages WHERE id = ...)` in their WITH CHECK
predicate. Because the calling role can no longer read `garages`, that
subquery always returns zero rows, so every client INSERT fails with
"new row violates row-level security policy".

## Fix
1. New SECURITY DEFINER function `garage_is_bookable(p_garage_id uuid)`
   that checks (inside the function body, as the owner) whether a garage
   exists, is published, and not suspended.  Clients call this function
   instead of reading the garages table directly.
2. Rewrite `client_insert_appointments` to use `garage_is_bookable()`.
3. Rewrite `client_insert_service_requests` to use `garage_is_bookable()`.

## Security
- `garage_is_bookable` is SECURITY DEFINER, SET search_path = public,
  EXECUTE granted to `authenticated`. It only returns a boolean — it
  leaks no data from the garages table.
- The new policies preserve all existing checks (client ownership,
  garage_id IS NOT NULL, status = 'en_attente') and replace the
  broken `EXISTS (SELECT ... FROM garages)` with the function call.
*/

-- 1. Helper function -------------------------------------------------------

CREATE OR REPLACE FUNCTION public.garage_is_bookable(p_garage_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.garages
    WHERE id = p_garage_id
      AND is_published = true
      AND COALESCE(subscription_status, 'active') <> 'suspended'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.garage_is_bookable(uuid) TO authenticated;

-- 2. Rewrite client_insert_appointments ------------------------------------

DROP POLICY IF EXISTS "client_insert_appointments" ON appointments;

CREATE POLICY "client_insert_appointments" ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id = current_user_client_id()
    AND garage_id IS NOT NULL
    AND status = 'en_attente'
    AND garage_is_bookable(garage_id)
  );

-- 3. Rewrite client_insert_service_requests --------------------------------

DROP POLICY IF EXISTS "client_insert_service_requests" ON service_requests;

CREATE POLICY "client_insert_service_requests" ON service_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id = current_user_client_id()
    AND garage_id IS NOT NULL
    AND status = 'en_attente'
    AND garage_is_bookable(garage_id)
  );
