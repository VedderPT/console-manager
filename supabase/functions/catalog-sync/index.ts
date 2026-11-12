// Sincroniza o catálogo WhatsApp (Meta) com o stock: um artigo por modelo.
// Com stock = visível; sem stock = oculto (nunca reativa sozinho um modelo que o dono ocultou à mão: só publica o que tem stock).
// Segredos: META_CATALOG_TOKEN (obrigatório). Opcionais: META_CATALOG_ID, CATALOG_LINK.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const token = Deno.env.get('META_CATALOG_TOKEN');
    const catalogId = Deno.env.get('META_CATALOG_ID') ?? '1307962459767863';
    const link = Deno.env.get('CATALOG_LINK') ?? 'https://wa.me/';
    if (!token) return json({ error: 'META_CATALOG_TOKEN não definido' }, 500);

    // Só o dono autenticado pode sincronizar.
    const authHeader = req.headers.get('Authorization') ?? '';
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await asUser.auth.getUser();
    if (!u?.user) return json({ error: 'não autenticado' }, 401);

    const body = await req.json().catch(() => ({}));
    const dry = body?.dry === true;

    const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const [m, v, s] = await Promise.all([
      db.from('models').select('id,brand,name,specs,os_frontend,image_path,active'),
      db.from('model_versions').select('model_id,price'),
      db.from('model_stock').select('model_id,available'),
    ]);
    if (m.error || v.error || s.error) return json({ error: (m.error ?? v.error ?? s.error)!.message }, 500);

    const stock = new Map<string, number>();
    (s.data ?? []).forEach((r) => stock.set(r.model_id, (stock.get(r.model_id) ?? 0) + Number(r.available)));
    const minPrice = new Map<string, number>();
    (v.data ?? []).forEach((r) => { const p = Number(r.price); if (!minPrice.has(r.model_id) || p < minPrice.get(r.model_id)!) minPrice.set(r.model_id, p); });

    const skipped: string[] = [];
    const requests: unknown[] = [];
    for (const x of m.data ?? []) {
      const price = minPrice.get(x.id);
      if (!x.active || price === undefined) continue;
      const inStock = (stock.get(x.id) ?? 0) > 0;
      if (!x.image_path) { skipped.push(`${x.name} (sem foto)`); continue; }
      const image = `${url}/storage/v1/object/public/model-images/${x.image_path}`;
      const desc = [x.specs, x.os_frontend].filter(Boolean).join(' · ') || `${x.brand} ${x.name}`;
      requests.push({
        method: 'UPDATE',
        data: {
          id: x.id, title: x.name, description: desc, brand: x.brand, condition: 'new',
          availability: inStock ? 'in stock' : 'out of stock',
          visibility: inStock ? 'published' : 'hidden',
          price: `${price.toFixed(2)} EUR`, link, image_link: image,
        },
      });
    }

    if (dry) return json({ dry: true, items: requests.length, skipped });
    if (!requests.length) return json({ ok: true, items: 0, skipped });

    const res = await fetch(`https://graph.facebook.com/v21.0/${catalogId}/items_batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ item_type: 'PRODUCT_ITEM', allow_upsert: true, requests }),
    });
    const out = await res.json();
    await db.from('sync_logs').insert({ platform: 'whatsapp', action: 'items_batch', ok: res.ok, detail: JSON.stringify(out).slice(0, 1000) });
    return json({ ok: res.ok, items: requests.length, skipped, meta: out }, res.ok ? 200 : 502);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
