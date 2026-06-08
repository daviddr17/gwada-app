-- DSFinV-K ZIP pro Kassensitzung (wie Loyaro: beim Z-Bon erzeugen und cachen)

alter table public.pos_register_sessions
  add column if not exists dsfinvk_export_id uuid,
  add column if not exists dsfinvk_export_storage_path text;

comment on column public.pos_register_sessions.dsfinvk_export_id is
  'Fiskaly DSFinV-K export_id (UUID beim PUT /exports/{id}).';

comment on column public.pos_register_sessions.dsfinvk_export_storage_path is
  'Supabase-Storage-Pfad zur gecachten DSFinV-K ZIP (pos-receipts Bucket).';
