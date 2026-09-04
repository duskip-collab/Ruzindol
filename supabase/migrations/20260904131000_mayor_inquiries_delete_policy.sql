-- ============================================================================
-- Mayor Inquiries: DELETE Policies & Notification Trigger
-- ============================================================================
BEGIN;

-- ============================================================================
-- 1. DELETE RLS Politiky
-- ============================================================================

-- DROP existing DELETE policies if any
DROP POLICY IF EXISTS "podnety_delete_author_or_manager" ON public.mayor_inquiries;

-- Policy 1: Authors can delete their own inquiries
-- Policy 2: Officials (admin/uradnik/starosta) can delete any inquiry
CREATE POLICY "podnety_delete_author_or_manager" ON public.mayor_inquiries
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_inquiry_manager(auth.uid())
  );

-- ============================================================================
-- 2. Trigger for Notifications on Inquiry Deletion by Officials
-- ============================================================================

-- Function to create notification when admin/official deletes inquiry
CREATE OR REPLACE FUNCTION public.handle_inquiry_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleter_name TEXT;
  deleter_is_manager BOOLEAN;
BEGIN
  -- Check if deleter is an official (not the author)
  SELECT public.is_inquiry_manager(auth.uid()) INTO deleter_is_manager;

  -- Only create notification if deleted by admin/official, NOT by author
  IF deleter_is_manager AND OLD.user_id != auth.uid() THEN
    -- Get deleter's name for notification
    SELECT name INTO deleter_name FROM public.profiles WHERE id = auth.uid();

    -- Create notification for inquiry author
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      ref_id,
      priority,
      is_critical
    ) VALUES (
      OLD.user_id,
      'inquiry_deleted',
      'Váš podnet bol vymazaný',
      'Podnet "' || LEFT(OLD.title, 50) || '..." bol vymazaný. Dôvod: ' || COALESCE(deleter_name, 'Správca obce'),
      OLD.id,
      'high',
      true
    );
  END IF;

  RETURN OLD;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_handle_inquiry_deletion ON public.mayor_inquiries;

-- Create trigger
CREATE TRIGGER trigger_handle_inquiry_deletion
  BEFORE DELETE ON public.mayor_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_inquiry_deletion();

-- Grant execute permission to authenticated users (for trigger context)
GRANT EXECUTE ON FUNCTION public.handle_inquiry_deletion() TO authenticated;

-- Grant permissions for notifications creation via trigger
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.notifications TO service_role, postgres;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

COMMIT;
