-- Audit log for admin subscription changes
CREATE TABLE IF NOT EXISTS public.admin_subscription_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid,
  target_type text,
  target_id uuid,
  action text NOT NULL,
  admin_user_id uuid,
  admin_email text,
  before jsonb,
  after jsonb,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_subscription_audit_pkey PRIMARY KEY (id),
  CONSTRAINT admin_subscription_audit_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id),
  CONSTRAINT admin_subscription_audit_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS admin_subscription_audit_subscription_id_idx
  ON public.admin_subscription_audit (subscription_id);

ALTER TABLE public.admin_subscription_audit ENABLE ROW LEVEL SECURITY;
