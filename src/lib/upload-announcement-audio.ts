import { supabase } from "@/integrations/supabase/client";

const BUCKET = "announcements-audio";

function extensionFor(file: File) {
  if (file.type === "audio/mpeg" || file.type === "audio/mp3") return "mp3";
  if (file.type === "audio/wav" || file.type === "audio/x-wav") return "wav";
  if (file.type === "audio/webm") return "webm";
  return "audio";
}

export async function uploadAnnouncementAudio(file: File, userId: string) {
  const ext = extensionFor(file);
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return {
    audioPath: path,
    audioUrl: data.publicUrl,
  };
}
