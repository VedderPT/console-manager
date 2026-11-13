import type { Metadata } from 'next';
import Link from 'next/link';
import { PHONE_SHOWN, waLink } from '@/lib/shop';

export const metadata: Metadata = {
  title: 'Star Tech · Consolas retro portáteis',
  description: 'Consolas portáteis retro Linux e Android, prontas a jogar. Faro, Portugal. Faz o teu pedido online.',
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="flex items-center justify-between gap-3">
        <Link href="/loja/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="h-9 w-9 rounded-lg" />
          <span><span className="block text-lg font-bold leading-none">Star Tech</span><span className="text-xs text-slate-400">Consolas retro · Faro</span></span>
        </Link>
        <a className="btn" href={waLink('Olá! Tenho uma dúvida sobre as consolas.')} target="_blank" rel="noreferrer">WhatsApp</a>
      </header>
      {children}
      <footer className="mt-10 border-t border-slate-800 pt-4 text-xs text-slate-500">
        <p>Star Tech · Faro, Portugal · {PHONE_SHOWN} · <a className="underline" href="https://instagram.com/startech.pt" target="_blank" rel="noreferrer">@startech.pt</a></p>
        <p className="mt-1"><Link href="/loja/privacidade/" className="underline">Privacidade</Link></p>
      </footer>
    </div>
  );
}
