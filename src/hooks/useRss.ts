import { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';

// Definícia typu pre tvoje novinky
export type RssItem = {
  id?: number;
  title: string;
  link: string;
  category: string;
  pub_date: string;
  description: string;
};

export const useRss = () => {
  const [news, setNews] = useState<RssItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Funkcia na načítanie dát z databázy (nie z externého webu!)
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Čítame priamo z tabuľky, kde sú dáta už pripravené (cache)
      const { data, error: dbError } = await supabase
        .from('rss_cache')
        .select('*')
        .order('pub_date', { ascending: false });

      if (dbError) throw dbError;

      setNews(data || []);
    } catch (err) {
      console.error("Chyba pri načítaní z databázy:", err);
      setError("Nepodarilo sa načítať novinky z databázy.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return { 
    news, 
    // Filtrovanie kalendára je teraz bezpečné, pretože news je vždy pole
    calendarEvents: news.filter((item) => item.category === "Kalendár podujatí"), 
    loading, 
    error,
    refresh: loadData // Tlačidlo na obnovu dát z DB môže volať túto funkciu
  };
};