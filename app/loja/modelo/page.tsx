'use client';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchCatalog, photoUrls, eur, waLink, shippingPrices, type ShopModel, type ShopOption } from '@/lib/shop';

type Done = { ref: string; total: number; text: string; preorder: boolean };

function Model() {
  const id = useSearchParams().get('id');
  const [model, setModel] = useState<ShopModel | null>(null);
  const [options, setOptions] = useState<ShopOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [img, setImg] = useState(0);

  const [versionId, setVersionId] = useState('');
  const [color, setColor] = useState('');
  const [option, setOption] = useState('');
  const [extras, setExtras] = useState<string[]>([]);
  const [delivery, setDelivery] = useState<'maos_faro' | 'registado' | 'cobranca'>('maos_faro');
  const [payment, setPayment] = useState('mbway');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState<Done | null>(null);
  const openedAt = useRef(Date.now());

  useEffect(() => {
    fetchCatalog().then(c => {
      const m = c.models.find(x => x.id === id) ?? null;
      setModel(m); setOptions(c.options);
      if (m) { setVersionId(m.versions[0]?.id ?? ''); setColor(m.colors.length === 1 ? m.colors[0] : ''); }
    }).catch(e => setError(e.message)).finally(() => setLoaded(true));
  }, [id]);

  const version = model?.versions.find(v => v.id === versionId);
  const capaPrice = model?.accessory && /^capa/i.test(model.accessory) ? Number(model.accessory.match(/(\d+)\s*€/)?.[1] ?? 0) : 0;
  const optionPrice = option === 'X' ? 30 : Number(options.find(o => o.code === option)?.price ?? 0);
  const total = useMemo(() => {
    if (!model) return 0;
    return Number(version?.price ?? 0) + optionPrice
      + (extras.includes('bolsa') ? Number(model.bag_price ?? 0) : 0) + (extras.includes('capa') ? capaPrice : 0);
  }, [model, version, optionPrice, extras, capaPrice]);

  if (!loaded) return <p className="mt-10 text-center text-slate-400">A carregar…</p>;
  if (error) return <p className="mt-10 text-center text-red-400">Não foi possível carregar a consola. Tenta novamente daqui a pouco.</p>;
  if (!model) {
    return (
      <div className="mt-10 text-center">
        <p className="text-lg font-semibold">Esta consola já não está disponível.</p>
        <p className="mt-1 text-slate-400">Vê as restantes ou pergunta-nos se vamos receber mais.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/loja/" className="btn">Ver consolas</Link>
          <a className="btn-ghost" href={waLink('Olá! Gostava de saber quando volta a haver uma consola que já não está no site.')} target="_blank" rel="noreferrer">Perguntar por WhatsApp</a>
        </div>
      </div>);
  }

  const m = model;
  const photos = photoUrls(m);
  const ship = shippingPrices(m);
  const toggleExtra = (k: string) => setExtras(e => (e.includes(k) ? e.filter(x => x !== k) : [...e, k]));
  const needsAddress = delivery !== 'maos_faro';
  const payOptions = delivery === 'cobranca' ? [['cobranca', 'Pago na entrega (à cobrança)']]
    : delivery === 'registado' ? [['mbway', 'MBWay'], ['transferencia', 'Transferência']]
    : [['mbway', 'MBWay'], ['transferencia', 'Transferência'], ['maos', 'Dinheiro em mãos']];
  const gamesByLabel = (label: string) => (/64/.test(label) ? m.games_64 : /128/.test(label) ? m.games_128 : null);

  function summary(ref: string, tot: number) {
    const opt = option === 'X' ? 'X · Apenas configuração' : options.find(o => o.code === option);
    const L = [`Olá! Fiz ${m.in_stock ? 'o pedido' : 'a pré-reserva'} ${ref} no site.`, '', `Consola: ${m.name}${version ? ` (${version.label.replace(/^Padrão\s*/, '')})` : ''}`];
    if (color) L.push(`Cor: ${color}`);
    if (opt) L.push(`Opção: ${typeof opt === 'string' ? opt : `${opt.code} · MicroSD ${opt.microsd ?? ''} ${opt.games ?? ''}`}`);
    if (extras.length) L.push(`Extras: ${extras.map(e => (e === 'bolsa' ? 'Bolsa de armazenamento' : 'Capa de silicone')).join(', ')}`);
    L.push(`Total estimado (sem portes): ${eur(tot)}`,
      `Entrega: ${delivery === 'maos_faro' ? 'Em mãos em Faro' : delivery === 'registado' ? 'Correio registado' : 'Envio à cobrança'}`, `Nome: ${name.trim()}`);
    return L.join('\n');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (m.colors.length > 1 && !color) { setFormError('Escolhe a cor.'); return; }
    if (m.system === 'android' && m.versions.length > 1 && !versionId) { setFormError('Escolhe a versão.'); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc('submit_order', { p: {
      model_id: m.id, version_id: versionId || null, color: color || null, option: option || null, extras,
      delivery, payment, name, phone, email, address, notes, consent, hp, elapsed: Date.now() - openedAt.current } });
    setBusy(false);
    if (error) { setFormError(error.message); return; }
    const r = data as { ref: string; total: number; preorder?: boolean };
    setDone({ ref: r.ref, total: Number(r.total), text: summary(r.ref, Number(r.total)), preorder: !!r.preorder });
    window.scrollTo({ top: 0 });
  }

  if (done) {
    return (
      <section className="card mt-6 text-center">
        <p className="text-4xl">✅</p>
        <h1 className="mt-2 text-2xl font-bold">{done.preorder ? 'Pré-reserva recebida' : 'Pedido recebido'}</h1>
        <p className="mt-1 text-slate-300">Referência <b>{done.ref}</b> · {m.name} · {eur(done.total)} (sem portes)</p>
        <p className="mt-3 text-sm text-slate-300">{done.preorder ? `Esta consola está a caminho${m.restock_eta ? ` (previsão: ${m.restock_eta})` : ''}. Envia-nos já a mensagem por WhatsApp e avisamos-te assim que chegar. Só pagas depois de confirmarmos contigo.` : 'Para agilizar, envia-nos já a mensagem por WhatsApp. Confirmamos disponibilidade, portes e forma de pagamento.'}</p>
        <a className="btn mt-4 block !py-3 text-base" href={waLink(done.text)} target="_blank" rel="noreferrer">Enviar por WhatsApp</a>
        <Link href="/loja/" className="mt-3 block text-sm text-sky-400">← Voltar às consolas</Link>
      </section>);
  }

  return (
    <>
      <Link href="/loja/" className="mt-4 inline-block text-sm text-sky-400">← Todas as consolas</Link>

      <div className={`card mt-2 overflow-hidden !p-0`}>
        <div className={`aspect-[16/10] bg-gradient-to-br ${m.system === 'linux' ? 'from-emerald-900/60' : 'from-sky-900/60'} to-slate-900`}>
          {photos[img]
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={photos[img]} alt={m.name} className="h-full w-full object-contain p-2" />
            : <div className="flex h-full items-center justify-center text-5xl opacity-40">🎮</div>}
        </div>
        {photos.length > 1 && (
          <ul className="flex gap-2 overflow-x-auto p-2">
            {photos.map((u, i) => (
              <li key={u}><button onClick={() => setImg(i)} className={`block h-14 w-14 overflow-hidden rounded-lg ${i === img ? 'ring-2 ring-sky-400' : 'opacity-60'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" /></button></li>))}
          </ul>)}
      </div>

      {!m.in_stock && (
        <div className="mt-3 rounded-2xl border border-amber-400/50 bg-amber-400/10 p-3 text-sm text-amber-100">
          <b>A caminho</b>: encomendada ao fornecedor{m.restock_eta ? <>, previsão de chegada <b>{m.restock_eta}</b></> : ''}. Podes fazer já uma pré-reserva, sem pagamento agora. A data é uma estimativa e pode mudar.
        </div>)}
      <h1 className="mt-4 text-2xl font-bold leading-tight">{m.name}</h1>
      <p className="text-sm text-slate-400">{m.brand} · {m.system === 'linux' ? 'Linux' : 'Android'}{m.os_frontend ? ` · ${m.os_frontend}` : ''}</p>
      {m.specs && <p className="mt-3 whitespace-pre-line text-slate-300">{m.specs}</p>}

      <section className="card mt-4 space-y-2 text-sm">
        <h2 className="font-semibold">O que inclui</h2>
        {m.system === 'linux' ? (
          <ul className="list-inside list-disc space-y-1 text-slate-300">
            {m.os_frontend && <li>Instalação {m.os_frontend}</li>}
            <li>MicroSD com jogos retro instalados (substitui o cartão original)</li>
            {(m.games_64 || m.games_128) && <li>Jogos incluídos: {[m.games_64 && `${m.games_64} (64GB)`, m.games_128 && `${m.games_128} (128GB)`].filter(Boolean).join(' / ')}</li>}
            <li>Bolsa de armazenamento + película de proteção</li>
          </ul>
        ) : (
          <ul className="list-inside list-disc space-y-1 text-slate-300">
            <li>Consola nova, aberta apenas para controlo de qualidade e configuração</li>
            <li>Sem jogos, microSD nem configuração, a não ser que escolhas uma opção abaixo</li>
          </ul>)}
        {m.games_url && <a className="btn-ghost mt-2 inline-block" href={m.games_url} target="_blank" rel="noreferrer">Ver lista de jogos</a>}
      </section>

      <form onSubmit={submit} className="mt-4 space-y-4">
        {m.versions.length > 0 && (
          <fieldset className="card">
            <legend className="px-1 font-semibold">{m.system === 'linux' ? 'Capacidade do cartão' : 'Versão'}</legend>
            <div className="mt-2 grid gap-2">
              {m.versions.map(v => (
                <label key={v.id} className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 ${versionId === v.id ? 'border-sky-500 bg-sky-500/10' : 'border-slate-700'}`}>
                  <span className="flex items-center gap-2"><input type="radio" name="version" checked={versionId === v.id} onChange={() => setVersionId(v.id)} />
                    <span>{v.label.replace(/^Padrão\s*/, '').replace(/^\((.*)\)$/, '$1')}{m.system === 'linux' && gamesByLabel(v.label) ? <span className="text-xs text-slate-400"> · {gamesByLabel(v.label)} jogos</span> : null}</span></span>
                  <b>{eur(Number(v.price))}</b>
                </label>))}
            </div>
          </fieldset>)}

        {m.colors.length > 1 && (
          <fieldset className="card">
            <legend className="px-1 font-semibold">Cor</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {m.colors.map(c => (
                <button type="button" key={c} onClick={() => setColor(c)} className={`chip !px-4 !py-2 text-sm ${color === c ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-200'}`}>{c}</button>))}
            </div>
          </fieldset>)}
        {m.colors.length === 1 && <p className="text-sm text-slate-400">Cor: {m.colors[0]}</p>}

        {m.system === 'android' && options.length > 0 && (
          <fieldset className="card">
            <legend className="px-1 font-semibold">Configuração e jogos (opcional)</legend>
            <p className="mt-1 text-xs text-slate-400">A configuração inclui emuladores + front-end (ES-DE ou Cocoon). MicroSD Samsung Evo Plus.</p>
            <div className="mt-2 grid gap-2">
              {[{ code: '', label: 'Apenas consola', price: 0 },
                { code: 'X', label: 'Só configuração dos emuladores (sem microSD/jogos)', price: 30 },
                ...options.map(o => ({ code: o.code, price: Number(o.price),
                  label: `MicroSD ${o.microsd} · ${o.games}${o.max_games ? ` (escolhes até ${o.max_games})` : ''}` }))].map(o => (
                <label key={o.code || 'none'} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${option === o.code ? 'border-sky-500 bg-sky-500/10' : 'border-slate-700'}`}>
                  <span className="flex items-center gap-2"><input type="radio" name="option" checked={option === o.code} onChange={() => setOption(o.code)} /><span>{o.label}</span></span>
                  <b className="whitespace-nowrap">{o.price ? `+${eur(o.price)}` : '—'}</b>
                </label>))}
            </div>
          </fieldset>)}

        {((m.system === 'android' && m.bag_price) || capaPrice > 0) && (
          <fieldset className="card">
            <legend className="px-1 font-semibold">Extras</legend>
            <div className="mt-2 grid gap-2">
              {m.system === 'android' && m.bag_price && (
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-700 px-3 py-2">
                  <span className="flex items-center gap-2"><input type="checkbox" checked={extras.includes('bolsa')} onChange={() => toggleExtra('bolsa')} />Bolsa de armazenamento</span><b>+{eur(Number(m.bag_price))}</b></label>)}
              {capaPrice > 0 && (
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-700 px-3 py-2">
                  <span className="flex items-center gap-2"><input type="checkbox" checked={extras.includes('capa')} onChange={() => toggleExtra('capa')} />Capa de silicone</span><b>+{eur(capaPrice)}</b></label>)}
            </div>
          </fieldset>)}

        <section className="card space-y-3">
          <h2 className="font-semibold">Os teus dados</h2>
          <input className="input" placeholder="Nome *" autoComplete="name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} />
          <input className="input" placeholder="Telemóvel *" autoComplete="tel" inputMode="tel" required maxLength={20} value={phone} onChange={e => setPhone(e.target.value)} />
          <input className="input" placeholder="E-mail (opcional)" autoComplete="email" inputMode="email" maxLength={120} value={email} onChange={e => setEmail(e.target.value)} />

          <p className="pt-1 text-sm font-medium">Entrega</p>
          {([['maos_faro', 'Em mãos em Faro (grátis)'], ['registado', `Correio registado (+${ship.reg})`], ['cobranca', `Envio à cobrança (+${ship.cob})`]] as const).map(([k, l]) => (
            <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${delivery === k ? 'border-sky-500 bg-sky-500/10' : 'border-slate-700'}`}>
              <input type="radio" name="delivery" checked={delivery === k} onChange={() => { setDelivery(k); setPayment(k === 'cobranca' ? 'cobranca' : 'mbway'); }} />{l}</label>))}
          {needsAddress && <textarea className="input" rows={2} placeholder="Morada completa com código postal *" required maxLength={200} value={address} onChange={e => setAddress(e.target.value)} />}

          <p className="pt-1 text-sm font-medium">Pagamento</p>
          <div className="flex flex-wrap gap-2">
            {payOptions.map(([k, l]) => (
              <button type="button" key={k} onClick={() => setPayment(k)} className={`chip !px-4 !py-2 text-sm ${payment === k ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-200'}`}>{l}</button>))}
          </div>
          <textarea className="input" rows={2} placeholder="Notas (opcional)" maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} />
          {/* campo armadilha para robôs: invisível para pessoas */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" value={hp} onChange={e => setHp(e.target.value)} />

          <label className="flex items-start gap-2 text-xs text-slate-300">
            <input type="checkbox" className="mt-0.5" checked={consent} onChange={e => setConsent(e.target.checked)} required />
            <span>Aceito que a Star Tech use o meu nome, telemóvel e restantes dados só para tratar este pedido e me contactar. <Link href="/loja/privacidade/" className="underline" target="_blank">Saber mais</Link></span>
          </label>
        </section>

        <div className="card sticky bottom-3 z-10 border-sky-500/40 bg-slate-900">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-300">Total estimado (sem portes)</span>
            <span className="text-2xl font-bold text-sky-300">{eur(total)}</span>
          </div>
          {formError && <p className="mt-2 text-sm text-red-400">{formError}</p>}
          <button className="btn mt-2 w-full !py-3 text-base" disabled={busy || !consent}>{busy ? 'A enviar…' : m.in_stock ? 'Enviar pedido' : 'Fazer pré-reserva'}</button>
          <p className="mt-2 text-center text-xs text-slate-400">Sem pagamento agora. Confirmamos tudo contigo antes.{!m.in_stock ? ' Avisamos quando a consola chegar.' : ''}</p>
        </div>
      </form>
    </>
  );
}

export default function Page() { return <Suspense fallback={null}><Model /></Suspense>; }
