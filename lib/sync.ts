import { supabase } from './supabase';
// Atualiza o catálogo WhatsApp em segundo plano; nunca bloqueia nem lança erro.
export async function syncCatalog(): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('catalog-sync', { body: {} });
    if (error) return 'Catálogo: erro na sincronização';
    return data?.ok === false ? 'Catálogo: erro na sincronização' : 'Catálogo atualizado';
  } catch { return 'Catálogo: erro na sincronização'; }
}
