'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { intlPhone, waLink, eur } from '@/lib/shop';
import Login from '../Login';

type Order = {
  id: string; ref: string; created_at: string; status: string; name: string; phone: string; email: string | null;
  model_name: string; version_label: string | null; color: string | null; option_code: string | null; extras: string | null;
  total: number | null; delivery: string; payment: string | null; address: string | null; notes: string | null;
};
const STATUS = ['novo', 'contactado', 'confirmado', 'enviado', 'cancelado'] as const;
const DELIVERY: Record<string, string> = { maos_faro: 'Em mãos em Faro', registado: 'Correio registado', cobranca: 'Envio à cobrança' };
const PAYMENT: Record<string, string> = { mbway: 'MBWay', transferencia: 'Transferência', maos: 'Dinheiro em mãos', cobranca: 'À cobrança' };

export default function Pedidos() {
  const { session, loading } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<'abertos' | 'todos'>('abertos');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) setError(error.message); else { setError(''); setOrders(data as Order[]); }
  }, []);
  useEffect(() => { if (session) load(); }, [session, load]);

  async function setStatus(o: Order, status: string) {
    const { error } = await supabase.from('orders').update({ status }).eq('id', o.id);
    if (error) setError(error.message); else await load();
  }
  async function remove(o: Order) {
    if (!window.confirm(`Apagar o pedido ${o.ref} de ${o.name}? Não dá para desfazer.`)) return;
    const { error } = await supabase.from('orders').delete().eq('id', o.id);
    if (error) setError(error.message); else await load();
  }

  if (loading) return <p className="mt-16 text-center text-slate-400">A carregar…</p>;
  if (!session) return <Login />;

  const shown = orders.filter(o => filter === 'todos' || !['enviado', 'cancelado'].includes(o.status));
  const novos = orders.filter(o => o.status === 'novo').length;

  return (
    <>
      <header>
        <p className="text-xs uppercase tracking-widest text-sky-400">Star Tech</p>
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <p className="text-sm text-slate-400">{novos} novo(s) · pedidos feitos no site /loja</p>
      </header>
      <div className="mt-3 flex gap-2">
        {(['abertos', 'todos'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`chip ${filter === f ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-200'}`}>{f === 'abertos' ? 'Em aberto' : 'Todos'}</button>))}
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {shown.length === 0 && !error && <p className="mt-8 text-center text-slate-400">Sem pedidos.</p>}
      <ul className="mt-4 space-y-3">
        {shown.map(o => {
          const when = new Date(o.created_at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
          const msg = `Olá ${o.name.split(' ')[0]}! Sou da Star Tech, recebi o teu pedido ${o.ref} (${o.model_name}). `;
          return (
            <li key={o.id} className={`card space-y-2 ${o.status === 'novo' ? 'border-sky-500/60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold leading-tight">{o.model_name}{o.version_label ? ` · ${o.version_label.replace(/^Padrão\s*/, '')}` : ''}</p>
                  <p className="text-xs text-slate-400">{o.ref} · {when}</p>
                </div>
                {o.total !== null && <b className="text-sky-300">{eur(Number(o.total))}</b>}
              </div>
              <p className="text-sm text-slate-300">
                {[o.color && `Cor ${o.color}`, o.option_code && `Opção ${o.option_code}`, o.extras].filter(Boolean).join(' · ') || 'Sem opções extra'}
              </p>
              <p className="text-sm"><b>{o.name}</b> · {o.phone}{o.email ? ` · ${o.email}` : ''}</p>
              <p className="text-sm text-slate-300">{DELIVERY[o.delivery]}{o.payment ? ` · ${PAYMENT[o.payment] ?? o.payment}` : ''}</p>
              {o.address && <p className="text-sm text-slate-300">📍 {o.address}</p>}
              {o.notes && <p className="rounded-lg bg-slate-950 p-2 text-sm text-slate-300">{o.notes}</p>}
              <div className="flex flex-wrap gap-2">
                <a className="btn" href={waLink(msg, intlPhone(o.phone))} target="_blank" rel="noreferrer">WhatsApp</a>
                <a className="btn-ghost" href={`tel:${o.phone}`}>Ligar</a>
                {o.email && <a className="btn-ghost" href={`mailto:${o.email}?subject=${encodeURIComponent('Pedido ' + o.ref + ' · Star Tech')}`}>E-mail</a>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {STATUS.map(s => (
                  <button key={s} onClick={() => setStatus(o, s)} className={`chip ${o.status === s ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>{s}</button>))}
                <button className="ml-auto text-xs text-red-400" onClick={() => remove(o)}>Apagar</button>
              </div>
            </li>);
        })}
      </ul>
    </>
  );
}
