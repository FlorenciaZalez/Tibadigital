ALTER TYPE public.account_tier ADD VALUE IF NOT EXISTS 'plus';

UPDATE public.products
SET account_tier = 'plus'::public.account_tier,
    is_ps_plus = true
WHERE is_ps_plus = true
  AND account_tier <> 'plus'::public.account_tier;