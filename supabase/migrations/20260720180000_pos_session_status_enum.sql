-- Phase 1a: Enum-Werte (eigene Migration — neue Enum-Werte nicht in derselben TX nutzen).
alter type public.pos_table_session_status add value if not exists 'bill';
alter type public.pos_table_session_status add value if not exists 'paid_pending_release';
