CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recipient text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_email_recipient(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role text;
  v_garage_id uuid;
  v_client_id uuid;
BEGIN
  v_role := public.current_user_role();
  v_garage_id := public.current_user_garage_id();
  v_client_id := public.current_user_client_id();

  IF v_role IN ('admin', 'secretaire', 'mecanicien') AND v_garage_id IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM clients c
      WHERE lower(c.email) = lower(p_email)
        AND public.garage_has_client(c.id)
    );
  ELSIF v_client_id IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM garages g
      WHERE lower(g.email) = lower(p_email)
    );
  END IF;

  RETURN false;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.can_email_recipient(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_email_recipient(text) TO authenticated;