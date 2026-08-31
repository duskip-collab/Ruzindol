import React, { useState } from 'react';
import { Vote, Check, Loader2, ShieldAlert } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

export interface AdminElectionsToggleProps {
  className?: string;
}

export const AdminElectionsToggle: React.FC<AdminElectionsToggleProps> = ({ className }) => {
  const { electionsEnabled, loading, setElectionsEnabled } = useAppSettings();
  const [updating, setUpdating] = useState(false);

  const handleToggle = async () => {
    triggerHaptic('light');
    const nextState = !electionsEnabled;
    setUpdating(true);
    const success = await setElectionsEnabled(nextState);
    if (success) {
      triggerHaptic('success');
    } else {
      triggerHaptic('error');
    }
    setUpdating(false);
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900 dark:text-white',
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors',
              electionsEnabled
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            )}
          >
            <Vote className="h-5 w-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Komunálne voľby
              </h3>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
                  electionsEnabled
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                {electionsEnabled ? 'Aktívne v PWA' : 'Skryté pre obyvateľov'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Zapnutím zobrazíte modul volieb a kandidátov všetkým používateľom.
            </p>
          </div>
        </div>

        {/* Custom Toggle Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={electionsEnabled}
          disabled={loading || updating}
          onClick={handleToggle}
          className={cn(
            'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50',
            electionsEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
          )}
        >
          <span className="sr-only">Prepnúť viditeľnosť modulu voľby</span>
          <span
            className={cn(
              'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center text-slate-700 dark:text-slate-800',
              electionsEnabled ? 'translate-x-5' : 'translate-x-0'
            )}
          >
            {updating ? (
              <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
            ) : electionsEnabled ? (
              <Check className="h-3 w-3 text-blue-600 stroke-[3]" />
            ) : null}
          </span>
        </button>
      </div>
    </div>
  );
};

export default AdminElectionsToggle;
