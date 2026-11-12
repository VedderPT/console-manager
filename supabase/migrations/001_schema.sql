-- Console Manager: esquema inicial (Fase 1)
-- Um único utilizador (o dono da loja). Desativar registos públicos em Supabase > Authentication.

create type system_type as enum ('linux', 'android');
create type unit_status as enum ('available', 'reserved', 'sold');
create type platform_type as enum ('olx', 'wallapop', 'vinted', 'marketplace', 'whatsapp');
create type listing_status as enum ('draft', 'to_publish', 'active', 'to_hide', 'hidden', 'expired');
create type task_status as enum ('open', 'done', 'dismissed');
create type request_status as enum ('new', 'contacted', 'confirmed', 'shipped', 'cancelled');

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Modelos
create table models (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  name text not null unique,
  system system_type not null,
  shipping_text text,
  bag_price numeric(8,2),
  accessory text,
  os_frontend text,
  specs text,
  games_64 text,
  games_128 text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Versões e preços (64GB/128GB; 8GB+128GB, Pro, Max...)
create table model_versions (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references models(id) on delete cascade,
  label text not null,
  price numeric(8,2) not null,
  sort int not null default 0,
  unique (model_id, label)
);
create index on model_versions (model_id);

-- Cores existentes por modelo
create table colors (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references models(id) on delete cascade,
  name text not null,
  note text,
  unique (model_id, name)
);
create index on colors (model_id);

-- Uma consola física = uma linha. O stock de um modelo é o número de unidades disponíveis.
create table units (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references models(id) on delete restrict,
  version_id uuid references model_versions(id) on delete set null,
  color_id uuid not null references colors(id) on delete restrict,
  status unit_status not null default 'available',
  notes text,
  sold_at timestamptz,
  sold_channel platform_type,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on units (model_id, status);
create index on units (color_id, status);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid references units(id) on delete set null,
  model_id uuid not null references models(id) on delete cascade,
  kind text not null check (kind in ('in', 'sale', 'reserve', 'release', 'adjust')),
  channel platform_type,
  note text,
  created_at timestamptz not null default now()
);
create index on stock_movements (model_id, created_at desc);

-- Fotos (os ficheiros ficam no Google Drive)
create table media (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references models(id) on delete cascade,
  color_id uuid references colors(id) on delete set null,
  kind text not null check (kind in ('all_colors', 'color', 'canva_page', 'other')),
  drive_file_id text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index on media (model_id, position);

create table listing_templates (
  id uuid primary key default gen_random_uuid(),
  platform platform_type not null,
  system system_type not null,
  body text not null,
  updated_at timestamptz not null default now(),
  unique (platform, system)
);

-- Anúncios por plataforma: um por modelo (OLX, Wallapop, Marketplace, WhatsApp) ou por unidade (Vinted)
create table platform_listings (
  id uuid primary key default gen_random_uuid(),
  platform platform_type not null,
  model_id uuid references models(id) on delete cascade,
  unit_id uuid references units(id) on delete cascade,
  status listing_status not null default 'draft',
  external_id text,
  external_url text,
  published_at timestamptz,
  expires_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (model_id is not null or unit_id is not null)
);
create index on platform_listings (platform, status);
create index on platform_listings (model_id);
create index on platform_listings (unit_id);
-- evita anúncios duplicados do mesmo modelo/unidade na mesma plataforma
create unique index platform_listings_model_unique on platform_listings (platform, model_id)
  where unit_id is null and status <> 'hidden';
create unique index platform_listings_unit_unique on platform_listings (platform, unit_id)
  where unit_id is not null and status <> 'hidden';

create table listing_content (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references platform_listings(id) on delete cascade,
  title text not null,
  body text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
create index on listing_content (listing_id);

-- Fila de trabalho: por publicar, por ocultar, por renovar, por atualizar preço
create table tasks (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('publish', 'hide', 'renew', 'update_price')),
  listing_id uuid references platform_listings(id) on delete cascade,
  status task_status not null default 'open',
  due_at timestamptz,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index on tasks (status, kind);

create table sync_logs (
  id uuid primary key default gen_random_uuid(),
  platform platform_type not null,
  action text not null,
  ok boolean not null,
  detail text,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table customer_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text not null,
  address text not null,
  postal_code text not null check (postal_code ~ '^[0-9]{4}-[0-9]{3}$'),
  city text not null,
  model_id uuid references models(id) on delete set null,
  color_id uuid references colors(id) on delete set null,
  microsd text,
  configuration text,
  consent boolean not null check (consent),
  status request_status not null default 'new',
  created_at timestamptz not null default now()
);
create index on customer_requests (status, created_at desc);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- updated_at
create trigger models_updated before update on models for each row execute function set_updated_at();
create trigger units_updated before update on units for each row execute function set_updated_at();
create trigger listings_updated before update on platform_listings for each row execute function set_updated_at();

-- Stock por modelo e cor (só interno)
create view model_stock with (security_invoker = true) as
select m.id as model_id, m.name as model, c.id as color_id, c.name as color,
       count(u.id) filter (where u.status = 'available') as available,
       count(u.id) filter (where u.status = 'reserved') as reserved
from models m
join colors c on c.model_id = m.id
left join units u on u.color_id = c.id
group by m.id, m.name, c.id, c.name;

-- "Vendido": escolhe uma unidade disponível, marca-a e regista o movimento
create or replace function sell_unit(p_color uuid, p_channel platform_type default null, p_version uuid default null)
returns uuid language plpgsql security invoker as $$
declare v_unit units%rowtype;
begin
  select * into v_unit from units
   where color_id = p_color and status = 'available'
     and (p_version is null or version_id = p_version)
   order by created_at limit 1 for update skip locked;
  if not found then
    raise exception 'sem stock disponível para esta cor';
  end if;
  update units set status = 'sold', sold_at = now(), sold_channel = p_channel where id = v_unit.id;
  insert into stock_movements (unit_id, model_id, kind, channel) values (v_unit.id, v_unit.model_id, 'sale', p_channel);
  return v_unit.id;
end $$;

-- Segurança: RLS em tudo. O utilizador autenticado (o dono) acede a tudo;
-- o público só pode submeter pedidos de clientes e ler modelos/cores ativos (sem quantidades).
do $$
declare t text;
begin
  foreach t in array array['models','model_versions','colors','units','stock_movements','media','listing_templates',
    'platform_listings','listing_content','tasks','sync_logs','notifications','settings','customer_requests','audit_log']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "dono total" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

create policy "publico le modelos ativos" on models for select to anon using (active);
create policy "publico le versoes" on model_versions for select to anon using (true);
create policy "publico le cores" on colors for select to anon using (true);
create policy "publico submete pedidos" on customer_requests for insert to anon with check (consent);
