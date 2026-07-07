import React from 'react';
import { useRss } from '../hooks/useRss';
import { Loader2, Newspaper } from 'lucide-react';

export function RssFeed() {
  const { news, loading } = useRss();

  if (loading) {
    return (
      <div className="p-4 text-center text-neutral-400">
        <Loader2 className="animate-spin inline" />
      </div>
    );
  }

  // Nájdeme prvú položku, ktorá patrí do kategórie 'Aktuality'
  const latestAktualita = news?.find(item => item.category === 'Aktuality');

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
      <h3 className="font-bold text-neutral-900 mb-4 flex items-center gap-2 text-xs uppercase tracking-widest">
        <Newspaper className="h-4 w-4 text-blue-500" /> Obecné informácie
      </h3>
      
      <div className="space-y-4">
        {latestAktualita ? (
          <a 
            href={latestAktualita.link} 
            target="_blank" 
            rel="noreferrer" 
            className="block text-sm hover:opacity-70 transition-opacity"
          >
            <span className="block text-[10px] text-blue-600 font-bold uppercase mb-1">
              {latestAktualita.category}
            </span>
            <span className="font-medium text-neutral-800">
              {latestAktualita.title}
            </span>
          </a>
        ) : (
          <p className="text-sm text-neutral-500 italic">
            Momentálne nie sú dostupné žiadne nové aktuality.
          </p>
        )}
      </div>
    </div>
  );
}