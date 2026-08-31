import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { triggerHaptic, HapticType } from '../lib/haptics';
import { cn } from '../lib/utils';

export type ToastType = 'success' | 'error';

export interface ToastProps {
  isVisible: boolean;
  type: ToastType;
  message: React.ReactNode;
  description?: React.ReactNode;
  duration?: number;
  onClose: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  isVisible,
  type,
  message,
  description,
  duration = 3000,
  onClose,
  className,
}) => {
  useEffect(() => {
    if (isVisible) {
      const hapticType: HapticType = type === 'success' ? 'success' : 'error';
      triggerHaptic(hapticType);

      if (duration > 0) {
        const timer = setTimeout(() => {
          onClose();
        }, duration);

        return () => clearTimeout(timer);
      }
    }
  }, [isVisible, type, duration, onClose]);

  const isSuccess = type === 'success';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4 pointer-events-none"
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <div
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-md transition-colors',
              'bg-white/95 text-slate-900 border-slate-200 dark:bg-slate-900/95 dark:text-white dark:border-slate-800',
              className
            )}
          >
            <div className="mt-0.5 shrink-0">
              {isSuccess ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">
                {message}
              </p>
              {description && (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-snug">
                  {description}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors focus:outline-none"
              aria-label="Zatvoriť"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Toast;
