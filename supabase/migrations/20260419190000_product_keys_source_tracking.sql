ALTER TABLE public.product_keys
ADD COLUMN IF NOT EXISTS source_code TEXT,
ADD COLUMN IF NOT EXISTS source_sheet TEXT;

CREATE INDEX IF NOT EXISTS idx_product_keys_source_code ON public.product_keys(source_code);