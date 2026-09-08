-- ==============================================================================
-- Robust Data Deletion and Automated Cleanup Migration
-- 1. Ensures robust cascading deletes for related records.
-- 2. Sets up automated scheduled cleanup (via pg_cron) for expired records and old logs.
-- ==============================================================================

-- 1. Ensure extensions exist
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Add or ensure cascade delete foreign keys where necessary for complete manual deletion
-- Elections / Candidates / Attachments cascade
DO $$
BEGIN
  -- election_candidates -> elections
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'election_candidates_election_id_fkey'
  ) THEN
    ALTER TABLE public.election_candidates DROP CONSTRAINT election_candidates_election_id_fkey;
  END IF;
  
  ALTER TABLE public.election_candidates
    ADD CONSTRAINT election_candidates_election_id_fkey
    FOREIGN KEY (election_id)
    REFERENCES public.elections(id)
    ON DELETE CASCADE;

  -- election_attachments -> elections
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'election_attachments_election_id_fkey'
  ) THEN
    ALTER TABLE public.election_attachments DROP CONSTRAINT election_attachments_election_id_fkey;
  END IF;

  ALTER TABLE public.election_attachments
    ADD CONSTRAINT election_attachments_election_id_fkey
    FOREIGN KEY (election_id)
    REFERENCES public.elections(id)
    ON DELETE CASCADE;
EXCEPTION
  WHEN undefined_table THEN
    -- Tables might not exist in some environments, ignore safely
    NULL;
END $$;


-- 3. Comprehensive cleanup function for expired and old records
CREATE OR REPLACE FUNCTION public.cleanup_expired_and_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- A. Clean up expired official notices / posts (expires_at passed by more than 30 days)
  DELETE FROM public.posts
  WHERE expires_at IS NOT NULL 
    AND expires_at < NOW() - INTERVAL '30 days';

  -- B. Clean up old read notifications older than 45 days
  DELETE FROM public.notifications
  WHERE read = true
    AND created_at < NOW() - INTERVAL '45 days';

  -- C. Clean up expired warehouse items older than 30 days past expiry
  BEGIN
    DELETE FROM public.warehouse_items
    WHERE expires_at IS NOT NULL 
      AND expires_at < NOW() - INTERVAL '30 days';
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  -- D. Clean up old user activity logs / analytics older than 60 days if table exists
  BEGIN
    DELETE FROM public.user_activity_logs
    WHERE created_at < NOW() - INTERVAL '60 days';
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  -- E. Clean up expired announcements or reminders
  BEGIN
    DELETE FROM public.reminders
    WHERE reminder_date < NOW() - INTERVAL '7 days';
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

END;
$$;

-- 4. Schedule the cleanup job via pg_cron (runs daily at 3:15 AM)
DO $$
BEGIN
  PERFORM cron.unschedule('robust-expired-data-cleanup');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'robust-expired-data-cleanup',
  '15 3 * * *',
  $cron$ SELECT public.cleanup_expired_and_old_data(); $cron$
);
