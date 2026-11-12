import './globals.css';
import type { Metadata, Viewport } from 'next';
import Nav from './Nav';

export const metadata: Metadata = { title: 'Star Tech Gestão', manifest: '/manifest.json', icons: { apple: '/icon-180.png' }, appleWebApp: { capable: true, title: 'Star Tech', statusBarStyle: 'black-translucent' } };
export const viewport: Viewport = { themeColor: '#0f172a', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT"><body>
      <main className="mx-auto max-w-3xl p-4 pb-28">{children}</main>
      <Nav />
    </body></html>
  );
}
