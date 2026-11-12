"""Gera supabase/seed.sql a partir do Excel (modelos, versões, cores). Stock NÃO é importado."""
import openpyxl, sys
src = sys.argv[1] if len(sys.argv) > 1 else 'scripts/Consolas_Modelos_Precos_Stock.xlsx'
out = sys.argv[2] if len(sys.argv) > 2 else 'supabase/seed.sql'
wb = openpyxl.load_workbook(src, data_only=True)
q = lambda v: 'null' if v in (None, '') else "'" + str(v).replace("'", "''") + "'"
L = ['-- Gerado por scripts/make_seed.py. Não editar à mão.', 'begin;']
for r in wb['Modelos'].iter_rows(min_row=2, values_only=True):
    if not r[1]: continue
    marca, nome, sis, portes, bolsa, acc, so, j64, j128 = r[:9]
    spec = r[12] if r[12] and not str(r[12]).startswith('Ver catálogo') else None
    ativo = 'true' if str(r[11]).strip().lower().startswith('s') else 'false'
    L.append(f"insert into models (brand,name,system,shipping_text,bag_price,accessory,os_frontend,specs,games_64,games_128,active) values "
             f"({q(marca)},{q(nome)},{q(str(sis).lower())},{q(portes)},{q(bolsa)},{q(acc)},{q(so)},{q(spec)},{q(j64)},{q(j128)},{ativo});")
for i, r in enumerate(wb['Preços'].iter_rows(min_row=2, values_only=True)):
    if not r[0] or r[2] is None: continue
    L.append(f"insert into model_versions (model_id,label,price,sort) select id,{q(r[1])},{r[2]},{i} from models where name={q(r[0])};")
for r in wb['Stock'].iter_rows(min_row=2, values_only=True):
    if not r[0] or str(r[0]).startswith('EXEMPLO') or not r[2]: continue
    L.append(f"insert into colors (model_id,name,note) select id,{q(r[2])},{q(r[5])} from models where name={q(r[0])};")
L.append('commit;')
open(out, 'w').write('\n'.join(L) + '\n')
print(len(L), 'linhas')
