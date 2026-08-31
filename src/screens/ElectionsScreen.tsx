import React, { useEffect, useState } from 'react';
import { Vote, Plus, MessageSquare, Award, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import CandidateCard, { Candidate } from '@/components/elections/CandidateCard';
import CandidateModal from '@/components/elections/CandidateModal';
import InquiryCard, { MayorInquiry } from '@/components/mayor/InquiryCard';
import InquiryModal from '@/components/mayor/InquiryModal';
import PollCard, { Poll } from '@/components/polls/PollCard';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

export function ElectionsScreen() {
  const { electionsEnabled, loading: settingsLoading } = useAppSettings();
  const { profile } = useCurrentUser();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [inquiries, setInquiries] = useState<MayorInquiry[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [candModalOpen, setCandModalOpen] = useState(false);
  const [inqModalOpen, setInqModalOpen] = useState(false);
  const [posFilter, setPosFilter] = useState<'vsetko' | 'starosta' | 'poslanec'>('vsetko');

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: cData } = await supabase.from('election_candidates').select('*').eq('is_active', true);
      if (cData) setCandidates(cData as unknown as Candidate[]);
      const { data: iData } = await supabase.from('mayor_inquiries').select('*, profiles:user_id(full_name, name)').limit(10);
      if (iData) setInquiries(iData as unknown as MayorInquiry[]);
      const { data: pData } = await supabase.from('polls').select('*, options:poll_options(*)');
      if (pData) setPolls(pData as unknown as Poll[]);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { void loadData(); }, []);

  if (settingsLoading) return <div className="p-8 text-center text-xs"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;

  const isOfficial = profile?.is_admin || profile?.role === 'Starosta' || profile?.role === 'Uradnik';
  if (!electionsEnabled && !isOfficial) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 my-6">
        <Vote className="h-10 w-10 text-slate-300 mx-auto mb-2" />
        <h3 className="text-sm font-bold">Modul volieb nie je aktívny</h3>
      </div>
    );
  }

  const filtered = candidates.filter((c) => posFilter === 'vsetko' || c.position_type === posFilter);

  return (
    <div className="space-y-5 p-4 max-w-4xl mx-auto pb-12">
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white flex items-center justify-between">
        <div>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
            <Vote className="h-3.5 w-3.5" /> Voľby
          </span>
          <h1 className="text-lg font-bold mt-1">Kandidáti a podnety</h1>
        </div>
        <button type="button" onClick={() => { triggerHaptic('light'); void loadData(); }} className="p-2 bg-white/10 rounded-xl">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-1.5"><Award className="h-4 w-4 text-amber-500" /> Kandidáti ({filtered.length})</h2>
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(['vsetko', 'starosta', 'poslanec'] as const).map((f) => (
              <button key={f} type="button" onClick={() => setPosFilter(f)} className={cn('px-2 py-0.5 text-xs font-semibold rounded-lg', posFilter === f ? 'bg-white dark:bg-slate-900' : 'text-slate-500')}>
                {f === 'vsetko' ? 'Všetci' : f === 'starosta' ? 'Starosta' : 'Poslanci'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((cand) => (
            <CandidateCard key={cand.id} candidate={cand} onSelect={(c) => { setSelectedCandidate(c); setCandModalOpen(true); }} />
          ))}
        </div>
      </div>

      {polls.length > 0 && (
        <div className="space-y-3 pt-3 border-t dark:border-slate-800">
          <h2 className="text-sm font-bold flex items-center gap-1.5"><Vote className="h-4 w-4 text-blue-500" /> Ankety</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {polls.map((p) => (<PollCard key={p.id} poll={p} isActiveNeighbor={Boolean(profile?.is_active_neighbor)} onVoteSuccess={loadData} />))}
          </div>
        </div>
      )}

      <div className="space-y-3 pt-3 border-t dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-1.5"><MessageSquare className="h-4 w-4 text-emerald-500" /> Podnety</h2>
          <button type="button" onClick={() => setInqModalOpen(true)} className="rounded-xl bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
            <Plus className="h-3.5 w-3.5 inline mr-1" /> Podnet
          </button>
        </div>

        <div className="space-y-2">
          {inquiries.map((inq) => (<InquiryCard key={inq.id} inquiry={inq} />))}
        </div>
      </div>

      <CandidateModal candidate={selectedCandidate} isOpen={candModalOpen} onClose={() => setCandModalOpen(false)} />
      <InquiryModal isOpen={inqModalOpen} onClose={() => setInqModalOpen(false)} onSuccess={loadData} />
    </div>
  );
}

export default ElectionsScreen;
