import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Building2,
  Camera,
  ShieldAlert,
  Ticket,
  Megaphone,
  Church,
  Trash2,
  Plus,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppMode } from "@/context/AppModeContext";
import { uploadAnnouncementAudio } from "@/lib/upload-announcement-audio";
import { useCurrentUser, type ProfileRole } from "@/hooks/useCurrentUser";
import { isIosDevice } from "@/lib/pwa";
import type { PostPriority } from "@/types";
import { MayorInquiriesPanel } from "@/components/mayor/MayorInquiriesPanel";
import { CommunityStats } from "@/components/CommunityStats";

type ReviewPost = {
  id: string;
  title: string;
  userName: string;
};

// =============================================================
// VIP Firma — Dashboard, business profile, mini-web builder
// =============================================================

export function VipDashboard({
  postsCount,
  itemsCount,
}: {
  postsCount: number;
  itemsCount: number;
}) {
  const [ico, setIco] = useState("");
  const [dic, setDic] = useState("");
  const [companyName, setCompanyName] = useState("Pekáreň u Anny");
  const [description, setDescription] = useState(
    "Rodinná pekáreň, čerstvé pečivo každý deň od 6:00.",
  );
  const [contact, setContact] = useState("+421 900 000 000");
  const [photos, setPhotos] = useState<string[]>([]);

  const analytics = useMemo(
    () => ({
      visits: 128 + itemsCount * 7,
      leads: 12 + postsCount,
      shares: 5 + Math.floor(itemsCount / 2),
    }),
    [itemsCount, postsCount],
  );

  function addPhoto(file: File | null) {
    if (!file || photos.length >= 3) return;
    const url = URL.createObjectURL(file);
    setPhotos((p) => [...p, url]);
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
      <PanelHeader
        icon={<Building2 className="h-4 w-4" />}
        title="Firemný panel"
        subtitle="Analytika, firemný profil a mini-web"
        tone="amber"
      />

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Návštevy" value={analytics.visits} />
        <Stat label="Kontakty" value={analytics.leads} />
        <Stat label="Zdieľania" value={analytics.shares} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <TextField label="IČO" value={ico} onChange={setIco} placeholder="12345678" />
        <TextField label="DIČ" value={dic} onChange={setDic} placeholder="SK1234567890" />
      </div>

      <div className="mt-4 rounded-2xl border border-white/50 bg-white/70 p-4 dark:border-neutral-300 dark:bg-neutral-200">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Mini-Web</p>
        <TextField label="Názov" value={companyName} onChange={setCompanyName} />
        <label className="mt-3 block">
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-800">Popis</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none dark:border-neutral-400 dark:bg-neutral-300 dark:text-neutral-900"
          />
        </label>
        <TextField label="Kontakt" value={contact} onChange={setContact} />

        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-800">
            Fotky ({photos.length}/3)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <label
                key={i}
                className="relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-300 bg-white/60 text-neutral-400 dark:border-neutral-400 dark:bg-neutral-300 dark:text-neutral-700"
              >
                {photos[i] ? (
                  <img src={photos[i]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => addPhoto(e.target.files?.[0] ?? null)}
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================
// Panel Starostu — municipal metrics, moderation, batch invites
// =============================================================

export function PanelStarostu({
  posts,
  itemsCount,
  usersCount,
  onDeleted,
}: {
  posts: ReviewPost[];
  itemsCount: number;
  usersCount: number;
  onDeleted: () => void;
}) {
  const { generateInviteCode } = useAppMode();
  const [batch, setBatch] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  function generateBatch(n: number) {
    const codes: string[] = [];
    for (let i = 0; i < n; i++) {
      const res = generateInviteCode();
      if (res.ok) codes.push(res.code);
    }
    setBatch(codes);
  }

  function copy(c: string) {
    navigator.clipboard?.writeText(c).then(() => {
      setCopied(c);
      setTimeout(() => setCopied(null), 1200);
    });
  }

  async function deletePost(id: string) {
    setDeletingPostId(id);
    await supabase.from("posts").delete().eq("id", id);
    setDeletingPostId(null);
    onDeleted();
  }

  return (
    <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
      <PanelHeader
        icon={<ShieldAlert className="h-4 w-4" />}
        title="Panel Starostu"
        subtitle="Metriky obce, moderácia a pozvánky"
        tone="blue"
      />

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Občania" value={usersCount} />
        <Stat label="Príspevky" value={posts.length} />
        <Stat label="Inzeráty" value={itemsCount} />
      </div>

      <div className="mt-4 rounded-2xl border border-white/50 bg-white/70 p-4 dark:border-neutral-300 dark:bg-neutral-200">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Posledné príspevky ({posts.length})
        </p>
        {posts.length === 0 ? (
          <p className="mt-2 text-xs text-neutral-500">Žiadne príspevky.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {posts.map((p) => (
              <li
                key={p.id}
                className="flex items-start justify-between gap-2 rounded-xl border border-neutral-200 bg-white p-2 text-xs dark:border-neutral-400 dark:bg-neutral-300"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-neutral-900 dark:text-neutral-900">
                    {p.title}
                  </p>
                  <p className="truncate text-neutral-500 dark:text-neutral-800">{p.userName}</p>
                </div>
                <button
                  onClick={() => void deletePost(p.id)}
                  disabled={deletingPostId === p.id}
                  className="rounded-md bg-rose-600 px-2 py-1 text-[10px] font-medium text-white disabled:opacity-60"
                >
                  {deletingPostId === p.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-white/50 bg-white/70 p-4 dark:border-neutral-300 dark:bg-neutral-200">
        <p className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-neutral-500">
          <span className="flex items-center gap-1.5">
            <Ticket className="h-3.5 w-3.5" /> Hromadné pozvánky
          </span>
        </p>
        <div className="mt-2 flex gap-1.5">
          {[5, 10, 25].map((n) => (
            <button
              key={n}
              onClick={() => generateBatch(n)}
              className="flex-1 rounded-xl bg-neutral-900 py-2 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900"
            >
              +{n}
            </button>
          ))}
        </div>
        {batch.length > 0 && (
          <ul className="mt-3 grid grid-cols-2 gap-1.5">
            {batch.map((c) => (
              <li
                key={c}
                onClick={() => copy(c)}
                className="flex cursor-pointer items-center justify-between gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-[11px] dark:border-neutral-400 dark:bg-neutral-300 dark:text-neutral-900"
              >
                <span className="truncate">{c}</span>
                {copied === c ? (
                  <Check className="h-3 w-3 text-emerald-600" />
                ) : (
                  <Copy className="h-3 w-3 text-neutral-400 dark:text-neutral-700" />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// =============================================================
// Digitalny Rozhlas — Uradnik alert composer
// =============================================================

const EXPIRY_OPTIONS: { label: string; hours: number }[] = [
  { label: "24 hodín", hours: 24 },
  { label: "3 dni", hours: 72 },
  { label: "5 dní", hours: 120 },
];

const PRIORITIES: { key: PostPriority; label: string; color: string }[] = [
  { key: "urgent", label: "Vysoká", color: "bg-rose-500 text-white" },
  { key: "high", label: "Stredná", color: "bg-amber-500 text-white" },
  { key: "normal", label: "Nízka", color: "bg-emerald-500 text-white" },
];

export function DigitalnyRozhlas({
  userId,
  onPosted,
}: {
  userId: string | null;
  onPosted: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<PostPriority>("high");
  const [expiryH, setExpiryH] = useState(72);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const canRecord =
    typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    };
  }, [audioPreviewUrl]);

  function clearAudio() {
    setAudioFile(null);
    setAudioPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setRecordError(null);
  }

  function setAudioFromBlob(blob: Blob, name: string) {
    clearAudio();
    const file = new File([blob], name, { type: blob.type || "audio/webm" });
    setAudioFile(file);
    setAudioPreviewUrl(URL.createObjectURL(blob));
  }

  async function startRecording() {
    if (!canRecord || recording) return;
    setRecordError(null);
    clearAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType =
        (isIosDevice() && MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "") ||
        (isIosDevice() && MediaRecorder.isTypeSupported("audio/mp4;codecs=mp4a.40.2")
          ? "audio/mp4;codecs=mp4a.40.2"
          : "") ||
        (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "");

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 48_000 })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setRecordError("Nahrávanie zlyhalo.");
        setRecording(false);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (blob.size > 0) {
          const ext = blob.type.includes("mp4") || blob.type.includes("m4a") ? "m4a" : "webm";
          setAudioFromBlob(blob, `rozhlas-${Date.now()}.${ext}`);
        }
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        chunksRef.current = [];
        setRecording(false);
      };

      recorder.start();
      setRecording(true);
    } catch {
      setRecordError("Mikrofón nie je dostupný alebo bol zamietnutý.");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      setRecording(false);
    }
  }

  function stopRecording() {
    if (recorderRef.current && recording) {
      recorderRef.current.stop();
    }
  }

  function handleFileUpload(file: File | null) {
    if (!file) return;
    const allowed = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/webm",
      "audio/mp4",
      "audio/m4a",
      "audio/x-m4a",
      "audio/aac",
    ];
    if (!allowed.includes(file.type)) {
      setRecordError("Podporované sú súbory MP3, WAV, M4A, AAC alebo WEBM.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setRecordError("Zvukový súbor musí mať najviac 5 MB. Väčšie súbory sa pred uložením skúsia komprimovať.");
      return;
    }
    setRecordError(null);
    clearAudio();
    setAudioFile(file);
    setAudioPreviewUrl(URL.createObjectURL(file));
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !userId || recording) return;

    setBusy(true);
    try {
      const safeExpiryH = Math.min(expiryH, 120);
      const expiresAtIso = new Date(Date.now() + safeExpiryH * 3600_000).toISOString();
      const announcementPriority =
        priority === "urgent" ? "vystraha" : priority === "high" ? "urgentne" : "oznam";

      let audioAttachment: { audioPath: string; audioUrl: string } | null = null;
      if (audioFile) {
        audioAttachment = await uploadAnnouncementAudio(audioFile, userId);
      }

      const { error } = await supabase.from("announcements").insert({
        source: "internal",
        author_id: userId,
        title: title.trim(),
        content: content.trim(),
        priority: announcementPriority,
        published_at: new Date().toISOString(),
        expires_at: expiresAtIso,
        audio_url: audioAttachment?.audioUrl ?? null,
        audio_path: audioAttachment?.audioPath ?? null,
      });

      if (error) {
        setRecordError(error.message);
        return;
      }

      setTitle("");
      setContent("");
      clearAudio();
      setSent(true);
      onPosted();
      setTimeout(() => setSent(false), 1500);
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : "Odoslanie zlyhalo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
      <PanelHeader
        icon={<Megaphone className="h-4 w-4" />}
        title="Digitálny Rozhlas"
        subtitle="Úradník — vysielanie oznamov"
        tone="orange"
      />
      <form onSubmit={send} className="mt-4 space-y-3">
        <TextField label="Titulok" value={title} onChange={setTitle} />
        <label className="block">
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-800">Obsah</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none dark:border-neutral-400 dark:bg-neutral-300 dark:text-neutral-900"
            required
          />
        </label>

        <div className="rounded-2xl border border-neutral-200/70 bg-white/80 p-4 dark:border-neutral-300 dark:bg-neutral-200">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (recording) stopRecording();
                else void startRecording();
              }}
              disabled={!canRecord && !recording}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                recording
                  ? "bg-rose-600 text-white hover:bg-rose-700"
                  : "bg-neutral-900 text-white hover:bg-neutral-800"
              } disabled:opacity-50`}
            >
              {recording ? "Zastaviť nahrávanie" : "Nahrať hlasovú správu"}
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-400 dark:bg-neutral-300 dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              Nahrať súbor MP3 / WAV / M4A / AAC / WEBM
            </button>

            {audioFile && (
              <button
                type="button"
                onClick={clearAudio}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-500 hover:bg-neutral-50 dark:border-neutral-400 dark:bg-neutral-300 dark:text-neutral-800 dark:hover:bg-neutral-100"
              >
                Odstrániť audio
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/webm,audio/mp4,audio/m4a,audio/x-m4a,audio/aac"
            className="hidden"
            onChange={(e) => {
              handleFileUpload(e.target.files?.[0] ?? null);
              e.currentTarget.value = "";
            }}
          />

          {audioPreviewUrl && audioFile && (
            <div className="mt-3 rounded-2xl border border-neutral-200/70 bg-neutral-50 p-3 dark:border-neutral-400 dark:bg-neutral-300">
              <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-900">
                Nahraná zvuková správa
              </p>
              <p className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-800">
                Pred uložením sa súbor skomprimuje a musí zostať pod limitom 5 MB.
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-700">{audioFile.name}</p>
              <audio controls preload="none" className="mt-2 w-full">
                <source src={audioPreviewUrl} type={audioFile.type || "audio/webm"} />
              </audio>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearAudio();
                    if (canRecord) void startRecording();
                  }}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-400 dark:bg-neutral-300 dark:text-neutral-900 dark:hover:bg-neutral-100"
                >
                  Nahrať znova
                </button>
              </div>
            </div>
          )}

          {recording && (
            <p className="mt-2 text-[11px] font-medium text-rose-600">Nahrávam... hovorte do mikrofónu.</p>
          )}
          {recordError && <p className="mt-2 text-[11px] text-rose-600">{recordError}</p>}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-800">
            Priorita
          </p>
          <div className="flex gap-1.5">
            {PRIORITIES.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPriority(p.key)}
                className={`flex-1 rounded-xl px-2 py-2 text-xs font-semibold transition ${
                  priority === p.key
                    ? p.color
                    : "bg-neutral-100 text-neutral-600 dark:bg-neutral-300 dark:text-neutral-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-800">
            Platnosť
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {EXPIRY_OPTIONS.map((o) => (
              <button
                key={o.hours}
                type="button"
                onClick={() => setExpiryH(o.hours)}
                className={`rounded-xl px-1 py-2 text-[11px] font-semibold ${
                  expiryH === o.hours
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "bg-neutral-100 text-neutral-600 dark:bg-neutral-300 dark:text-neutral-900"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || !userId || recording}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-orange-600 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : sent ? (
            <Check className="h-4 w-4" />
          ) : (
            <Megaphone className="h-4 w-4" />
          )}
          {sent ? "Odoslané" : "Vysielať"}
        </button>
      </form>
    </section>
  );
}

// =============================================================
// Farsky Urad — Farar
// =============================================================

export function FarskyUrad({
  userId,
  municipalityId,
  onPosted,
}: {
  userId: string | null;
  municipalityId: string | null;
  onPosted: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [location, setLocation] = useState("Kostol sv. Martina");
  const [dt, setDt] = useState(() => {
    const d = new Date(Date.now() + 24 * 3600_000);
    return d.toISOString().slice(0, 16);
  });
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !userId) return;

    setBusy(true);
    const startsAt = new Date(dt).toISOString();

    const postResult = await supabase.from("posts").insert({
      user_id: userId,
      type: "farsky_oznam",
      category: "Farský oznam",
      title: title.trim(),
      content: content.trim(),
    });

    if (!postResult.error) {
      await supabase.from("events").insert({
        author_id: userId,
        municipality_id: municipalityId,
        title: title.trim(),
        description: content.trim(),
        location,
        starts_at: startsAt,
        type: "Kostol",
      });
      onPosted();
    }

    setBusy(false);
    if (postResult.error) return;

    setOk(true);
    setTitle("");
    setContent("");
    setTimeout(() => setOk(false), 1500);
  }

  return (
    <section className="rounded-2xl border border-purple-200 bg-white p-5 shadow-sm">
      <PanelHeader
        icon={<Church className="h-4 w-4" />}
        title="Farský Úrad"
        subtitle="Farár — oznamy synchronizované s kalendárom"
        tone="purple"
      />
      <form onSubmit={submit} className="mt-4 space-y-3">
        <TextField label="Titulok" value={title} onChange={setTitle} />
        <label className="block">
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-800">Obsah</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none dark:border-neutral-400 dark:bg-neutral-300 dark:text-neutral-900"
            required
          />
        </label>
        <TextField label="Miesto" value={location} onChange={setLocation} />
        <label className="block">
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-800">Termín</span>
          <input
            type="datetime-local"
            value={dt}
            onChange={(e) => setDt(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none dark:border-neutral-400 dark:bg-neutral-300 dark:text-neutral-900"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !userId}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-purple-600 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : ok ? (
            <Check className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {ok ? "Pridané do kalendára" : "Publikovať oznam"}
        </button>
      </form>
    </section>
  );
}

// =============================================================
// Role router — decides which panels to show for currentRole
// =============================================================

export function RolePanels({ role }: { role: ProfileRole }) {
  const { profile, userId } = useCurrentUser();
  const [posts, setPosts] = useState<ReviewPost[]>([]);
  const [usersCount, setUsersCount] = useState(0);
  const [itemsCount, setItemsCount] = useState(0);

  type PostAuthorRow = { name: string | null };
  type ReviewPostRow = {
    id: string;
    title: string | null;
    user_id: string;
    profiles: PostAuthorRow | null;
  };

  const loadStats = useCallback(async () => {
    const [postsRes, usersRes, itemsRes] = await Promise.all([
      supabase
        .from("posts")
        .select("id, title, user_id, profiles(name)")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("warehouse_items").select("id", { count: "exact", head: true }),
    ]);

    const mappedPosts: ReviewPost[] = ((postsRes.data as ReviewPostRow[] | null) ?? []).map(
      (p) => ({
        id: p.id,
        title: p.title ?? "Bez názvu",
        userName: p.profiles?.name ?? "Sused",
      }),
    );

    setPosts(mappedPosts);
    setUsersCount(usersRes.count ?? 0);
    setItemsCount(itemsRes.count ?? 0);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadStats();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadStats]);

  return (
    <div className="flex flex-col gap-4">
      {/* Community Statistics - visible for everyone */}
      <CommunityStats municipalityId={profile?.municipality_id ?? null} />
      
      {role === "VIP_Firma" && <VipDashboard postsCount={posts.length} itemsCount={itemsCount} />}
      {role === "Starosta" && (
        <PanelStarostu
          posts={posts}
          itemsCount={itemsCount}
          usersCount={usersCount}
          onDeleted={() => {
            void loadStats();
          }}
        />
      )}
      {role === "Uradnik" && (
        <section className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
          <PanelHeader
            icon={<Megaphone className="h-4 w-4" />}
            title="Digitálny Rozhlas"
            subtitle="Presunuté do záložky Aktuality"
            tone="orange"
          />
          <p className="mt-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-900">
            Hlásenie teraz otvoríš priamo v Aktualitách cez ikonu megafónu v sekcii Aktuality a
            oznamy.
          </p>
        </section>
      )}
      {role === "Farar" && (
        <FarskyUrad
          userId={userId}
          municipalityId={profile?.municipality_id ?? null}
          onPosted={() => {
            void loadStats();
          }}
        />
      )}

      {/* {profile?.is_official && (
        <div className="space-y-6">
          <MayorInquiriesPanel />
        </div>
      )} */}
    </div>
  );
}

// ---------- Shared UI atoms ----------

function PanelHeader({
  icon,
  title,
  subtitle,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tone: "amber" | "blue" | "orange" | "purple";
}) {
  const toneMap: Record<string, string> = {
    amber: "bg-amber-500",
    blue: "bg-blue-600",
    orange: "bg-orange-500",
    purple: "bg-purple-600",
  };
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-white ${toneMap[tone]}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900 dark:text-neutral-900">
          <BarChart3 className="h-3.5 w-3.5 opacity-50" /> {title}
        </p>
        <p className="text-[11px] text-neutral-500 dark:text-neutral-800">{subtitle}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/50 bg-white/70 p-3 text-center dark:border-neutral-300 dark:bg-neutral-200">
      <p className="text-lg font-bold text-neutral-900 dark:text-neutral-900">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-800">{label}</p>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-neutral-600 dark:text-neutral-800">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:border-neutral-400 dark:bg-neutral-300 dark:text-neutral-900 dark:placeholder:text-neutral-600"
      />
    </label>
  );
}