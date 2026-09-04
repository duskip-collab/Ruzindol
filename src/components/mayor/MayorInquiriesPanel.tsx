'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Inbox, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle, 
  Send, 
  Eye, 
  EyeOff,
  Filter
} from 'lucide-react';

interface Inquiry {
  id: string;
  user_id: string;
  category: string;
  title: string;
  body: string;
  image_url?: string;
  is_public: boolean;
  status: 'pending' | 'in_progress' | 'resolved' | 'rejected';
  answer?: string;
  answered_at?: string;
  created_at: string;
  profiles?: {
    name?: string;
    full_name?: string;
    email?: string;
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  odpad: 'Odpad a čistota',
  cesty_chodniky: 'Cesty a chodníky',
  zelen: 'Zeleň a príroda',
  osvetlenie: 'Verejné osvetlenie',
  urad_sluzby: 'Úrad a služby',
  ine: 'Iné',
};

export function MayorInquiriesPanel() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Stavy pre formulár odpovede
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [targetStatus, setTargetStatus] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Načítanie podnetov pre starostu
  const fetchInquiries = async () => {
    setLoading(true);
    
    // Explicitné naviazanie cudzieho kľúča profiles!mayor_inquiries_user_id_fkey zabráni chybe 400 Bad Request
    const { data, error } = await supabase
      .from('mayor_inquiries')
      .select('*, profiles!mayor_inquiries_user_id_fkey(name, full_name, email)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Chyba pri načítavaní podnetov:', error);
    } else if (data) {
      setInquiries(data as unknown as Inquiry[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  // Odoslanie odpovede na podnet
  const handleSendAnswer = async (inquiryId: string) => {
    const text = replyText[inquiryId];
    const newStatus = targetStatus[inquiryId] || 'resolved';

    if (!text || text.trim() === '') return;

    setSubmittingId(inquiryId);
    
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('mayor_inquiries')
      .update({
        answer: text.trim(),
        status: newStatus,
        answered_at: new Date().toISOString(),
        answered_by: user?.id,
      })
      .eq('id', inquiryId);

    if (!error) {
      await fetchInquiries();
      setReplyText((prev) => ({ ...prev, [inquiryId]: '' }));
    } else {
      console.error('Chyba pri odosielaní odpovede:', error);
    }
    setSubmittingId(null);
  };

  // Prepnutie verejný / súkromný
  const togglePublicStatus = async (inquiryId: string, currentPublic: boolean) => {
    const { error } = await supabase
      .from('mayor_inquiries')
      .update({ is_public: !currentPublic })
      .eq('id', inquiryId);

    if (!error) {
      await fetchInquiries();
    } else {
      console.error('Chyba pri zmene viditeľnosti:', error);
    }
  };

  // Filtrovanie podnetov
  const filteredInquiries = inquiries.filter((item) => {
    if (filterStatus === 'all') return true;
    return item.status === filterStatus;
  });

  const countPending = inquiries.filter((i) => i.status === 'pending').length;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
      
      {/* Hlavička panelu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Podnety od občanov</h2>
            <p className="text-xs text-slate-500">
              Správa a odpovedanie na otázky adresované starostovi
            </p>
          </div>
        </div>

        {countPending > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold self-start sm:self-auto">
            <AlertCircle className="w-3.5 h-3.5" />
            {countPending} čaká na odpoveď
          </span>
        )}
      </div>

      {/* Filter stavov */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-medium">
        <Filter className="w-4 h-4 text-slate-400 shrink-0 mr-1" />
        {[
          { key: 'all', label: 'Všetky' },
          { key: 'pending', label: 'Čakajúce' },
          { key: 'in_progress', label: 'V riešení' },
          { key: 'resolved', label: 'Vyriešené' },
          { key: 'rejected', label: 'Zamietnuté' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              filterStatus === tab.key
                ? 'bg-slate-900 text-white font-semibold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Zoznam podnetov */}
      {loading ? (
        <p className="text-center py-8 text-slate-400 text-sm">Načítavam podnety občanov...</p>
      ) : filteredInquiries.length === 0 ? (
        <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-100">
          <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm font-medium">Žiadne podnety v tejto kategórii.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInquiries.map((item) => (
            <div
              key={item.id}
              className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3 transition-all hover:border-slate-300"
            >
              {/* Info o autorovi a kategórii */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-900">
                    {item.profiles?.name || item.profiles?.full_name || 'Anonymný občan'}
                  </span>
                  <span>•</span>
                  <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                    {CATEGORY_LABELS[item.category] || item.category}
                  </span>
                  <span>•</span>
                  <span className="text-slate-400">
                    {new Date(item.created_at).toLocaleDateString('sk-SK')}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Tlačidlo Viditeľnosť */}
                  <button
                    onClick={() => togglePublicStatus(item.id, item.is_public)}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                      item.is_public
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                    title={item.is_public ? 'Verejný podnet' : 'Súkromný podnet'}
                  >
                    {item.is_public ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{item.is_public ? 'Verejný' : 'Súkromný'}</span>
                  </button>

                  {/* Odznak stavu */}
                  <StatusBadge status={item.status} />
                </div>
              </div>

              {/* Obsah podnetu */}
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{item.title}</h3>
                <p className="text-xs text-slate-700 mt-1 whitespace-pre-line">{item.body}</p>
                {item.image_url && (
                  <a
                    href={item.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-2 text-xs text-emerald-600 underline font-medium"
                  >
                    Zobraziť priloženú fotografiu
                  </a>
                )}
              </div>

              {/* Existujúca odpoveď */}
              {item.answer && (
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 text-xs text-slate-800 space-y-1">
                  <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Oficiálna odpoveď obce:
                  </p>
                  <p className="whitespace-pre-line text-slate-700">{item.answer}</p>
                  {item.answered_at && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Odpovedané: {new Date(item.answered_at).toLocaleString('sk-SK')}
                    </p>
                  )}
                </div>
              )}

              {/* Formulár pre odpoveď starostu */}
              <div className="pt-2 border-t border-slate-200/60 space-y-2">
                <textarea
                  placeholder="Napíšte odpoveď pre občana..."
                  value={replyText[item.id] || ''}
                  onChange={(e) =>
                    setReplyText((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  rows={2}
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 font-medium">Nový stav:</span>
                    <select
                      value={targetStatus[item.id] || item.status}
                      onChange={(e) =>
                        setTargetStatus((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                    >
                      <option value="in_progress">V riešení</option>
                      <option value="resolved">Vyriešené</option>
                      <option value="rejected">Zamietnuté</option>
                    </select>
                  </div>

                  <button
                    onClick={() => handleSendAnswer(item.id)}
                    disabled={submittingId === item.id || !replyText[item.id]}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Odoslať odpoveď</span>
                  </button>
                </div>
              </div>

            </div>
          ))}

        </div>
      )}
    </div>
  );
}

// Pomocný odznak pre stav podnetu
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
          <Clock className="w-3 h-3" /> Čaká
        </span>
      );
    case 'in_progress':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
          <Clock className="w-3 h-3" /> V riešení
        </span>
      );
    case 'resolved':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
          <CheckCircle2 className="w-3 h-3" /> Vyriešené
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
          <XCircle className="w-3 h-3" /> Zamietnuté
        </span>
      );
    default:
      return null;
  }
}