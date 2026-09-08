import React, { useCallback, useState } from 'react';
import { Upload, File, Trash2, Loader2, AlertCircle, FileText, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

export interface AttachmentFile {
  id: string;
  file_name: string;
  file_type: 'pdf' | 'image';
  file_url: string;
  file_size_bytes?: number;
  description?: string;
  sort_order: number;
}

export interface ElectionsAttachmentUploadProps {
  electionId: string;
  attachments: AttachmentFile[];
  onAttachmentsChange: (attachments: AttachmentFile[]) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = {
  pdf: ['application/pdf'],
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
};
const STORAGE_BUCKET = 'elections';
const STORAGE_FALLBACK_BUCKET = 'public'; // Fallback ak 'elections' neexistuje

export const ElectionsAttachmentUpload: React.FC<ElectionsAttachmentUploadProps> = ({
  electionId,
  attachments,
  onAttachmentsChange,
  disabled = false
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0 || disabled || uploading) return;

    setError(null);
    const file = files[0];

    // Validácia
    if (file.size > MAX_FILE_SIZE) {
      setError('Súbor je príliš veľký (max 10MB)');
      return;
    }

    const isPdf = ALLOWED_TYPES.pdf.includes(file.type);
    const isImage = ALLOWED_TYPES.image.includes(file.type);

    if (!isPdf && !isImage) {
      setError('Povolené sú iba PDF a obrázky (JPEG, PNG, WebP, GIF)');
      return;
    }

    const fileType: 'pdf' | 'image' = isPdf ? 'pdf' : 'image';

    try {
      setUploading(true);
      triggerHaptic('light');

      const fileName = `${electionId}/${fileType}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '-')}`;
      
      let uploadData;
      let uploadError;
      
      // Pokús sa nahráť na 'elections' bucket, ak zlyhá spróbuj 'public'
      try {
        const result = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(fileName, file);
        uploadData = result.data;
        uploadError = result.error;
      } catch (err) {
        console.warn(`Bucket '${STORAGE_BUCKET}' failed, trying fallback:`, err);
        // Fallback na verejný bucket ak 'elections' neexistuje
        const result = await supabase.storage
          .from(STORAGE_FALLBACK_BUCKET)
          .upload(`elections/${fileName}`, file);
        uploadData = result.data;
        uploadError = result.error;
      }

      if (uploadError) {
        console.error('Upload error:', uploadError);
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('StorageApiError')) {
          setError('Úložisko nie je správne nakonfigurované. Kontaktuj administrátora.');
        } else {
          setError('Chyba pri nahrávaní súboru');
        }
        triggerHaptic('error');
        return;
      }

      const publicUrlData = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(fileName);

      const newAttachment: AttachmentFile = {
        id: uploadData.path,
        file_name: file.name,
        file_type: fileType,
        file_url: publicUrlData.data.publicUrl,
        file_size_bytes: file.size,
        description: '',
        sort_order: attachments.length
      };

      onAttachmentsChange([...attachments, newAttachment]);
      triggerHaptic('success');
    } catch (err) {
      console.error('Upload failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Neznáma chyba';
      if (errorMessage.includes('Bucket not found') || errorMessage.includes('StorageApiError')) {
        setError('Úložisko nie je správne nakonfigurované. Kontaktuj administrátora.');
      } else {
        setError('Neznáma chyba pri nahrávaní');
      }
      triggerHaptic('error');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (id: string) => {
    triggerHaptic('light');
    onAttachmentsChange(attachments.filter((a) => a.id !== id));
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFileChange(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-2xl border-2 border-dashed p-6 text-center transition-colors',
          dragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
            : 'border-slate-300 dark:border-slate-700'
        )}
      >
        <input
          type="file"
          id="file-upload"
          accept=".pdf,image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => handleFileChange(e.target.files)}
          disabled={disabled || uploading}
          className="hidden"
        />

        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Nahrávam súbor...</span>
          </div>
        ) : (
          <>
            <label
              htmlFor="file-upload"
              className="flex cursor-pointer flex-col items-center gap-2"
            >
              <Upload className="h-6 w-6 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Klikni na upload alebo vylož súbor
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  PDF alebo obrázky (max 10MB)
                </p>
              </div>
            </label>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 p-3 dark:bg-red-950/20 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <span className="text-xs text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Nahraté súbory ({attachments.length})
          </p>
          <div className="space-y-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {att.file_type === 'pdf' ? (
                    <FileText className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                      {att.file_name}
                    </p>
                    {att.file_size_bytes && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {(att.file_size_bytes / 1024).toFixed(1)} KB
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemove(att.id)}
                  disabled={disabled || uploading}
                  className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ElectionsAttachmentUpload;
