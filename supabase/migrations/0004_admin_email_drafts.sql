-- Bulk email compose drafts (persisted; actual send is stubbed)
CREATE TABLE public.admin_email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  recipient_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_email_drafts TO authenticated;
GRANT ALL ON public.admin_email_drafts TO service_role;
ALTER TABLE public.admin_email_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage email drafts" ON public.admin_email_drafts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX admin_email_drafts_created_at_idx ON public.admin_email_drafts (created_at DESC);