-- POS receipt PDFs: private bucket; path {restaurant_id}/{order_id}.pdf
-- pos_orders.receipt_url stores the object path (not an HTTP URL).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pos-receipts',
  'pos-receipts',
  false,
  2097152,
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Reuse storage_restaurant_id_from_object_path from restaurant_documents migration.

create policy pos_receipts_storage_select_staff
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'pos-receipts'
    and public.auth_is_restaurant_staff(
      public.storage_restaurant_id_from_object_path(name)
    )
  );
