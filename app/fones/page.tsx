'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase, shrinkImage } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import Login from '../Login';

type Fone = { id: string; name: string; kind: 'auricular' | 'fone'; price: number; qty: number; image_url: string | null };

export default function Fones() {
  const { session, loading } = useSession();
  const [items, setItems] = useState<Fone[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('fones').select('id,name,kind,price,qty,image_url').eq('active', true).order('sort');
    if (error) setError(error.message); else setItems(data as Fone[]);
  }, []);
  useEffect(() => { if (session) load(); }, [session, load]);

  async function adjust(f: Fone, delta: number) {
    setBusy(f.id); setError('');
    const { error } = await supabase.rpc('fone_adjust', { p_id: f.id, p_delta: delta, p_note: delta > 0 ? 'entrada' : 'venda' });
    if (error) setError(error.message); else await load();
    setBusy('');
  }

  async function setPhoto(f: Fone, file: File | undefined) {
    if (!file) return;
    setBusy(f.id); setError('');
    try {
      const path = `fones/${f.id}-${Date.now()}.jpg`;
      const up = await supabase.storage.from('model-images').upload(path, await shrinkImage(file), { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      const url = supabase.storage.from('model-images').getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from('fones').update({ image_url: url }).eq('id', f.id);
      if (error) throw error;
      await load();
    } catch (e) { setError((e as Error).message); }
    setBusy('');
  }

  if (loading) return <p className="mt-16 text-center text-slate-400">A carregar…</p>;
  if (!session) return <Login />;

  const total = items.reduce((a, f) => a + f.qty, 0);
  const groups: [string, Fone['kind']][] = [['Auriculares Bluetooth', 'auricular'], ['Fones Bluetooth', 'fone']];

  return (
    <>
      <header>
        <p className="text-xs uppercase tracking-widest text-sky-400">Star Tech</p>
        <h1 className="text-2xl font-bold">Fones</h1>
        <p className="text-sm text-slate-400">{total} em stock · controlo separado das consolas</p>
      </header>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {groups.map(([title, kind]) => (
        <section key={kind} className="mt-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
          <ul className="space-y-2">
            {items.filter(f => f.kind === kind).map(f => (
              <li key={f.id} className="card flex items-center gap-3 !p-3">
                <label className="cursor-pointer" title="Mudar foto">
                  {f.image_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={f.image_url} alt={f.name} className="h-16 w-16 rounded-lg bg-white object-contain" loading="lazy" />
                    : <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-800 text-2xl">🎧</div>}
                  <input type="file" accept="image/*" className="hidden" onChange={e => setPhoto(f, e.target.files?.[0])} />
                </label>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">{f.name}</p>
                  <p className="text-sm text-sky-300">{String(f.price).replace('.', ',')} €</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn-ghost !px-3" disabled={busy === f.id || f.qty === 0} onClick={() => adjust(f, -1)} aria-label="Vendido">−</button>
                  <span className={`w-6 text-center text-lg font-bold ${f.qty > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>{f.qty}</span>
                  <button className="btn !px-3" disabled={busy === f.id} onClick={() => adjust(f, 1)} aria-label="Entrada">+</button>
                </div>
              </li>))}
          </ul>
        </section>))}
    </>
  );
}
