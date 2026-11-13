'use client';
import { syncCatalog } from '@/lib/sync';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase, shrinkImage, type Version } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import ModelImage from '../ModelImage';
import { Gallery } from '../Gallery';

type Color = { id: string; name: string; note: string | null };
type Unit = { id: string; color_id: string; version_id: string | null };
type Info = { name: string; brand: string; system: 'linux' | 'android'; image_path: string | null; games_url: string | null; games_extra: number | null; restock_eta: string | null };
const CHANNELS = [['olx', 'OLX'], ['wallapop', 'Wallapop'], ['vinted', 'Vinted'], ['marketplace', 'Marketplace'], ['whatsapp', 'WhatsApp']] as const;

function ModelDetail() {
  const id = useSearchParams().get('id');
  const { session, loading } = useSession();
  const [info, setInfo] = useState<Info | null>(null);
  const [colors, setColors] = useState<Color[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [channel, setChannel] = useState('');
  const [version, setVersion] = useState('');
  const [gamesUrl, setGamesUrl] = useState('');
  const [extra, setExtra] = useState('');
  const [restock, setRestock] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');

  const multiVersion = info?.system === 'android' && versions.length > 1;

  const load = useCallback(async () => {
    if (!id) return;
    const [m, c, v, u] = await Promise.all([
      supabase.from('models').select('name,brand,system,image_path,games_url,games_extra,restock_eta').eq('id', id).single(),
      supabase.from('colors').select('id,name,note').eq('model_id', id).order('name'),
      supabase.from('model_versions').select('*').eq('model_id', id).order('sort'),
      supabase.from('units').select('id,color_id,version_id').eq('model_id', id).eq('status', 'available'),
    ]);
    setLoadError(m.error?.message ?? '');
    if (m.data) { setInfo(m.data as Info); setGamesUrl(m.data.games_url ?? ''); setExtra(m.data.games_extra?.toString() ?? ''); setRestock(m.data.restock_eta ?? ''); }
    setColors((c.data ?? []) as Color[]); setVersions((v.data ?? []) as Version[]); setUnits((u.data ?? []) as Unit[]);
    setVersion(prev => prev || v.data?.[0]?.id || '');
  }, [id]);
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
    syncCatalog().then(setMsg);
  }
  async function sell(colorId: string, vid?: string) {
    setBusy(true); setMsg('');
    const { error } = await supabase.rpc('sell_unit', { p_color: colorId, p_channel: channel || null, p_version: vid ?? null });
    setMsg(error ? error.message : 'Venda registada.');
    await load(); setBusy(false);
    if (!error) syncCatalog().then(r => setMsg(`Venda registada. ${r}`));
  }
  async function upload(file: File) {
    setBusy(true); setMsg('');
    try {
      const blob = await shrinkImage(file);
      const path = `${id}-${Date.now()}.jpg`;
      const up = await supabase.storage.from('model-images').upload(path, blob, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      const old = info?.image_path;
      const { error } = await supabase.from('models').update({ image_path: path }).eq('id', id);
      if (error) throw error;
      if (old) await supabase.storage.from('model-images').remove([old]);
      setMsg('Imagem atualizada.');
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Erro ao enviar a imagem'); }
    await load(); setBusy(false);
  }
  async function removeCover() {
    if (!info?.image_path || !window.confirm('Remover a foto principal deste modelo?')) return;
    setBusy(true); setMsg('');
    const { error } = await supabase.from('models').update({ image_path: null }).eq('id', id);
    if (error) setMsg(error.message);
    else { await supabase.storage.from('model-images').remove([info.image_path]); setMsg('Foto removida.'); }
    await load(); setBusy(false);
  }
  async function saveExtra() {
    setBusy(true);
    const { error } = await supabase.from('models').update({ games_url: gamesUrl.trim() || null, restock_eta: restock.trim() || null }).eq('id', id);
    setMsg(error ? error.message : 'Dados do anúncio guardados.'); setBusy(false);
  }

  if (loading) return <p className="mt-16 text-center text-slate-400">A carregar…</p>;
  if (!session) return <p className="mt-16 text-center"><Link href="/" className="underline">Iniciar sessão</Link></p>;
  if (loadError && !info) return <p className="mt-16 text-center text-red-400">Erro ao carregar o modelo: {loadError}</p>;
  if (!id || !info) return <p>A carregar modelo…</p>;
  const total = units.length;

  return (
    <>
      <Link href="/" className="text-sm text-sky-400">← Voltar</Link>
      <div className="card mt-2 overflow-hidden !p-0">
        <div className="relative">
          <ModelImage path={info.image_path} name={info.name} system={info.system} className="aspect-[16/10]" />
          <div className="absolute bottom-2 right-2 flex gap-2">
            {info.image_path && <button className="btn-ghost !py-1 text-xs text-red-300" disabled={busy} onClick={removeCover}>Remover foto</button>}
            <label className="btn-ghost cursor-pointer !py-1 text-xs">
              {info.image_path ? 'Trocar foto' : 'Adicionar foto'}
              <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          </div>
        </div>
        <div className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">{info.brand} · {info.system === 'linux' ? 'Linux' : 'Android'}</p>
          <h1 className="text-xl font-bold">{info.name}</h1>
          <p className="mt-1 text-sm text-slate-300">{total} em stock · {versions.map(v => `${v.label} ${v.price}€`).join(' · ')}</p>
        </div>
      </div>

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
              <span className={`chip ${count(c.id) > 0 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>{count(c.id)}</span>
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

      <Gallery modelId={id} />

      <details className="card mt-4">
        <summary className="cursor-pointer font-medium">Dados para os anúncios</summary>
        <div className="mt-3 space-y-2">
          <label className="text-sm text-slate-400">Link da lista de jogos</label>
          <input className="input" inputMode="url" value={gamesUrl} onChange={e => setGamesUrl(e.target.value)} placeholder="https://..." />
          <label className="text-sm text-slate-400">Aguarda reposição (previsão, ex.: «final de novembro»). Vazio = não está em reposição</label>
          <input className="input" value={restock} onChange={e => setRestock(e.target.value)} placeholder="Sem reposição" maxLength={60} />
          <p className="text-xs text-slate-500">Só aparece no site quando o modelo está sem stock. Com stock, o site mostra-o normalmente.</p>
          <button className="btn" disabled={busy} onClick={saveExtra}>Guardar</button>
        </div>
      </details>
    </>
  );
}

export default function Page() { return <Suspense fallback={null}><ModelDetail /></Suspense>; }
