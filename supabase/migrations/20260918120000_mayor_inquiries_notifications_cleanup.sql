-- =============================================================================
-- Mayor Inquiries - Status changes with automatic notifications and cleanup
-- =============================================================================

-- 1. Pridať expires_at kolónku pre automatické mazanie po 24h
ALTER TABLE public.mayor_inquiries
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 2. Funkcia na odoslanie notifikácie občanovi pri zmene stavu podnetu
CREATE OR REPLACE FUNCTION public.notify_inquiry_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_notification_type TEXT;
  v_notification_title TEXT;
  v_notification_body TEXT;
  v_notification_url TEXT;
BEGIN
  -- Only proceed if status changed and user is a manager
  IF OLD.status IS DISTINCT FROM NEW.status
     AND public.is_inquiry_manager(NEW.answered_by) THEN
     
    v_user_id := NEW.user_id;
    
    -- Determine notification type and content based on new status
    CASE NEW.status
      WHEN 'in_progress' THEN
        v_notification_type := 'inquiry_in_progress';
        v_notification_title := 'Vaša požiadavka je v riešení';
        v_notification_body := CASE 
          WHEN NEW.answer IS NOT NULL AND NEW.answer != '' THEN
            format('Starosta odošiel odpoveď: %s', NEW.answer)
          ELSE
            'Vaša požiadavka je teraz v riešení.'
        END;
        v_notification_url := '/spravy';
        
      WHEN 'resolved' THEN
        v_notification_type := 'inquiry_resolved';
        v_notification_title := 'Vaša požiadavka bola vyriešená';
        v_notification_body := CASE 
          WHEN NEW.answer IS NOT NULL AND NEW.answer != '' THEN
            format('Starosta odošiel odpoveď: %s', NEW.answer)
          ELSE
            'Vaša požiadavka bola vyriešená.'
        END;
        v_notification_url := '/spravy';
        
      WHEN 'rejected' THEN
        v_notification_type := 'inquiry_rejected';
        v_notification_title := 'Vaša požiadavka bola zamietnutá';
        -- Pre zamietnuté použijeme preddefinovanú šablónu (bez vyžiadavky odpovede)
        v_notification_body := 'Vaša požiadavka bola zvážená a zamietnutá. Ďakujeme za pochopenie.';
        v_notification_url := '/spravy';
        
      ELSE
        -- pending or other - skip notification
        RETURN NEW;
    END CASE;
    
    -- Insert notification for the citizen
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      ref_id,
      url,
      priority,
      is_critical
    )
    VALUES (
      v_user_id,
      v_notification_type,
      v_notification_title,
      v_notification_body,
      NEW.id,
      v_notification_url,
      'oznam',
      false
    );
    
    -- Set expires_at based on status
    IF NEW.status = 'rejected' THEN
      -- Immediate deletion (set to now for cleanup)
      NEW.expires_at := NOW();
    ELSIF NEW.status IN ('in_progress', 'resolved') THEN
      -- Auto-delete after 24 hours
      NEW.expires_at := NOW() + INTERVAL '24 hours';
    ELSE
      -- pending - no expiration
      NEW.expires_at := NULL;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Trigger pre notifikácie pri zmene stavu (BEFOREUpdate pre modifikáciu NEW)
DROP TRIGGER IF EXISTS notify_inquiry_status_change_trigger ON public.mayor_inquiries;
CREATE TRIGGER notify_inquiry_status_change_trigger
  BEFORE UPDATE OF status, answer ON public.mayor_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_inquiry_status_change();

-- 4. Funkcia pre automatické mazanie expirovaných podnetov
CREATE OR REPLACE FUNCTION public.cleanup_expired_inquiries()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  DELETE FROM public.mayor_inquiries
  WHERE expires_at IS NOT NULL
    AND expires_at <= NOW()
    AND status IN ('in_progress', 'resolved');
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- 5. Grant permissions
REVOKE ALL ON FUNCTION public.notify_inquiry_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_inquiries() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_inquiries() TO service_role;

-- 6. Nainštalovať cron job pre cleanup (správa 24h cleanup)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-expired-inquiries');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-expired-inquiries',
  '*/30 * * * *',  -- Každých 30 minút
  $$SELECT public.cleanup_expired_inquiries()$$
);

COMMIT;