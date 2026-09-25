-- Add labour (main d'œuvre) to quotes, repair orders and invoices, plus starter task templates

-- 1. Garage hourly rate
ALTER TABLE garages ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2) NOT NULL DEFAULT 120;

-- 2. item_type on line-item tables
ALTER TABLE devis_items ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'piece' CHECK (item_type IN ('piece','main_oeuvre'));
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'piece' CHECK (item_type IN ('piece','main_oeuvre'));
ALTER TABLE repair_order_items ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'piece' CHECK (item_type IN ('piece','main_oeuvre'));

-- 3. default_labor_hours on canned_tasks
ALTER TABLE canned_tasks ADD COLUMN IF NOT EXISTS default_labor_hours numeric(5,2);

-- 4. seed_default_canned_tasks function
CREATE OR REPLACE FUNCTION public.seed_default_canned_tasks(p_garage_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_count integer;
  v_existing integer;
  v_role text;
BEGIN
  v_role := public.current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('admin') THEN
    RAISE EXCEPTION 'Seul un administrateur peut effectuer cette action';
  END IF;

  SELECT COUNT(*) INTO v_existing FROM canned_tasks WHERE garage_id = p_garage_id;
  IF v_existing > 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO canned_tasks (garage_id, name, estimated_duration_minutes, default_labor_hours)
  VALUES
    ('Service / Vidange', 60, 1.0),
    ('Changement plaquettes avant', 90, 1.5),
    ('Changement plaquettes arrière', 90, 1.5),
    ('Changement disques + plaquettes', 150, 2.5),
    ('Changement pneus (4)', 45, 0.75),
    ('Équilibrage roues', 30, 0.5),
    ('Géométrie / Parallélisme', 60, 1.0),
    ('Diagnostic électronique', 60, 1.0),
    ('Changement batterie', 30, 0.5),
    ('Changement filtre habitacle', 30, 0.5),
    ('Changement courroie de distribution', 300, 5.0),
    ('Contrôle avant expertise', 90, 1.5),
    ('Changement amortisseurs (essieu)', 150, 2.5),
    ('Service climatisation', 60, 1.0)
  ;
  -- set garage_id for all inserted rows
  UPDATE canned_tasks SET garage_id = p_garage_id
  WHERE garage_id IS NULL AND name IN (
    'Service / Vidange','Changement plaquettes avant','Changement plaquettes arrière',
    'Changement disques + plaquettes','Changement pneus (4)','Équilibrage roues',
    'Géométrie / Parallélisme','Diagnostic électronique','Changement batterie',
    'Changement filtre habitacle','Changement courroie de distribution',
    'Contrôle avant expertise','Changement amortisseurs (essieu)','Service climatisation'
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.seed_default_canned_tasks(uuid) TO authenticated;
