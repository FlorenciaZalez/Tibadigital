ALTER TABLE public.product_keys
  ADD COLUMN IF NOT EXISTS initial_verification_code TEXT;

COMMENT ON COLUMN public.product_keys.initial_verification_code IS
  'Código inicial reservado en la web de códigos y entregado junto con la cuenta.';
