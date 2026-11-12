'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import Login from '../Login';

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Importa imagens para o catálogo WhatsApp a partir de links (uma linha: Nome do modelo|https://…). */
export default function Imagens() {
  const { session, loading } = useSession();
  const [text, setText] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true); setLog([]);
    const out: string[] = [];
    for (const line of text.split('\n').map(l => l.trim()).filter(Boolean)) {
      const i = line.indexOf('|'); const name = line.slice(0, i).trim(); const url = line.slice(i + 1).trim();
      try {
        const { data: m, error: e1 } = await supabase.from('models').select('id').eq('name', name).single();
        if (e1 || !m) throw new Error('modelo não encontrado');
        const blob = await (await fetch(url)).blob();
        const path = `catalog/${slug(name)}.jpg`;
        const { error: e2 } = await supabase.storage.from('model-images').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
        if (e2) throw e2;
        const { error: e3 } = await supabase.from('models').update({ catalog_image_path: path }).eq('id', m.id);
        if (e3) throw e3;
        out.push(`✓ ${name}`);
      } catch (e: any) { out.push(`✗ ${name}: ${e?.message ?? e}`); }
      setLog([...out]);
    }
    setBusy(false);
  }

  if (loading) return <p className="mt-16 text-center text-slate-400">A carregar…</p>;
  if (!session) return <Login />;
  return (
    <>
      <header><p className="text-xs uppercase tracking-widest text-sky-400">Star Tech</p><h1 className="text-2xl font-bold">Imagens do catálogo</h1></header>
      <p className="mt-2 text-sm text-slate-400">Uma linha por modelo: <code>Nome do modelo|link da imagem</code>. A imagem fica como foto por defeito do catálogo WhatsApp.</p>
      <textarea id="imgs" className="input mt-3 h-48 font-mono text-xs" value={text} onChange={e => setText(e.target.value)} />
      <button className="btn mt-3 w-full" disabled={busy || !text.trim()} onClick={run}>{busy ? 'A importar…' : 'Importar'}</button>
      <pre id="imglog" className="mt-3 whitespace-pre-wrap text-xs text-slate-300">{log.join('\n')}</pre>
    </>
  );
}
