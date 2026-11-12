'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase, shrinkImage, listPhotos } from '@/lib/supabase';

type Photo = { path: string; url: string };

/** Gestão das fotos de um modelo: enviar várias, apagar. Ficam guardadas na cloud (PC e telemóvel). */
export function Gallery({ modelId }: { modelId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => setPhotos(await listPhotos(modelId)), [modelId]);
  useEffect(() => { load(); }, [load]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setMsg('');
    try {
      let i = 0;
      for (const f of Array.from(files)) {
        const path = `gallery/${modelId}/${Date.now()}-${i++}.jpg`;
        const up = await supabase.storage.from('model-images').upload(path, await shrinkImage(f, 1600), { contentType: 'image/jpeg' });
        if (up.error) throw up.error;
      }
      setMsg(`${files.length} foto(s) guardada(s).`);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Erro ao enviar fotos'); }
    await load(); setBusy(false);
  }
  async function remove(p: Photo) {
    if (!window.confirm('Apagar esta foto?')) return;
    setBusy(true);
    const { error } = await supabase.storage.from('model-images').remove([p.path]);
    setMsg(error ? error.message : 'Foto apagada.');
    await load(); setBusy(false);
  }

  return (
    <section className="card mt-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Fotos para anúncios ({photos.length})</h2>
        <label className="btn cursor-pointer !py-1 text-sm">
          Adicionar fotos
          <input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={e => { upload(e.target.files); e.target.value = ''; }} />
        </label>
      </div>
      <p className="mt-1 text-xs text-slate-400">Ficam guardadas automaticamente e aparecem em qualquer dispositivo. Nos anúncios escolhes quais usar.</p>
      {msg && <p className="mt-2 text-sm text-amber-300">{msg}</p>}
      {photos.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {photos.map(p => (
            <li key={p.path} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
              <button className="absolute right-1 top-1 rounded-full bg-slate-950/80 px-2 text-sm" disabled={busy} onClick={() => remove(p)} aria-label="Apagar">✕</button>
            </li>))}
        </ul>)}
    </section>
  );
}

/** Escolha de fotos no ecrã do anúncio: partilhar (telemóvel) ou descarregar (PC). */
export function PhotoPicker({ modelId }: { modelId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { listPhotos(modelId).then(p => { setPhotos(p); setSel(new Set(p.map(x => x.path))); }); }, [modelId]);

  if (photos.length === 0) return <p className="text-xs text-slate-500">Sem fotos neste modelo. Adiciona-as no ecrã do modelo (Stock → modelo → Fotos para anúncios).</p>;

  const toggle = (path: string) => setSel(s => { const n = new Set(s); n.has(path) ? n.delete(path) : n.add(path); return n; });
  const chosen = photos.filter(p => sel.has(p.path));

  async function send() {
    setBusy(true); setMsg('');
    try {
      const files = await Promise.all(chosen.map(async (p, i) => new File([await (await fetch(p.url)).blob()], `foto-${i + 1}.jpg`, { type: 'image/jpeg' })));
      if (navigator.canShare?.({ files })) { await navigator.share({ files }); }
      else {
        for (const f of files) { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click(); URL.revokeObjectURL(a.href); await new Promise(r => setTimeout(r, 250)); }
        setMsg('Fotos descarregadas.');
      }
    } catch (e) { if ((e as Error).name !== 'AbortError') setMsg(e instanceof Error ? e.message : 'Erro ao preparar as fotos'); }
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>Fotos ({chosen.length}/{photos.length})</span>
        <button className="text-sky-400" onClick={() => setSel(chosen.length === photos.length ? new Set() : new Set(photos.map(p => p.path)))}>
          {chosen.length === photos.length ? 'Desmarcar todas' : 'Marcar todas'}
        </button>
      </div>
      <ul className="grid grid-cols-4 gap-2">
        {photos.map(p => (
          <li key={p.path}>
            <button className="relative block w-full" onClick={() => toggle(p.path)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className={`aspect-square w-full rounded-lg object-cover ${sel.has(p.path) ? 'ring-2 ring-sky-400' : 'opacity-40'}`} loading="lazy" />
              {sel.has(p.path) && <span className="absolute right-1 top-1 rounded-full bg-sky-500 px-1.5 text-xs font-bold text-slate-950">✓</span>}
            </button>
          </li>))}
      </ul>
      <button className="btn w-full" disabled={busy || chosen.length === 0} onClick={send}>
        {busy ? 'A preparar…' : 'Partilhar / guardar fotos selecionadas'}
      </button>
      {msg && <p className="text-sm text-amber-300">{msg}</p>}
    </div>
  );
}
