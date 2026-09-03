import React, { useEffect, useState } from 'react';
import { X, Loader2, MapPin, Globe, Lock, User, CheckCircle2, Clock, AlertCircle, XCircle, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

export interface MayorInquiry {
  id: string;
  user_id: string;
  category: 'odpad' | 'cesty_chodniky' | 'zelen' | 'osvetlenie' | 'urad_sluzby' | 'ine';
  title: string;
  body: string;
  image_url?: string | null;
  is_public: boolean;
  is_anonymous_public?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  status: 'pending' | 'in_progress' | 'resolved' | 'rejected';
  answer?: string | null;
  answered_at?: string | null;
  answered_by?: string | null;
  created_at: string;
  profiles?: {
    full_name?: string | null;
    name?: string | null;
  } | null;
}

interface DashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { id: 'all', label: 'Všetky' },
  { id: 'odpad', label: 'Odpad' },
  { id: 'cesty_chodniky', label: 'Cesty' },
  { id: 'zelen', label: 'Zeleň' },
  { id: 'osvetlenie', label: 'Osvetlenie' },
  { id: 'urad_sluzby', label: 'Úrad' },
  { id: 'ine', label: 'Iné' },
] as const;

const STATUS_FILTERS = [
  { id: 'all', label: 'Všetky' },
  { id: 'pending', label: 'Čakajúce' },
  { id: 'in_progress', label: 'V riešení' },
  { id: 'resolved', label: 'Vyriešené' },
  { id: 'rejected', label: 'Zamietnuté' },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  odpad: 'Odpad a čistota',
  cesty_chodniky: 'Cesty a chodníky',
  zelen: 'Zeleň a parky',
  osvetlenie: 'Verejné osvetlenie',
  urad_sluzby: 'Úrad a služby',
  ine: 'Iné',
};

export const MayorInquiriesDashboard: React.FC<DashboardProps> = ({ isOpen, onClose }) => {
  const { userId } = useCurrentUser();
  const [inquiries, setInquiries] = useState<MayorInquiry[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [selectedInquiries, setSelectedInquiries] = useState<Set<string>>(new Set());

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const loadInquiries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mayor_inquiries')
        .select('*, profiles:user_id(full_name, name)')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const inquiries = data as unknown as MayorInquiry[];
        setInquiries(inquiries);
        
        // Initialize answers and statuses from existing data
        const answersMap: Record<string, string> = {};
        const statusesMap: Record<string, string> = {};
        inquiries.forEach((inq) => {
          if (inq.answer) answersMap[inq.id] = inq.answer;
          statusesMap[inq.id] = inq.status;
        });
        setAnswers(answersMap);
        setStatuses(statusesMap);
      }
    } catch (err) {
      console.error('Error loading inquiries:', err);
      triggerHaptic('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadInquiries();
    }
  }, [isOpen]);

  const filteredInquiries = inquiries.filter((inq) => {
    const categoryMatch = selectedCategory === 'all' || inq.category === selectedCategory;
    const statusMatch = selectedStatus === 'all' || inq.status === selectedStatus;
    return categoryMatch && statusMatch;
  });

  const statusCounts = {
    pending: inquiries.filter((i) => i.status === 'pending').length,
    in_progress: inquiries.filter((i) => i.status === 'in_progress').length,
    resolved: inquiries.filter((i) => i.status === 'resolved').length,
    rejected: inquiries.filter((i) => i.status === 'rejected').length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" /> Vyriešené
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
            <Clock className="h-3.5 w-3.5" /> V riešení
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-800 dark:bg-rose-950/80 dark:text-rose-300">
            <XCircle className="h-3.5 w-3.5" /> Zamietnuté
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
            <AlertCircle className="h-3.5 w-3.5" /> Čaká
          </span>
        );
    }
  };

  const handleSubmitAnswers = async () => {
    if (selectedInquiries.size === 0) {
      triggerHaptic('error');
      alert('Vyberte aspoň jeden podnet.');
      return;
    }

    setSubmitting(true);
    try {
      for (const inquiryId of selectedInquiries) {
        const answer = answers[inquiryId] || '';
        const status = statuses[inquiryId] || 'pending';

        const { error } = await supabase
          .from('mayor_inquiries')
          .update({
            answer: answer || null,
            status,
            answered_at: answer ? new Date().toISOString() : null,
            answered_by: userId,
          })
          .eq('id', inquiryId);

        if (error) throw error;
      }

      triggerHaptic('success');
      setSelectedInquiries(new Set());
      await loadInquiries();
    } catch (err) {
      console.error('Error submitting answers:', err);
      triggerHaptic('error');
      alert('Chyba pri ukladaní. Skúste neskôr.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[99] bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Fullscreen Dashboard */}
          <motion.div
            className="fixed inset-0 z-[100] flex flex-col h-full w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden"
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
          >
            {/* HEADER */}
            <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold">Podnety od občanov</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Správa a odpovede na podnety
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Zatvoriť"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Status Counts */}
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2 border border-amber-200 dark:border-amber-800">
                  <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{statusCounts.pending}</div>
                  <div className="text-[11px] text-amber-600 dark:text-amber-400">Čaká</div>
                </div>
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-2 border border-blue-200 dark:border-blue-800">
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{statusCounts.in_progress}</div>
                  <div className="text-[11px] text-blue-600 dark:text-blue-400">V riešení</div>
                </div>
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{statusCounts.resolved}</div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400">Vyriešené</div>
                </div>
                <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 p-2 border border-rose-200 dark:border-rose-800">
                  <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">{statusCounts.rejected}</div>
                  <div className="text-[11px] text-rose-600 dark:text-rose-400">Zamietnuté</div>
                </div>
              </div>

              {/* Filters */}
              <div className="mt-4 space-y-2">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {STATUS_FILTERS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStatus(s.id)}
                      className={cn(
                        'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                        selectedStatus === s.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCategory(c.id)}
                      className={cn(
                        'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                        selectedCategory === c.id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SCROLLABLE CONTENT */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : filteredInquiries.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Žiadne podnety v tejto kategórii</p>
                </div>
              ) : (
                filteredInquiries.map((inq) => (
                  <div
                    key={inq.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 p-3 transition-all hover:shadow-md"
                  >
                    {/* Top Bar */}
                    <div className="flex items-start gap-3 mb-2">
                      <input
                        type="checkbox"
                        checked={selectedInquiries.has(inq.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedInquiries);
                          if (e.target.checked) {
                            newSelected.add(inq.id);
                          } else {
                            newSelected.delete(inq.id);
                          }
                          setSelectedInquiries(newSelected);
                        }}
                        className="mt-1 w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm">{inq.title}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {inq.is_anonymous_public && inq.is_public
                            ? 'Anonymný občan'
                            : inq.profiles?.full_name || inq.profiles?.name || 'Neznámy'}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {getStatusBadge(inq.status)}
                      </div>
                    </div>

                    {/* Body */}
                    <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 ml-7 whitespace-pre-wrap line-clamp-2">
                      {inq.body}
                    </p>

                    {/* Image & Location */}
                    <div className="ml-7 flex gap-2 mb-2 flex-wrap">
                      {inq.image_url && (
                        <img
                          src={inq.image_url}
                          alt="Fotka podnetu"
                          className="h-12 w-12 rounded object-cover border border-slate-200 dark:border-slate-700"
                        />
                      )}
                      {inq.latitude && inq.longitude && (
                        <a
                          href={`https://maps.google.com/?q=${inq.latitude},${inq.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <MapPin className="h-3 w-3" />
                          {inq.latitude.toFixed(4)}, {inq.longitude.toFixed(4)}
                        </a>
                      )}
                    </div>

                    {/* Expandable Section */}
                    <button
                      onClick={() => setExpandedId(expandedId === inq.id ? null : inq.id)}
                      className="ml-7 text-xs text-blue-600 dark:text-blue-400 hover:underline mb-2"
                    >
                      {expandedId === inq.id ? 'Skryť' : 'Odpoveď'}
                    </button>

                    {expandedId === inq.id && (
                      <div className="ml-7 space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        {/* Status Select */}
                        <div>
                          <label className="text-xs font-medium block mb-1">Stav:</label>
                          <select
                            value={statuses[inq.id] || inq.status}
                            onChange={(e) =>
                              setStatuses({ ...statuses, [inq.id]: e.target.value })
                            }
                            className="w-full rounded px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700"
                          >
                            <option value="pending">Čaká na vybavenie</option>
                            <option value="in_progress">V riešení</option>
                            <option value="resolved">Vyriešené</option>
                            <option value="rejected">Zamietnuté</option>
                          </select>
                        </div>

                        {/* Answer Textarea */}
                        <div>
                          <label className="text-xs font-medium block mb-1">Odpoveď:</label>
                          <textarea
                            value={answers[inq.id] || ''}
                            onChange={(e) =>
                              setAnswers({ ...answers, [inq.id]: e.target.value })
                            }
                            placeholder="Napíšte odpoveď..."
                            rows={3}
                            className="w-full rounded px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 resize-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* FOOTER */}
            <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur p-4 pb-safe flex items-center gap-3">
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Vybrané: {selectedInquiries.size}
              </div>
              <button
                onClick={handleSubmitAnswers}
                disabled={submitting || selectedInquiries.size === 0}
                className="ml-auto inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Odosielam...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Odoslať odpovede
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MayorInquiriesDashboard;
