import { supabase } from "@/integrations/supabase/client";

export function extractStorageObjectPathFromUrl(url: string, bucket: string) {
  try {
    const parsed = new URL(url);
    const marker = `/object/sign/${bucket}/`;
    const publicMarker = `/object/public/${bucket}/`;

    if (parsed.pathname.includes(marker)) {
      return decodeURIComponent(parsed.pathname.split(marker)[1] ?? "");
    }

    if (parsed.pathname.includes(publicMarker)) {
      return decodeURIComponent(parsed.pathname.split(publicMarker)[1] ?? "");
    }
  } catch {
    return null;
  }

  return null;
}

export async function removeBucketObject(bucket: string, path: string | null | undefined) {
  const objectPath = path?.trim();
  if (!objectPath) return;

  const { error } = await supabase.storage.from(bucket).remove([objectPath]);
  if (error) throw error;
}