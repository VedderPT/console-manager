'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

const items = [['/', 'Stock', '▦'], ['/fones/', 'Fones', '♪'], ['/anuncios/', 'Anúncios', '✎'], ['/pedidos/', 'Pedidos', '✉'], ['/importar/', 'Importar', '⇪']] as const;

export default function Nav() {
  const { session } = useSession();
  const path = usePathname();
  const [novos, setNovos] = useState(0);
  useEffect(() => {
    if (!session) return;
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'novo').then(r => setNovos(r.count ?? 0));
  }, [session, path]);
  if (!session || path.startsWith('/loja')) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl">
        {items.map(([href, label, icon]) => {
          const on = href === '/' ? path === '/' : path.startsWith(href.slice(0, -1));
          return (
            <Link key={href} href={href} className={`flex flex-1 flex-col items-center py-2 text-xs ${on ? 'text-sky-400' : 'text-slate-400'}`}>
              <span className="relative text-lg leading-none">{icon}{href === '/pedidos/' && novos > 0 && <span className="absolute -right-3 -top-1 rounded-full bg-sky-500 px-1 text-[10px] font-bold text-slate-950">{novos}</span>}</span>{label}
            </Link>);
        })}
      </div>
    </nav>
  );
}
