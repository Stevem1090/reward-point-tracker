DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.auto_email_settings;
CREATE POLICY "Users can add their own email settings" ON public.auto_email_settings
  FOR INSERT TO authenticated
  WITH CHECK (email = (SELECT auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Only admins can view VAPID keys" ON public.vapid_keys;

DROP POLICY IF EXISTS "Recipe images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their recipe images" ON storage.objects;

CREATE POLICY "Users can see their own recipe image files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'recipe-images' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));
CREATE POLICY "Users can upload recipe images to their folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recipe-images' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));
CREATE POLICY "Users can update their own recipe images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'recipe-images' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text))
  WITH CHECK (bucket_id = 'recipe-images' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));
CREATE POLICY "Users can delete their own recipe images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'recipe-images' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));