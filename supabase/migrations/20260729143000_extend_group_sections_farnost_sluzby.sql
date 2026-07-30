DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'group_admins'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%group_key%'
  LOOP
    EXECUTE format('ALTER TABLE public.group_admins DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'group_announcements'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%group_key%'
  LOOP
    EXECUTE format('ALTER TABLE public.group_announcements DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.group_admins
  ADD CONSTRAINT group_admins_group_key_check
  CHECK (group_key IN ('osk_ruzindol', 'dochodcovia', 'dhz', 'farnost', 'sluzby'));

ALTER TABLE public.group_announcements
  ADD CONSTRAINT group_announcements_group_key_check
  CHECK (group_key IN ('osk_ruzindol', 'dochodcovia', 'dhz', 'farnost', 'sluzby'));
