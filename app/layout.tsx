import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = { title: 'Star Tech Gestão', manifest: '/manifest.json' };
export const viewport: Viewport = { themeColor: '#0f172a', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT"><body><main className="mx-auto max-w-2xl p-4 pb-24">{children}</main></body></html>
  );
}
