import { createClient } from '@supabase/supabase-js';

// Použi svoje existujúce URL a Anon Key
const supabase = createClient(
  'Tvoja_SUPABASE_URL', 
  'Tvoja_SUPABASE_ANON_KEY'
);

export const fetchAllNews = async (): Promise<any[]> => {
  try {
    // Volanie tvojej čerstvo nasadenej Edge Function
    const { data, error } = await supabase.functions.invoke('fetch-rss');

    if (error) throw error;

    // data teraz obsahuje XML string, ktorý si stiahol Supabase server
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(data, "text/xml");
    
    // Tu spracuj xmlDoc tak, ako si to mal predtým
    const items = Array.from(xmlDoc.querySelectorAll("item"));
    
    return items.map(item => ({
      title: item.querySelector("title")?.textContent || "",
      link: item.querySelector("link")?.textContent || "",
      // ... ostatné polia
    }));
  } catch (error) {
    console.error("Chyba pri získavaní RSS cez Edge Function:", error);
    return [];
  }
};

export const fetchCalendarEvents = async (): Promise<any[]> => {
  const allNews = await fetchAllNews();
  return allNews.filter((item) => item.category === "Kalendár podujatí");
};