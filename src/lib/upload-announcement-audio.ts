import { supabase } from "@/integrations/supabase/client";
import { isIosDevice } from "@/lib/pwa";

const BUCKET = "announcements-audio";
const MAX_AUDIO_SIZE_BYTES = 5 * 1024 * 1024;

function extensionFor(file: File) {
  if (file.type === "audio/mpeg" || file.type === "audio/mp3") return "mp3";
  if (file.type === "audio/wav" || file.type === "audio/x-wav") return "wav";
  if (file.type === "audio/mp4" || file.type === "audio/m4a" || file.type === "audio/x-m4a") return "m4a";
  if (file.type === "audio/aac") return "aac";
  if (file.type === "audio/webm") return "webm";
  return "audio";
}

function preferredCompressionMimeType() {
  const preferred = isIosDevice()
    ? ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4"];

  return preferred.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? "";
}

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("aac")) return "aac";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  return "webm";
}

async function compressAudioToSupportedFormat(file: File) {
  const context = new AudioContext();

  try {
    const buffer = await file.arrayBuffer();
    const decoded = await context.decodeAudioData(buffer.slice(0));
    const destination = context.createMediaStreamDestination();
    const source = context.createBufferSource();
    source.buffer = decoded;
    source.connect(destination);

    const chunks: Blob[] = [];
    const mimeType = preferredCompressionMimeType();
    if (!mimeType) {
      throw new Error("Toto zariadenie nepodporuje kompresiu audia v prehliadači.");
    }

    const recorder = new MediaRecorder(destination.stream, {
      mimeType,
      audioBitsPerSecond: 48_000,
    });

    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error("Kompresia audia zlyhala."));
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || mimeType }));
      source.onended = () => {
        if (recorder.state !== "inactive") recorder.stop();
      };

      recorder.start();
      source.start(0);
    });

    const finalMimeType = blob.type || mimeType;
    const ext = extensionForMimeType(finalMimeType);

    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "audio"}.${ext}`, {
      type: finalMimeType,
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

    prepared = await compressAudioToSupportedFormat(prepared);
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
