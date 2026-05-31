-- Dokumente: nur PDF, Word, Pages, CSV (Sicherheit).

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'application/csv',
  'text/comma-separated-values',
  'application/vnd.apple.pages',
  'application/x-iwork-pages-sffpages',
  'application/vnd.apple.iwork',
  'application/zip',
  'application/x-zip-compressed'
]
where id = 'restaurant-documents';
