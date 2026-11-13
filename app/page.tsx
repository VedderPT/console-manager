'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, type ColorStock, type Model, type Version } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import Login from './Login';
import ModelImage from './ModelImage';
import { colorHex, isTransparent } from '@/lib/colors';

export default function Home() {
  const { session, loading } = useSession();
  const [models, setModels] = useState<Model[]>([]);
  const [stock, setStock] = useState<ColorStock[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [filter, setFilter] = useState<'todos' | 'linux' | 'android' | 'sem'>('todos');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [m, s, v] = await Promise.all([
      supabase.from('models').select('id,brand,name,system,active,image_path,restock_eta').order('system').order('name'),
      supabase.from('model_stock').select('*'),
      supabase.from('model_versions').select('*'),
    ]);
    const err = m.error || s.error || v.error;
    if (err) { setError(err.message); return; }
    setModels(m.data as Model[]); setStock(s.data as ColorStock[]); setVersions(v.data as Version[]);
  }, []);
  useEffect(() => { if (session) load(); }, [session, load]);

  const totals = useMemo(() => {
    const t = new Map<string, number>();
    stock.forEach(r => t.set(r.model_id, (t.get(r.model_id) ?? 0) + Number(r.available)));
    return t;
  }, [stock]);
  const dots = useMemo(() => {
    const d = new Map<string, ColorStock[]>();
    stock.forEach(r => d.set(r.model_id, [...(d.get(r.model_id) ?? []), r]));
    d.forEach(a => a.sort((x, y) => Number(y.available > 0) - Number(x.available > 0) || x.color.localeCompare(y.color)));
    return d;
  }, [stock]);
  const prices = useMemo(() => {
    const p = new Map<string, number>();
    versions.forEach(v => p.set(v.model_id, Math.min(p.get(v.model_id) ?? Infinity, Number(v.price))));
    return p;
  }, [versions]);

  if (loading) return <p className="mt-16 text-center text-slate-400">A carregar…</p>;
  if (!session) return <Login />;

  const shown = models.filter(m =>
    (filter === 'todos' || (filter === 'sem' ? (totals.get(m.id) ?? 0) === 0 : m.system === filter)) &&
    m.name.toLowerCase().includes(q.toLowerCase()));
  const totalUnits = [...totals.values()].reduce((a, b) => a + b, 0);
  const withStock = models.filter(m => (totals.get(m.id) ?? 0) > 0).length;

  return (
    <>
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-sky-400">Star Tech</p>
          <h1 className="text-2xl font-bold">Stock</h1>
        </div>
        <button className="btn-ghost" onClick={() => supabase.auth.signOut()}>Sair</button>
      </header>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="card !p-3"><div className="text-2xl font-bold text-emerald-400">{totalUnits}</div><div className="text-xs text-slate-400">consolas</div></div>
        <div className="card !p-3"><div className="text-2xl font-bold">{withStock}</div><div className="text-xs text-slate-400">modelos com stock</div></div>
        <div className="card !p-3"><div className="text-2xl font-bold text-amber-300">{models.length - withStock}</div><div className="text-xs text-slate-400">esgotados</div></div>
      </div>
      <input className="input mt-4" placeholder="Pesquisar modelo…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {(['todos', 'linux', 'android', 'sem'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`chip whitespace-nowrap ${filter === f ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-200'}`}>
            {f === 'sem' ? 'Sem stock' : f[0].toUpperCase() + f.slice(1)}
          </button>))}
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map(m => {
          const n = totals.get(m.id) ?? 0;
          const p = prices.get(m.id);
          return (
            <li key={m.id}>
              <Link href={`/modelo/?id=${m.id}`} className="card block overflow-hidden !p-0 transition active:scale-[.98]">
                <div className="relative">
                  <ModelImage path={m.image_path} name={m.name} system={m.system} className="aspect-[4/3]" />
                  <span className={`chip absolute right-2 top-2 ${n > 0 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800/90 text-slate-400'}`}>{n > 0 ? `${n} em stock` : m.restock_eta ? 'a caminho' : 'esgotado'}</span>
                </div>
                <div className="p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">{m.brand} · {m.system === 'linux' ? 'Linux' : 'Android'}</p>
                  <p className="font-semibold leading-tight">{m.name.replace(new RegExp(`^${m.brand}\\s+`, 'i'), '')}</p>
                  {(dots.get(m.id)?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {dots.get(m.id)!.map(c => (
                        <span key={c.color_id} title={`${c.color}: ${c.available}`}
                          className={`relative inline-block h-4 w-4 rounded-full ring-1 ring-slate-500 ${Number(c.available) > 0 ? '' : 'opacity-25'}`}
                          style={{ background: isTransparent(c.color) ? `linear-gradient(135deg, ${colorHex(c.color)} 55%, rgba(255,255,255,.35) 55%)` : colorHex(c.color) }}>
                          {Number(c.available) > 1 && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-sky-500 px-1 text-[9px] font-bold leading-3 text-slate-950">{c.available}</span>}
                        </span>))}
                    </div>)}
                  {p !== undefined && p !== Infinity && <p className="mt-1 text-sm text-sky-300">desde {p} €</p>}
                </div>
              </Link>
            </li>);
        })}
      </ul>
    </>
  );
}
