CREATE TABLE IF NOT EXISTS public.reseller_accounts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  client_code TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reseller_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own reseller account" ON public.reseller_accounts;
CREATE POLICY "Users see own reseller account"
  ON public.reseller_accounts
  FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage reseller accounts" ON public.reseller_accounts;
CREATE POLICY "Admins manage reseller accounts"
  ON public.reseller_accounts
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

REVOKE INSERT, UPDATE, DELETE ON public.reseller_accounts FROM anon, authenticated;

