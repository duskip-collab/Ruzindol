import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Trash2, Loader2, Save, X, AlertCircle, ChevronDown,
  User, Users, Award, FileText, Trash
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AnimatedModal } from '../AnimatedModal';
import { ElectionsAttachmentUpload, AttachmentFile } from './ElectionsAttachmentUpload';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

export interface CandidateRow {
  id?: string;
  full_name: string;
  party_or_independent: string;
  position_type: 'starosta' | 'poslanec';
  age?: number | null;
  profession?: string | null;
  motto?: string | null;
  bio?: string | null;
  email?: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  program_priorities?: string[];
  photo_url?: string | null;
  sort_order?: number;
}

export interface ElectionsData {
  id?: string;
  name: string;
  description?: string;
  election_date?: string;
  status?: 'draft' | 'active' | 'closed';
  candidates_mayor: CandidateRow[];
  candidates_council: CandidateRow[];
  attachments: AttachmentFile[];
}

export interface ElectionsEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ElectionsData) => Promise<void>;
  initialData?: ElectionsData | null;
}

const emptyCandidate = (): CandidateRow => ({
  full_name: '',
  party_or_independent: '',
  position_type: 'starosta',
  age: undefined,
  profession: '',
  motto: '',
  bio: '',
  email: '',
  website_url: '',
  facebook_url: '',
  program_priorities: [],
  sort_order: 0
});

export const ElectionsEditModal: React.FC<ElectionsEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTab, setExpandedTab] = useState<'info' | 'mayor' | 'council' | 'files'>('info');
  const [confirmDelete, setConfirmDelete] = useState<'mayor' | 'council' | 'attachments' | null>(null);

  const [formData, setFormData] = useState<ElectionsData>({
    name: '',
    description: '',
    election_date: '',
    status: 'draft',
    candidates_mayor: [emptyCandidate()],
    candidates_council: [emptyCandidate()],
    attachments: []
  });

  // Initialize from initialData or defaults
  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        candidates_mayor: initialData.candidates_mayor?.length > 0 
          ? initialData.candidates_mayor 
          : [emptyCandidate()],
        candidates_council: initialData.candidates_council?.length > 0 
          ? initialData.candidates_council 
          : [emptyCandidate()],
        attachments: initialData.attachments || []
      });
    }
  }, [initialData, isOpen]);

  const handleChange = (field: keyof Omit<ElectionsData, 'candidates_mayor' | 'candidates_council' | 'attachments'>, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Kandidáti na starostu
  const updateMayorCandidate = (idx: number, field: keyof CandidateRow, value: any) => {
    const newCandidates = [...formData.candidates_mayor];
    newCandidates[idx] = { ...newCandidates[idx], [field]: value };
    setFormData(prev => ({ ...prev, candidates_mayor: newCandidates }));
  };

  const addMayorCandidate = () => {
    triggerHaptic('light');
    setFormData(prev => ({
      ...prev,
      candidates_mayor: [...prev.candidates_mayor, emptyCandidate()]
    }));
  };

  const removeMayorCandidate = (idx: number) => {
    triggerHaptic('light');
    setFormData(prev => ({
      ...prev,
      candidates_mayor: prev.candidates_mayor.filter((_, i) => i !== idx)
    }));
  };

  // Kandidáti do zastupiteľstva
  const updateCouncilCandidate = (idx: number, field: keyof CandidateRow, value: any) => {
    const newCandidates = [...formData.candidates_council];
    newCandidates[idx] = { ...newCandidates[idx], [field]: value };
    setFormData(prev => ({ ...prev, candidates_council: newCandidates }));
  };

  const addCouncilCandidate = () => {
    triggerHaptic('light');
    setFormData(prev => ({
      ...prev,
      candidates_council: [...prev.candidates_council, { ...emptyCandidate(), position_type: 'poslanec' }]
    }));
  };

  const removeCouncilCandidate = (idx: number) => {
    triggerHaptic('light');
    setFormData(prev => ({
      ...prev,
      candidates_council: prev.candidates_council.filter((_, i) => i !== idx)
    }));
  };

  // Mazanie všetkých kandidátov na starostu
  const clearAllMayorCandidates = () => {
    triggerHaptic('medium');
    setFormData(prev => ({
      ...prev,
      candidates_mayor: [emptyCandidate()]
    }));
    setConfirmDelete(null);
  };

  // Mazanie všetkých kandidátov do zastupiteľstva
  const clearAllCouncilCandidates = () => {
    triggerHaptic('medium');
    setFormData(prev => ({
      ...prev,
      candidates_council: [emptyCandidate()]
    }));
    setConfirmDelete(null);
  };

  // Mazanie všetkých prílohy
  const clearAllAttachments = () => {
    triggerHaptic('medium');
    setFormData(prev => ({
      ...prev,
      attachments: []
    }));
    setConfirmDelete(null);
  };

  const handleSave = async () => {
    setError(null);

    // Validácia
    if (!formData.name.trim()) {
      setError('Názov volieb je povinný');
      return;
    }

    if (
      (formData.candidates_mayor.length === 1 && !formData.candidates_mayor[0].full_name.trim()) &&
      (formData.candidates_council.length === 1 && !formData.candidates_council[0].full_name.trim())
    ) {
      setError('Pridaj aspoň jedného kandidáta');
      return;
    }

    try {
      setLoading(true);
      triggerHaptic('light');
      
      // Filter out empty candidates
      const cleanMayor = formData.candidates_mayor.filter((c) => c.full_name.trim());
      const cleanCouncil = formData.candidates_council.filter((c) => c.full_name.trim());

      const dataToSave: ElectionsData = {
        ...formData,
        candidates_mayor: cleanMayor,
        candidates_council: cleanCouncil
      };

      await onSave(dataToSave);
      triggerHaptic('success');
      onClose();
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Chyba pri ukladaní');
      triggerHaptic('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton
      confirmText={loading ? 'Ukladám...' : 'Uložiť zmeny'}
      confirmDisabled={loading}
      cancelText="Zavrieť"
      onConfirm={handleSave}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-950/80 flex items-center justify-center">
            <Award className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {formData.id ? 'Upraviť voľby' : 'Nové voľby'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Spravuj kandidátov a prílohy k voľbám
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 p-3 dark:bg-red-950/20 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <span className="text-xs text-red-700 dark:text-red-400">{error}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl overflow-x-auto">
          {(['info', 'mayor', 'council', 'files'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setExpandedTab(tab)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0',
                expandedTab === tab
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              )}
            >
              {tab === 'info' && <FileText className="h-3.5 w-3.5" />}
              {tab === 'mayor' && <User className="h-3.5 w-3.5" />}
              {tab === 'council' && <Users className="h-3.5 w-3.5" />}
              {tab === 'files' && <Trash2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">
                {tab === 'info' && 'Informácie'}
                {tab === 'mayor' && `Starosta (${formData.candidates_mayor.filter((c) => c.full_name.trim()).length})`}
                {tab === 'council' && `Poslanci (${formData.candidates_council.filter((c) => c.full_name.trim()).length})`}
                {tab === 'files' && 'Prílohy'}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
          {/* INFO TAB */}
          {expandedTab === 'info' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Názov volieb *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Komunálne voľby 2026"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Popis
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Úvod a info o voľbách..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Dátum volieb
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.election_date ? new Date(formData.election_date).toISOString().slice(0, 16) : ''}
                    onChange={(e) => handleChange('election_date', e.target.value ? new Date(e.target.value).toISOString() : '')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Stav
                  </label>
                  <select
                    value={formData.status || 'draft'}
                    onChange={(e) => handleChange('status', e.target.value as 'draft' | 'active' | 'closed')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="draft">Návrh</option>
                    <option value="active">Aktívne</option>
                    <option value="closed">Ukončené</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* MAYOR CANDIDATES TAB */}
          {expandedTab === 'mayor' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Počet kandidátov: {formData.candidates_mayor.filter((c) => c.full_name.trim()).length}
                </p>
                {formData.candidates_mayor.some((c) => c.full_name.trim()) && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete('mayor')}
                    disabled={loading}
                    className="text-xs px-2 py-1 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors font-semibold"
                  >
                    Vymazať všetkých
                  </button>
                )}
              </div>

              {formData.candidates_mayor.map((candidate, idx) => (
                <CandidateRow
                  key={idx}
                  candidate={candidate}
                  index={idx}
                  positionLabel="Starosta"
                  onChange={(field, value) => updateMayorCandidate(idx, field, value)}
                  onRemove={() => removeMayorCandidate(idx)}
                  disabled={loading}
                />
              ))}

              <button
                type="button"
                onClick={addMayorCandidate}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20 p-3 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Pridať kandidáta na starostu
              </button>
            </div>
          )}

          {/* COUNCIL CANDIDATES TAB */}
          {expandedTab === 'council' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Počet kandidátov: {formData.candidates_council.filter((c) => c.full_name.trim()).length}
                </p>
                {formData.candidates_council.some((c) => c.full_name.trim()) && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete('council')}
                    disabled={loading}
                    className="text-xs px-2 py-1 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors font-semibold"
                  >
                    Vymazať všetkých
                  </button>
                )}
              </div>

              {formData.candidates_council.map((candidate, idx) => (
                <CandidateRow
                  key={idx}
                  candidate={candidate}
                  index={idx}
                  positionLabel="Poslanec"
                  onChange={(field, value) => updateCouncilCandidate(idx, field, value)}
                  onRemove={() => removeCouncilCandidate(idx)}
                  disabled={loading}
                />
              ))}

              <button
                type="button"
                onClick={addCouncilCandidate}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20 p-3 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Pridať kandidáta do zastupiteľstva
              </button>
            </div>
          )}

          {/* FILES TAB */}
          {expandedTab === 'files' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Počet prílohy: {formData.attachments.length}
                </p>
                {formData.attachments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete('attachments')}
                    disabled={loading}
                    className="text-xs px-2 py-1 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors font-semibold"
                  >
                    Vymazať všetko
                  </button>
                )}
              </div>
              <ElectionsAttachmentUpload
                electionId={formData.id || 'new'}
                attachments={formData.attachments}
                onAttachmentsChange={(attachments) => setFormData(prev => ({ ...prev, attachments }))}
                disabled={loading}
              />
            </div>
          )}
        </div>

        {/* CONFIRM DELETE DIALOG */}
        {confirmDelete && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900 dark:text-red-300 mb-2">
                  {confirmDelete === 'mayor' && 'Vymazať všetkých kandidátov na starostu?'}
                  {confirmDelete === 'council' && 'Vymazať všetkých kandidátov do zastupiteľstva?'}
                  {confirmDelete === 'attachments' && 'Vymazať všetky prílohy?'}
                </p>
                <p className="text-xs text-red-800 dark:text-red-400 mb-3">
                  {confirmDelete === 'mayor' && 'Táto akcia je trvalá. Všetci kandidáti na starostu budú vymazaní.'}
                  {confirmDelete === 'council' && 'Táto akcia je trvalá. Všetci kandidáti do zastupiteľstva budú vymazaní.'}
                  {confirmDelete === 'attachments' && 'Táto akcia je trvalá. Všetky prílohy budú vymazané.'}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmDelete === 'mayor') clearAllMayorCandidates();
                      if (confirmDelete === 'council') clearAllCouncilCandidates();
                      if (confirmDelete === 'attachments') clearAllAttachments();
                    }}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-lg bg-red-600 dark:bg-red-700 text-white text-xs font-semibold hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
                  >
                    Vymazať
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    disabled={loading}
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

// ---------- Helper Component: Candidate Row ----------

interface CandidateRowProps {
  candidate: CandidateRow;
  index: number;
  positionLabel: string;
  onChange: (field: keyof CandidateRow, value: any) => void;
  onRemove: () => void;
  disabled?: boolean;
}

const CandidateRow: React.FC<CandidateRowProps> = ({
  candidate,
  index,
  positionLabel,
  onChange,
  onRemove,
  disabled = false
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 p-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 text-left">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 shrink-0 text-xs font-bold">
            {index + 1}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
              {candidate.full_name || `${positionLabel} #${index + 1}`}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {candidate.party_or_independent || 'Nezaradený'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ChevronDown
            className={cn(
              'h-4 w-4 text-slate-400 transition-transform shrink-0',
              expanded && 'rotate-180'
            )}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-200 dark:border-slate-700 p-3 space-y-2 bg-white dark:bg-slate-800">
          {/* Meno a strana */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Meno *
              </label>
              <input
                type="text"
                value={candidate.full_name}
                onChange={(e) => onChange('full_name', e.target.value)}
                placeholder="Meno a priezvisko"
                disabled={disabled}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Strana/Subjekt *
              </label>
              <input
                type="text"
                value={candidate.party_or_independent}
                onChange={(e) => onChange('party_or_independent', e.target.value)}
                placeholder="Strana, nezaradený"
                disabled={disabled}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Vek a Povolanie */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Vek
              </label>
              <input
                type="number"
                value={candidate.age || ''}
                onChange={(e) => onChange('age', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="napr. 45"
                disabled={disabled}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Povolanie
              </label>
              <input
                type="text"
                value={candidate.profession || ''}
                onChange={(e) => onChange('profession', e.target.value)}
                placeholder="napr. Učiteľ"
                disabled={disabled}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Motto */}
          <div>
            <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Motto
            </label>
            <input
              type="text"
              value={candidate.motto || ''}
              onChange={(e) => onChange('motto', e.target.value)}
              placeholder="Stručný slogan"
              disabled={disabled}
              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Životopis
            </label>
            <textarea
              value={candidate.bio || ''}
              onChange={(e) => onChange('bio', e.target.value)}
              placeholder="Podrobnosti o kandidátovi..."
              rows={2}
              disabled={disabled}
              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Kontakt */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Email
              </label>
              <input
                type="email"
                value={candidate.email || ''}
                onChange={(e) => onChange('email', e.target.value)}
                placeholder="email@example.com"
                disabled={disabled}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Webová stránka
              </label>
              <input
                type="url"
                value={candidate.website_url || ''}
                onChange={(e) => onChange('website_url', e.target.value)}
                placeholder="https://..."
                disabled={disabled}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Facebook */}
          <div>
            <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Facebook
            </label>
            <input
              type="url"
              value={candidate.facebook_url || ''}
              onChange={(e) => onChange('facebook_url', e.target.value)}
              placeholder="https://facebook.com/..."
              disabled={disabled}
              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Remove Button */}
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 p-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Odstrániť kandidáta
          </button>
        </div>
      )}
    </div>
  );
};

export default ElectionsEditModal;
