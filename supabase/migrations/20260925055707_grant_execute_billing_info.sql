-- invoice_billing_info function already created via execute_sql
-- This migration records the GRANT for version control

GRANT EXECUTE ON FUNCTION public.invoice_billing_info(uuid) TO authenticated;
