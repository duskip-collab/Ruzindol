import { supabase } from "@/integrations/supabase/client";

const BUCKET = "announcements-audio";
const MAX_AUDIO_SIZE_BYTES = 5 * 1024 * 1024;

function extensionFor(file: File) {
  if (file.type === "audio/mpeg" || file.type === "audio/mp3") return "mp3";
  if (file.type === "audio/wav" || file.type === "audio/x-wav") return "wav";
  if (file.type === "audio/mp4" || file.type === "audio/m4a") return "m4a";
  if (file.type === "audio/webm") return "webm";
  return "audio";
}

async function compressAudioToWebm(file: File) {
  const context = new AudioContext();

  try {
    const buffer = await file.arrayBuffer();
    const decoded = await context.decodeAudioData(buffer.slice(0));
    const destination = context.createMediaStreamDestination();
    const source = context.createBufferSource();
    source.buffer = decoded;
    source.connect(destination);

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(destination.stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm",
      audioBitsPerSecond: 48_000,
    });

    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error("Kompresia audia zlyhala."));
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
      source.onended = () => {
        if (recorder.state !== "inactive") recorder.stop();
      };

      recorder.start();
      source.start(0);
    });

    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "audio"}.webm`, {
      type: blob.type || "audio/webm",
    });
  } finally {
    await context.close();
  }
}

export async function prepareAnnouncementAudio(file: File) {
  let prepared = file;

  if (prepared.size > MAX_AUDIO_SIZE_BYTES) {
    if (typeof AudioContext === "undefined" || typeof MediaRecorder === "undefined") {
      throw new Error("Audio súbor musí mať po kompresii menej ako 5 MB.");
    }

    prepared = await compressAudioToWebm(prepared);
  }

  if (prepared.size > MAX_AUDIO_SIZE_BYTES) {
    throw new Error("Audio súbor je aj po kompresii väčší než 5 MB.");
  }

  return prepared;
}

export async function uploadAnnouncementAudio(file: File, userId: string) {
  const preparedFile = await prepareAnnouncementAudio(file);
  const ext = extensionFor(preparedFile);
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, preparedFile, {
    contentType: preparedFile.type || undefined,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return {
    audioPath: path,
    audioUrl: data.publicUrl,
  };
}
