/*
# Garage-created quotes (devis)

## Changes

### 1. New columns on service_requests
- `devis_number` (text): per-garage quote number (DEV-YYYY-NNNN)
- `created_by` (uuid, FK -> profiles): staff member who created the quote
- `responded_by` (uuid, FK -> profiles): staff member who recorded the client response
- `responded_at` (timestamptz): when the client response was recorded

### 2. New table: devis_counters
- Per-garage, per-year counter for quote numbering
- RLS enabled, no policies (accessed only via SECURITY DEFINER function)

### 3. New function: generate_devis_number(p_garage_id uuid)
- Returns 'DEV-YYYY-NNNN' using pg_advisory_xact_lock pattern
- Mirrors generate_invoice_number

### 4. New function: staff_respond_devis(p_request_id uuid, p_accept boolean)
- SECURITY DEFINER: staff records client's accept/refuse for offline clients
- Checks caller is admin/secretaire of the request's garage
- Only works when status is 'devis_recu'
- Sets status to devis_accepte/devis_refuse, responded_by, responded_at

### 5. Security
- devis_counters: RLS enabled, no policies (locked down)
- Both functions are SECURITY DEFINER with search_path = public
- staff_respond_devis checks garage membership before acting
*/

-- ── Add columns to service_requests ──
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS devis_number text;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id);
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS responded_by uuid REFERENCES profiles(id);
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS responded_at timestamptz;

-- ── Devis counters table ──
CREATE TABLE IF NOT EXISTS public.devis_counters (
  garage_id uuid NOT NULL,
  year int NOT NULL,
  last_number int NOT NULL DEFAULT 0,
  PRIMARY KEY (garage_id, year)
);

ALTER TABLE public.devis_counters ENABLE ROW LEVEL SECURITY;

-- ── generate_devis_number function ──
CREATE OR REPLACE FUNCTION public.generate_devis_number(p_garage_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_year int;
  v_next int;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::int;
  PERFORM pg_advisory_xact_lock(hashtext(p_garage_id::text || v_year::text));
  INSERT INTO devis_counters (garage_id, year, last_number)
  VALUES (p_garage_id, v_year, 1)
  ON CONFLICT (garage_id, year)
  DO UPDATE SET last_number = devis_counters.last_number + 1
  RETURNING last_number INTO v_next;
  RETURN 'DEV-' || v_year || '-' || lpad(v_next::text, 4, '0');
END;
$function$;

-- ── staff_respond_devis function ──
CREATE OR REPLACE FUNCTION public.staff_respond_devis(p_request_id uuid, p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_request service_requests%ROWTYPE;
  v_caller_role TEXT;
  v_caller_garage_id uuid;
BEGIN
  SELECT * INTO v_request FROM service_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_request.status != 'devis_recu' THEN
    RAISE EXCEPTION 'Request is not awaiting client response';
  END IF;

  SELECT role, garage_id INTO v_caller_role, v_caller_garage_id
  FROM profiles WHERE id = auth.uid();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Caller not found';
  END IF;

  IF v_caller_role NOT IN ('admin', 'secretaire') THEN
    RAISE EXCEPTION 'Only admin or secretaire can record client responses';
  END IF;

  IF v_caller_garage_id IS DISTINCT FROM v_request.garage_id THEN
    RAISE EXCEPTION 'Caller does not belong to this garage';
  END IF;

  UPDATE service_requests
  SET status = CASE WHEN p_accept THEN 'devis_accepte' ELSE 'devis_refuse' END,
      responded_by = auth.uid(),
      responded_at = now(),
      updated_at = now()
  WHERE id = p_request_id;
END;
$function$;

-- ── Grant execute to authenticated ──
GRANT EXECUTE ON FUNCTION public.generate_devis_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_respond_devis(uuid, boolean) TO authenticated;