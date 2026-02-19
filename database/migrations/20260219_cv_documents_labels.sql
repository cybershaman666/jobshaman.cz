-- CV document labels and locale metadata.
SET lock_timeout = '5s';
SET statement_timeout = '5min';
SET idle_in_transaction_session_timeout = '2min';

ALTER TABLE public.cv_documents
    ADD COLUMN IF NOT EXISTS label text;

ALTER TABLE public.cv_documents
    ADD COLUMN IF NOT EXISTS locale text;

ALTER TABLE public.cv_documents
    ADD COLUMN IF NOT EXISTS parsed_at timestamptz;
