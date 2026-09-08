import React, { useEffect, useState } from 'react';
import { Vote, Award, Loader2, RefreshCw, Edit3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import CandidateCard, { Candidate } from '@/components/elections/CandidateCard';
import CandidateModal from '@/components/elections/CandidateModal';
import ElectionsEditModal, { ElectionsData } from '@/components/elections/ElectionsEditModal';
import PollCard, { Poll } from '@/components/polls/PollCard';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

export function ElectionsScreen() {
  const { electionsEnabled, loading: settingsLoading } = useAppSettings();
  const { profile } = useCurrentUser();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [candModalOpen, setCandModalOpen] = useState(false);
  const [posFilter, setPosFilter] = useState<'vsetko' | 'starosta' | 'poslanec'>('vsetko');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentElection, setCurrentElection] = useState<ElectionsData | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: cData } = await supabase.from('election_candidates').select('*').eq('is_active', true);
      if (cData) setCandidates(cData as unknown as Candidate[]);
      const { data: pData } = await supabase.from('polls').select('*, options:poll_options(*)');
      if (pData) setPolls(pData as unknown as Poll[]);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSaveElection = async (data: ElectionsData) => {
    try {
      const { data: electionResult, error: electionError } = data.id
        ? await supabase
            .from('elections')
            .update({
              name: data.name,
              description: data.description,
              election_date: data.election_date,
              status: data.status,
              updated_at: new Date().toISOString()
            })
            .eq('id', data.id)
            .select()
        : await supabase
            .from('elections')
            .insert({
              name: data.name,
              description: data.description,
              election_date: data.election_date,
              status: data.status,
              created_by: profile?.id,
              created_at: new Date().toISOString()
            })
            .select();

      if (electionError) throw new Error(electionError.message);
      const electionId = electionResult?.[0]?.id;
      if (!electionId) throw new Error('Voľby sa nepodarilo vytvoriť');

      // Vymažem starých kandidátov
      if (data.id) {
        await supabase
          .from('election_candidates')
          .delete()
          .eq('election_id', electionId);
      }

      // Vložím nových kandidátov
      const allCandidates = [
        ...data.candidates_mayor.map((c, i) => ({ ...c, election_id: electionId, sort_order: i })),
        ...data.candidates_council.map((c, i) => ({ ...c, election_id: electionId, sort_order: i }))
      ];

      if (allCandidates.length > 0) {
        const { error: candError } = await supabase
          .from('election_candidates')
          .insert(
            allCandidates.map((c) => ({
              full_name: c.full_name,
              party_or_independent: c.party_or_independent,
              position_type: c.position_type,
              age: c.age,
              profession: c.profession,
              motto: c.motto,
              bio: c.bio,
              email: c.email,
              website_url: c.website_url,
              facebook_url: c.facebook_url,
              program_priorities: c.program_priorities,
              photo_url: c.photo_url,
              election_id: electionId,
              sort_order: c.sort_order,
              is_active: true
            }))
          );

        if (candError) throw new Error(candError.message);
      }

      // Handleuj prílohy (attachments)
      if (data.attachments.length > 0) {
        const existingAttachments = data.attachments.filter((a) => !a.id.startsWith('new'));
        if (existingAttachments.length > 0) {
          const { error: attachError } = await supabase
            .from('elections_attachments')
            .upsert(
              existingAttachments.map((a) => ({
                id: a.id,
                election_id: electionId,
                file_name: a.file_name,
                file_type: a.file_type,
                file_url: a.file_url,
                file_size_bytes: a.file_size_bytes,
                description: a.description,
                sort_order: a.sort_order,
                uploaded_by: profile?.id
              }))
            );

          if (attachError) throw new Error(attachError.message);
        }
      }

      triggerHaptic('success');
      void loadData();
      setCurrentElection(null);
    } catch (error: any) {
      console.error('Save election error:', error);
      throw error;
    }
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
          <h1 className="text-lg font-bold mt-1">Kandidáti na starostu a poslancov</h1>
        </div>
        <div className="flex items-center gap-2">
          {isOfficial && (
            <button 
              type="button" 
              onClick={() => { 
                triggerHaptic('light'); 
                setEditModalOpen(true); 
              }} 
              className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
              title="Upraviť voľby"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          )}
          <button type="button" onClick={() => { triggerHaptic('light'); void loadData(); }} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
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

      <CandidateModal candidate={selectedCandidate} isOpen={candModalOpen} onClose={() => setCandModalOpen(false)} />
      
      <ElectionsEditModal 
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleSaveElection}
        initialData={currentElection}
      />
    </div>
  );
}

export default ElectionsScreen;
