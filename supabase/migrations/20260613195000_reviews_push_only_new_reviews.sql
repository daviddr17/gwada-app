-- Push bei externen Bewertungen (Google, Facebook, …) nur, wenn die Bewertung selbst neu ist —
-- nicht beim Erst-Import alter Cache-Zeilen aus dem Plattform-Sync.

create or replace function public.trg_emit_notification_event_reviews_cache()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  review_rating numeric;
  review_author text;
  review_preview text;
  review_created_at timestamptz;
  prev_synced_at timestamptz;
  grace interval := interval '2 hours';
  max_age interval := interval '7 days';
begin
  review_rating := coalesce((new.item->>'rating')::numeric, 0);
  review_author := coalesce(
    nullif(trim(new.item->>'authorName'), ''),
    'Gast'
  );
  review_preview := left(trim(coalesce(new.item->>'comment', '')), 120);

  review_created_at := nullif(trim(new.item->>'createdAt'), '')::timestamptz;

  select s.synced_at
  into prev_synced_at
  from public.restaurant_reviews_platform_sync s
  where s.restaurant_id = new.restaurant_id
    and s.platform = new.platform;

  -- Erst-Sync / noch nie synchronisiert: Cache befüllen, aber keine Push-Sturm für Historie.
  if prev_synced_at is null then
    return new;
  end if;

  -- Bewertungsdatum fehlt oder eindeutig alt → kein Push.
  if review_created_at is null then
    return new;
  end if;

  if review_created_at < timezone('utc', now()) - max_age then
    return new;
  end if;

  if review_created_at < prev_synced_at - grace then
    return new;
  end if;

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    new.restaurant_id,
    'reviews',
    new.platform || ':' || new.external_id,
    jsonb_build_object(
      'rating', review_rating,
      'authorName', review_author,
      'commentPreview', review_preview,
      'platform', new.platform,
      'reviewId', new.platform || ':' || new.external_id,
      'reviewCreatedAt', review_created_at
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = 'reviews'
      and e.reference_id = new.platform || ':' || new.external_id
      and coalesce(e.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(new.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

  return new;
end;
$$;

comment on function public.trg_emit_notification_event_reviews_cache() is
  'Push nur bei neuen externen Bewertungen (createdAt nahe am Sync-Fenster), nicht beim Erst-Import alter Reviews.';
