UPDATE public.products
SET account_tier = 'primary'::public.account_tier
WHERE account_tier = 'general'::public.account_tier;

ALTER TABLE public.products
ALTER COLUMN account_tier SET DEFAULT 'primary'::public.account_tier;