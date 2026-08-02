-- Workspace-Speicher: Basic/Free 3 GB, Pro (sowie Legacy/Complimentary) 10 GB.

create or replace function public.restaurant_workspace_quota_bytes(p_restaurant_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.restaurant_subscriptions s
      where s.restaurant_id = p_restaurant_id
        and (
          s.plan_id = 'pro'
          or s.source in ('legacy', 'complimentary')
          or s.status = 'legacy'
        )
    ) then 10737418240::bigint -- 10 GB
    else 3221225472::bigint -- 3 GB
  end;
$$;

comment on function public.restaurant_workspace_quota_bytes(uuid) is
  'Workspace-Speicherlimit: 10 GB für Pro/Legacy/Complimentary, sonst 3 GB.';

-- Alte 0-Argument-Variante entfernen (konstant 3 GB).
drop function if exists public.restaurant_workspace_quota_bytes();

create or replace function public.restaurant_documents_quota_bytes(p_restaurant_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select public.restaurant_workspace_quota_bytes(p_restaurant_id);
$$;

drop function if exists public.restaurant_documents_quota_bytes();

create or replace function public.restaurant_workspace_storage_breakdown(p_restaurant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'documentsBytes', public.restaurant_documents_used_bytes(p_restaurant_id),
    'galleryBytes', public.restaurant_gallery_used_bytes(p_restaurant_id),
    'newsBytes', public.restaurant_news_media_used_bytes(p_restaurant_id),
    'accountingBytes', public.restaurant_accounting_storage_used_bytes(p_restaurant_id),
    'totalBytes', public.restaurant_workspace_used_bytes(p_restaurant_id),
    'quotaBytes', public.restaurant_workspace_quota_bytes(p_restaurant_id)
  );
$$;

create or replace function public.restaurant_documents_enforce_quota()
returns trigger
language plpgsql
as $$
declare
  used bigint;
  quota bigint;
begin
  quota := public.restaurant_workspace_quota_bytes(new.restaurant_id);
  select public.restaurant_workspace_used_bytes(new.restaurant_id) into used;
  if used + new.size_bytes > quota then
    raise exception 'storage_quota_exceeded'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.gwada_gallery_items_enforce_quota()
returns trigger
language plpgsql
as $$
declare
  used bigint;
  quota bigint;
begin
  quota := public.restaurant_workspace_quota_bytes(new.restaurant_id);
  select public.restaurant_workspace_used_bytes(new.restaurant_id) into used;
  if used + new.size_bytes > quota then
    raise exception 'storage_quota_exceeded'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

grant execute on function public.restaurant_workspace_quota_bytes(uuid) to authenticated;
grant execute on function public.restaurant_documents_quota_bytes(uuid) to authenticated;
