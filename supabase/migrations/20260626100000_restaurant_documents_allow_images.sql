-- Dokumente: JPEG/PNG für gescannte Belege und Fotos (image/png war schon für Vertrags-Signaturen drin).

update storage.buckets
set allowed_mime_types = (
  select coalesce(array_agg(distinct mime order by mime), array['image/jpeg', 'image/png']::text[])
  from (
    select unnest(coalesce(allowed_mime_types, array[]::text[])) as mime
    from storage.buckets
    where id = 'restaurant-documents'
    union all
    select unnest(array['image/jpeg', 'image/png']::text[])
  ) combined
)
where id = 'restaurant-documents';
