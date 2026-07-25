-- Secure checkout, atomic stock allocation and fulfillment observability.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_email TEXT,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sheets_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fulfillment_error TEXT;

-- Keep fulfillment independent from future changes to the Auth user record.
UPDATE public.orders o
SET delivery_email = lower(u.email)
FROM auth.users u
WHERE u.id = o.user_id
  AND o.delivery_email IS NULL
  AND u.email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_matched_payment_id_unique
  ON public.orders (matched_payment_id)
  WHERE matched_payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_product_stock(_product_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.products
  SET stock = (
    SELECT count(*)::int
    FROM public.product_keys
    WHERE product_id = _product_id
      AND status = 'available'
  )
  WHERE id = _product_id;
$$;

CREATE OR REPLACE FUNCTION public.sync_product_stock_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_product_stock(OLD.product_id);
    RETURN OLD;
  END IF;

  PERFORM public.sync_product_stock(NEW.product_id);
  IF TG_OP = 'UPDATE' AND OLD.product_id IS DISTINCT FROM NEW.product_id THEN
    PERFORM public.sync_product_stock(OLD.product_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_keys_sync_visible_stock ON public.product_keys;
CREATE TRIGGER product_keys_sync_visible_stock
AFTER INSERT OR UPDATE OF status, product_id OR DELETE
ON public.product_keys
FOR EACH ROW EXECUTE FUNCTION public.sync_product_stock_trigger();

-- Reconcile existing visible stock once when this migration is applied.
UPDATE public.products p
SET stock = (
  SELECT count(*)::int
  FROM public.product_keys pk
  WHERE pk.product_id = p.id
    AND pk.status = 'available'
);

CREATE OR REPLACE FUNCTION public.create_checkout_order(
  _payment_method TEXT,
  _whatsapp TEXT DEFAULT NULL,
  _notes TEXT DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _order public.orders;
  _total NUMERIC(10,2);
  _item RECORD;
  _available INT;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF _payment_method NOT IN ('mercadopago', 'transferencia', 'binance') THEN
    RAISE EXCEPTION 'invalid payment method';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.cart_items WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'cart is empty';
  END IF;

  FOR _item IN
    SELECT ci.product_id, ci.quantity, p.title, p.is_active,
      COALESCE(p.discount_price, p.price) AS unit_price
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id
    WHERE ci.user_id = _user_id
    FOR SHARE OF p
  LOOP
    IF NOT _item.is_active THEN
      RAISE EXCEPTION 'product % is not active', _item.title;
    END IF;

    SELECT count(*)::int INTO _available
    FROM public.product_keys
    WHERE product_id = _item.product_id
      AND status = 'available';

    IF _available < _item.quantity THEN
      RAISE EXCEPTION 'insufficient stock for %', _item.title;
    END IF;
  END LOOP;

  SELECT round(sum(ci.quantity * COALESCE(p.discount_price, p.price)), 2)
  INTO _total
  FROM public.cart_items ci
  JOIN public.products p ON p.id = ci.product_id
  WHERE ci.user_id = _user_id;

  INSERT INTO public.orders (
    user_id, delivery_email, total, payment_method, whatsapp, notes, status
  ) VALUES (
    _user_id, lower(auth.jwt() ->> 'email'), _total, _payment_method, NULLIF(trim(_whatsapp), ''),
    NULLIF(trim(_notes), ''), 'pending'
  )
  RETURNING * INTO _order;

  INSERT INTO public.order_items (
    order_id, product_id, product_title, unit_price, quantity
  )
  SELECT _order.id, ci.product_id, p.title,
    COALESCE(p.discount_price, p.price), ci.quantity
  FROM public.cart_items ci
  JOIN public.products p ON p.id = ci.product_id
  WHERE ci.user_id = _user_id;

  DELETE FROM public.cart_items WHERE user_id = _user_id;
  RETURN _order;
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout_order(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_order_payment_proof(
  _order_id UUID,
  _storage_path TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF _storage_path NOT LIKE _user_id::text || '/%' THEN
    RAISE EXCEPTION 'invalid proof path';
  END IF;

  UPDATE public.orders
  SET payment_proof_url = _storage_path,
      proof_submitted_at = now(),
      verification_status = 'awaiting_verification',
      verification_notes = 'Comprobante recibido'
  WHERE id = _order_id
    AND user_id = _user_id
    AND payment_method = 'transferencia'
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order is not eligible for proof submission';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_order_payment_proof(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_order_payment_proof(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_paid_order_keys(_order_id UUID)
RETURNS SETOF public.product_keys
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order public.orders;
  _item RECORD;
  _key_ids UUID[] := '{}';
  _selected_ids UUID[];
BEGIN
  SELECT * INTO _order
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF _order.id IS NULL THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF _order.status = 'delivered' THEN
    RETURN QUERY
      SELECT * FROM public.product_keys
      WHERE reserved_for_order_id = _order_id
        AND status = 'delivered'
      ORDER BY delivered_at;
    RETURN;
  END IF;

  IF _order.status <> 'paid' OR _order.verification_status <> 'verified' THEN
    RAISE EXCEPTION 'payment is not verified';
  END IF;

  -- Idempotent retry after keys were claimed but a downstream service failed.
  IF EXISTS (
    SELECT 1 FROM public.product_keys
    WHERE reserved_for_order_id = _order_id
      AND status = 'delivered'
  ) THEN
    RETURN QUERY
      SELECT * FROM public.product_keys
      WHERE reserved_for_order_id = _order_id
        AND status = 'delivered'
      ORDER BY delivered_at;
    RETURN;
  END IF;

  FOR _item IN
    SELECT product_id, product_title, quantity
    FROM public.order_items
    WHERE order_id = _order_id
    ORDER BY id
  LOOP
    SELECT array_agg(id) INTO _selected_ids
    FROM (
      SELECT id
      FROM public.product_keys
      WHERE product_id = _item.product_id
        AND status = 'available'
      ORDER BY created_at, id
      FOR UPDATE SKIP LOCKED
      LIMIT _item.quantity
    ) selected;

    IF coalesce(array_length(_selected_ids, 1), 0) <> _item.quantity THEN
      RAISE EXCEPTION 'insufficient stock for %', _item.product_title;
    END IF;

    _key_ids := _key_ids || _selected_ids;
  END LOOP;

  UPDATE public.product_keys
  SET status = 'delivered',
      reserved_for_order_id = _order_id,
      delivered_to_user_id = _order.user_id,
      delivered_at = now()
  WHERE id = ANY(_key_ids);

  RETURN QUERY
    SELECT * FROM public.product_keys
    WHERE id = ANY(_key_ids)
    ORDER BY delivered_at, id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_paid_order_keys(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_paid_order_keys(UUID) TO service_role;
