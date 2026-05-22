ALTER TABLE public.account_tier_instructions
ADD COLUMN IF NOT EXISTS platform public.platform;

UPDATE public.account_tier_instructions
SET platform = 'PS5'
WHERE platform IS NULL;

ALTER TABLE public.account_tier_instructions
ALTER COLUMN platform SET NOT NULL;

ALTER TABLE public.account_tier_instructions
DROP CONSTRAINT IF EXISTS account_tier_instructions_tier_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_tier_instructions_tier_platform
  ON public.account_tier_instructions(tier, platform);

INSERT INTO public.account_tier_instructions (tier, platform)
VALUES
  ('primary', 'PS4'),
  ('primary', 'PS5'),
  ('secondary', 'PS4'),
  ('secondary', 'PS5'),
  ('plus', 'PS4'),
  ('plus', 'PS5')
ON CONFLICT (tier, platform) DO NOTHING;