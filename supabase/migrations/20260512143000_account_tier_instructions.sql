CREATE TABLE IF NOT EXISTS public.account_tier_instructions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier public.account_tier NOT NULL UNIQUE,
  instruction_text TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.account_tier_instructions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'account_tier_instructions'
      AND policyname = 'Admins manage account tier instructions'
  ) THEN
    CREATE POLICY "Admins manage account tier instructions"
      ON public.account_tier_instructions FOR ALL
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

INSERT INTO public.account_tier_instructions (tier)
VALUES
  ('primary'),
  ('secondary'),
  ('plus')
ON CONFLICT (tier) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_account_tier_instructions_updated'
  ) THEN
    CREATE TRIGGER trg_account_tier_instructions_updated
      BEFORE UPDATE ON public.account_tier_instructions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;