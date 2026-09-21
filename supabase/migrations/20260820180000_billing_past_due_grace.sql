-- 7-day grace after first failed/unpaid Stripe charge. Access drops to Free afterwards.

alter table public.restaurant_subscriptions
  add column if not exists past_due_since timestamptz;

comment on column public.restaurant_subscriptions.past_due_since is
  'Start of the current unpaid cycle (first payment_failed / past_due). Paid-plan access ends after 7 days.';

update public.restaurant_subscriptions
set past_due_since = coalesce(past_due_since, updated_at)
where past_due_since is null
  and source = 'stripe'
  and status in ('past_due', 'unpaid');

create index if not exists restaurant_subscriptions_past_due_since_idx
  on public.restaurant_subscriptions (past_due_since)
  where past_due_since is not null
    and status in ('past_due', 'unpaid');
