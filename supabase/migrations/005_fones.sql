-- Fones: stock separado das consolas (só controlo de quantidade).
create table if not exists fones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null check (kind in ('auricular', 'fone')),
  price numeric(8,2) not null,
  qty int not null default 0 check (qty >= 0),
  image_url text,
  active boolean not null default true,
  sort int not null default 0
);
create table if not exists fone_movements (
  id uuid primary key default gen_random_uuid(),
  fone_id uuid not null references fones(id) on delete cascade,
  delta int not null,
  note text,
  created_at timestamptz not null default now()
);
alter table fones enable row level security;
alter table fone_movements enable row level security;
create policy "dono total" on fones for all to authenticated using (true) with check (true);
create policy "dono total" on fone_movements for all to authenticated using (true) with check (true);

create or replace function fone_adjust(p_id uuid, p_delta int, p_note text default null) returns int
language plpgsql security invoker as $$
declare n int;
begin
  update fones set qty = qty + p_delta where id = p_id and qty + p_delta >= 0 returning qty into n;
  if n is null then raise exception 'Stock insuficiente'; end if;
  insert into fone_movements (fone_id, delta, note) values (p_id, p_delta, p_note);
  return n;
end $$;

insert into fones (name, kind, price, sort) values
 ('Lenovo LP40 Pro', 'auricular', 15, 1),
 ('Lenovo GM2 Pro', 'auricular', 15, 2),
 ('A9 PRO', 'auricular', 15, 3),
 ('ST Pods Pro', 'auricular', 20, 4),
 ('ST Pods Pro 2ª Geração', 'auricular', 25, 5),
 ('Fones P9', 'fone', 20, 6),
 ('Lenovo TH30', 'fone', 25, 7)
on conflict (name) do nothing;
notify pgrst, 'reload schema';
