import { supabase, imageUrl } from './supabase';

export const SHOP_URL = 'https://console-manager.pages.dev';
export const WHATSAPP = '351912713922';
export const PHONE_SHOWN = '912 713 922';

export type ShopVersion = { id: string; label: string; price: number };
export type ShopModel = {
  id: string; brand: string; name: string; system: 'linux' | 'android';
  os_frontend: string | null; specs: string | null; games_url: string | null; games_64: string | null; games_128: string | null;
  bag_price: number | null; accessory: string | null; shipping_text: string | null; image_path: string | null;
  colors: string[]; versions: ShopVersion[]; photos: string[];
};
export type ShopOption = { code: string; price: number; microsd: string | null; kind: string | null; games: string | null; max_games: string | null };
export type Catalog = { models: ShopModel[]; options: ShopOption[] };

export async function fetchCatalog(): Promise<Catalog> {
  const { data, error } = await supabase.rpc('shop_catalog');
  if (error) throw new Error(error.message);
  return data as Catalog;
}

export const eur = (n: number) => `${String(n).replace('.', ',')} €`;
export const photoUrls = (m: ShopModel) => {
  const g = m.photos.map(p => imageUrl(p)).filter(Boolean) as string[];
  const cover = imageUrl(m.image_path);
  return g.length ? g : cover ? [cover] : [];
};
export const minPrice = (m: ShopModel) => (m.versions.length ? Math.min(...m.versions.map(v => Number(v.price))) : null);
export const waLink = (text: string, phone = WHATSAPP) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

/** Telemóvel PT (9 dígitos) → formato internacional para o wa.me. */
export function intlPhone(p: string) {
  const d = p.replace(/[^0-9]/g, '');
  return d.length === 9 ? `351${d}` : d;
}

/** Portes por peso. Android e modelos só com "7,50" = mais de 500 g. */
export function shippingPrices(m: Pick<ShopModel, 'system' | 'shipping_text'>) {
  const t = (m.shipping_text ?? '').replace(/\s/g, '');
  const big = m.system === 'android' || t === '7,50';
  if (!big && t.includes('|')) return { reg: '5,50 € (até 500 g) ou 7,50 € (mais de 500 g)', cob: '10,90 € ou 14,50 €' };
  return big ? { reg: '7,50 €', cob: '14,50 €' } : { reg: '5,50 €', cob: '10,90 €' };
}
