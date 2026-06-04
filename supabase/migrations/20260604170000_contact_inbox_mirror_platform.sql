-- E-Mail-Spiegel aus IMAP: Kanal korrekt als email (nicht gwada)
update public.contact_messages
set platform = 'email'
where platform = 'gwada'
  and external_source_id like 'email-imap:%';
