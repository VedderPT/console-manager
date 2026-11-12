'use client';
import { imageUrl } from '@/lib/supabase';

export default function ModelImage({ path, name, system, className = '' }: { path: string | null; name: string; system: 'linux' | 'android'; className?: string }) {
  const url = imageUrl(path);
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${system === 'linux' ? 'from-emerald-900/60 to-slate-900' : 'from-sky-900/60 to-slate-900'} ${className}`}>
      {url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt={name} className="h-full w-full object-contain p-2" loading="lazy" />
        : <div className="flex h-full w-full items-center justify-center text-4xl opacity-40">🎮</div>}
    </div>
  );
}
