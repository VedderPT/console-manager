import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-key',
);

export type ColorStock = { model_id: string; model: string; color_id: string; color: string; available: number; reserved: number };
export type Model = { id: string; brand: string; name: string; system: 'linux' | 'android'; active: boolean };
export type Version = { id: string; model_id: string; label: string; price: number; sort: number };
