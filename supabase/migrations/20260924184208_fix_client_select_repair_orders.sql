-- Allow clients to read their own repair orders (by client_id or vehicle ownership)
CREATE POLICY "client_select_repair_orders" ON public.repair_orders FOR SELECT
  TO authenticated USING (
    client_id = public.current_user_client_id()
    OR EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = repair_orders.vehicle_id AND v.client_id = public.current_user_client_id())
  );