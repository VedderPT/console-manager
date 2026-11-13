'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { fetchCatalog, photoUrls, minPrice, eur, type ShopModel } from '@/lib/shop';

export default function Shop() {
  const [models, setModels] = useState<ShopModel[] | null>(null);
  const [error, setError] = useState('');
  const [sys, setSys] = useState<'todas' | 'linux' | 'android'>('todas');
  const [q, setQ] = useState('');
  useEffect(() => { fetchCatalog().then(c => setModels(c.models)).catch(e => setError(e.message)); }, []);

  const shown = useMemo(() => (models ?? []).filter(m =>
    (sys === 'todas' || m.system === sys) && m.name.toLowerCase().includes(q.toLowerCase())), [models, sys, q]);

  return (
    <>
      <section className="mt-6">
        <h1 className="text-3xl font-bold leading-tight">Consolas retro portáteis,<br /><span className="text-sky-400">prontas a jogar.</span></h1>
        <p className="mt-2 text-slate-300">Escolhe a tua consola, vê fotos, especificações e opções, e faz o pedido em 1 minuto. Respondemos por WhatsApp.</p>
        <ul className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
          <li className="chip bg-slate-800">Linux: microSD com jogos instalados</li>
          <li className="chip bg-slate-800">Android: escolhes jogos e configuração</li>
          <li className="chip bg-slate-800">Entrega em mãos em Faro ou envio</li>
        </ul>
      </section>

      <input className="input mt-5" placeholder="Pesquisar consola…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="mt-3 flex gap-2">
        {(['todas', 'linux', 'android'] as const).map(f => (
          <button key={f} onClick={() => setSys(f)} className={`chip ${sys === f ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-200'}`}>{f[0].toUpperCase() + f.slice(1)}</button>))}
      </div>

      {error && <p className="mt-4 text-sm text-red-400">Não foi possível carregar o catálogo. Tenta novamente daqui a pouco.</p>}
      {models === null && !error && <p className="mt-8 text-center text-slate-400">A carregar…</p>}
      {models && shown.length === 0 && !error && (
        <p className="mt-8 text-center text-slate-400">{models.length === 0 ? 'De momento não temos consolas disponíveis. Volta em breve ou fala connosco por WhatsApp.' : 'Nenhuma consola encontrada.'}</p>)}

      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map(m => {
          const img = photoUrls(m)[0]; const p = minPrice(m);
          return (
            <li key={m.id}>
              <Link href={`/loja/modelo/?id=${m.id}`} className="card block overflow-hidden !p-0 transition active:scale-[.98]">
                <div className={`aspect-[4/3] bg-gradient-to-br ${m.system === 'linux' ? 'from-emerald-900/60' : 'from-sky-900/60'} to-slate-900`}>
                  {img
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={img} alt={m.name} className="h-full w-full object-contain p-2" loading="lazy" />
                    : <div className="flex h-full items-center justify-center text-4xl opacity-40">🎮</div>}
                </div>
                <div className="p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">{m.brand} · {m.system === 'linux' ? 'Linux' : 'Android'}</p>
                  <p className="font-semibold leading-tight">{m.name.replace(new RegExp(`^${m.brand}\\s+`, 'i'), '')}</p>
                  {p !== null && <p className="mt-1 text-sm text-sky-300">desde {eur(p)}</p>}
                </div>
              </Link>
            </li>);
        })}
      </ul>
    </>
  );
}
