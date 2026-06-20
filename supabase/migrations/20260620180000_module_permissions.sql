-- Modul-Berechtigungen: Speisekarte, Bestand, Reservierungen, Nachrichten, Bewertungen, Dokumente, Mitarbeiter

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, perm.key
from public.restaurant_positions rp
cross join (
  values
    ('menu.manage'),
    ('inventory.manage'),
    ('reservations.manage'),
    ('contacts.manage'),
    ('reviews.manage'),
    ('documents.manage'),
    ('staff.manage')
) as perm(key)
where rp.slug in ('owner', 'manager')
on conflict do nothing;

create or replace function public.auth_user_restaurant_permission_keys(p_restaurant_id uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct rpp.permission_key
  from public.restaurant_employees re
  inner join public.restaurant_position_permissions rpp
    on rpp.position_id = re.position_id
  where re.restaurant_id = p_restaurant_id
    and re.profile_id = (select auth.uid())
    and re.is_active
    and re.position_id is not null
  union
  select unnest(array[
    'roles.manage',
    'team.manage',
    'integrations.whatsapp',
    'integrations.email',
    'integrations.facebook',
    'integrations.instagram',
    'integrations.google_business',
    'integrations.lexoffice',
    'settings.restaurant',
    'settings.opening_hours',
    'settings.branding',
    'settings.dashboard',
    'menu.manage',
    'inventory.manage',
    'reservations.manage',
    'contacts.manage',
    'news.manage',
    'events.manage',
    'reviews.manage',
    'gallery.read',
    'gallery.create',
    'gallery.update',
    'gallery.delete',
    'documents.manage',
    'documents.notes.edit',
    'staff.manage',
    'accounting.manage',
    'display.manage',
    'display.time',
    'display.time_presence',
    'display.reservations',
    'display.recipes',
    'display.inventory',
    'display.kds',
    'display.module_switch',
    'pos.kasse.manage',
    'pos.kasse.export'
  ]::text[])
  where exists (
    select 1
    from public.restaurant_employees re
    inner join public.restaurant_positions rp on rp.id = re.position_id
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and rp.slug = 'owner'
  );
$$;

-- ── Speisekarte ─────────────────────────────────────────────────────────────

drop policy if exists "menu_categories_access" on public.menu_categories;
create policy "menu_categories_access"
  on public.menu_categories for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'menu.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'menu.manage'));

drop policy if exists "menu_tags_access" on public.menu_tags;
create policy "menu_tags_access"
  on public.menu_tags for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'menu.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'menu.manage'));

drop policy if exists "menu_allergens_access" on public.menu_allergens;
create policy "menu_allergens_access"
  on public.menu_allergens for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'menu.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'menu.manage'));

drop policy if exists "menu_items_access" on public.menu_items;
create policy "menu_items_access"
  on public.menu_items for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'menu.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'menu.manage'));

drop policy if exists "menu_item_tags_access" on public.menu_item_tags;
create policy "menu_item_tags_access"
  on public.menu_item_tags for all
  to authenticated
  using (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_tags.menu_item_id
        and public.auth_has_restaurant_permission(mi.restaurant_id, 'menu.manage')
    )
  )
  with check (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_tags.menu_item_id
        and public.auth_has_restaurant_permission(mi.restaurant_id, 'menu.manage')
    )
  );

drop policy if exists "menu_item_allergens_access" on public.menu_item_allergens;
create policy "menu_item_allergens_access"
  on public.menu_item_allergens for all
  to authenticated
  using (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_allergens.menu_item_id
        and public.auth_has_restaurant_permission(mi.restaurant_id, 'menu.manage')
    )
  )
  with check (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_allergens.menu_item_id
        and public.auth_has_restaurant_permission(mi.restaurant_id, 'menu.manage')
    )
  );

drop policy if exists "menu_item_recipe_lines_access" on public.menu_item_recipe_lines;
create policy "menu_item_recipe_lines_access"
  on public.menu_item_recipe_lines for all
  to authenticated
  using (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_recipe_lines.menu_item_id
        and public.auth_has_restaurant_permission(mi.restaurant_id, 'menu.manage')
    )
  )
  with check (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_recipe_lines.menu_item_id
        and public.auth_has_restaurant_permission(mi.restaurant_id, 'menu.manage')
    )
  );

drop policy if exists "restaurant_menu_settings_staff_all" on public.restaurant_menu_settings;
create policy "restaurant_menu_settings_staff_all"
  on public.restaurant_menu_settings for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'menu.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'menu.manage'));

-- ── Bestand ─────────────────────────────────────────────────────────────────

drop policy if exists "inventory_suppliers_access" on public.inventory_suppliers;
create policy "inventory_suppliers_access"
  on public.inventory_suppliers for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'));

drop policy if exists "inventory_brands_access" on public.inventory_brands;
create policy "inventory_brands_access"
  on public.inventory_brands for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'));

drop policy if exists "inventory_ingredient_categories_access" on public.inventory_ingredient_categories;
create policy "inventory_ingredient_categories_access"
  on public.inventory_ingredient_categories for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'));

drop policy if exists "inventory_production_sites_access" on public.inventory_production_sites;
create policy "inventory_production_sites_access"
  on public.inventory_production_sites for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'));

drop policy if exists "inventory_units_access" on public.inventory_units;
create policy "inventory_units_access"
  on public.inventory_units for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'));

drop policy if exists "inventory_ingredients_access" on public.inventory_ingredients;
create policy "inventory_ingredients_access"
  on public.inventory_ingredients for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'));

drop policy if exists "inventory_stock_log_access" on public.inventory_stock_log_entries;
create policy "inventory_stock_log_access"
  on public.inventory_stock_log_entries for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'));

drop policy if exists "inventory_purchase_orders_access" on public.inventory_purchase_orders;
create policy "inventory_purchase_orders_access"
  on public.inventory_purchase_orders for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'));

drop policy if exists "inventory_purchase_order_lines_access" on public.inventory_purchase_order_lines;
create policy "inventory_purchase_order_lines_access"
  on public.inventory_purchase_order_lines for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'));

drop policy if exists "inventory_purchase_order_log_access" on public.inventory_purchase_order_log_entries;
create policy "inventory_purchase_order_log_access"
  on public.inventory_purchase_order_log_entries for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'inventory.manage'));

-- ── Reservierungen ──────────────────────────────────────────────────────────

drop policy if exists "reservations_select_guest_or_staff" on public.reservations;
create policy "reservations_select_guest_or_staff"
  on public.reservations for select
  to authenticated
  using (
    guest_profile_id = (select auth.uid())
    or public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
  );

drop policy if exists "reservations_insert_guest_or_staff" on public.reservations;
create policy "reservations_insert_guest_or_staff"
  on public.reservations for insert
  to authenticated
  with check (
    guest_profile_id is null
    or guest_profile_id = (select auth.uid())
    or public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
  );

drop policy if exists "reservations_update_staff_or_guest" on public.reservations;
create policy "reservations_update_staff_or_guest"
  on public.reservations for update
  to authenticated
  using (
    guest_profile_id = (select auth.uid())
    or public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
  )
  with check (
    guest_profile_id = (select auth.uid())
    or public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
  );

drop policy if exists "reservations_delete_staff_or_guest" on public.reservations;
create policy "reservations_delete_staff_or_guest"
  on public.reservations for delete
  to authenticated
  using (
    guest_profile_id = (select auth.uid())
    or public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
  );

drop policy if exists "dining_areas_staff_all" on public.dining_areas;
create policy "dining_areas_staff_all"
  on public.dining_areas for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage'));

drop policy if exists "restaurant_reservation_settings_staff_all" on public.restaurant_reservation_settings;
create policy "restaurant_reservation_settings_staff_all"
  on public.restaurant_reservation_settings for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage'));

drop policy if exists "restaurant_reservation_counters_staff" on public.restaurant_reservation_counters;
create policy "restaurant_reservation_counters_staff"
  on public.restaurant_reservation_counters for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage'));

drop policy if exists "dining_tables_select_staff" on public.dining_tables;
create policy "dining_tables_select_staff"
  on public.dining_tables for select
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
    or exists (
      select 1 from public.restaurants r
      where r.id = dining_tables.restaurant_id
        and r.is_published
    )
  );

drop policy if exists "dining_tables_write_staff" on public.dining_tables;
create policy "dining_tables_write_staff"
  on public.dining_tables for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage'));

drop policy if exists "reservation_whatsapp_outbox_select_staff" on public.reservation_whatsapp_outbox;
create policy "reservation_whatsapp_outbox_select_staff"
  on public.reservation_whatsapp_outbox for select
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage'));

drop policy if exists "reservation_email_outbox_select_staff" on public.reservation_email_outbox;
create policy "reservation_email_outbox_select_staff"
  on public.reservation_email_outbox for select
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage'));

-- ── Nachrichten / Kontakte ───────────────────────────────────────────────────

drop policy if exists "restaurant_contact_settings_staff_all" on public.restaurant_contact_settings;
create policy "restaurant_contact_settings_staff_all"
  on public.restaurant_contact_settings for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage'));

drop policy if exists "contacts_staff_all" on public.contacts;
create policy "contacts_staff_all"
  on public.contacts for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage'));

drop policy if exists "contact_emails_staff_all" on public.contact_emails;
create policy "contact_emails_staff_all"
  on public.contact_emails for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage'));

drop policy if exists "contact_phones_staff_all" on public.contact_phones;
create policy "contact_phones_staff_all"
  on public.contact_phones for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage'));

drop policy if exists "contact_messages_staff_all" on public.contact_messages;
create policy "contact_messages_staff_all"
  on public.contact_messages for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage'));

drop policy if exists "contact_messaging_ids_staff_all" on public.contact_messaging_ids;
create policy "contact_messaging_ids_staff_all"
  on public.contact_messaging_ids for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage'));

drop policy if exists "contact_message_attachments_staff_all" on public.contact_message_attachments;
create policy "contact_message_attachments_staff_all"
  on public.contact_message_attachments for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage'));

drop policy if exists "contact_lexoffice_links_select_staff" on public.contact_lexoffice_links;
create policy "contact_lexoffice_links_select_staff"
  on public.contact_lexoffice_links for select
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage'));

drop policy if exists "contact_lexoffice_links_write_staff" on public.contact_lexoffice_links;
create policy "contact_lexoffice_links_write_staff"
  on public.contact_lexoffice_links for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage'));

drop policy if exists "restaurant_lexoffice_contacts_cache_staff_select" on public.restaurant_lexoffice_contacts_cache;
create policy "restaurant_lexoffice_contacts_cache_staff_select"
  on public.restaurant_lexoffice_contacts_cache for select
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage'));

drop policy if exists "restaurant_inbox_signals_staff_select" on public.restaurant_inbox_signals;
create policy "restaurant_inbox_signals_staff_select"
  on public.restaurant_inbox_signals for select
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'contacts.manage'));

-- ── Bewertungen ─────────────────────────────────────────────────────────────

drop policy if exists "gwada_review_invitations_staff_select" on public.gwada_review_invitations;
create policy "gwada_review_invitations_staff_select"
  on public.gwada_review_invitations for select
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'reviews.manage'));

drop policy if exists "gwada_reviews_staff_select" on public.gwada_reviews;
create policy "gwada_reviews_staff_select"
  on public.gwada_reviews for select
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'reviews.manage'));

drop policy if exists "gwada_reviews_staff_insert" on public.gwada_reviews;
create policy "gwada_reviews_staff_insert"
  on public.gwada_reviews for insert
  to authenticated
  with check (public.auth_has_restaurant_permission(restaurant_id, 'reviews.manage'));

drop policy if exists "restaurant_review_settings_staff_select" on public.restaurant_review_settings;
create policy "restaurant_review_settings_staff_select"
  on public.restaurant_review_settings for select
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'reviews.manage'));

drop policy if exists "restaurant_review_settings_staff_write" on public.restaurant_review_settings;
create policy "restaurant_review_settings_staff_write"
  on public.restaurant_review_settings for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'reviews.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'reviews.manage'));

drop policy if exists "restaurant_review_auto_reply_rules_staff_select" on public.restaurant_review_auto_reply_rules;
create policy "restaurant_review_auto_reply_rules_staff_select"
  on public.restaurant_review_auto_reply_rules for select
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'reviews.manage'));

drop policy if exists "restaurant_review_auto_reply_rules_staff_write" on public.restaurant_review_auto_reply_rules;
create policy "restaurant_review_auto_reply_rules_staff_write"
  on public.restaurant_review_auto_reply_rules for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'reviews.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'reviews.manage'));

drop policy if exists "restaurant_review_visibility_staff_select" on public.restaurant_review_visibility;
create policy "restaurant_review_visibility_staff_select"
  on public.restaurant_review_visibility for select
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'reviews.manage'));

drop policy if exists "restaurant_review_visibility_staff_write" on public.restaurant_review_visibility;
create policy "restaurant_review_visibility_staff_write"
  on public.restaurant_review_visibility for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'reviews.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'reviews.manage'));

drop policy if exists "restaurant_review_auto_reply_log_staff_select" on public.restaurant_review_auto_reply_log;
create policy "restaurant_review_auto_reply_log_staff_select"
  on public.restaurant_review_auto_reply_log for select
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'reviews.manage'));

drop policy if exists "restaurant_reviews_platform_sync_staff_select" on public.restaurant_reviews_platform_sync;
create policy "restaurant_reviews_platform_sync_staff_select"
  on public.restaurant_reviews_platform_sync for select
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'reviews.manage'));

drop policy if exists "restaurant_reviews_platform_cache_staff_select" on public.restaurant_reviews_platform_cache;
create policy "restaurant_reviews_platform_cache_staff_select"
  on public.restaurant_reviews_platform_cache for select
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'reviews.manage'));

drop policy if exists "restaurant_review_reads_own_staff" on public.restaurant_review_reads;
create policy "restaurant_review_reads_own_staff"
  on public.restaurant_review_reads for all
  to authenticated
  using (
    user_id = (select auth.uid())
    and public.auth_has_restaurant_permission(restaurant_id, 'reviews.manage')
  )
  with check (
    user_id = (select auth.uid())
    and public.auth_has_restaurant_permission(restaurant_id, 'reviews.manage')
  );

-- ── Dokumente ───────────────────────────────────────────────────────────────

drop policy if exists "restaurant_document_tags_staff_all" on public.restaurant_document_tags;
create policy "restaurant_document_tags_staff_all"
  on public.restaurant_document_tags for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'documents.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'documents.manage'));

drop policy if exists "restaurant_documents_staff_all" on public.restaurant_documents;
create policy "restaurant_documents_staff_all"
  on public.restaurant_documents for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'documents.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'documents.manage'));

drop policy if exists "restaurant_document_log_staff_select" on public.restaurant_document_log_entries;
create policy "restaurant_document_log_staff_select"
  on public.restaurant_document_log_entries for select
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'documents.manage'));

drop policy if exists "restaurant_document_log_staff_insert" on public.restaurant_document_log_entries;
create policy "restaurant_document_log_staff_insert"
  on public.restaurant_document_log_entries for insert
  to authenticated
  with check (public.auth_has_restaurant_permission(restaurant_id, 'documents.manage'));

drop policy if exists "restaurant_document_note_entries_staff_select" on public.restaurant_document_note_entries;
create policy "restaurant_document_note_entries_staff_select"
  on public.restaurant_document_note_entries for select
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'documents.manage'));

drop policy if exists "restaurant_document_note_entries_staff_insert" on public.restaurant_document_note_entries;
create policy "restaurant_document_note_entries_staff_insert"
  on public.restaurant_document_note_entries for insert
  to authenticated
  with check (public.auth_has_restaurant_permission(restaurant_id, 'documents.manage'));

-- ── Mitarbeiter (HR — nicht Team/Positionen) ──────────────────────────────────

drop policy if exists "restaurant_staff_position_tags_staff_all" on public.restaurant_staff_position_tags;
create policy "restaurant_staff_position_tags_staff_all"
  on public.restaurant_staff_position_tags for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'));

drop policy if exists "restaurant_staff_staff_all" on public.restaurant_staff;
create policy "restaurant_staff_staff_all"
  on public.restaurant_staff for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'));

drop policy if exists "restaurant_staff_invites_staff_select" on public.restaurant_staff_invites;
create policy "restaurant_staff_invites_staff_select"
  on public.restaurant_staff_invites for select
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'));

drop policy if exists "restaurant_staff_contracts_staff_all" on public.restaurant_staff_contracts;
create policy "restaurant_staff_contracts_staff_all"
  on public.restaurant_staff_contracts for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'));

drop policy if exists "restaurant_staff_work_entries_staff_all" on public.restaurant_staff_work_entries;
create policy "restaurant_staff_work_entries_staff_all"
  on public.restaurant_staff_work_entries for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'));

drop policy if exists "restaurant_staff_time_sessions_staff_all" on public.restaurant_staff_time_sessions;
create policy "restaurant_staff_time_sessions_staff_all"
  on public.restaurant_staff_time_sessions for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'));

drop policy if exists "restaurant_staff_employment_types_staff_all" on public.restaurant_staff_employment_types;
create policy "restaurant_staff_employment_types_staff_all"
  on public.restaurant_staff_employment_types for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'));

drop policy if exists "restaurant_shift_schedule_settings_staff_all" on public.restaurant_shift_schedule_settings;
create policy "restaurant_shift_schedule_settings_staff_all"
  on public.restaurant_shift_schedule_settings for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'));

drop policy if exists "restaurant_shift_templates_staff_all" on public.restaurant_shift_templates;
create policy "restaurant_shift_templates_staff_all"
  on public.restaurant_shift_templates for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'));

drop policy if exists "restaurant_staff_scheduled_shifts_staff_all" on public.restaurant_staff_scheduled_shifts;
create policy "restaurant_staff_scheduled_shifts_staff_all"
  on public.restaurant_staff_scheduled_shifts for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'));

drop policy if exists "restaurant_staff_log_staff_select" on public.restaurant_staff_log_entries;
create policy "restaurant_staff_log_staff_select"
  on public.restaurant_staff_log_entries for select
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'));

drop policy if exists "restaurant_staff_log_staff_insert" on public.restaurant_staff_log_entries;
create policy "restaurant_staff_log_staff_insert"
  on public.restaurant_staff_log_entries for insert
  to authenticated
  with check (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'));

drop policy if exists "restaurant_staff_contract_log_staff_select" on public.restaurant_staff_contract_log_entries;
create policy "restaurant_staff_contract_log_staff_select"
  on public.restaurant_staff_contract_log_entries for select
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'));

drop policy if exists "restaurant_staff_contract_log_staff_insert" on public.restaurant_staff_contract_log_entries;
create policy "restaurant_staff_contract_log_staff_insert"
  on public.restaurant_staff_contract_log_entries for insert
  to authenticated
  with check (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'));

drop policy if exists "restaurant_staff_work_entry_log_staff_select" on public.restaurant_staff_work_entry_log_entries;
create policy "restaurant_staff_work_entry_log_staff_select"
  on public.restaurant_staff_work_entry_log_entries for select
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'));

drop policy if exists "restaurant_staff_work_entry_log_staff_insert" on public.restaurant_staff_work_entry_log_entries;
create policy "restaurant_staff_work_entry_log_staff_insert"
  on public.restaurant_staff_work_entry_log_entries for insert
  to authenticated
  with check (public.auth_has_restaurant_permission(restaurant_id, 'staff.manage'));
