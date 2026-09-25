-- Fix seed_default_canned_tasks: column/value mismatch and unsafe UPDATE-by-name

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
  v_caller_garage_id uuid;
BEGIN
  v_role := public.current_user_role();
  v_caller_garage_id := public.current_user_garage_id();

  IF v_role IS NULL OR v_role <> 'admin' OR v_caller_garage_id IS NULL OR v_caller_garage_id <> p_garage_id THEN
    RAISE EXCEPTION 'Seul un administrateur peut effectuer cette action pour son propre garage';
  END IF;

  SELECT COUNT(*) INTO v_existing FROM canned_tasks WHERE garage_id = p_garage_id;
  IF v_existing > 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO canned_tasks (garage_id, name, estimated_duration_minutes, default_labor_hours)
  VALUES
    (p_garage_id, 'Service / Vidange', 60, 1.0),
    (p_garage_id, 'Changement plaquettes avant', 90, 1.5),
    (p_garage_id, 'Changement plaquettes arrière', 90, 1.5),
    (p_garage_id, 'Changement disques + plaquettes', 150, 2.5),
    (p_garage_id, 'Changement pneus (4)', 45, 0.75),
    (p_garage_id, 'Équilibrage roues', 30, 0.5),
    (p_garage_id, 'Géométrie / Parallélisme', 60, 1.0),
    (p_garage_id, 'Diagnostic électronique', 60, 1.0),
    (p_garage_id, 'Changement batterie', 30, 0.5),
    (p_garage_id, 'Changement filtre habitacle', 30, 0.5),
    (p_garage_id, 'Changement courroie de distribution', 300, 5.0),
    (p_garage_id, 'Contrôle avant expertise', 90, 1.5),
    (p_garage_id, 'Changement amortisseurs (essieu)', 150, 2.5),
    (p_garage_id, 'Service climatisation', 60, 1.0);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.seed_default_canned_tasks(uuid) TO authenticated;
