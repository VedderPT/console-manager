-- Loja pública: catálogo (só consolas em stock, sem quantidades), pedidos de clientes e aviso no telemóvel (ntfy).
-- O tópico ntfy NÃO fica aqui: guarda-se em settings (key 'ntfy_topic') só na base de dados.

create extension if not exists pg_net with schema extensions;

-- Consola encomendada ao fornecedor: texto com a estimativa (ex.: 'final de novembro'). Vazio = não está em reposição.
alter table models add column if not exists restock_eta text;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  created_at timestamptz not null default now(),
  status text not null default 'novo' check (status in ('novo', 'contactado', 'confirmado', 'enviado', 'cancelado')),
  name text not null,
  phone text not null,
  email text,
  model_id uuid references models(id) on delete set null,
  model_name text not null,
  version_label text,
  color text,
  option_code text,
  extras text,
  total numeric(8,2),
  delivery text not null check (delivery in ('maos_faro', 'registado', 'cobranca')),
  payment text,
  address text,
  notes text,
  preorder boolean not null default false,
  consent_at timestamptz not null
);
create index if not exists orders_status_idx on orders (status, created_at desc);
alter table orders enable row level security;
drop policy if exists "dono total" on orders;
create policy "dono total" on orders for all to authenticated using (true) with check (true);

-- A inserção direta anónima (sem limites anti-spam) é substituída por submit_order().
drop policy if exists "publico submete pedidos" on customer_requests;

-- Catálogo público: só modelos ativos com stock disponível. Nunca devolve quantidades.
create or replace function shop_catalog() returns jsonb
language sql security definer stable set search_path = public, storage as $$
  select jsonb_build_object(
    'models', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'brand', m.brand, 'name', m.name, 'system', m.system,
        'in_stock', s.in_stock, 'restock_eta', m.restock_eta,
        'os_frontend', m.os_frontend, 'specs', m.specs, 'games_url', m.games_url,
        'games_64', m.games_64, 'games_128', m.games_128, 'bag_price', m.bag_price,
        'accessory', m.accessory, 'shipping_text', m.shipping_text, 'image_path', m.image_path,
        'colors', coalesce(case when s.in_stock
            then (select jsonb_agg(distinct c.name) from units u join colors c on c.id = u.color_id
                  where u.model_id = m.id and u.status = 'available')
            else (select jsonb_agg(c.name order by c.name) from colors c where c.model_id = m.id) end, '[]'::jsonb),
        'versions', coalesce((
          select jsonb_agg(jsonb_build_object('id', v.id, 'label', v.label, 'price', v.price) order by v.sort)
          from model_versions v
          where v.model_id = m.id and (
            m.system = 'linux' or not exists (select 1 from units u where u.model_id = m.id and u.status = 'available' and u.version_id is not null)
            or exists (select 1 from units u where u.model_id = m.id and u.status = 'available' and u.version_id = v.id))
        ), '[]'::jsonb),
        'photos', coalesce((
          select jsonb_agg(o.name order by o.name) from storage.objects o
          where o.bucket_id = 'model-images' and o.name like 'gallery/' || m.id::text || '/%' and o.name not like '%/.%'
        ), '[]'::jsonb)
      ) order by m.system, m.name)
      from models m
      cross join lateral (select exists (select 1 from units u where u.model_id = m.id and u.status = 'available') as in_stock) s
      where m.active and (s.in_stock or m.restock_eta is not null)
    ), '[]'::jsonb),
    'options', coalesce((select jsonb_agg(to_jsonb(o) order by o.sort) from android_options o), '[]'::jsonb)
  );
$$;

-- Submissão de pedido: valida, limita spam, calcula o total estimado no servidor e avisa o dono.
create or replace function submit_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(coalesce(p->>'name', ''));
  v_phone text := regexp_replace(coalesce(p->>'phone', ''), '[^0-9+]', '', 'g');
  v_email text := nullif(btrim(coalesce(p->>'email', '')), '');
  v_color text := nullif(btrim(coalesce(p->>'color', '')), '');
  v_delivery text := coalesce(p->>'delivery', '');
  v_payment text := nullif(btrim(coalesce(p->>'payment', '')), '');
  v_address text := nullif(btrim(coalesce(p->>'address', '')), '');
  v_notes text := nullif(btrim(coalesce(p->>'notes', '')), '');
  v_code text := nullif(btrim(coalesce(p->>'option', '')), '');
  v_model models%rowtype;
  v_ver model_versions%rowtype;
  v_opt android_options%rowtype;
  v_total numeric := 0;
  v_extras text[] := '{}';
  v_x text;
  v_ref text;
  v_topic text;
  v_opt_label text;
  v_in_stock boolean;
begin
  -- armadilha anti-bot: campo escondido preenchido => finge sucesso sem guardar
  if coalesce(p->>'hp', '') <> '' then
    return jsonb_build_object('ok', true, 'ref', 'ST-000000', 'total', 0);
  end if;
  if coalesce(nullif(p->>'elapsed', '')::numeric, 0) < 3000 then
    raise exception 'Demasiado rápido. Tenta novamente.';
  end if;
  if length(v_name) < 2 or length(v_name) > 80 then raise exception 'Indica o teu nome.'; end if;
  if v_phone !~ '^\+?[0-9]{9,15}$' then raise exception 'Indica um telemóvel válido.'; end if;
  if v_email is not null and (length(v_email) > 120 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'O e-mail não parece válido.';
  end if;
  if coalesce((p->>'consent')::boolean, false) is not true then raise exception 'É preciso aceitar o tratamento dos dados.'; end if;
  if v_delivery not in ('maos_faro', 'registado', 'cobranca') then raise exception 'Escolhe a forma de entrega.'; end if;
  if v_payment is not null and v_payment not in ('mbway', 'transferencia', 'maos', 'cobranca') then raise exception 'Forma de pagamento inválida.'; end if;
  if v_delivery <> 'maos_faro' and (v_address is null or length(v_address) < 8) then raise exception 'Indica a morada para o envio.'; end if;
  if length(coalesce(v_address, '')) > 200 or length(coalesce(v_notes, '')) > 500 or length(coalesce(v_color, '')) > 40 then
    raise exception 'Texto demasiado longo.';
  end if;

  if (select count(*) from orders where phone = v_phone and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Já recebemos o teu pedido. Vamos contactar-te em breve.';
  end if;
  if (select count(*) from orders where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Muitos pedidos neste momento. Tenta daqui a pouco ou fala connosco por WhatsApp.';
  end if;

  select * into v_model from models where id = (p->>'model_id')::uuid and active;
  v_in_stock := found and exists (select 1 from units where model_id = v_model.id and status = 'available');
  if not found or (not v_in_stock and v_model.restock_eta is null) then
    raise exception 'Este modelo já não está disponível.';
  end if;
  if v_in_stock and v_color is not null and not exists (
    select 1 from units u join colors c on c.id = u.color_id
    where u.model_id = v_model.id and u.status = 'available' and c.name = v_color) then
    raise exception 'Essa cor já não está disponível.';
  end if;

  if nullif(p->>'version_id', '') is not null then
    select * into v_ver from model_versions where id = (p->>'version_id')::uuid and model_id = v_model.id;
  else
    select * into v_ver from model_versions where model_id = v_model.id order by price limit 1;
  end if;
  if v_ver.id is not null then v_total := v_total + v_ver.price; end if;

  if v_code is not null then
    if v_model.system <> 'android' then raise exception 'Opção inválida.'; end if;
    if v_code = 'X' then
      v_total := v_total + 30; v_opt_label := 'X · Apenas configuração';
    else
      select * into v_opt from android_options where code = v_code;
      if not found then raise exception 'Opção inválida.'; end if;
      v_total := v_total + v_opt.price;
      v_opt_label := v_opt.code || ' · MicroSD ' || coalesce(v_opt.microsd, '') || ' ' || coalesce(v_opt.games, '');
    end if;
  end if;

  for v_x in select jsonb_array_elements_text(coalesce(p->'extras', '[]'::jsonb)) loop
    if v_x = 'bolsa' and v_model.bag_price is not null then
      v_total := v_total + v_model.bag_price; v_extras := v_extras || 'Bolsa de armazenamento';
    elsif v_x = 'capa' and v_model.accessory ilike 'capa%' then
      v_total := v_total + coalesce(substring(v_model.accessory from '([0-9]+)\s*€')::numeric, 0);
      v_extras := v_extras || 'Capa de silicone';
    end if;
  end loop;

  v_ref := 'ST-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into orders (ref, name, phone, email, model_id, model_name, version_label, color, option_code, extras, total,
                      delivery, payment, address, notes, preorder, consent_at)
  values (v_ref, v_name, v_phone, v_email, v_model.id, v_model.name, v_ver.label, v_color, v_opt_label,
          nullif(array_to_string(v_extras, ', '), ''), v_total, v_delivery, v_payment, v_address, v_notes, not v_in_stock, now());

  -- aviso no telemóvel (ntfy). Sem dados pessoais do cliente: os detalhes ficam na app.
  select value #>> '{}' into v_topic from settings where key = 'ntfy_topic';
  if v_topic is not null then
    begin
      perform net.http_post(
        url := 'https://ntfy.sh',
        body := jsonb_build_object('topic', v_topic, 'title', case when v_in_stock then 'Novo pedido ' else 'Nova pré-reserva ' end || v_ref,
          'message', v_model.name || ' · ' || v_total || ' €', 'tags', jsonb_build_array('shopping_cart'), 'priority', 4,
          'click', 'https://console-manager.pages.dev/pedidos/'));
    exception when others then null;
    end;
  end if;

  return jsonb_build_object('ok', true, 'ref', v_ref, 'total', v_total, 'preorder', not v_in_stock);
end $$;

revoke all on function shop_catalog() from public;
revoke all on function submit_order(jsonb) from public;
grant execute on function shop_catalog() to anon, authenticated;
grant execute on function submit_order(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
