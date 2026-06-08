-- DSFinV-K ZIPs are not stored server-side; bucket stays PDF-only for receipts.

update storage.buckets
set
  allowed_mime_types = array['application/pdf'],
  file_size_limit = 2097152
where id = 'pos-receipts';
