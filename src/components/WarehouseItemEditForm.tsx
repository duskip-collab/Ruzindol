import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ImageInput } from "@/components/ImageInput";
import type { CompressedImage } from "@/lib/compress-image";
import { uploadCompressedImage } from "@/lib/upload-image";
import { removeBucketObject } from "@/lib/storage";

const MAX_PHOTOS = 4;

type StoredPhoto = { url: string; path: string | null };
type Item = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  description: string;
  price: number;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  image_url_4: string | null;
  image_path: string | null;
  image_path_2: string | null;
  image_path_3: string | null;
  image_path_4: string | null;
};

export function WarehouseItemEditForm({
  item,
  onClose,
  onSaved,
}: {
  item: Item;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [price, setPrice] = useState(String(item.price));
  const [storedPhotos, setStoredPhotos] = useState<StoredPhoto[]>(() =>
    [
      [item.image_url, item.image_path],
      [item.image_url_2, item.image_path_2],
      [item.image_url_3, item.image_path_3],
      [item.image_url_4, item.image_path_4],
    ].flatMap(([url, path]) => (url ? [{ url, path }] : [])),
  );
  const [newPhotos, setNewPhotos] = useState<CompressedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const photoCount = storedPhotos.length + newPhotos.length;
  const addPhotos = (images: CompressedImage[]) => {
    setNewPhotos((current) => {
      const available = Math.max(0, MAX_PHOTOS - storedPhotos.length - current.length);
      const accepted = images.slice(0, available);
      images.slice(available).forEach((image) => URL.revokeObjectURL(image.previewUrl));
      if (accepted.length < images.length) {
        setError("Inzerát môže obsahovať najviac 4 fotky.");
      } else {
        setError(null);
      }
      return [...current, ...accepted];
    });
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (photoCount > MAX_PHOTOS || !title.trim() || busy) return;
    setBusy(true);
    setError(null);
    const uploaded: StoredPhoto[] = [];
    let databaseSaved = false;
    try {
      for (const photo of newPhotos) {
        const upload = await uploadCompressedImage(photo, item.user_id);
        uploaded.push({ url: upload.imageUrl, path: upload.imagePath });
      }
      const photos = [...storedPhotos, ...uploaded];
      const fields = photos.reduce<Record<string, string | null>>((result, photo, index) => {
        const suffix = index === 0 ? "" : `_${index + 1}`;
        result[`image_url${suffix}`] = photo.url;
        result[`image_path${suffix}`] = photo.path;
        return result;
      }, {});
      for (let index = photos.length; index < MAX_PHOTOS; index++) {
        const suffix = index === 0 ? "" : `_${index + 1}`;
        fields[`image_url${suffix}`] = null;
        fields[`image_path${suffix}`] = null;
      }
      const { error: updateError } = await supabase
        .from("warehouse_items")
        .update({ title: title.trim(), description: description.trim(), price: item.type === "darovanie" ? 0 : Number(price) || 0, ...fields })
        .eq("id", item.id)
        .eq("user_id", item.user_id);
      if (updateError) throw updateError;
      databaseSaved = true;

      const retainedPaths = new Set(photos.map((photo) => photo.path).filter(Boolean));
      const storageResults = await Promise.all(
        [item.image_path, item.image_path_2, item.image_path_3, item.image_path_4]
          .filter((path): path is string => Boolean(path) && !retainedPaths.has(path))
          .map((path) => removeBucketObject("warehouse", path).then(() => null).catch(() => path)),
      );
      if (storageResults.some(Boolean)) {
        setError("Inzerát bol uložený, ale niektoré staré fotky sa nepodarilo odstrániť zo storage.");
      }
      newPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      await onSaved();
      setSaved(true);
      window.setTimeout(onClose, 900);
    } catch (caught) {
      if (!databaseSaved) {
        await Promise.all(uploaded.map((photo) => removeBucketObject("warehouse", photo.path).catch(() => undefined)));
      }
      setError(caught instanceof Error ? caught.message : "Zmeny sa nepodarilo uložiť.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[180] flex items-end bg-black/40 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-5">
      <div className="flex h-full w-full flex-col bg-background text-foreground md:h-auto md:max-h-[92%] md:max-w-2xl md:rounded-3xl md:border md:border-border md:shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold">Upraviť inzerát</h2>
          <button type="button" onClick={onClose} aria-label="Zavrieť" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={(event) => void submit(event)} className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <label className="text-sm font-medium">Názov<input value={title} onChange={(event) => setTitle(event.target.value)} required className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" /></label>
          <label className="text-sm font-medium">Popis<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} className="mt-1 w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm" /></label>
          <div>
            <p className="text-sm font-medium">Fotografie ({photoCount}/{MAX_PHOTOS})</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {storedPhotos.map((photo, index) => (
                <div key={photo.path ?? photo.url} className="relative">
                  <img src={photo.url} alt="" className="h-28 w-full rounded-xl object-cover" />
                  <button type="button" onClick={() => setStoredPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} aria-label="Odstrániť fotku" className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"><X className="h-4 w-4" /></button>
                </div>
              ))}
              {newPhotos.map((photo, index) => (
                <div key={photo.previewUrl} className="relative"><img src={photo.previewUrl} alt="Nová fotka" className="h-28 w-full rounded-xl object-cover" /><button type="button" onClick={() => { URL.revokeObjectURL(photo.previewUrl); setNewPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index)); }} aria-label="Odstrániť fotku" className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"><X className="h-4 w-4" /></button></div>
              ))}
            </div>
            {photoCount < MAX_PHOTOS && (
              <ImageInput
                value={null}
                onChange={(image) => image && addPhotos([image])}
                onChangeMany={addPhotos}
                multiple
                label="Pridať fotografie"
              />
            )}
          </div>
          {item.type !== "darovanie" && <label className="text-sm font-medium">Cena (€)<input type="number" min={0} step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" /></label>}
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {saved && <p className="text-sm font-medium text-emerald-600">Zmeny boli úspešne uložené.</p>}
          <div className="mt-auto flex gap-2 pt-2"><button type="button" onClick={onClose} className="btn-secondary-surface flex-1 px-4 py-3 text-sm font-medium">Zrušiť</button><button type="submit" disabled={busy || photoCount > MAX_PHOTOS} className="btn-primary-glow flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Uložiť zmeny</button></div>
        </form>
      </div>
    </div>
  );
}