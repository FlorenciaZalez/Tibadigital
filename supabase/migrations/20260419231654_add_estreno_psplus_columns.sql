ALTER TABLE products ADD COLUMN IF NOT EXISTS is_estreno boolean NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_ps_plus boolean NOT NULL DEFAULT false;
