import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Vote, CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

export interface PollOption { id: string; poll_id: string; option_text: string; sort_order: number; votes_count?: number; }
export interface Poll { id: string; created_by: string; title: string; description?: string | null; expires_at: string; is_active: boolean; created_at: string; options: PollOption[]; user_voted_option_id?: string | null; total_votes?: number; }

export const PollCard: React.FC<{ poll: Poll; isActiveNeighbor?: boolean; onVoteSuccess?: () => void; className?: string }> = ({ poll, isActiveNeighbor = true, onVoteSuccess, className }) => {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(poll.user_voted_option_id || null);
  const [hasVoted, setHasVoted] = useState<boolean>(Boolean(poll.user_voted_option_id));
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isExpired = !poll.is_active || new Date(poll.expires_at) <= new Date();
  const totalVotes = poll.options.reduce((acc, opt) => acc + (opt.votes_count || 0), 0);

  const handleSelect = (id: string) => {
    if (hasVoted || isExpired) return;
    triggerHaptic('light');
    setSelectedOptionId(id);
    setErrorMessage(null);
  };

  const handleVote = async () => {
    if (!selectedOptionId) { triggerHaptic('error'); setErrorMessage('Vyberte možnosť.'); return; }
    if (!isActiveNeighbor) { triggerHaptic('error'); setErrorMessage('Hlasovať môžu iba overení susedia.'); return; }

    try {
      setSubmitting(true);
      const { error } = await supabase.rpc('cast_poll_vote', { p_poll_id: poll.id, p_option_id: selectedOptionId });
      if (error) throw error;
      triggerHaptic('success');
      setHasVoted(true);
      if (onVoteSuccess) onVoteSuccess();
    } catch (err) {
      triggerHaptic('error');
      setErrorMessage(err instanceof Error ? err.message : 'Chyba hlasovania.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-white', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
          <Vote className="h-3.5 w-3.5" /> Anketa
        </span>
        <span className="text-[11px] text-slate-500 flex items-center gap-1">
          <Clock className="h-3 w-3" /> {isExpired ? 'Ukončené' : 'Aktívna'}
        </span>
      </div>

      <h3 className="text-base font-bold mb-1">{poll.title}</h3>
      {poll.description && <p className="text-xs text-slate-500 mb-3">{poll.description}</p>}

      {errorMessage && (
        <div className="mb-2 flex items-center gap-1 bg-rose-50 p-2 text-xs text-rose-700 rounded-lg dark:bg-rose-950 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="space-y-2 my-3">
        {poll.options.map((opt) => {
          const votes = opt.votes_count || 0;
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const isSel = selectedOptionId === opt.id;

          if (hasVoted || isExpired) {
            return (
              <div key={opt.id} className={cn('relative overflow-hidden rounded-xl border p-2 text-xs', isSel ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30' : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40')}>
                <motion.div className={cn('absolute left-0 top-0 bottom-0 opacity-20', isSel ? 'bg-blue-600' : 'bg-slate-400')} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
                <div className="relative z-10 flex items-center justify-between font-semibold">
                  <div className="flex items-center gap-1.5">{isSel && <CheckCircle2 className="h-4 w-4 text-blue-600" />}<span>{opt.option_text}</span></div>
                  <span>{pct}% ({votes})</span>
                </div>
              </div>
            );
          }

          return (
            <button key={opt.id} type="button" onClick={() => handleSelect(opt.id)} className={cn('flex w-full items-center justify-between rounded-xl border p-2 text-xs font-semibold', isSel ? 'border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-200' : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300')}>
              <span>{opt.option_text}</span>
              <div className={cn('h-4 w-4 rounded-full border-2', isSel ? 'border-blue-600 bg-blue-600' : 'border-slate-300')} />
            </button>
          );
        })}
      </div>

      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        <span className="text-slate-500 text-[11px]">Celkovo hlasov: {totalVotes}</span>
        {!hasVoted && !isExpired && (
          <button type="button" disabled={!selectedOptionId || submitting} onClick={handleVote} className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {submitting && <Loader2 className="h-3 w-3 animate-spin inline mr-1" />} Hlasovať
          </button>
        )}
      </div>
    </div>
  );
};

export default PollCard;
