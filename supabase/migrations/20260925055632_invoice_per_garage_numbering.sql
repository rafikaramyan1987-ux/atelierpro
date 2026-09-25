-- Per-garage invoice numbering

CREATE TABLE IF NOT EXISTS public.invoice_counters (
  garage_id uuid NOT NULL,
  year int NOT NULL,
  last_number int NOT NULL DEFAULT 0,
  PRIMARY KEY (garage_id, year)
);

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_garage_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_year int;
  v_next int;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::int;
  PERFORM pg_advisory_xact_lock(hashtext(p_garage_id::text || v_year::text));
  INSERT INTO invoice_counters (garage_id, year, last_number)
  VALUES (p_garage_id, v_year, 1)
  ON CONFLICT (garage_id, year)
  DO UPDATE SET last_number = invoice_counters.last_number + 1
  RETURNING last_number INTO v_next;
  RETURN 'FAC-' || v_year || '-' || lpad(v_next::text, 4, '0');
END;
$function$;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
DROP INDEX IF EXISTS public.invoices_invoice_number_key;
CREATE UNIQUE INDEX invoices_garage_invoice_number_key
  ON public.invoices (garage_id, invoice_number);

INSERT INTO invoice_counters (garage_id, year, last_number)
SELECT
  garage_id,
  EXTRACT(YEAR FROM issue_date)::int AS year,
  COALESCE(MAX(
    CASE
      WHEN invoice_number ~ '^FAC-[0-9]{4}-[0-9]{4}$'
      THEN CAST(SUBSTRING(invoice_number FROM '[0-9]{4}$') AS int)
      ELSE 0
    END
  ), 0) AS last_number
FROM invoices
WHERE garage_id IS NOT NULL
GROUP BY garage_id, EXTRACT(YEAR FROM issue_date)::int
ON CONFLICT (garage_id, year) DO NOTHING;
