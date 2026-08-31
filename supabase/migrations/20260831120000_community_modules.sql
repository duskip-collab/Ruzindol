-- ============================================================================
-- 0. KOREKCIA TABUĽKY PROFILES (Pridanie chýbajúcich stĺpcov ak neexistujú)
-- ============================================================================
alter table public.profiles add column if not exists is_admin boolean default false;
alter table public.profiles add column if not exists is_official boolean default false;
alter table public.profiles add column if not exists is_active_neighbor boolean default false;

-- ============================================================================
-- MIGRÁCIA PRE NOVÉ MODULY: APP SETTINGS, NAPÍŠ STAROSTOVI, ANKETY A VOĽBY
-- ============================================================================

-- 1. TABUĽKA APP_SETTINGS (Globálne nastavenia aplikácie)
create table if not exists public.app_settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamptz default now() not null,
    updated_by uuid references public.profiles(id) on delete set null
);

insert into public.app_settings (key, value)
values ('elections_enabled', 'false'::jsonb)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "Allow authenticated read app_settings" on public.app_settings;
create policy "Allow authenticated read app_settings"
    on public.app_settings for select
    to authenticated
    using (true);

drop policy if exists "Allow admin/official write app_settings" on public.app_settings;
create policy "Allow admin/official write app_settings"
    on public.app_settings for all
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and (is_admin = true or is_official = true)
        )
    )
    with check (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and (is_admin = true or is_official = true)
        )
    );

-- 2. TABUĽKA MAYOR_INQUIRIES (Modul Napíš starostovi)
create table if not exists public.mayor_inquiries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    category text not null check (category in ('odpad', 'cesty_chodniky', 'zelen', 'osvetlenie', 'urad_sluzby', 'ine')),
    title text not null,
    body text not null,
    image_url text,
    is_public boolean default true not null,
    status text default 'pending' not null check (status in ('pending', 'in_progress', 'resolved', 'rejected')),
    answer text,
    answered_at timestamptz,
    answered_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz default now() not null
);

alter table public.mayor_inquiries enable row level security;

drop policy if exists "Allow select mayor_inquiries" on public.mayor_inquiries;
create policy "Allow select mayor_inquiries"
    on public.mayor_inquiries for select
    to authenticated
    using (
        is_public = true
        or user_id = auth.uid()
        or exists (
            select 1 from public.profiles
            where id = auth.uid() and (is_admin = true or is_official = true)
        )
    );

drop policy if exists "Allow insert active_neighbor mayor_inquiries" on public.mayor_inquiries;
create policy "Allow insert active_neighbor mayor_inquiries"
    on public.mayor_inquiries for insert
    to authenticated
    with check (
        user_id = auth.uid()
        and exists (
            select 1 from public.profiles
            where id = auth.uid() and is_active_neighbor = true
        )
    );

drop policy if exists "Allow update admin/official mayor_inquiries" on public.mayor_inquiries;
create policy "Allow update admin/official mayor_inquiries"
    on public.mayor_inquiries for update
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and (is_admin = true or is_official = true)
        )
    );

-- 3. TABUĽKY PRE MODUL ANKETY (POLLS, POLL_OPTIONS, POLL_VOTES)
create table if not exists public.polls (
    id uuid primary key default gen_random_uuid(),
    created_by uuid not null references public.profiles(id) on delete cascade,
    title text not null,
    description text,
    expires_at timestamptz not null,
    is_active boolean default true not null,
    created_at timestamptz default now() not null
);

create table if not exists public.poll_options (
    id uuid primary key default gen_random_uuid(),
    poll_id uuid not null references public.polls(id) on delete cascade,
    option_text text not null,
    sort_order integer default 0 not null
);

create table if not exists public.poll_votes (
    id uuid primary key default gen_random_uuid(),
    poll_id uuid not null references public.polls(id) on delete cascade,
    option_id uuid not null references public.poll_options(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz default now() not null,
    constraint poll_votes_poll_user_unique unique (poll_id, user_id)
);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

drop policy if exists "Allow read polls" on public.polls;
create policy "Allow read polls" on public.polls for select to authenticated using (true);

drop policy if exists "Allow read poll_options" on public.poll_options;
create policy "Allow read poll_options" on public.poll_options for select to authenticated using (true);

drop policy if exists "Allow read poll_votes" on public.poll_votes;
create policy "Allow read poll_votes" on public.poll_votes for select to authenticated using (true);

drop policy if exists "Allow admin/official write polls" on public.polls;
create policy "Allow admin/official write polls" on public.polls for all to authenticated
    using (exists (select 1 from public.profiles where id = auth.uid() and (is_admin = true or is_official = true)))
    with check (exists (select 1 from public.profiles where id = auth.uid() and (is_admin = true or is_official = true)));

drop policy if exists "Allow admin/official write poll_options" on public.poll_options;
create policy "Allow admin/official write poll_options" on public.poll_options for all to authenticated
    using (exists (select 1 from public.profiles where id = auth.uid() and (is_admin = true or is_official = true)))
    with check (exists (select 1 from public.profiles where id = auth.uid() and (is_admin = true or is_official = true)));

create or replace function public.cast_poll_vote(p_poll_id uuid, p_option_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_is_active boolean;
    v_poll_active boolean;
    v_poll_expires timestamptz;
begin
    if v_user_id is null then
        raise exception 'Používateľ nie je prihlásený';
    end if;

    select is_active_neighbor into v_is_active
    from public.profiles
    where id = v_user_id;

    if v_is_active is not true then
        raise exception 'Hlasovať môžu iba overení aktívni susedia';
    end if;

    select is_active, expires_at into v_poll_active, v_poll_expires
    from public.polls
    where id = p_poll_id;

    if v_poll_active is not true or v_poll_expires <= now() then
        raise exception 'Tento prieskum / anketa už nie je aktívna';
    end if;

    if not exists (select 1 from public.poll_options where id = p_option_id and poll_id = p_poll_id) then
        raise exception 'Neplatná možnosť pre túto anketu';
    end if;

    insert into public.poll_votes (poll_id, option_id, user_id)
    values (p_poll_id, p_option_id, v_user_id);

    return jsonb_build_object('success', true);
end;
$$;

-- 4. TABUĽKA ELECTION_CANDIDATES (Modul Voľby)
create table if not exists public.election_candidates (
    id uuid primary key default gen_random_uuid(),
    full_name text not null,
    photo_url text,
    position_type text not null check (position_type in ('starosta', 'poslanec')),
    party_or_independent text not null,
    age integer,
    profession text,
    motto text,
    program_priorities text[] default '{}'::text[] not null,
    bio text,
    email text,
    website_url text,
    facebook_url text,
    is_active boolean default true not null,
    created_at timestamptz default now() not null
);

alter table public.election_candidates enable row level security;

drop policy if exists "Allow public read election_candidates" on public.election_candidates;
create policy "Allow public read election_candidates"
    on public.election_candidates for select
    to authenticated
    using (true);

drop policy if exists "Allow admin/official write election_candidates" on public.election_candidates;
create policy "Allow admin/official write election_candidates"
    on public.election_candidates for all
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and (is_admin = true or is_official = true)
        )
    )
    with check (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and (is_admin = true or is_official = true)
        )
    );