
-- Public read + authenticated write for community-images bucket
CREATE POLICY "community_images_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'community-images');

CREATE POLICY "community_images_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'community-images' AND owner = auth.uid());

CREATE POLICY "community_images_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'community-images' AND owner = auth.uid());

CREATE POLICY "community_images_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'community-images' AND owner = auth.uid());
