
-- 1. Hacer admin a la usuaria
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'florenciarociozalez@gmail.com'
ON CONFLICT DO NOTHING;

-- 2. Enum para tipo de key
CREATE TYPE public.key_type AS ENUM ('code', 'account', 'link');
CREATE TYPE public.key_status AS ENUM ('available', 'reserved', 'delivered');
CREATE TYPE public.verification_status AS ENUM ('not_submitted', 'awaiting_verification', 'verified', 'rejected', 'manual_review');

-- 3. Tabla product_keys (stock de credenciales)
CREATE TABLE public.product_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  key_type public.key_type NOT NULL DEFAULT 'code',
  content TEXT NOT NULL, -- el código, o "user|pass", o el link
  notes TEXT,
  status public.key_status NOT NULL DEFAULT 'available',
  reserved_for_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  delivered_to_user_id UUID,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_keys_product_status ON public.product_keys(product_id, status);
CREATE INDEX idx_product_keys_order ON public.product_keys(reserved_for_order_id);

ALTER TABLE public.product_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage product keys"
ON public.product_keys FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users see own delivered keys"
ON public.product_keys FOR SELECT
USING (delivered_to_user_id = auth.uid() AND status = 'delivered');

CREATE TRIGGER update_product_keys_updated_at
BEFORE UPDATE ON public.product_keys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Nuevos campos en orders
ALTER TABLE public.orders
  ADD COLUMN public_code TEXT UNIQUE,
  ADD COLUMN exact_amount NUMERIC,
  ADD COLUMN payment_proof_url TEXT,
  ADD COLUMN verification_status public.verification_status NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN verification_attempted_at TIMESTAMPTZ,
  ADD COLUMN verification_notes TEXT,
  ADD COLUMN proof_submitted_at TIMESTAMPTZ,
  ADD COLUMN whatsapp TEXT,
  ADD COLUMN matched_payment_id TEXT;

-- 5. Función para generar public_code corto y monto exacto con microajuste
CREATE OR REPLACE FUNCTION public.set_order_public_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  attempts INT := 0;
  micro INT;
BEGIN
  -- Generar code único TIBA-XXXX
  LOOP
    new_code := 'TIBA-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE public_code = new_code);
    attempts := attempts + 1;
    IF attempts > 10 THEN EXIT; END IF;
  END LOOP;
  NEW.public_code := new_code;

  -- Microajuste: agregar entre 1 y 99 centavos al total para que sea único en una ventana
  micro := (floor(random() * 99) + 1)::int;
  NEW.exact_amount := round(NEW.total::numeric, 0) + (micro::numeric / 100);

  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_set_public_fields
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_order_public_fields();

-- 6. Campo whatsapp en profiles
ALTER TABLE public.profiles ADD COLUMN whatsapp TEXT;

-- 7. Bucket privado payment-proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- 8. Policies del bucket
CREATE POLICY "Users upload own payment proofs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users view own payment proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-proofs'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Admins manage payment proofs"
ON storage.objects FOR ALL
USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'));
