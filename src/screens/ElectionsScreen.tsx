import React, { useEffect, useState } from 'react';
import { Vote, Award, Loader2, RefreshCw, Edit3, FileText, Image as ImageIcon, Download, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import CandidateCard, { Candidate } from '@/components/elections/CandidateCard';
import CandidateModal from '@/components/elections/CandidateModal';
import ElectionsEditModal, { ElectionsData } from '@/components/elections/ElectionsEditModal';
import PollCard, { Poll } from '@/components/polls/PollCard';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

type Attachment = {
  id: string;
  election_id: string;
  file_name: string;
  file_type: 'pdf' | 'image';
  file_url: string;
  file_size_bytes?: number;
  description?: string;
  sort_order: number;
  created_at: string;
};

export function ElectionsScreen() {
  const { electionsEnabled, loading: settingsLoading } = useAppSettings();
  const { profile } = useCurrentUser();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
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
      // Načítaj prílohy volieb
      const { data: aData } = await supabase
        .from('elections_attachments')
        .select('*')
        .order('sort_order', { ascending: true });
      if (aData) setAttachments(aData as unknown as Attachment[]);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleEditElections = async () => {
    try {
      setLoading(true);
      // Načítaj aktívnu voľbu
      const { data: electionsData } = await supabase
        .from('elections')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (electionsData && electionsData.length > 0) {
        const election = electionsData[0];
         
        // Načítaj kandidátov IBA AKTÍVNYCH
        const { data: candidatesData } = await supabase
          .from('election_candidates')
          .select('*')
          .eq('election_id', election.id)
          .eq('is_active', true);

        // Načítaj prílohy
        const { data: attachmentsData } = await supabase
          .from('elections_attachments')
          .select('*')
          .eq('election_id', election.id)
          .order('sort_order', { ascending: true });

        const mayorCandidates = (candidatesData || [])
          .filter((c: any) => c.position_type === 'starosta')
          .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
        
        const councilCandidates = (candidatesData || [])
          .filter((c: any) => c.position_type === 'poslanec')
          .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));

        const attachmentsAsFiles = (attachmentsData || []).map((a: Attachment) => ({
          id: a.id,
          file_name: a.file_name,
          file_type: a.file_type,
          file_url: a.file_url,
          file_size_bytes: a.file_size_bytes,
          description: a.description,
          sort_order: a.sort_order
        }));

        setCurrentElection({
          id: election.id,
          name: election.name,
          description: election.description,
          election_date: election.election_date,
          status: election.status,
          candidates_mayor: mayorCandidates.length > 0 ? mayorCandidates : [emptyElectionCandidate()],
          candidates_council: councilCandidates.length > 0 ? councilCandidates : [emptyElectionCandidate()],
          attachments: attachmentsAsFiles
        });
      } else {
        setCurrentElection(null);
      }

      triggerHaptic('light');
      setEditModalOpen(true);
    } catch (err) {
      console.error('Error loading election for edit:', err);
    } finally {
      setLoading(false);
    }
  };

  const emptyElectionCandidate = () => ({
    full_name: '',
    party_or_independent: '',
    position_type: 'starosta' as const,
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
      // 1. Vymažem staré prílohy ak editujeme
      if (data.id) {
        await supabase
          .from('elections_attachments')
          .delete()
          .eq('election_id', electionId);
      }

      // 2. Vložím nové prílohy
      if (data.attachments.length > 0) {
        const attachmentsToInsert = data.attachments
          .filter((a) => a.file_url) // Iba prílohy s URL (nahrané súbory)
          .map((a, idx) => ({
            election_id: electionId,
            file_name: a.file_name,
            file_type: a.file_type,
            file_url: a.file_url,
            file_size_bytes: a.file_size_bytes,
            description: a.description,
            sort_order: idx,
            uploaded_by: profile?.id
          }));

        if (attachmentsToInsert.length > 0) {
          const { error: attachError } = await supabase
            .from('elections_attachments')
            .insert(attachmentsToInsert);

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

  // Manuálne mazanie jednotlivého kandidáta (Soft delete - nastaví is_active=false)
  const handleDeleteCandidate = async (candidateId: string) => {
    try {
      const { error } = await supabase
        .from('election_candidates')
        .update({ is_active: false })
        .eq('id', candidateId);

      if (error) throw new Error(error.message);
      
      triggerHaptic('success');
      void loadData();
    } catch (error) {
      console.error('Delete candidate error:', error);
      throw error;
    }
  };

  // Manuálne mazanie jednotlivej prílohy
  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      const { error } = await supabase
        .from('elections_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw new Error(error.message);
      
      triggerHaptic('success');
      void loadData();
    } catch (error) {
      console.error('Delete attachment error:', error);
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
                void handleEditElections();
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

      {attachments.length > 0 && (
        <div className="space-y-3 pt-3 border-t dark:border-slate-800">
          <h2 className="text-sm font-bold flex items-center gap-1.5"><FileText className="h-4 w-4 text-amber-600" /> Dokumenty a fotografie</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="group relative rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden flex flex-col h-full"
              >
                <a
                  href={att.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex flex-col hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all"
                >
                  {att.file_type === 'image' ? (
                    <div className="aspect-video overflow-hidden bg-slate-100 dark:bg-slate-900">
                      <img
                        src={att.file_url}
                        alt={att.file_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/30 flex items-center justify-center">
                      <FileText className="h-12 w-12 text-red-400 dark:text-red-600" />
                    </div>
                  )}
                  <div className="p-3 flex-1 flex flex-col">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {att.file_name}
                    </p>
                    {att.description && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {att.description}
                      </p>
                    )}
                    {att.file_size_bytes && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-auto pt-1">
                        {(att.file_size_bytes / 1024).toFixed(1)} KB
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
                        Stiahnuť
                      </span>
                    </div>
                  </div>
                </a>

                {isOfficial && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteAttachment(att.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors opacity-0 group-hover:opacity-100"
                    title="Vymazať prílohu"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <CandidateModal 
        candidate={selectedCandidate} 
        isOpen={candModalOpen} 
        onClose={() => setCandModalOpen(false)} 
        onDelete={handleDeleteCandidate}
        isAdmin={isOfficial}
      />
      
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
