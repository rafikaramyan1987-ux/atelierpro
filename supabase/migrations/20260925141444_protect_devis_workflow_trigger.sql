/*
# Protect devis workflow — enforce approval flow at the database level

## Problem
The RLS policy "staff_update_service_requests" lets any staff member (including
mecanicien) update any field on service_requests, so the admin validation step
can be bypassed from outside the UI.

## Solution
Replace the narrow `prevent_mechanic_send_devis` trigger with a comprehensive
`protect_devis_workflow` BEFORE UPDATE trigger that enforces the full approval
flow at the database level.

## Rules
1. auth.uid() IS NULL (service role / server side) → allow
2. admin / secretaire → allow everything
3. mecanicien → may only edit his own draft (OLD.status = 'en_attente_validation'
   AND OLD.created_by = auth.uid()); status must stay 'en_attente_validation';
   any other update raises an exception
4. client caller → block direct status changes except the allowed transitions
   'devis_recu' → 'devis_accepte' and 'devis_recu' → 'devis_refuse' (used by
   the SECURITY DEFINER function client_respond_devis)
5. no role → raise

## Compatibility
- client_respond_devis (SECURITY DEFINER, caller = client): allowed via rule 4
- staff_respond_devis (SECURITY DEFINER, caller = admin/secretaire): allowed via rule 2
*/

-- Drop the old narrow trigger; the new one supersedes it
DROP TRIGGER IF EXISTS trg_prevent_mechanic_send_devis ON service_requests;
DROP FUNCTION IF EXISTS prevent_mechanic_send_devis();

CREATE OR REPLACE FUNCTION public.protect_devis_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role text;
  v_client_id uuid;
BEGIN
  -- Service role / server-side (no authenticated user) → allow
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_role := public.current_user_role();

  -- Admin / secretaire → allow everything
  IF v_role IN ('admin', 'secretaire') THEN
    RETURN NEW;
  END IF;

  -- Mecanicien → may only correct his own draft, cannot change status
  IF v_role = 'mecanicien' THEN
    IF OLD.status = 'en_attente_validation' AND OLD.created_by = auth.uid() THEN
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Seul un administrateur peut valider ou modifier ce devis';
      END IF;
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Seul un administrateur peut valider ou modifier ce devis';
  END IF;

  -- Client caller → block direct status changes except allowed transitions
  v_client_id := public.current_user_client_id();
  IF v_client_id IS NOT NULL THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      -- Allow only devis_recu → devis_accepte / devis_refuse (client_respond_devis)
      IF OLD.status = 'devis_recu' AND NEW.status IN ('devis_accepte', 'devis_refuse') THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Les clients ne peuvent pas modifier le statut directement';
    END IF;
    RETURN NEW;
  END IF;

  -- No recognised role → block
  RAISE EXCEPTION 'Seul un administrateur peut valider ou modifier ce devis';
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_devis_workflow ON service_requests;
CREATE TRIGGER trg_protect_devis_workflow
  BEFORE UPDATE ON service_requests
  FOR EACH ROW
  EXECUTE FUNCTION protect_devis_workflow();
