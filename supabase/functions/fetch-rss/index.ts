import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  try {
    const response = await fetch("https://www.ruzindol.sk/api/rss/");
    const xmlText = await response.text();

    // Jednoduché parsovanie RSS (hľadáme tagy <item>)
    const regex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    const items = [];

    while ((match = regex.exec(xmlText)) !== null) {
      const raw = match[1];
      const titleMatch = raw.match(/<title>(.*?)<\/title>/);
      const linkMatch = raw.match(/<link>(.*?)<\/link>/);
      
      if (titleMatch && linkMatch) {
        items.push({
          title: titleMatch[1].replace('<![CDATA[', '').replace(']]>', ''),
          link: linkMatch[1],
          pub_date: new Date().toISOString()
        });
      }
    }

    const { error } = await supabase.from('rss_cache').upsert(items, { onConflict: 'link' });
    
    if (error) throw error;

    return new Response(JSON.stringify({ status: "OK", count: items.length }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
})