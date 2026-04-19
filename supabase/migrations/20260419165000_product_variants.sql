ALTER TYPE public.platform ADD VALUE IF NOT EXISTS 'PS4/PS5';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_tier') THEN
    CREATE TYPE public.account_tier AS ENUM ('general', 'primary', 'secondary');
  END IF;
END $$;

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS account_tier public.account_tier NOT NULL DEFAULT 'general';

UPDATE public.products
SET account_tier = CASE
  WHEN lower(coalesce(genre, '')) LIKE '%secundaria%' THEN 'secondary'::public.account_tier
  WHEN lower(coalesce(genre, '')) LIKE '%primaria%' THEN 'primary'::public.account_tier
  ELSE 'general'::public.account_tier
END
WHERE account_tier = 'general';

CREATE INDEX IF NOT EXISTS idx_products_account_tier ON public.products(account_tier);