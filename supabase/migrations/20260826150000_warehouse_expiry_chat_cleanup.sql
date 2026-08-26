BEGIN;

-- Expired warehouse items are removed by the existing hourly cleanup job.
-- chats.item_id has ON DELETE CASCADE, so related messages and chats are removed too.
CREATE INDEX IF NOT EXISTS warehouse_items_expires_at_idx
  ON public.warehouse_items (expires_at)
  WHERE expires_at IS NOT NULL;

-- Both participants may manually delete their conversation.
DROP POLICY IF EXISTS "Chat participants can delete their chats" ON public.chats;
CREATE POLICY "Chat participants can delete their chats"
  ON public.chats
  FOR DELETE
  TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

COMMIT;

-- Verification queries:
SELECT count(*) AS expired_offers
FROM public.warehouse_items
WHERE type = 'sklad_ponuka'
  AND COALESCE(expires_at, created_at + interval '14 days') <= now();

SELECT count(*) AS active_offers
FROM public.warehouse_items
WHERE type = 'sklad_ponuka'
  AND COALESCE(expires_at, created_at + interval '14 days') > now();
