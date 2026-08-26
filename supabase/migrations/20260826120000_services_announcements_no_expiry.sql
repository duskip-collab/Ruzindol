-- Služby announcements are persistent; other group sections keep their expiry.
BEGIN;

ALTER TABLE public.group_announcements
  ALTER COLUMN expires_at DROP NOT NULL;

UPDATE public.group_announcements
SET expires_at = NULL
WHERE group_key = 'sluzby';

CREATE OR REPLACE FUNCTION public.set_group_announcement_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.expires_at := CASE
    WHEN NEW.group_key = 'sluzby' THEN NULL
    ELSE COALESCE(NEW.created_at, now()) + interval '4 days'
  END;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "group_announcements_delete_owner_or_moderator" ON public.group_announcements;
CREATE POLICY "group_announcements_delete_owner_or_moderator"
  ON public.group_announcements
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = author_id
    OR public.can_moderate(auth.uid())
  );

COMMIT;
