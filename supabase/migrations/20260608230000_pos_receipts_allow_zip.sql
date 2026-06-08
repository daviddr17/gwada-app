-- DSFinV-K ZIP exports share pos-receipts bucket with receipt PDFs.

update storage.buckets
set
  allowed_mime_types = array['application/pdf', 'application/zip'],
  file_size_limit = 52428800
where id = 'pos-receipts';
