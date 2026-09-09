CREATE POLICY "curso files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('videoaulas','materiais'));
CREATE POLICY "curso files insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('videoaulas','materiais') AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "curso files update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('videoaulas','materiais') AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "curso files delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('videoaulas','materiais') AND public.has_role(auth.uid(),'admin'));