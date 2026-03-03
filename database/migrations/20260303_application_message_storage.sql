SET lock_timeout = '5s';
SET statement_timeout = '5min';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT
  'application-message-files',
  'application-message-files',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]::text[]
WHERE NOT EXISTS (
  SELECT 1
  FROM storage.buckets
  WHERE id = 'application-message-files'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'application_message_files_select_authenticated'
  ) THEN
    CREATE POLICY application_message_files_select_authenticated
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id = 'application-message-files');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'application_message_files_insert_authenticated'
  ) THEN
    CREATE POLICY application_message_files_insert_authenticated
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'application-message-files');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'application_message_files_update_authenticated'
  ) THEN
    CREATE POLICY application_message_files_update_authenticated
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'application-message-files')
      WITH CHECK (bucket_id = 'application-message-files');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'application_message_files_delete_authenticated'
  ) THEN
    CREATE POLICY application_message_files_delete_authenticated
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'application-message-files');
  END IF;
END
$$;
