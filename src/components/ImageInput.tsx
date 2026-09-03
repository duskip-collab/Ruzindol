import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X, Camera } from "lucide-react";
import { compressImage, type CompressedImage } from "@/lib/compress-image";

type Props = {
  value: CompressedImage | null;
  onChange: (img: CompressedImage | null) => void;
  label?: string;
  multiple?: boolean;
  onChangeMany?: (images: CompressedImage[]) => void;
};

export function ImageInput({ value, onChange, label = "Fotka", multiple = false, onChangeMany }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Revoke object URL on unmount / replacement to avoid leaks.
  useEffect(() => {
    return () => {
      if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
    };
  }, [value?.previewUrl]);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const compressed = await compressImage(file);
      if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
      onChange(compressed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kompresia zlyhala.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  }

  async function handleFiles(files: FileList) {
    setError(null);
    setBusy(true);
    try {
      const compressed = await Promise.all(Array.from(files).map((file) => compressImage(file)));
      onChangeMany?.(compressed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kompresia zlyhala.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  }

  const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;

  return (
    <div>
      <label className="text-sm font-medium text-neutral-700">{label}</label>

      {/* Hidden file inputs - one for gallery, one for camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (multiple && e.target.files?.length) {
            void handleFiles(e.target.files);
          } else {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={false}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />

      {value ? (
        <div className="mt-1 flex items-center gap-3 rounded-xl border border-neutral-200 bg-white/80 p-2 backdrop-blur">
          <img
            src={value.previewUrl}
            alt="Náhľad"
            className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-neutral-200"
          />
          <div className="min-w-0 flex-1 text-xs text-neutral-600">
            <p className="font-medium text-neutral-800">
              {value.width} × {value.height} px
            </p>
            <p>
              {kb(value.originalSize)} →{" "}
              <span className="font-semibold text-emerald-700">{kb(value.compressedSize)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              URL.revokeObjectURL(value.previewUrl);
              onChange(null);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
            aria-label="Odstrániť fotku"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="mt-1 flex gap-2">
          {/* Button for gallery / file picker */}
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white/60 px-3 py-3 text-sm font-medium text-neutral-700 backdrop-blur transition hover:bg-white disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Optimalizujem…
              </>
            ) : (
              <>
                <ImagePlus className="h-4 w-4" />
                Galéria
              </>
            )}
          </button>

          {/* Button for camera capture */}
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white/60 px-3 py-3 text-sm font-medium text-neutral-700 backdrop-blur transition hover:bg-white disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Optimalizujem…
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" />
                Fotit
              </>
            )}
          </button>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      {!error && !busy && !value && (
        <p className="mt-1 text-xs text-neutral-500">
          Fotka sa v prehliadači automaticky zmenší (max 800 px, JPEG 70 %) — šetríme miesto.
        </p>
      )}
    </div>
  );
}
