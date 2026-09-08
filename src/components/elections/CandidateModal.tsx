import React, { useState } from 'react';
import { User, Award, CheckCircle2, Globe, Mail, Facebook, ExternalLink, Trash2, AlertCircle } from 'lucide-react';
import { AnimatedModal } from '../AnimatedModal';
import { Candidate } from './CandidateCard';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

export interface CandidateModalProps {
  candidate: Candidate | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (candidateId: string) => Promise<void>;
  isAdmin?: boolean;
}

type TabType = 'info' | 'program' | 'contact';

export const CandidateModal: React.FC<CandidateModalProps> = ({ 
  candidate, 
  isOpen, 
  onClose, 
  onDelete,
  isAdmin = false 
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!candidate) return null;
  const isMayor = candidate.position_type === 'starosta';

  const handleTabChange = (tab: TabType) => {
    triggerHaptic('light');
    setActiveTab(tab);
  };

  const handleDelete = async () => {
    if (!onDelete || !candidate.id) return;
    
    try {
      setDeleting(true);
      triggerHaptic('light');
      await onDelete(candidate.id);
      triggerHaptic('success');
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      triggerHaptic('error');
      console.error('Delete error:', error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose} showCloseButton confirmText="Zavrieť" cancelText="">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
              {candidate.photo_url ? (
                <img src={candidate.photo_url} alt={candidate.full_name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-400">
                  <User className="h-8 w-8" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                <Award className="h-3 w-3" />
                Kandidát na {isMayor ? 'starostu' : 'poslanca'}
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{candidate.full_name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{candidate.party_or_independent}</p>
            </div>
          </div>

          {isAdmin && onDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="shrink-0 p-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors"
              title="Vymazať kandidáta"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
          <button
            type="button"
            onClick={() => handleTabChange('info')}
            className={cn(
              'pb-2 px-2 text-xs font-semibold border-b-2',
              activeTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            )}
          >
            O kandidátovi
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('program')}
            className={cn(
              'pb-2 px-2 text-xs font-semibold border-b-2',
              activeTab === 'program' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            )}
          >
            Program
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('contact')}
            className={cn(
              'pb-2 px-2 text-xs font-semibold border-b-2',
              activeTab === 'contact' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            )}
          >
            Kontakt
          </button>
        </div>

        <div className="min-h-[100px] text-xs">
          {activeTab === 'info' && (
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              {candidate.bio || 'Kandidát zatiaľ neuvedol podrobný životopis.'}
            </p>
          )}

          {activeTab === 'program' && (
            <div className="space-y-1.5">
              {candidate.program_priorities?.map((priority, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>{priority}</span>
                </div>
              )) || <p className="text-slate-400">Žiadne priority.</p>}
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="space-y-2">
              {candidate.email && (
                <a href={`mailto:${candidate.email}`} className="flex items-center gap-2 text-blue-600">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{candidate.email}</span>
                </a>
              )}
              {candidate.website_url && (
                <a href={candidate.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-emerald-600">
                  <Globe className="h-3.5 w-3.5" />
                  <span>Webová stránka</span>
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </a>
              )}
              {candidate.facebook_url && (
                <a href={candidate.facebook_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-700">
                  <Facebook className="h-3.5 w-3.5" />
                  <span>Facebook</span>
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* DELETE CONFIRMATION DIALOG */}
        {showDeleteConfirm && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900 dark:text-red-300 mb-2">
                  Vymazať kandidáta?
                </p>
                <p className="text-xs text-red-800 dark:text-red-400 mb-3">
                  Táto akcia je trvalá. Kandidát {candidate.full_name} bude vymazaný z databázy.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-3 py-1.5 rounded-lg bg-red-600 dark:bg-red-700 text-white text-xs font-semibold hover:bg-red-700 dark:hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {deleting ? 'Vymazávam...' : 'Vymazať'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                  >
                    Zrušiť
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AnimatedModal>
  );
};

export default CandidateModal;
