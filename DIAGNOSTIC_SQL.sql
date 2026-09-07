-- =============================================================================
-- DIAGNOSTICKÝ SQL SKRIPT NA KONTROLU NOTIFIKAČNÉHO SYSTÉMU
-- =============================================================================
-- Spustite tieto príkazy v Supabase SQL editori

-- 1. Skontrolovať, či existujú triggery
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'posts'
  AND trigger_schema = 'public'
ORDER BY trigger_name;

-- 2. Skontrolovať, či existujú trigger funkcie
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_name LIKE '%enqueue_notifications%' OR routine_name LIKE '%notification%')
ORDER BY routine_name;

-- 3. Počet všetkých notifikácií v posledných 24 hodinách podľa typu
SELECT 
    type,
    COUNT(*) as pocet_notifikacii,
    MAX(created_at) as posledna_notifikacia
FROM public.notifications
WHERE created_at > now() - INTERVAL '24 hours'
GROUP BY type
ORDER BY pocet_notifikacii DESC;

-- 4. Skontrolovať, či sú príspevky správneho typu
SELECT 
    type,
    COUNT(*) as pocet_prisspevkov,
    MAX(created_at) as posledny_prispevok
FROM public.posts
WHERE created_at > now() - INTERVAL '24 hours'
GROUP BY type
ORDER BY pocet_prisspevkov DESC;

-- 5. Skontrolovať, či sú push subskripcie zaregistrované
SELECT 
    COUNT(*) as pocet_subskripcii,
    COUNT(DISTINCT user_id) as pocet_pouzivatelo,
    MAX(created_at) as najnovsia_subskripcia
FROM public.user_push_subscriptions;

-- 6. Skontrolovať posledných 5 notifikácií
SELECT 
    id,
    user_id,
    type,
    title,
    is_critical,
    created_at
FROM public.notifications
ORDER BY created_at DESC
LIMIT 5;

-- 7. Skontrolovať posledných 5 príspevkov
SELECT 
    id,
    user_id,
    type,
    title,
    created_at
FROM public.posts
WHERE created_at > now() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 5;
