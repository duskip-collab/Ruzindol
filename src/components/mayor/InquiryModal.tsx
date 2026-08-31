import React, { useState } from 'react';
import { Image, Lock, Globe, AlertCircle } from 'lucide-react';
import { AnimatedModal } from '../AnimatedModal';
import { supabase } from '@/integrations/supabase/client';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

export interface InquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CATEGORIES = [
  { id: 'odpad', label: 'Odpad' },
  { id: 'cesty_chodniky', label: 'Cesty' },
  { id: 'zelen', label: 'Zeleň' },
  { id: 'osvetlenie', label: 'Osvetlenie' },
  { id: 'urad_sluzby', label: 'Úrad' },
  { id: 'ine', label: 'Iné' },
] as const;

export const InquiryModal: React.FC<InquiryModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['id']>('odpad');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) {
      triggerHaptic('error');
      setErrorMessage('Vyplňte prosím názov a text.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) throw new Error('Musíte byť prihlásený.');

      const { error } = await supabase.from('mayor_inquiries').insert({
        user_id: userData.user.id,
        category,
        title: title.trim(),
        body: body.trim(),
        image_url: imageUrl.trim() || null,
        is_public: isPublic,
        status: 'pending',
      });

      if (error) throw error;

      triggerHaptic('success');
      setTitle('');
      setBody('');
      setImageUrl('');
      setIsPublic(true);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      triggerHaptic('error');
      setErrorMessage(err instanceof Error ? err.message : 'Chyba odoslania.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose} title="Podnet starostovi" confirmText={submitting ? 'Odosielam...' : 'Odoslať'} cancelText="Zrušiť" onConfirm={handleSubmit}>
      <div className="space-y-3">
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold mb-1">Kategória</label>
          <div className="grid grid-cols-3 gap-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => { triggerHaptic('light'); setCategory(cat.id); }}
                className={cn('rounded-lg border p-1 text-[11px] font-medium text-center', category === cat.id ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400')}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="inquiry-title" className="block text-xs font-semibold mb-1">Názov</label>
          <input id="inquiry-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Názov podnetu" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-white" />
        </div>

        <div>
          <label htmlFor="inquiry-body" className="block text-xs font-semibold mb-1">Popis</label>
          <textarea id="inquiry-body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Popíšte situáciu..." className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-white resize-none" />
        </div>

        <div>
          <label htmlFor="inquiry-image" className="block text-xs font-semibold mb-1">URL fotky (voliteľné)</label>
          <div className="relative">
            <input id="inquiry-image" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-white" />
            <Image className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            {isPublic ? <Globe className="h-4 w-4 text-emerald-500" /> : <Lock className="h-4 w-4 text-amber-500" />}
            <span className="text-xs font-semibold">{isPublic ? 'Verejný podnet' : 'Súkromný podnet'}</span>
          </div>

          <button type="button" onClick={() => { triggerHaptic('light'); setIsPublic(!isPublic); }} className={cn('relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors', isPublic ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700')}>
            <span className={cn('pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200', isPublic ? 'translate-x-5' : 'translate-x-0')} />
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
};

export default InquiryModal;
