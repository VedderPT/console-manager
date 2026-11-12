'use client';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase, type Version } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

type Color = { id: string; name: string; note: string | null };
type Unit = { id: string; color_id: string; version_id: string | null };
const CHANNELS = [['olx', 'OLX'], ['wallapop', 'Wallapop'], ['vinted', 'Vinted'], ['marketplace', 'Marketplace'], ['whatsapp', 'WhatsApp']] as const;

function ModelDetail() {
  const id = useSearchParams().get('id');
  const { session, loading } = useSession();
  const [name, setName] = useState('');
  const [system, setSystem] = useState('');
  const [colors, setColors] = useState<Color[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [channel, setChannel] = useState('');
  const [version, setVersion] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const multiVersion = system === 'android' && versions.length > 1;

  const load = useCallback(async () => {
    if (!id) return;
    const [m, c, v, u] = await Promise.all([
      supabase.from('models').select('name,system').eq('id', id).single(),
      supabase.from('colors').select('id,name,note').eq('model_id', id).order('name'),
      supabase.from('model_versions').select('*').eq('model_id', id).order('sort'),
      supabase.from('units').select('id,color_id,version_id').eq('model_id', id).eq('status', 'available'),
    ]);
    if (m.data) { setName(m.data.name); setSystem(m.data.system); }
    setColors((c.data ?? []) as Color[]); setVersions((v.data ?? []) as Version[]); setUnits((u.data ?? []) as Unit[]);
    if (v.data?.length && !version) setVersion(v.data[0].id);
  }, [id, version]);
  useEffect(() => { if (session) load(); }, [session, load]);

  const count = (colorId: string) => units.filter(u => u.color_id === colorId).length;
  const countVer = (colorId: string, vid: string) => units.filter(u => u.color_id === colorId && u.version_id === vid).length;

  async function add(colorId: string) {
    setBusy(true); setMsg('');
    const { data, error } = await supabase.from('units')
      .insert({ model_id: id, color_id: colorId, version_id: multiVersion ? version : null }).select('id').single();
    if (error) setMsg(error.message);
    else await supabase.from('stock_movements').insert({ unit_id: data.id, model_id: id, kind: 'in' });
    await load(); setBusy(false);
  }
  async function sell(colorId: string, vid?: string) {
    setBusy(true); setMsg('');
    const { error } = await supabase.rpc('sell_unit', { p_color: colorId, p_channel: channel || null, p_version: vid ?? null });
    setMsg(error ? error.message : 'Venda registada.');
    await load(); setBusy(false);
  }

  if (loading) return <p className="mt-16 text-center text-slate-400">A carregar…</p>;
  if (!session) return <p className="mt-16 text-center"><Link href="/" className="underline">Iniciar sessão</Link></p>;
  if (!id) return <p>Modelo não indicado.</p>;

  return (
    <>
      <Link href="/" className="text-sm text-sky-400">← Voltar</Link>
      <h1 className="mt-2 text-xl font-semibold">{name}</h1>
      <div className="mt-4 grid gap-2">
        <label className="text-sm text-slate-400">Canal da venda (opcional)</label>
        <select className="input" value={channel} onChange={e => setChannel(e.target.value)}>
          <option value="">—</option>
          {CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {multiVersion && (<>
          <label className="text-sm text-slate-400">Versão a adicionar</label>
          <select className="input" value={version} onChange={e => setVersion(e.target.value)}>
            {versions.map(v => <option key={v.id} value={v.id}>{v.label} · {v.price} €</option>)}
          </select>
        </>)}
      </div>
      {msg && <p className="mt-3 text-sm text-amber-300">{msg}</p>}
      <ul className="mt-4 space-y-2">
        {colors.map(c => (
          <li key={c.id} className="card">
            <div className="flex items-center justify-between">
              <span className="font-medium">{c.name}</span>
              <span className="text-lg font-semibold">{count(c.id)}</span>
            </div>
            {c.note && <p className="mt-1 text-xs text-slate-500">{c.note}</p>}
            {multiVersion && versions.map(v => countVer(c.id, v.id) > 0 && (
              <div key={v.id} className="mt-2 flex items-center justify-between text-sm">
                <span className="text-slate-300">{v.label}: {countVer(c.id, v.id)}</span>
                <button className="btn-ghost" disabled={busy} onClick={() => sell(c.id, v.id)}>Vendido</button>
              </div>))}
            <div className="mt-3 flex gap-2">
              <button className="btn-ghost flex-1" disabled={busy} onClick={() => add(c.id)}>+ Entrada</button>
              {!multiVersion && <button className="btn flex-1" disabled={busy || count(c.id) === 0} onClick={() => sell(c.id)}>Vendido</button>}
            </div>
          </li>))}
      </ul>
    </>
  );
}

export default function Page() { return <Suspense fallback={null}><ModelDetail /></Suspense>; }
