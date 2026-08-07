BEGIN;

CREATE OR REPLACE FUNCTION public.get_active_warehouse_counts()
RETURNS TABLE (type text, active_count bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH active AS (
    SELECT wi.type
    FROM public.warehouse_items wi
    WHERE COALESCE(
      wi.expires_at,
      CASE
        WHEN wi.type IN ('trh', 'darovanie') THEN wi.created_at + interval '30 days'
        WHEN wi.type = 'sklad_ponuka' THEN wi.created_at + interval '14 days'
        WHEN wi.type = 'sklad_dopyt' THEN wi.created_at + interval '24 hours'
        ELSE wi.created_at + interval '14 days'
      END
    ) > now()
  )
  SELECT base.type, COUNT(active.type)::bigint AS active_count
  FROM (
    VALUES ('trh'::text), ('darovanie'::text), ('sklad_ponuka'::text), ('sklad_dopyt'::text)
  ) AS base(type)
  LEFT JOIN active ON active.type = base.type
  GROUP BY base.type
  ORDER BY base.type;
$$;

REVOKE ALL ON FUNCTION public.get_active_warehouse_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_warehouse_counts() TO authenticated, service_role;

COMMIT;
