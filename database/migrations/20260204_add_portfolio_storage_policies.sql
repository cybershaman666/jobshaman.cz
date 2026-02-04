-- Migration: add storage RLS policies for portfolio bucket
-- Created: 2026-02-04

-- Ensure RLS is enabled on storage objects
ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public read of portfolio images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'portfolio_read_public'
  ) THEN
    CREATE POLICY portfolio_read_public
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'portfolio');
  END IF;
END $$;

-- Allow authenticated users to insert into their own folder: {uid}/filename
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'portfolio_insert_own'
  ) THEN
    CREATE POLICY portfolio_insert_own
      ON storage.objects
      FOR INSERT
      WITH CHECK (
        bucket_id = 'portfolio'
        AND auth.uid()::text = split_part(name, '/', 1)
      );
  END IF;
END $$;

-- Allow authenticated users to update their own files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'portfolio_update_own'
  ) THEN
    CREATE POLICY portfolio_update_own
      ON storage.objects
      FOR UPDATE
      USING (
        bucket_id = 'portfolio'
        AND auth.uid()::text = split_part(name, '/', 1)
      );
  END IF;
END $$;

-- Allow authenticated users to delete their own files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'portfolio_delete_own'
  ) THEN
    CREATE POLICY portfolio_delete_own
      ON storage.objects
      FOR DELETE
      USING (
        bucket_id = 'portfolio'
        AND auth.uid()::text = split_part(name, '/', 1)
      );
  END IF;
END $$;

-- End of migration
