'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from '@/lib/useSession';

const items = [['/', 'Stock', '▦'], ['/anuncios/', 'Anúncios', '✎'], ['/importar/', 'Importar', '⇪']] as const;

export default function Nav() {
  const { session } = useSession();
  const path = usePathname();
  if (!session) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl">
        {items.map(([href, label, icon]) => {
          const on = href === '/' ? path === '/' : path.startsWith(href.slice(0, -1));
          return (
            <Link key={href} href={href} className={`flex flex-1 flex-col items-center py-2 text-xs ${on ? 'text-sky-400' : 'text-slate-400'}`}>
              <span className="text-lg leading-none">{icon}</span>{label}
            </Link>);
        })}
      </div>
    </nav>
  );
}
