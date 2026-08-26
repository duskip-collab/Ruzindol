-- Create reminders table for user event reminders
create table if not exists public.reminders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  event_id uuid references public.events(id) on delete cascade,
  title text not null,
  remind_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.reminders enable row level security;

-- RLS Policies: users can only see/manage their own reminders
drop policy if exists "Users can view their own reminders" on public.reminders;
create policy "Users can view their own reminders"
  on public.reminders for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own reminders" on public.reminders;
create policy "Users can insert their own reminders"
  on public.reminders for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own reminders" on public.reminders;
create policy "Users can update their own reminders"
  on public.reminders for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own reminders" on public.reminders;
create policy "Users can delete their own reminders"
  on public.reminders for delete
  using (auth.uid() = user_id);
