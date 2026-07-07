-- Add temporary ban, unblock, and soft-delete support for neighbor profiles.
-- Admins and Starostas can manage these actions.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

-- Helper function to check whether the current authenticated user may manage neighbors.
CREATE OR REPLACE FUNCTION public.can_manage_neighbors()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'Starosta'
  );
$$;

-- Ban a neighbor for 1-10 days.
CREATE OR REPLACE FUNCTION public.ban_neighbor(target_id UUID, days INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.can_manage_neighbors() THEN
    RAISE EXCEPTION 'Unauthorized to manage neighbor bans.';
  END IF;

  IF days < 1 OR days > 10 THEN
    RAISE EXCEPTION 'Ban duration must be between 1 and 10 days.';
  END IF;

  UPDATE public.profiles
  SET banned_until = now() + (days || ' days')::interval,
      is_deleted = false
  WHERE id = target_id;
END;
$$;

-- Unban a neighbor immediately.
CREATE OR REPLACE FUNCTION public.unban_neighbor(target_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.can_manage_neighbors() THEN
    RAISE EXCEPTION 'Unauthorized to manage neighbor bans.';
  END IF;

  UPDATE public.profiles
  SET banned_until = NULL
  WHERE id = target_id;
END;
$$;

-- Soft-delete a neighbor profile.
CREATE OR REPLACE FUNCTION public.delete_neighbor(target_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.can_manage_neighbors() THEN
    RAISE EXCEPTION 'Unauthorized to delete neighbor.';
  END IF;

  UPDATE public.profiles
  SET is_deleted = true
  WHERE id = target_id;
END;
$$;

-- Policy allowing admins and mayors to update ban/delete fields directly if needed.
CREATE POLICY IF NOT EXISTS "Admins and Starosty manage neighbor status"
  ON public.profiles FOR UPDATE
  USING (public.can_manage_neighbors())
  WITH CHECK (public.can_manage_neighbors());
