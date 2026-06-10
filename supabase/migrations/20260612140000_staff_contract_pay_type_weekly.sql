-- Vergütung: Festlohn pro Woche (Schritt 1 — Enum-Wert, eigene Migration wegen PG-Transaktion)

alter type public.staff_contract_pay_type add value if not exists 'fixed_weekly';
