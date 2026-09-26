-- 1. Drop global UNIQUE on parts.reference, replace with per-garage unique
ALTER TABLE parts DROP CONSTRAINT IF EXISTS parts_reference_key;
CREATE UNIQUE INDEX IF NOT EXISTS parts_garage_reference_unique ON parts (garage_id, reference) WHERE garage_id IS NOT NULL;

-- 2. Add purchase_price to parts
ALTER TABLE parts ADD COLUMN IF NOT EXISTS purchase_price numeric(12,2) NOT NULL DEFAULT 0;

-- 3. Add part_id to parts_orders and repair_order_items
ALTER TABLE parts_orders ADD COLUMN IF NOT EXISTS part_id uuid REFERENCES parts(id) ON DELETE SET NULL;
ALTER TABLE repair_order_items ADD COLUMN IF NOT EXISTS part_id uuid REFERENCES parts(id) ON DELETE SET NULL;

-- 4. Create stock_movements table
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id uuid NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  garage_id uuid NOT NULL REFERENCES garages(id) ON DELETE CASCADE,
  quantity numeric(10,2) NOT NULL,
  reason text NOT NULL CHECK (reason IN ('invoice', 'invoice_cancelled', 'order_received', 'manual')),
  invoice_item_id uuid,
  parts_order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_stock_movements" ON public.stock_movements FOR SELECT
  TO authenticated USING (garage_id = current_user_garage_id());

-- 5. Trigger on invoice_items for stock movements
CREATE OR REPLACE FUNCTION public.apply_stock_movement_from_invoice_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_garage_id uuid;
  v_part_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.part_id IS NOT NULL THEN
      SELECT garage_id INTO v_garage_id FROM parts WHERE id = NEW.part_id;
      UPDATE parts SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.part_id;
      INSERT INTO stock_movements (part_id, garage_id, quantity, reason, invoice_item_id)
      VALUES (NEW.part_id, v_garage_id, -NEW.quantity, 'invoice', NEW.id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.part_id IS NOT NULL THEN
      SELECT garage_id INTO v_garage_id FROM parts WHERE id = OLD.part_id;
      UPDATE parts SET stock_quantity = stock_quantity + OLD.quantity WHERE id = OLD.part_id;
      INSERT INTO stock_movements (part_id, garage_id, quantity, reason, invoice_item_id)
      VALUES (OLD.part_id, v_garage_id, OLD.quantity, 'invoice_cancelled', OLD.id);
    END IF;
    IF NEW.part_id IS NOT NULL THEN
      SELECT garage_id INTO v_garage_id FROM parts WHERE id = NEW.part_id;
      UPDATE parts SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.part_id;
      INSERT INTO stock_movements (part_id, garage_id, quantity, reason, invoice_item_id)
      VALUES (NEW.part_id, v_garage_id, -NEW.quantity, 'invoice', NEW.id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.part_id IS NOT NULL THEN
      SELECT garage_id INTO v_garage_id FROM parts WHERE id = OLD.part_id;
      UPDATE parts SET stock_quantity = stock_quantity + OLD.quantity WHERE id = OLD.part_id;
      INSERT INTO stock_movements (part_id, garage_id, quantity, reason, invoice_item_id)
      VALUES (OLD.part_id, v_garage_id, OLD.quantity, 'invoice_cancelled', OLD.id);
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_stock_movement_invoice_item ON invoice_items;
CREATE TRIGGER trg_stock_movement_invoice_item
AFTER INSERT OR UPDATE OR DELETE ON invoice_items
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement_from_invoice_item();

-- 6. Trigger on parts_orders for order_received
CREATE OR REPLACE FUNCTION public.apply_stock_movement_from_parts_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_garage_id uuid;
BEGIN
  IF NEW.status = 'recue' AND OLD.status <> 'recue' AND NEW.part_id IS NOT NULL THEN
    SELECT garage_id INTO v_garage_id FROM parts WHERE id = NEW.part_id;
    UPDATE parts SET stock_quantity = stock_quantity + NEW.quantity WHERE id = NEW.part_id;
    INSERT INTO stock_movements (part_id, garage_id, quantity, reason, parts_order_id)
    VALUES (NEW.part_id, v_garage_id, NEW.quantity, 'order_received', NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_stock_movement_parts_order ON parts_orders;
CREATE TRIGGER trg_stock_movement_parts_order
AFTER UPDATE ON parts_orders
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement_from_parts_order();