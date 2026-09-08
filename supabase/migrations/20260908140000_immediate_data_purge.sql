-- ==============================================================================
-- Immediate Data Purge and Cleanup Migration
-- 1. Permanently deletes inactive/soft-deleted election candidates (`is_active = false`).
-- 2. Permanently cleans up expired warehouse items and orphaned/unassigned items.
-- 3. Ensures automated functions run cleanly.
-- ==============================================================================

BEGIN;

-- 1. Purge all inactive or deleted election candidates
DELETE FROM public.election_candidates
WHERE is_active = false;

-- Also purge any candidates belonging to deleted or non-existent elections
DELETE FROM public.election_candidates
WHERE election_id NOT IN (SELECT id FROM public.elections);

-- 2. Purge expired warehouse items (offers/requests past expiry or older than 30 days)
DELETE FROM public.warehouse_items
WHERE expires_at IS NOT NULL AND expires_at < NOW() - INTERVAL '7 days';

-- 3. Purge unassigned / orphaned warehouse items where user no longer exists in profiles
DELETE FROM public.warehouse_items
WHERE user_id NOT IN (SELECT id FROM public.profiles);

COMMIT;
