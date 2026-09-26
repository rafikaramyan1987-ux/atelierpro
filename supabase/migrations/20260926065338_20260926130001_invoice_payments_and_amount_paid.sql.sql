-- 1. Add amount_paid column
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0;

-- 2. Extend status constraint to include 'partiellement_payee'
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status = ANY (ARRAY['brouillon'::text, 'envoyee'::text, 'payee'::text, 'en_retard'::text, 'en_attente_validation'::text, 'paiement_declare'::text, 'partiellement_payee'::text]));

-- 3. Create invoice_payments table
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('twint','especes','carte','virement')),
  paid_at date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies
-- SELECT: garage staff OR the invoice's client
CREATE POLICY "select_invoice_payments" ON public.invoice_payments FOR SELECT
  TO authenticated USING (
    garage_id = public.current_user_garage_id()
    OR EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_payments.invoice_id
      AND i.client_id = public.current_user_client_id()
    )
  );

-- INSERT: only admin/secretaire of that garage
CREATE POLICY "insert_invoice_payments" ON public.invoice_payments FOR INSERT
  TO authenticated WITH CHECK (
    garage_id = public.current_user_garage_id()
    AND public.current_user_role() IN ('admin','secretaire')
  );

-- UPDATE: only admin/secretaire of that garage
CREATE POLICY "update_invoice_payments" ON public.invoice_payments FOR UPDATE
  TO authenticated USING (
    garage_id = public.current_user_garage_id()
    AND public.current_user_role() IN ('admin','secretaire')
  ) WITH CHECK (
    garage_id = public.current_user_garage_id()
    AND public.current_user_role() IN ('admin','secretaire')
  );

-- DELETE: only admin/secretaire of that garage
CREATE POLICY "delete_invoice_payments" ON public.invoice_payments FOR DELETE
  TO authenticated USING (
    garage_id = public.current_user_garage_id()
    AND public.current_user_role() IN ('admin','secretaire')
  );

-- 6. Trigger to recompute invoice state from payments
CREATE OR REPLACE FUNCTION public.recalc_invoice_payment_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_invoice_id uuid;
  v_amount_paid numeric(12,2);
  v_total numeric(12,2);
  v_current_status text;
  v_max_paid date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
  END IF;

  SELECT COALESCE(SUM(amount), 0), MAX(paid_at)
  INTO v_amount_paid, v_max_paid
  FROM public.invoice_payments
  WHERE invoice_id = v_invoice_id;

  SELECT total, status INTO v_total, v_current_status
  FROM public.invoices WHERE id = v_invoice_id;

  IF v_current_status IN ('brouillon','en_attente_validation') THEN
    UPDATE public.invoices
    SET amount_paid = v_amount_paid
    WHERE id = v_invoice_id;
  ELSIF v_amount_paid >= v_total THEN
    UPDATE public.invoices
    SET amount_paid = v_amount_paid,
        status = 'payee',
        paid_date = v_max_paid
    WHERE id = v_invoice_id;
  ELSIF v_amount_paid > 0 THEN
    UPDATE public.invoices
    SET amount_paid = v_amount_paid,
        status = 'partiellement_payee',
        paid_date = NULL
    WHERE id = v_invoice_id;
  ELSE
    UPDATE public.invoices
    SET amount_paid = 0,
        status = 'envoyee',
        paid_date = NULL
    WHERE id = v_invoice_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 7. Trigger on invoice_payments
DROP TRIGGER IF EXISTS trg_recalc_invoice_payment ON public.invoice_payments;
CREATE TRIGGER trg_recalc_invoice_payment
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.recalc_invoice_payment_state();