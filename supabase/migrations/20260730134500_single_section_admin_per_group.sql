-- Enforce a single assigned neighbor per manual section.

BEGIN;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY group_key
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.group_admins
)
DELETE FROM public.group_admins ga
USING ranked r
WHERE ga.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS group_admins_group_key_unique_idx
  ON public.group_admins(group_key);

COMMIT;
