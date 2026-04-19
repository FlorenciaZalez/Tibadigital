# TIBADIGITAL

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
