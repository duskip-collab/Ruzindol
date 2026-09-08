import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PhotoLightboxProps {
  photoUrl: string | null | undefined;
  candidateName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  photoUrl,
  candidateName,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !photoUrl) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Fotka kandidáta ${candidateName}`}
    >
      <div className="relative max-w-4xl max-h-[90vh] w-full mx-auto px-4">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Zavrieť"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Image Container */}
        <div className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center">
          <img
            src={photoUrl}
            alt={candidateName}
            className="w-full h-auto max-h-[90vh] object-contain"
            loading="lazy"
          />
        </div>

        {/* Caption */}
        <div className="mt-4 text-center text-white/80 text-sm">
          <p>{candidateName}</p>
        </div>
      </div>
    </div>
  );
};

export default PhotoLightbox;
