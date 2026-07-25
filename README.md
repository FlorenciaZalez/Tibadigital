# TIBADIGITAL

## Flujo seguro de compra y entrega

La migración `20260724190000_secure_checkout_and_fulfillment.sql` es obligatoria
antes de desplegar las funciones actuales. Implementa:

- creación transaccional del pedido con precios leídos desde la base;
- validación de stock al confirmar el carrito;
- asignación atómica de cuentas mediante `FOR UPDATE SKIP LOCKED`;
- actualización automática de `products.stock` al cambiar `product_keys`;
- carga segura de comprobantes mediante RPC;
- trazabilidad separada de email, Google Sheets y errores de entrega.

La orden solo pasa a `delivered` cuando el email y Google Sheets terminaron
correctamente. Si un proveedor falla, queda en `paid` y puede reintentarse desde
Mis pedidos sin consumir otra cuenta ni duplicar un email que ya fue enviado.

Mercado Pago utiliza `mercadopago-webhook`, por lo que la acreditación no depende
de que el comprador vuelva al sitio. Transferencia continúa requiriendo aprobación
manual. Binance Pay utiliza su webhook firmado.

### Secrets de entrega

Tomar como base `supabase/functions/fulfillment.env.example`. Como mínimo deben
estar configurados `RESEND_API_KEY`, `EMAIL_FROM` con dominio verificado y todas
las variables `GOOGLE_*`. Sin ellos, por seguridad, el pedido queda pagado pero
pendiente de completar en vez de figurar como entregado.

### Orden de despliegue

1. Aplicar todas las migraciones pendientes.
2. Configurar los secrets de email, Google Sheets y proveedores de pago.
3. Desplegar `deliver-order`, `retry-delivery`, `verify-payment`,
   `approve-order-admin`, `create-mercadopago-preference`,
   `confirm-mercadopago-payment`, `mercadopago-webhook`,
   `create-binance-order` y `binance-pay-webhook`.
4. Hacer una compra controlada por cada medio de pago y comprobar orden, email,
   credencial entregada, stock visible y checkbox de Google Sheets.

## Binance Pay

El proyecto ahora soporta checkout oficial de Binance Pay con webhook firmado y entrega automatica cuando el pago queda acreditado.

### Que agrega

- Un checkout dedicado en `/checkout/binance/:orderId`.
- Una edge function `create-binance-order` para crear o reusar la orden en Binance Pay.
- Una edge function `binance-pay-webhook` para confirmar el pago y disparar la entrega.
- La migracion `supabase/migrations/20260702120000_add_payment_provider_meta.sql`, que guarda el estado efimero del checkout en `orders.payment_provider_meta`.

### Variables de entorno

Tomar como base `supabase/functions/.env.binance-pay.example`.

- `BINANCE_PAY_API_KEY`: API key de merchant emitida por Binance Pay.
- `BINANCE_PAY_SECRET_KEY`: secret key asociada a esa API key.
- `BINANCE_PAY_USDT_RATE_ARS`: cotizacion servidor para convertir el monto de la orden de ARS a USDT.
- `BINANCE_PAY_WEBHOOK_CERT_SN`: opcional. Serial del certificado del webhook.
- `BINANCE_PAY_WEBHOOK_PUBLIC_KEY`: opcional. Public key PEM del webhook. Si no se informa, la function consulta certificados a Binance Pay.

### Pasos de activacion

1. Aplicar la migracion nueva en el proyecto remoto de Supabase.
2. Cargar los secrets de Binance Pay en Edge Functions.
3. Desplegar `create-binance-order` y `binance-pay-webhook`.
4. Configurar en Binance Merchant el webhook apuntando a `https://<tu-proyecto>.supabase.co/functions/v1/binance-pay-webhook`.
5. Probar una orden real en sandbox o merchant test antes de habilitarlo en produccion.

## Google Sheets sync

La entrega de cuentas puede marcar automaticamente una fila de Google Sheets cuando una key queda en estado `delivered`.

### Que usa para encontrar la fila

- El importador de cuentas guarda el `CODIGO` del CSV como identificador de origen.
- Si la base remota ya tiene `product_keys.source_code`, lo guarda en esa columna.
- Si la base remota todavia no tiene esa migracion, lo guarda oculto dentro de `notes` y la edge function lo sigue pudiendo leer igual.

### Variables de entorno de la edge function

Tomar como base [supabase/functions/.env.google-sheets.example](/Users/florenciazalez/Desktop/Desktop/Proyectos/TIBADIGITAL/supabase/functions/.env.google-sheets.example).

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: email de la service account de Google Cloud.
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: private key completa del JSON de la service account, manteniendo los `\n`.
- `GOOGLE_SHEETS_SPREADSHEET_ID`: ID del spreadsheet.
- `GOOGLE_SHEETS_TAB_NAME`: nombre exacto de la pestaña.
- `GOOGLE_SHEETS_CODE_COLUMN`: columna donde vive `CODIGO`. Por defecto `A`.
- `GOOGLE_SHEETS_CHECKBOX_COLUMN`: columna del checkbox que marca vendida la fila. Por defecto `H`.

### Preparacion en Google

1. Crear una service account en Google Cloud.
2. Habilitar Google Sheets API.
3. Compartir la hoja con el email de la service account con permiso de edicion.
4. Confirmar que la columna de `CODIGO` y la del checkbox coincidan con las variables configuradas.

### Prueba sugerida

1. Copiar las variables del ejemplo a la configuracion de Secrets de Supabase Edge Functions.
2. Importar una cuenta desde Admin con un `CODIGO` real.
3. Completar una entrega de prueba para ese producto.
4. Verificar que la fila correspondiente en Google Sheets quede con el checkbox en `TRUE`.

### Nota sobre migraciones

La migracion [supabase/migrations/20260419190000_product_keys_source_tracking.sql](/Users/florenciazalez/Desktop/Desktop/Proyectos/TIBADIGITAL/supabase/migrations/20260419190000_product_keys_source_tracking.sql) agrega `source_code` y `source_sheet` a `product_keys`.

Mientras esa migracion no exista en el proyecto remoto, el sistema sigue funcionando con un fallback legacy en `notes`. Cuando la migracion este aplicada, las nuevas importaciones pasan a usar la columna dedicada automaticamente.
