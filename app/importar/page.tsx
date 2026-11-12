'use client';
import { syncCatalog } from '@/lib/sync';
import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

type Row = { line: string; model?: string; modelId?: string; colorId?: string; versionId: string | null; color: string; n: number; error?: string };
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

export default function Importar() {
  const { session, loading } = useSession();
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function preview() {
    setMsg('');
    const [m, c, v] = await Promise.all([
      supabase.from('models').select('id,name,system'),
      supabase.from('colors').select('id,model_id,name'),
      supabase.from('model_versions').select('id,model_id,label'),
    ]);
    const models = m.data ?? [], colors = c.data ?? [], versions = v.data ?? [];
    const out: Row[] = [];
    for (const line of text.split('\n').map(l => l.trim()).filter(Boolean)) {
      const i = line.indexOf(':');
      if (i < 0) { out.push({ line, color: '', n: 0, versionId: null, error: 'Falta ":" depois do modelo' }); continue; }
      const name = norm(line.slice(0, i));
      // aceita "RG35XX Plus" ou "Anbernic RG35XX Plus"
      const cands = models.filter(x => norm(x.name) === name || norm(x.name).endsWith(' ' + name));
      if (cands.length !== 1) { out.push({ line, color: '', n: 0, versionId: null, error: cands.length ? 'Modelo ambíguo' : 'Modelo não encontrado' }); continue; }
      const model = cands[0];
      for (const part of line.slice(i + 1).split(',').map(p => p.trim()).filter(Boolean)) {
        // "Preto (2)" ou "Preto (2) [Pro]"; sem número = 1
        const mt = part.match(/^(.*?)\s*(?:\((\d+)\))?\s*(?:\[(.+?)\])?$/);
        const colorName = norm(mt?.[1] ?? part), n = mt?.[2] ? parseInt(mt[2]) : 1, ver = mt?.[3];
        const color = colors.find(x => x.model_id === model.id && norm(x.name) === colorName);
        const mv = versions.filter(x => x.model_id === model.id);
        let versionId: string | null = null, error: string | undefined;
        if (!color) error = `Cor "${mt?.[1]}" não existe neste modelo`;
        if (model.system === 'android' && mv.length > 1) {
          const found = ver ? mv.filter(x => norm(x.label).startsWith(norm(ver))) : [];
          if (found.length === 1) versionId = found[0].id; else if (!error) error = 'Indica a versão, ex.: Preto (2) [Pro]';
        }
        out.push({ line, model: model.name, modelId: model.id, colorId: color?.id, versionId, color: mt?.[1] ?? part, n, error });
      }
    }
    setRows(out);
  }

  async function confirm() {
    setBusy(true); setMsg('');
    const units = rows.flatMap(r => Array.from({ length: r.n }, () => ({ model_id: r.modelId, color_id: r.colorId, version_id: r.versionId })));
    const { data, error } = await supabase.from('units').insert(units).select('id,model_id');
    if (error) { setMsg(error.message); setBusy(false); return; }
    await supabase.from('stock_movements').insert(data!.map(u => ({ unit_id: u.id, model_id: u.model_id, kind: 'in', note: 'importação' })));
    setMsg(`${data!.length} consolas adicionadas ao stock.`); setRows([]); setText(''); setBusy(false);
    syncCatalog().then(r => setMsg(m => `${m} ${r}`));
  }

  if (loading) return <p className="mt-16 text-center text-slate-400">A carregar…</p>;
  if (!session) return <p className="mt-16 text-center"><Link href="/" className="underline">Iniciar sessão</Link></p>;
  const ok = rows.length > 0 && rows.every(r => !r.error);

  return (
    <>
      <Link href="/" className="text-sm text-sky-400">← Voltar</Link>
      <h1 className="mt-2 text-xl font-semibold">Importar stock</h1>
      <p className="mt-1 text-sm text-slate-400">Uma linha por modelo, ex.: <code>R36S: Branco (2), Rosa (1)</code>. Em Android com várias versões: <code>Odin 3: Preto (1) [Pro]</code>. Soma ao stock existente.</p>
      <textarea className="input mt-3 h-56 font-mono text-sm" value={text} onChange={e => setText(e.target.value)} />
      <button className="btn mt-3" onClick={preview} disabled={!text.trim()}>Pré-visualizar</button>
      {rows.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm">
          {rows.map((r, i) => (
            <li key={i} className={r.error ? 'text-red-400' : 'text-emerald-300'}>
              {r.error ? `✗ ${r.line} — ${r.error}` : `✓ ${r.model} · ${r.color} × ${r.n}`}
            </li>))}
        </ul>)}
      {ok && <button className="btn mt-4 w-full" onClick={confirm} disabled={busy}>Confirmar e adicionar</button>}
      {msg && <p className="mt-3 text-amber-300">{msg}</p>}
    </>
  );
}
