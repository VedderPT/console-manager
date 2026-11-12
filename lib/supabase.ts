import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-key',
);

export type ColorStock = { model_id: string; model: string; color_id: string; color: string; available: number; reserved: number };
export type Model = { id: string; brand: string; name: string; system: 'linux' | 'android'; active: boolean; image_path: string | null };
export type Version = { id: string; model_id: string; label: string; price: number; sort: number };

export function imageUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from('model-images').getPublicUrl(path).data.publicUrl;
}

/** Reduz a imagem (máx. 900px) e re-codifica em JPEG: remove EXIF/GPS e poupa espaço. */
export async function shrinkImage(file: File, max = 900): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Falha ao processar imagem'))), 'image/jpeg', 0.85));
}
