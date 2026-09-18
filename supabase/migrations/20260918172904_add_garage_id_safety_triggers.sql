/*
# Add safety-net triggers to auto-populate garage_id on insert

If a client-side insert omits garage_id, these triggers fill it from the
caller's profile via current_user_garage_id(). This prevents accidental
cross-garage data leaks from frontend bugs.
*/

-- Helper function for the trigger
CREATE OR REPLACE FUNCTION public.set_garage_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.garage_id IS NULL THEN
    NEW.garage_id := current_user_garage_id();
  END IF;
  RETURN NEW;
END;
$function$;

-- Apply to each garage-owned table
CREATE TRIGGER trg_clients_set_garage_id
  BEFORE INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION public.set_garage_id_on_insert();

CREATE TRIGGER trg_vehicles_set_garage_id
  BEFORE INSERT ON vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_garage_id_on_insert();

CREATE TRIGGER trg_invoices_set_garage_id
  BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_garage_id_on_insert();

CREATE TRIGGER trg_invoice_items_set_garage_id
  BEFORE INSERT ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.set_garage_id_on_insert();

CREATE TRIGGER trg_parts_set_garage_id
  BEFORE INSERT ON parts
  FOR EACH ROW EXECUTE FUNCTION public.set_garage_id_on_insert();

CREATE TRIGGER trg_devis_items_set_garage_id
  BEFORE INSERT ON devis_items
  FOR EACH ROW EXECUTE FUNCTION public.set_garage_id_on_insert();

CREATE TRIGGER trg_repair_order_items_set_garage_id
  BEFORE INSERT ON repair_order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_garage_id_on_insert();

CREATE TRIGGER trg_loaner_assignments_set_garage_id
  BEFORE INSERT ON loaner_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_garage_id_on_insert();

CREATE TRIGGER trg_twint_payments_set_garage_id
  BEFORE INSERT ON twint_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_garage_id_on_insert();

-- Also apply to tables that already had garage_id but might have NULLs
CREATE TRIGGER trg_appointments_set_garage_id
  BEFORE INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_garage_id_on_insert();

CREATE TRIGGER trg_service_requests_set_garage_id
  BEFORE INSERT ON service_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_garage_id_on_insert();

CREATE TRIGGER trg_repair_orders_set_garage_id
  BEFORE INSERT ON repair_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_garage_id_on_insert();

CREATE TRIGGER trg_canned_tasks_set_garage_id
  BEFORE INSERT ON canned_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_garage_id_on_insert();

CREATE TRIGGER trg_loaner_vehicles_set_garage_id
  BEFORE INSERT ON loaner_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_garage_id_on_insert();

CREATE TRIGGER trg_parts_orders_set_garage_id
  BEFORE INSERT ON parts_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_garage_id_on_insert();
