// Compress an image file entirely in the browser using HTML5 Canvas.
// - Longer side is downscaled to MAX_SIDE (aspect ratio preserved via a single scale factor).
// - Output is JPEG at QUALITY.
// - Never upscales: if the original is already small, scale is capped at 1.

const MAX_SIDE = 800;
const QUALITY = 0.7;

export type CompressedImage = {
  file: File; // ready-to-upload JPEG
  previewUrl: string; // object URL for <img> thumbnail
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
};

export function compressImage(input: File): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    if (!input.type.startsWith("image/")) {
      reject(new Error("Súbor nie je obrázok."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Nepodarilo sa načítať súbor."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Nepodarilo sa dekódovať obrázok."));
      img.onload = () => {
        // Single scale factor derived from the LONGER side => aspect ratio preserved
        // for both portrait and landscape photos. Cap at 1 to avoid upscaling.
        const longer = Math.max(img.width, img.height);
        const scale = Math.min(1, MAX_SIDE / longer);

        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas nie je podporovaný."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Kompresia zlyhala."));
              return;
            }
            const baseName = input.name.replace(/\.[^.]+$/, "");
            const file = new File([blob], `${baseName}.jpg`, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve({
              file,
              previewUrl: URL.createObjectURL(blob),
              width,
              height,
              originalSize: input.size,
              compressedSize: blob.size,
            });
          },
          "image/jpeg",
          QUALITY,
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(input);
  });
}
