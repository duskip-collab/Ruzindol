import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { triggerHaptic } from '../lib/haptics';
import { cn } from '../lib/utils';

export interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void | Promise<void>;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'danger' | 'success';
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  className?: string;
}

export const AnimatedModal: React.FC<AnimatedModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmText = 'Potvrdiť',
  cancelText = 'Zrušiť',
  confirmVariant = 'primary',
  showCloseButton = true,
  closeOnBackdropClick = true,
  className,
}) => {
  useEffect(() => {
    if (isOpen) {
      triggerHaptic('light');
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose();
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  const handleConfirm = async () => {
    triggerHaptic('success');
    if (onConfirm) {
      await onConfirm();
    }
  };

  const getConfirmButtonClasses = () => {
    switch (confirmVariant) {
      case 'danger':
        return 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500 active:scale-95';
      case 'success':
        return 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 active:scale-95';
      case 'primary':
      default:
        return 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 active:scale-95';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeOnBackdropClick ? onClose : undefined}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            aria-describedby={description ? 'modal-description' : undefined}
            className={cn(
              'relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-colors',
              'dark:border-slate-800 dark:bg-slate-900 dark:text-white',
              className
            )}
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          >
            <div className="flex items-start justify-between gap-4">
              {title && (
                <h3
                  id="modal-title"
                  className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                >
                  {title}
                </h3>
              )}

              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors focus:outline-none"
                  aria-label="Zatvoriť"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {description && (
              <p
                id="modal-description"
                className="mt-2 text-sm text-slate-600 dark:text-slate-400"
              >
                {description}
              </p>
            )}

            {children && <div className="mt-4">{children}</div>}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors active:scale-95"
              >
                {cancelText}
              </button>

              {onConfirm && (
                <button
                  type="button"
                  onClick={handleConfirm}
                  className={cn(
                    'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                    getConfirmButtonClasses()
                  )}
                >
                  {confirmText}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AnimatedModal;
