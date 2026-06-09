-- POS: line-level payment allocations for split bill / session settlement.

create table public.pos_payment_line_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.pos_payments (id) on delete cascade,
  order_line_id uuid not null references public.pos_order_lines (id) on delete restrict,
  quantity numeric(10, 2) not null check (quantity > 0),
  amount_cents bigint not null check (amount_cents >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (payment_id, order_line_id)
);

create index pos_payment_line_allocations_line_idx
  on public.pos_payment_line_allocations (order_line_id);

create index pos_payment_line_allocations_payment_idx
  on public.pos_payment_line_allocations (payment_id);

alter table public.pos_payment_line_allocations enable row level security;

create policy pos_payment_line_allocations_staff_all
  on public.pos_payment_line_allocations for all
  using (
    exists (
      select 1
      from public.pos_payments p
      where p.id = pos_payment_line_allocations.payment_id
        and public.auth_is_restaurant_staff(p.restaurant_id)
    )
  )
  with check (
    exists (
      select 1
      from public.pos_payments p
      where p.id = pos_payment_line_allocations.payment_id
        and public.auth_is_restaurant_staff(p.restaurant_id)
    )
  );

alter table public.pos_order_lines
  add column if not exists paid_quantity numeric(10, 2) not null default 0;

alter table public.pos_order_lines
  drop constraint if exists pos_order_lines_paid_quantity_chk;

alter table public.pos_order_lines
  add constraint pos_order_lines_paid_quantity_chk
  check (paid_quantity >= 0 and paid_quantity <= quantity);

comment on table public.pos_payment_line_allocations is
  'Maps a POS payment to specific order line quantities (split bill).';

comment on column public.pos_order_lines.paid_quantity is
  'Denormalized sum of allocated paid quantity for this line.';

-- Backfill: legacy full-order cash payments count as fully paid lines.
update public.pos_order_lines ol
set paid_quantity = ol.quantity
from public.pos_orders o
join public.pos_payments p on p.order_id = o.id and p.status = 'paid'
where ol.order_id = o.id
  and ol.paid_quantity = 0
  and not exists (
    select 1 from public.pos_payment_line_allocations a where a.payment_id = p.id
  );
