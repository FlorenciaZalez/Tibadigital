alter table public.products
add column if not exists is_preventa boolean not null default false;