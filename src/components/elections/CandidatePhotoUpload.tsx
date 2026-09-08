import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/haptics';

export interface CandidatePhotoUploadProps {
  photo_url?: string | null;
  onChange: (url: string | null) => void;
  candidateId?: string;
  disabled?: boolean;
}

export const CandidatePhotoUpload: React.FC<CandidatePhotoUploadProps> = ({
  photo_url,
  onChange,
  candidateId,
  disabled = false
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    // Check file type (JPG, PNG, WebP)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Iba JPG, PNG alebo WebP formáty sú povolené');
      triggerHaptic('error');
      return false;
    }

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError('Súbor je príliš veľký (max 5MB)');
      triggerHaptic('error');
      return false;
    }

    return true;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!validateFile(file)) return;

    setError(null);
    setUploading(true);
    triggerHaptic('light');

    try {
      // Generate unique file name
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      const fileName = `${candidateId || 'new'}-${timestamp}-${randomStr}.jpg`;
      const storagePath = `elections/candidates/${fileName}`;

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('elections')
        .upload(storagePath, file, {
          upsert: false,
          contentType: file.type
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setError('Chyba pri nahrávaní fotky. Skúste neskôr.');
        triggerHaptic('error');
        setUploading(false);
        return;
      }

      // Get public URL
      const { data: publicData } = supabase.storage
        .from('elections')
        .getPublicUrl(storagePath);

      if (publicData?.publicUrl) {
        onChange(publicData.publicUrl);
        setError(null);
        triggerHaptic('success');
      } else {
        setError('Chyba pri získavaní URL fotky');
        triggerHaptic('error');
      }
    } catch (err) {
      console.error('Upload exception:', err);
      setError('Neznáma chyba pri nahrávaní');
      triggerHaptic('error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = () => {
    setError(null);
    onChange(null);
    triggerHaptic('light');
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        // Simulate file input change
        const input = fileInputRef.current;
        if (input) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          input.files = dataTransfer.files;
          
          const event = new Event('change', { bubbles: true });
          input.dispatchEvent(event);
        }
      }
    }
  };

  return (
    <div className="space-y-2">
      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-2">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Current photo preview */}
      {photo_url && (
        <div className="relative group">
          <img
            src={photo_url}
            alt="Fotka kandidáta"
            className="h-24 w-24 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
          />
          <button
            type="button"
            onClick={handleRemovePhoto}
            disabled={uploading || disabled}
            className="absolute -top-2 -right-2 flex items-center justify-center h-6 w-6 rounded-full bg-red-600 dark:bg-red-700 text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
            title="Odstrániť fotku"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Upload area */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-lg border-2 border-dashed transition-all p-4 text-center',
          uploading || disabled
            ? 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600 cursor-not-allowed opacity-50'
            : 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20 hover:border-blue-400 dark:hover:border-blue-600 cursor-pointer'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={uploading || disabled}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || disabled}
          className="w-full flex flex-col items-center gap-2"
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Nahrávam...
              </span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  Klikni alebo pretiahnite fotku
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  JPG, PNG alebo WebP (max 5MB)
                </p>
              </div>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CandidatePhotoUpload;
