-- Feed media optimization: thumbnail path + blur placeholder for gallery items

alter table public.gwada_gallery_items
  add column if not exists thumb_storage_path text,
  add column if not exists blur_data_url text;
