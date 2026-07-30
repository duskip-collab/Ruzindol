CREATE OR REPLACE FUNCTION public.enforce_message_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg_count INTEGER;
BEGIN
  SELECT count(*) INTO msg_count
  FROM public.messages
  WHERE chat_id = NEW.chat_id;

  IF msg_count >= 15 THEN
    RAISE EXCEPTION 'Limit 15 správ pre tento chat bol dosiahnutý.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_message_limit() FROM PUBLIC, anon, authenticated;