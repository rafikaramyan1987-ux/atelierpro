-- Fix: ambiguous column references in admin_garage_stats
-- The RETURN TABLE columns (garage_id, etc.) conflict with subquery column names
-- Fix by aliasing all subquery columns uniquely

CREATE OR REPLACE FUNCTION public.admin_garage_stats()
RETURNS TABLE(
  garage_id uuid,
  garage_name text,
  subscription_status text,
  created_at timestamptz,
  employee_count bigint,
  client_count bigint,
  invoice_count bigint,
  total_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only super_admin can access garage stats';
  END IF;

  RETURN QUERY
  SELECT
    g.id,
    g.name,
    g.subscription_status,
    g.created_at,
    COALESCE(emp.emp_cnt, 0),
    COALESCE(cli.cli_cnt, 0),
    COALESCE(inv.inv_cnt, 0),
    COALESCE(inv.inv_rev, 0)
  FROM garages g
  LEFT JOIN (
    SELECT profiles.garage_id AS g_id, COUNT(*) AS emp_cnt
    FROM profiles
    WHERE profiles.role IN ('admin', 'mecanicien', 'secretaire')
    GROUP BY profiles.garage_id
  ) emp ON emp.g_id = g.id
  LEFT JOIN (
    SELECT clients.garage_id AS g_id, COUNT(*) AS cli_cnt
    FROM clients
    GROUP BY clients.garage_id
  ) cli ON cli.g_id = g.id
  LEFT JOIN (
    SELECT invoices.garage_id AS g_id, COUNT(*) AS inv_cnt, COALESCE(SUM(invoices.total), 0) AS inv_rev
    FROM invoices
    WHERE invoices.status = 'payee'
    GROUP BY invoices.garage_id
  ) inv ON inv.g_id = g.id
  ORDER BY g.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_garage_stats() TO authenticated;
