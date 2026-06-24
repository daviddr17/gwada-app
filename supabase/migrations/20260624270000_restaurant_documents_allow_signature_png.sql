-- Digitale Vertrags-Unterschriften sind PNGs unter staff-contracts/…/signature-*.png
-- (20260519150000 hatte image/png aus dem Bucket entfernt)

update storage.buckets
set allowed_mime_types = (
  select coalesce(array_agg(distinct mime order by mime), array['image/png']::text[])
  from (
    select unnest(coalesce(allowed_mime_types, array[]::text[])) as mime
    from storage.buckets
    where id = 'restaurant-documents'
    union all
    select 'image/png'::text
  ) combined
)
where id = 'restaurant-documents';
