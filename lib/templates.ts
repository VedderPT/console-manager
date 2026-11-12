// Geração dos textos de anúncio a partir dos templates da especificação. Sem IA.
// Nunca gera listas de títulos de jogos: só contagens vindas dos dados.

export type TModel = {
  id: string; brand: string; name: string; system: 'linux' | 'android';
  shipping_text: string | null; bag_price: number | null; accessory: string | null;
  os_frontend: string | null; specs: string | null; games_url: string | null; games_64: string | null; games_128: string | null; games_extra: number | null;
};
export type TVersion = { id: string; label: string; price: number; sort: number };
export type TOption = { code: string; price: number; microsd: string | null; kind: string | null; games: string | null; max_games: string | null };

const eur = (n: number) => `${String(n).replace('.', ',')}€`;

/** Portes: até 500 g 5,50€ (à cobrança 10,90€); mais de 500 g 7,50€ (à cobrança 14,50€).
 *  Android e modelos com "7,50" = mais de 500 g. Modelos com "5,50 | 7,50" mostram os dois escalões. */
function shippingLine(m: TModel): string {
  const t = (m.shipping_text ?? '').replace(/\s/g, '');
  const big = m.system === 'android' || t === '7,50';
  const both = !big && t.includes('|');
  if (both) {
    return 'Opções de envio: Entrega em mãos em Faro (Grátis), Correio Registado (+5,50€ até 500g / +7,50€ acima de 500g), ' +
      'Envio à cobrança (+10,90€ até 500g / +14,50€ acima de 500g)';
  }
  const sh = big ? { reg: '7,50€', cob: '14,50€' } : { reg: '5,50€', cob: '10,90€' };
  return `Opções de envio: Entrega em mãos em Faro (Grátis), Correio Registado (+${sh.reg}), Envio à cobrança (+${sh.cob})`;
}
const PAGAMENTO = 'Opções de pagamento: MBWay, Transferência, Entrega em mãos (Faro), Envio à cobrança';

export const minPrice = (v: TVersion[]) => (v.length ? Math.min(...v.map(x => x.price)) : null);
const cleanLabel = (l: string) => l.replace(/^Padrão\s*/, '').replace(/^\((.*)\)$/, '$1');

export function title(platform: string, m: TModel): string {
  if (platform === 'olx' || platform === 'marketplace') return m.system === 'linux' ? `${m.name} | Oferta Bolsa Armazenamento` : m.name;
  if (platform === 'wallapop') return m.name;
  return m.name;
}

export function olxText(m: TModel, versions: TVersion[], colors: string[], options: TOption[]): string {
  const cores = colors.length ? colors.join(', ') : 'sob consulta';
  const L: string[] = [];
  if (m.system === 'linux') {
    L.push(`${m.name} | Oferta Bolsa Armazenamento`, '');
    if (m.os_frontend) L.push(`- Instalação ${m.os_frontend}`);
    if (m.games_64 || m.games_128) {
      const g = [m.games_64 && `${m.games_64} jogos (64GB)`, m.games_128 && `${m.games_128} jogos (128GB)`].filter(Boolean).join(' / ');
      L.push(`- Jogos incluídos: ${g}`);
    }
    L.push('- Cartão original substituído por microSD conforme disponibilidade.', '');
    for (const v of versions) L.push(`Versão ${v.label}: ${eur(v.price)}`);
    L.push('', `Disponível em: ${cores}`);
    if (m.specs) L.push('', m.specs);
    if (m.games_url) L.push('', `Lista de jogos: ${m.games_url}`);
    if (m.accessory) L.push('', `Opcional: ${m.accessory}`);
    L.push('', PAGAMENTO,
      shippingLine(m));
  } else {
    L.push(m.name, '', '- Todas as Consolas são novas, apenas abertas para controlo de qualidade, fotos, e configuração (se necessário)', '',
      `Cores disponíveis: ${cores}`, '', 'Opções:');
    for (const v of versions) L.push(`- Apenas Consola (${cleanLabel(v.label)}): ${eur(v.price)}`);
    L.push('', 'Opcional:', '- Instalação e Configuração Emuladores + Bios + Front-End (Não inclui jogos): +30€', '',
      'Opções c/ MicroSD Jogos + Configuração:');
    for (const o of options) {
      L.push(`${o.code} - MicroSD ${o.microsd} · ${o.games}${o.max_games ? ` (escolha até ${o.max_games})` : ''}: +${eur(o.price)}`);
    }
    if (m.bag_price) L.push('', `Opcional: Bolsa de Armazenamento: +${eur(m.bag_price)}`);
    if (m.games_url) L.push('', `Lista de jogos: ${m.games_url}`);
    if (m.specs) L.push('', m.specs);
    L.push('', 'Valores não são negociáveis, obrigado.', '', PAGAMENTO,
      shippingLine(m));
  }
  return L.join('\n');
}

export function wallapopText(m: TModel, versions: TVersion[], colors: string[]): string {
  const cores = colors.length ? colors.join(', ') : 'sob consulta';
  const ver = versions.map(v => cleanLabel(v.label)).join(' / ');
  const L = [`${m.name}${ver ? ` (${ver})` : ''}`,
    'Não compre neste anúncio, por favor envie mensagem com o modelo que tem interesse.', '',
    '- Todas as Consolas são novas, apenas abertas para controlo de qualidade e fotos.'];
  L.push(m.system === 'android'
    ? '- Não inclui MicroSD/Jogos/Configuração'
    : `- Inclui microSD com instalação${m.os_frontend ? ` ${m.os_frontend}` : ''}`);
  L.push('- Valores não são negociáveis', '', `Cores disponíveis: ${cores}`);
  if (m.bag_price) L.push(`Opcional: Bolsa Armazenamento: ${eur(m.bag_price)}`);
  if (m.games_url) L.push(`Lista de jogos: ${m.games_url}`);
  return L.join('\n');
}

export function vintedText(m: TModel, color: string, versionLabel: string | null): string {
  const inclui = m.system === 'android' ? 'Consola' : `Consola com microSD${m.os_frontend ? ` e instalação ${m.os_frontend}` : ''}`;
  return ['Consola ' + m.brand, '', 'Consola apenas aberta para controle de qualidade e fotos', '',
    `Modelo: ${m.name}${versionLabel ? ` (${cleanLabel(versionLabel)})` : ''}`, `Cor: ${color}`, '',
    `Inclui: ${inclui}`, 'Valores não são negociáveis.'].join('\n');
}

export function textFor(platform: string, m: TModel, versions: TVersion[], colors: string[], options: TOption[]): string {
  if (platform === 'wallapop') return wallapopText(m, versions, colors);
  return olxText(m, versions, colors, options);
}
