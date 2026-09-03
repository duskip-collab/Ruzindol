import React, { useEffect, useState } from 'react';
import { MessageSquare, Plus, RefreshCw, Loader2, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import InquiryCard, { MayorInquiry } from '@/components/mayor/InquiryCard';
import InquiryModal from '@/components/mayor/InquiryModal';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { id: 'all', label: 'Všetky' },
  { id: 'odpad', label: 'Odpad' },
  { id: 'cesty_chodniky', label: 'Cesty & Chodníky' },
  { id: 'zelen', label: 'Zeleň & Parky' },
  { id: 'osvetlenie', label: 'Osvetlenie' },
  { id: 'urad_sluzby', label: 'Úrad & Služby' },
  { id: 'ine', label: 'Iné' },
] as const;

export function InquiriesScreen() {
  const { profile } = useCurrentUser();
  const [inquiries, setInquiries] = useState<MayorInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const loadInquiries = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('mayor_inquiries')
        .select('*, profiles:user_id(name)')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Supabase chyba pri načítaní verejných podnetov:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        setInquiries([]);
        return;
      }

      if (data) {
        setInquiries(data);
      } else {
        setInquiries([]);
      }
    } catch (err) {
      console.error('❌ Neočakávaná chyba:', err);
      setInquiries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInquiries();

    // Realtime subscription
    let channel: any = null;
    let isMounted = true;
    
    const setupRealtime = async () => {
      try {
        channel = supabase.channel('mayor-inquiries-live', {
          config: { broadcast: { ack: true } }
        });
        
        channel
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'mayor_inquiries' },
            () => {
              if (!isMounted) return;
              void loadInquiries();
            }
          );

        await channel.subscribe((status: string) => {
          if (!isMounted) return;
          if (status !== 'SUBSCRIBED' && status !== 'SUBSCRIBING') {
            console.warn('Inquiries realtime status:', status);
          }
        });
      } catch (err) {
        if (isMounted) {
          console.error('Error setting up inquiries realtime:', err);
        }
      }
    };

    void setupRealtime();

    return () => {
      isMounted = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  const filteredInquiries = inquiries.filter((inq) => {
    if (selectedCategory === 'all') return true;
    return inq.category === selectedCategory;
  });

  return (
    <div className="space-y-5 p-4 max-w-4xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 p-5 text-white shadow-md flex items-center justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm">
            <MessageSquare className="h-3.5 w-3.5" /> Obecné podnety
          </span>
          <h1 className="mt-2 text-xl font-bold">PODNETY PRE STAROSTU A ÚRAD</h1>
          <p className="mt-1 text-xs text-emerald-100 max-w-md">
            Nahláste problém v obci, položte otázku starostovi a sledujte oficiálne odpovede obce.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            void loadInquiries();
          }}
          className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
          title="Obnoviť podnety"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Top Controls: Filter & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setSelectedCategory(cat.id);
              }}
              className={cn(
                'shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors',
                selectedCategory === cat.id
                  ? 'bg-emerald-600 text-white shadow-sm dark:bg-emerald-600'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Submit New Inquiry Button */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setInquiryModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" /> Napísať podnet
        </button>
      </div>

      {/* Inquiries List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-xs">
          <Loader2 className="h-5 w-5 animate-spin mr-2 text-emerald-600" /> Načítavam podnety...
        </div>
      ) : filteredInquiries.length > 0 ? (
        <div className="space-y-4">
          {filteredInquiries.map((inq) => (
            <InquiryCard key={inq.id} inquiry={inq} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900 my-4">
          <MessageSquare className="h-10 w-10 text-slate-300 mx-auto mb-2 dark:text-slate-600" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Žiadne podnety v tejto kategórii</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            V tejto kategórii zatiaľ neboli zaevidované žiadne verejné podnety.
          </p>
        </div>
      )}

      {/* Inquiry Creation Modal */}
      <InquiryModal
        isOpen={inquiryModalOpen}
        onClose={() => setInquiryModalOpen(false)}
        onSuccess={loadInquiries}
      />
    </div>
  );
}

export default InquiriesScreen;