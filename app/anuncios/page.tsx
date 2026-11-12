'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, imageUrl, type ColorStock, type Version } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { minPrice, textFor, title, vintedText, type TModel, type TOption, type TVersion } from '@/lib/templates';
import Login from '../Login';
import ModelImage from '../ModelImage';

type Platform = 'wallapop' | 'olx' | 'marketplace' | 'vinted';
type ModelRow = TModel & { image_path: string | null; active: boolean };
type Listing = { id: string; platform: Platform; model_id: string | null; unit_id: string | null; status: string; external_url: string | null };
type UnitRow = { id: string; model_id: string; color_id: string; version_id: string | null };
const PLATFORMS: [Platform, string][] = [['wallapop', 'Wallapop'], ['olx', 'OLX'], ['marketplace', 'Marketplace'], ['vinted', 'Vinted']];

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false);
  return <button className="btn-ghost" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch { window.prompt('Copiar:', text); } }}>{ok ? 'Copiado ✓' : label}</button>;
}

export default function Anuncios() {
  const { session, loading } = useSession();
  const [platform, setPlatform] = useState<Platform>('wallapop');
  const [models, setModels] = useState<ModelRow[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [stock, setStock] = useState<ColorStock[]>([]);
  const [options, setOptions] = useState<TOption[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const [m, v, s, o, l, u] = await Promise.all([
      supabase.from('models').select('id,brand,name,system,shipping_text,bag_price,accessory,os_frontend,specs,box_contents,games_extra,image_path,active').order('name'),
      supabase.from('model_versions').select('*').order('sort'),
      supabase.from('model_stock').select('*'),
      supabase.from('android_options').select('*').order('sort'),
      supabase.from('platform_listings').select('id,platform,model_id,unit_id,status,external_url').neq('status', 'hidden'),
      supabase.from('units').select('id,model_id,color_id,version_id').eq('status', 'available'),
    ]);
    setModels((m.data ?? []) as ModelRow[]); setVersions((v.data ?? []) as Version[]); setStock((s.data ?? []) as ColorStock[]);
    setOptions((o.data ?? []) as TOption[]); setListings((l.data ?? []) as Listing[]); setUnits((u.data ?? []) as UnitRow[]);
  }, []);
  useEffect(() => { if (session) load(); }, [session, load]);

  const total = useMemo(() => { const t = new Map<string, number>(); stock.forEach(r => t.set(r.model_id, (t.get(r.model_id) ?? 0) + Number(r.available))); return t; }, [stock]);
  const modelById = useMemo(() => new Map(models.map(m => [m.id, m])), [models]);
  const colorsInStock = (mid: string) => stock.filter(r => r.model_id === mid && Number(r.available) > 0).map(r => r.color);
  const versOf = (mid: string): TVersion[] => versions.filter(v => v.model_id === mid);

  async function publish(row: { model_id?: string; unit_id?: string }) {
    const { error } = await supabase.from('platform_listings').insert({ platform, ...row, status: 'active', external_url: link.trim() || null, published_at: new Date().toISOString() });
    setMsg(error ? error.message : 'Anúncio registado como ativo.'); setLink(''); setOpen(null); await load();
  }
  async function hide(id: string) {
    const { error } = await supabase.from('platform_listings').update({ status: 'hidden' }).eq('id', id);
    setMsg(error ? error.message : 'Marcado como ocultado.'); await load();
  }

  if (loading) return <p className="mt-16 text-center text-slate-400">A carregar…</p>;
  if (!session) return <Login />;

  const mine = listings.filter(l => l.platform === platform);
  // por ocultar: anúncio ativo cujo modelo ficou sem stock (ou, no Vinted, cuja unidade já não está disponível)
  const toHide = mine.filter(l => platform === 'vinted'
    ? l.unit_id && !units.some(u => u.id === l.unit_id)
    : l.model_id && (total.get(l.model_id) ?? 0) === 0);
  const listingFor = (mid: string) => mine.find(l => l.model_id === mid);
  const activeModels = models.filter(m => m.active && (total.get(m.id) ?? 0) > 0);
  const Link2 = ({ url }: { url: string | null }) => url ? <a href={url} target="_blank" rel="noreferrer" className="text-sky-400 underline">abrir anúncio</a> : <span className="text-slate-500">sem link</span>;

  return (
    <>
      <header><p className="text-xs uppercase tracking-widest text-sky-400">Star Tech</p><h1 className="text-2xl font-bold">Anúncios</h1></header>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {PLATFORMS.map(([p, l]) => <button key={p} onClick={() => { setPlatform(p); setOpen(null); setMsg(''); }} className={`chip whitespace-nowrap ${platform === p ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-200'}`}>{l}</button>)}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {platform === 'vinted' ? 'Um anúncio por consola.' : platform === 'marketplace' ? 'Texto igual ao do OLX, um anúncio por modelo.' : 'Um anúncio por modelo.'} A publicação é manual: copias o texto, publicas na plataforma e voltas aqui para registar.
      </p>
      {msg && <p className="mt-3 text-sm text-amber-300">{msg}</p>}

      {toHide.length > 0 && (
        <section className="card mt-4 border-amber-500/40">
          <h2 className="font-semibold text-amber-300">Por ocultar ({toHide.length})</h2>
          <p className="text-xs text-slate-400">Sem stock: oculta nestas plataformas (não apagues).</p>
          <ul className="mt-2 space-y-2">
            {toHide.map(l => {
              const m = modelById.get(l.model_id ?? units.find(u => u.id === l.unit_id)?.model_id ?? '');
              return (
                <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{m?.name ?? 'Consola vendida'} · <Link2 url={l.external_url} /></span>
                  <button className="btn" onClick={() => hide(l.id)}>Já ocultei</button>
                </li>);
            })}
          </ul>
        </section>)}

      <ul className="mt-4 space-y-3">
        {platform !== 'vinted' && activeModels.map(m => {
          const l = listingFor(m.id);
          const vs = versOf(m.id), cols = colorsInStock(m.id);
          const text = textFor(platform, m, vs, cols, options);
          const price = minPrice(vs);
          return (
            <li key={m.id} className="card !p-0 overflow-hidden">
              <button className="flex w-full items-center gap-3 p-3 text-left" onClick={() => { setOpen(open === m.id ? null : m.id); setLink(''); }}>
                <ModelImage path={m.image_path} name={m.name} system={m.system} className="h-14 w-14 shrink-0 rounded-lg" />
                <span className="flex-1"><span className="block font-medium leading-tight">{m.name}</span>
                  <span className="text-xs text-slate-400">{total.get(m.id)} em stock{price ? ` · desde ${price} €` : ''}</span></span>
                <span className={`chip ${l ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>{l ? 'ativo' : 'por publicar'}</span>
              </button>
              {open === m.id && (
                <div className="border-t border-slate-800 p-3 space-y-3">
                  <div className="text-sm text-slate-300">Título: <b>{title(platform, m)}</b>{price ? <> · Preço no anúncio: <b>{price} €</b></> : null}</div>
                  <pre className="whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-sm text-slate-200">{text}</pre>
                  <div className="flex flex-wrap gap-2">
                    <CopyBtn text={title(platform, m)} label="Copiar título" />
                    <CopyBtn text={text} label="Copiar texto" />
                    {imageUrl(m.image_path) && <a className="btn-ghost" href={imageUrl(m.image_path)!} target="_blank" rel="noreferrer">Ver foto</a>}
                  </div>
                  {l ? (
                    <div className="flex items-center justify-between text-sm"><Link2 url={l.external_url} /><button className="btn-ghost" onClick={() => hide(l.id)}>Marcar como ocultado</button></div>
                  ) : (
                    <div className="space-y-2">
                      <input className="input" placeholder="Link do anúncio (opcional)" value={link} onChange={e => setLink(e.target.value)} />
                      <button className="btn w-full" onClick={() => publish({ model_id: m.id })}>Já publiquei</button>
                    </div>)}
                </div>)}
            </li>);
        })}

        {platform === 'vinted' && units.map(u => {
          const m = modelById.get(u.model_id); if (!m) return null;
          const color = stock.find(s => s.color_id === u.color_id)?.color ?? '';
          const ver = versions.find(v => v.id === u.version_id);
          const l = mine.find(x => x.unit_id === u.id);
          const text = vintedText(m, color, ver?.label ?? null);
          const price = ver?.price ?? minPrice(versOf(m.id));
          return (
            <li key={u.id} className="card !p-0 overflow-hidden">
              <button className="flex w-full items-center gap-3 p-3 text-left" onClick={() => { setOpen(open === u.id ? null : u.id); setLink(''); }}>
                <ModelImage path={m.image_path} name={m.name} system={m.system} className="h-14 w-14 shrink-0 rounded-lg" />
                <span className="flex-1"><span className="block font-medium leading-tight">{m.name}</span><span className="text-xs text-slate-400">{color}{price ? ` · ${price} €` : ''}</span></span>
                <span className={`chip ${l ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>{l ? 'ativo' : 'por publicar'}</span>
              </button>
              {open === u.id && (
                <div className="border-t border-slate-800 p-3 space-y-3">
                  <div className="text-sm text-slate-300">Título: <b>{m.name} {color}</b>{price ? <> · Preço: <b>{price} €</b></> : null}</div>
                  <pre className="whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-sm text-slate-200">{text}</pre>
                  <div className="flex flex-wrap gap-2"><CopyBtn text={`${m.name} ${color}`} label="Copiar título" /><CopyBtn text={text} label="Copiar texto" /></div>
                  {l ? <div className="flex items-center justify-between text-sm"><Link2 url={l.external_url} /><button className="btn-ghost" onClick={() => hide(l.id)}>Marcar como ocultado</button></div> : (
                    <div className="space-y-2"><input className="input" placeholder="Link do anúncio (opcional)" value={link} onChange={e => setLink(e.target.value)} />
                      <button className="btn w-full" onClick={() => publish({ unit_id: u.id })}>Já publiquei</button></div>)}
                </div>)}
            </li>);
        })}
      </ul>
      {((platform !== 'vinted' && activeModels.length === 0) || (platform === 'vinted' && units.length === 0)) && (
        <p className="mt-6 text-center text-slate-400">Sem consolas em stock. Importa ou adiciona stock para ver anúncios.</p>)}
    </>
  );
}
