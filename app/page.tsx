'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, type ColorStock, type Model } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import Login from './Login';

export default function Home() {
  const { session, loading } = useSession();
  const [models, setModels] = useState<Model[]>([]);
  const [stock, setStock] = useState<ColorStock[]>([]);
  const [filter, setFilter] = useState<'todos' | 'linux' | 'android' | 'sem'>('todos');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [m, s] = await Promise.all([
      supabase.from('models').select('id,brand,name,system,active').order('system').order('name'),
      supabase.from('model_stock').select('*'),
    ]);
    if (m.error || s.error) { setError((m.error || s.error)!.message); return; }
    setModels(m.data as Model[]); setStock(s.data as ColorStock[]);
  }, []);
  useEffect(() => { if (session) load(); }, [session, load]);

  const totals = useMemo(() => {
    const t = new Map<string, number>();
    stock.forEach(r => t.set(r.model_id, (t.get(r.model_id) ?? 0) + Number(r.available)));
    return t;
  }, [stock]);

  if (loading) return <p className="mt-16 text-center text-slate-400">A carregar…</p>;
  if (!session) return <Login />;

  const shown = models.filter(m =>
    (filter === 'todos' || (filter === 'sem' ? (totals.get(m.id) ?? 0) === 0 : m.system === filter)) &&
    m.name.toLowerCase().includes(q.toLowerCase()));
  const totalUnits = [...totals.values()].reduce((a, b) => a + b, 0);

  return (
    <>
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Stock <span className="text-slate-400 text-base">({totalUnits} consolas)</span></h1>
        <span className="flex gap-2"><Link href="/importar/" className="btn-ghost">Importar</Link><button className="btn-ghost" onClick={() => supabase.auth.signOut()}>Sair</button></span>
      </header>
      <input className="input mt-3" placeholder="Pesquisar modelo…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {(['todos', 'linux', 'android', 'sem'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={filter === f ? 'btn' : 'btn-ghost'}>
            {f === 'sem' ? 'Sem stock' : f[0].toUpperCase() + f.slice(1)}
          </button>))}
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <ul className="mt-4 space-y-2">
        {shown.map(m => {
          const n = totals.get(m.id) ?? 0;
          return (
            <li key={m.id}>
              <Link href={`/modelo/?id=${m.id}`} className="card flex items-center justify-between">
                <span>
                  <span className="block font-medium">{m.name}</span>
                  <span className="text-xs text-slate-400">{m.system === 'linux' ? 'Linux' : 'Android'}</span>
                </span>
                <span className={n > 0 ? 'text-lg font-semibold text-emerald-400' : 'text-sm text-slate-500'}>{n > 0 ? n : 'esgotado'}</span>
              </Link>
            </li>);
        })}
      </ul>
    </>
  );
}
