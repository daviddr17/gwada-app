-- Restaurant lehnt Anfrage ab: klarer als „Abgesagt“ (Stornierung = cancelled).
update public.reservation_statuses
set name = 'Abgelehnt'
where code = 'declined'
  and name = 'Abgesagt';
