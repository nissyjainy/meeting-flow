-- Allow Chrome extension WebM tab-audio captures in the meetings storage bucket.

update storage.buckets
set allowed_mime_types = array(
  select distinct unnest(
    coalesce(allowed_mime_types, array[]::text[])
      || array['audio/webm', 'video/webm']::text[]
  )
)
where id = 'meetings';
