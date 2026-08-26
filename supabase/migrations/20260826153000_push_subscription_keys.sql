BEGIN;

ALTER TABLE public.user_push_subscriptions
  ADD COLUMN IF NOT EXISTS p256dh TEXT,
  ADD COLUMN IF NOT EXISTS auth TEXT;

UPDATE public.user_push_subscriptions
SET
  p256dh = COALESCE(p256dh, subscription->'keys'->>'p256dh'),
  auth = COALESCE(auth, subscription->'keys'->>'auth')
WHERE subscription IS NOT NULL;

COMMIT;