import React, { useState } from 'react';
import { MessageSquare, Clock, CheckCircle2, XCircle, AlertCircle, Lock, Globe, Building2, MapPin, User, Trash2, Loader2 } from 'lucide-react';
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

export interface InquiryCardProps {
  inquiry: MayorInquiry;
  className?: string;
  onDeleted?: () => void;
}

const CATEGORY_LABELS: Record<MayorInquiry['category'], string> = {
  odpad: 'Odpad a čistota',
  cesty_chodniky: 'Cesty a chodníky',
  zelen: 'Zeleň a parky',
  osvetlenie: 'Verejné osvetlenie',
  urad_sluzby: 'Úrad a služby',
  ine: 'Iné',
};

export const InquiryCard: React.FC<InquiryCardProps> = ({ inquiry, className, onDeleted }) => {
  const { userId } = useCurrentUser();
  const [isDeleting, setIsDeleting] = useState(false);
  const isAuthor = userId === inquiry.user_id;

  const handleDelete = async () => {
    if (!confirm('Naozaj chceš zmazať tento podnet? Túto akciu sa nedá vrátiť.')) return;

    setIsDeleting(true);
    try {
      triggerHaptic('success');
      const { error } = await supabase
        .from('mayor_inquiries')
        .delete()
        .eq('id', inquiry.id);

      if (error) {
        triggerHaptic('error');
        console.error('Chyba pri mazaní podnetu:', error);
        alert('Nepodarilo sa zmazať podnet: ' + (error.message || 'Neznáma chyba'));
      } else {
        triggerHaptic('success');
        onDeleted?.();
      }
    } catch (err) {
      triggerHaptic('error');
      console.error('Neočakávaná chyba:', err);
      alert('Neočakávaná chyba pri mazaní');
    } finally {
      setIsDeleting(false);
    }
  };
  const getStatusBadge = () => {
    switch (inquiry.status) {
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Vybavené
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
            <Clock className="h-3.5 w-3.5 animate-pulse" />
            V riešení
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-800 dark:bg-rose-950/80 dark:text-rose-300">
            <XCircle className="h-3.5 w-3.5" />
            Zamietnuté
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
            <AlertCircle className="h-3.5 w-3.5" />
            Čaká na vybavenie
          </span>
        );
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('sk-SK', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900 dark:text-white',
        className
      )}
    >
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {CATEGORY_LABELS[inquiry.category] || inquiry.category}
          </span>

          <span
            className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400"
            title={inquiry.is_public ? 'Verejný podnet' : 'Súkromný podnet'}
          >
            {inquiry.is_public ? (
              <>
                <Globe className="h-3 w-3 text-emerald-500" /> Verejný
              </>
            ) : (
              <>
                <Lock className="h-3 w-3 text-amber-500" /> Súkromný
              </>
            )}
          </span>

          {inquiry.is_anonymous_public && inquiry.is_public && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              <User className="h-3 w-3 text-blue-500" /> Anonymný
            </span>
          )}
        </div>

        {getStatusBadge()}
      </div>

      {/* Title & Content */}
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
        {inquiry.title}
      </h3>

      <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed mb-4">
        {inquiry.body}
      </p>

      {/* GPS Location if available */}
      {inquiry.latitude && inquiry.longitude && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 p-2 border border-blue-200 dark:border-blue-800">
          <MapPin className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-xs text-blue-700 dark:text-blue-300">
            Poloha: {inquiry.latitude.toFixed(4)}, {inquiry.longitude.toFixed(4)}
          </span>
          <a
            href={`https://maps.google.com/?q=${inquiry.latitude},${inquiry.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Mapa
          </a>
        </div>
      )}

      {/* Image if available */}
      {inquiry.image_url && (
        <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 max-h-60 bg-slate-50 dark:bg-slate-800">
          <img
            src={inquiry.image_url}
            alt={inquiry.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Official Answer Section */}
      {inquiry.answer && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4 border border-slate-200 dark:bg-slate-800/80 dark:border-slate-700/80">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Oficiálna odpoveď obce
            </h4>
            {inquiry.answered_at && (
              <span className="text-[10px] text-slate-400 ml-auto">
                {formatDate(inquiry.answered_at)}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
            {inquiry.answer}
          </p>
        </div>
      )}

      {/* Footer Meta */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 mb-3">
          <span>Odoslané: {formatDate(inquiry.created_at)}</span>
          {inquiry.is_anonymous_public && inquiry.is_public ? (
            <span>Autor: Overený občan</span>
          ) : inquiry.profiles?.name || inquiry.profiles?.full_name ? (
            <span>Autor: {inquiry.profiles.name || inquiry.profiles.full_name}</span>
          ) : null}
        </div>
        
        {/* Delete button for author */}
        {isAuthor && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-xs font-medium transition-colors disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            {isDeleting ? 'Mazanie...' : 'Zmazať podnet'}
          </button>
        )}
      </div>
    </div>
  );
};

export default InquiryCard;
