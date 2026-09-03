-- Handle notifications for answered inquiries
CREATE OR REPLACE FUNCTION public.handle_inquiry_answer_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if the answer was updated (i.e., changed from NULL or something else) and is not NULL
  IF (OLD.answer IS DISTINCT FROM NEW.answer) AND NEW.answer IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      ref_id,
      is_read
    )
    VALUES (
      NEW.user_id,
      'inquiry_answer',
      'Odpoveď na podnet',
      'Váš podnet "' || LEFT(NEW.title, 20) || '..." bol zodpovedaný.',
      NEW.id,
      false
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_inquiry_answer_update ON public.mayor_inquiries;
CREATE TRIGGER on_inquiry_answer_update
AFTER UPDATE ON public.mayor_inquiries
FOR EACH ROW EXECUTE FUNCTION public.handle_inquiry_answer_update();
