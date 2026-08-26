BEGIN;

CREATE OR REPLACE FUNCTION public.delete_neighbor(_target uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.can_moderate(v_uid) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF _target = v_uid THEN
    RAISE EXCEPTION 'Nemôžete vymazať sami seba' USING ERRCODE = 'P0001';
  END IF;
  IF public.has_role(_target, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Nemôžete vymazať administrátora' USING ERRCODE = 'P0001';
  END IF;

  -- Keep deletion reliable even if a legacy foreign key lacks ON DELETE CASCADE.
  DELETE FROM public.user_push_subscriptions WHERE user_id = _target;
  DELETE FROM public.notifications WHERE user_id = _target;
  DELETE FROM public.user_settings WHERE user_id = _target;
  DELETE FROM public.group_admins WHERE user_id = _target;
  DELETE FROM public.group_announcements WHERE author_id = _target;
  DELETE FROM public.post_replies WHERE user_id = _target;
  DELETE FROM public.post_likes WHERE user_id = _target;
  DELETE FROM public.post_reports WHERE reporter_id = _target;
  DELETE FROM public.events WHERE author_id = _target;
  DELETE FROM public.posts WHERE user_id = _target;
  DELETE FROM public.chats WHERE buyer_id = _target OR seller_id = _target;
  DELETE FROM public.warehouse_items WHERE user_id = _target;
  DELETE FROM public.user_roles WHERE user_id = _target;
  DELETE FROM public.profiles WHERE id = _target;
  DELETE FROM auth.users WHERE id = _target;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_neighbor(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_neighbor(uuid) TO authenticated;

COMMIT;