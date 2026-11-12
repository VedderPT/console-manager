-- Fase 2/4: imagens por modelo, dados extra para anúncios e opções Android

alter table models
  add column if not exists image_path text,      -- ficheiro no bucket model-images
  add column if not exists box_contents text,    -- "Caixa inclui: ..."
  add column if not exists games_extra int;      -- "Adicionamos até N jogos à escolha extra" (Linux)

create table if not exists android_options (
  code text primary key,
  price numeric(8,2) not null,
  microsd text,
  kind text,
  games text,
  max_games text,
  sort int not null default 0
);
alter table android_options enable row level security;
create policy "dono total" on android_options for all to authenticated using (true) with check (true);

insert into android_options (code, price, microsd, kind, games, max_games, sort) values
 ('A', 70,  '128GB', 'BASE',          '3900 jogos retro base', null, 1),
 ('B', 100, '256GB', 'BASE',          '7200 jogos retro base', null, 2),
 ('C', 110, '256GB', 'MISTO',         '3900 base + até 40 à escolha', '100GB', 3),
 ('D', 140, '512GB', 'MISTO',         '7200 base + até 75 à escolha', '200GB', 4),
 ('E', 80,  '128GB', 'PERSONALIZADO', 'Até 50 jogos à escolha', '100GB', 5),
 ('F', 120, '256GB', 'PERSONALIZADO', 'Até 100 jogos à escolha', '200GB', 6),
 ('G', 160, '512GB', 'PERSONALIZADO', 'Até 200 jogos à escolha', '420GB', 7),
 ('H', 300, '1TB',   'PERSONALIZADO', 'Até 400 jogos à escolha', '900GB', 8)
on conflict (code) do nothing;

-- Imagens dos modelos: leitura pública (são fotos de catálogo), escrita só para o dono
insert into storage.buckets (id, name, public) values ('model-images', 'model-images', true)
  on conflict (id) do nothing;
create policy "imagens leitura publica" on storage.objects for select using (bucket_id = 'model-images');
create policy "dono insere imagens" on storage.objects for insert to authenticated with check (bucket_id = 'model-images');
create policy "dono altera imagens" on storage.objects for update to authenticated using (bucket_id = 'model-images');
create policy "dono apaga imagens" on storage.objects for delete to authenticated using (bucket_id = 'model-images');
