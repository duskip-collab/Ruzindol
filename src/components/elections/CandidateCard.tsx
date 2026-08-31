import React from 'react';
import { User, Award, ArrowRight } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

export interface Candidate {
  id: string;
  full_name: string;
  photo_url?: string | null;
  position_type: 'starosta' | 'poslanec';
  party_or_independent: string;
  age?: number | null;
  profession?: string | null;
  motto?: string | null;
  program_priorities?: string[];
  bio?: string | null;
  email?: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  is_active?: boolean;
}

export interface CandidateCardProps {
  candidate: Candidate;
  onSelect: (candidate: Candidate) => void;
  className?: string;
}

export const CandidateCard: React.FC<CandidateCardProps> = ({ candidate, onSelect, className }) => {
  const handleClick = () => {
    triggerHaptic('light');
    onSelect(candidate);
  };

  const isMayor = candidate.position_type === 'starosta';

  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-white',
        className
      )}
    >
      <div>
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
              isMayor
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
            )}
          >
            <Award className="h-3.5 w-3.5" />
            Kandidát na {isMayor ? 'starostu' : 'poslanca'}
          </span>

          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
            {candidate.party_or_independent}
          </span>
        </div>

        {/* Profile Info */}
        <div className="flex items-start gap-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {candidate.photo_url ? (
              <img
                src={candidate.photo_url}
                alt={candidate.full_name}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-400">
                <User className="h-8 w-8" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
              {candidate.full_name}
            </h3>

            {(candidate.profession || candidate.age) && (
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 truncate">
                {[candidate.profession, candidate.age ? `${candidate.age} rokov` : null]
                  .filter(Boolean)
                  .join(' • ')}
              </p>
            )}

            {candidate.motto && (
              <p className="mt-2 text-xs italic text-slate-600 dark:text-slate-400 line-clamp-2">
                "{candidate.motto}"
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {candidate.program_priorities?.length || 0} priorit v programe
        </span>

        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          Detail kandidáta
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export default CandidateCard;
