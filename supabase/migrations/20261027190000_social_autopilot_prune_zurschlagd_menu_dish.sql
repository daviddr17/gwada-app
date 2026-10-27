-- Soft-skip offene Speisekarten-/Ambiente-Drafts bei zurschlagd (nie gepostet).
-- Behebt ~1196 menu_dish-pending Spam — kein Hard-Delete. Idempotent.

update public.social_post_suggestions s
set status = 'skipped'
from public.restaurants r
where r.id = s.restaurant_id
  and r.slug = 'zurschlagd'
  and s.status in ('pending', 'needs_asset')
  and s.slot_kind in ('menu_dish', 'ambient')
  and s.news_post_id is null;
