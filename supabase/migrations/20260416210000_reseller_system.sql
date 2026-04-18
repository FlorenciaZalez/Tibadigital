-- ============ RESELLER CODES ============
CREATE TABLE public.reseller_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reseller_codes ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins manage reseller codes"
  ON public.reseller_codes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Anyone can check if a code exists and is available (for signup validation)
CREATE POLICY "Anyone can check available codes"
  ON public.reseller_codes FOR SELECT
  USING (used_by IS NULL);

-- ============ ADD RESELLER PRICE TO PRODUCTS ============
ALTER TABLE public.products
  ADD COLUMN reseller_price NUMERIC(10,2) CHECK (reseller_price >= 0);
