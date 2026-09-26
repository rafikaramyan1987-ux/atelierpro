-- 1. Convert integer columns to numeric(10,2)
ALTER TABLE parts ALTER COLUMN stock_quantity TYPE numeric(10,2);
ALTER TABLE parts ALTER COLUMN min_stock_threshold TYPE numeric(10,2);

-- 2. Replace invoice_items trigger with safe garage resolution + no-op guard
CREATE OR REPLACE FUNCTION public.apply_stock_movement_from_invoice_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_garage_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.part_id IS NOT NULL THEN
      v_garage_id := COALESCE(
        (SELECT garage_id FROM parts WHERE id = NEW.part_id),
        (SELECT garage_id FROM invoices WHERE id = NEW.invoice_id)
      );
      UPDATE parts SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.part_id;
      IF v_garage_id IS NOT NULL THEN
        INSERT INTO stock_movements (part_id, garage_id, quantity, reason, invoice_item_id)
        VALUES (NEW.part_id, v_garage_id, -NEW.quantity, 'invoice', NEW.id);
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.part_id IS NOT DISTINCT FROM OLD.part_id AND NEW.quantity = OLD.quantity THEN
      RETURN NEW;
    END IF;
    IF OLD.part_id IS NOT NULL THEN
      v_garage_id := COALESCE(
        (SELECT garage_id FROM parts WHERE id = OLD.part_id),
        (SELECT garage_id FROM invoices WHERE id = OLD.invoice_id)
      );
      UPDATE parts SET stock_quantity = stock_quantity + OLD.quantity WHERE id = OLD.part_id;
      IF v_garage_id IS NOT NULL THEN
        INSERT INTO stock_movements (part_id, garage_id, quantity, reason, invoice_item_id)
        VALUES (OLD.part_id, v_garage_id, OLD.quantity, 'invoice_cancelled', OLD.id);
      END IF;
    END IF;
    IF NEW.part_id IS NOT NULL THEN
      v_garage_id := COALESCE(
        (SELECT garage_id FROM parts WHERE id = NEW.part_id),
        (SELECT garage_id FROM invoices WHERE id = NEW.invoice_id)
      );
      UPDATE parts SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.part_id;
      IF v_garage_id IS NOT NULL THEN
        INSERT INTO stock_movements (part_id, garage_id, quantity, reason, invoice_item_id)
        VALUES (NEW.part_id, v_garage_id, -NEW.quantity, 'invoice', NEW.id);
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.part_id IS NOT NULL THEN
      v_garage_id := COALESCE(
        (SELECT garage_id FROM parts WHERE id = OLD.part_id),
        (SELECT garage_id FROM invoices WHERE id = OLD.invoice_id)
      );
      UPDATE parts SET stock_quantity = stock_quantity + OLD.quantity WHERE id = OLD.part_id;
      IF v_garage_id IS NOT NULL THEN
        INSERT INTO stock_movements (part_id, garage_id, quantity, reason, invoice_item_id)
        VALUES (OLD.part_id, v_garage_id, OLD.quantity, 'invoice_cancelled', OLD.id);
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- 3. Replace parts_order trigger with safe garage resolution
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
    v_garage_id := COALESCE(
      (SELECT garage_id FROM parts WHERE id = NEW.part_id),
      (SELECT garage_id FROM parts_orders WHERE id = NEW.id)
    );
    UPDATE parts SET stock_quantity = stock_quantity + NEW.quantity WHERE id = NEW.part_id;
    IF v_garage_id IS NOT NULL THEN
      INSERT INTO stock_movements (part_id, garage_id, quantity, reason, parts_order_id)
      VALUES (NEW.part_id, v_garage_id, NEW.quantity, 'order_received', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;