import { supabase } from "@/integrations/supabase/client";
import type { CompressedImage } from "./compress-image";

// Uploads the compressed JPEG to the private `community-images` bucket
// and returns a long-lived signed URL that we store in image_url columns.
const TEN_YEARS_SECONDS = 60 * 60 * 24 * 365 * 10;

export async function uploadCompressedImage(
  image: CompressedImage,
  userId: string,
): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage
    .from("community-images")
    .upload(path, image.file, {
      contentType: "image/jpeg",
      upsert: false,
    });
  if (error) throw error;

  const { data, error: signErr } = await supabase.storage
    .from("community-images")
    .createSignedUrl(path, TEN_YEARS_SECONDS);
  if (signErr) throw signErr;

  return data.signedUrl;
}
