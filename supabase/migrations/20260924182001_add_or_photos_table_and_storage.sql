-- Create or_photos table
CREATE TABLE IF NOT EXISTS public.or_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_order_id uuid NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,
  garage_id uuid NOT NULL REFERENCES public.garages(id),
  storage_path text NOT NULL,
  caption text,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.or_photos ENABLE ROW LEVEL SECURITY;

-- Staff policies: garage-scoped CRUD
CREATE POLICY "or_photos_staff_select" ON public.or_photos FOR SELECT
  TO authenticated USING (garage_id = public.current_user_garage_id());

CREATE POLICY "or_photos_staff_insert" ON public.or_photos FOR INSERT
  TO authenticated WITH CHECK (garage_id = public.current_user_garage_id());

CREATE POLICY "or_photos_staff_delete" ON public.or_photos FOR DELETE
  TO authenticated USING (garage_id = public.current_user_garage_id());

-- Client policy: SELECT only, when the repair order's vehicle belongs to the client
CREATE POLICY "or_photos_client_select" ON public.or_photos FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.repair_orders ro
      JOIN public.vehicles v ON v.id = ro.vehicle_id
      WHERE ro.id = or_photos.repair_order_id
        AND v.client_id = public.current_user_client_id()
    )
  );

-- Create private storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('or-photos', 'or-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: staff SELECT/INSERT/DELETE by garage_id folder prefix
CREATE POLICY "or_photos_storage_staff_select" ON storage.objects FOR SELECT
  TO authenticated USING (
    bucket_id = 'or-photos'
    AND (storage.foldername(name))[1] = public.current_user_garage_id()::text
  );

CREATE POLICY "or_photos_storage_staff_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'or-photos'
    AND (storage.foldername(name))[1] = public.current_user_garage_id()::text
  );

CREATE POLICY "or_photos_storage_staff_delete" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'or-photos'
    AND (storage.foldername(name))[1] = public.current_user_garage_id()::text
  );

-- Storage RLS: client SELECT when folder[2] is a repair_order belonging to their vehicle
CREATE POLICY "or_photos_storage_client_select" ON storage.objects FOR SELECT
  TO authenticated USING (
    bucket_id = 'or-photos'
    AND EXISTS (
      SELECT 1 FROM public.repair_orders ro
      JOIN public.vehicles v ON v.id = ro.vehicle_id
      WHERE ro.id::text = (storage.foldername(name))[2]
        AND v.client_id = public.current_user_client_id()
    )
  );