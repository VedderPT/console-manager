const MAP: [string, string][] = [
  ['azul gelo', '#9fd8f0'], ['amarelo', '#facc15'], ['laranja', '#fb923c'], ['vermelho', '#ef4444'],
  ['rosa', '#f472b6'], ['roxo', '#8b5cf6'], ['verde', '#22c55e'], ['azul', '#3b82f6'],
  ['cinzento', '#9ca3af'], ['branco', '#f8fafc'], ['preto', '#18181b'],
];
export function colorHex(name: string): string {
  const n = name.toLowerCase();
  return MAP.find(([k]) => n.includes(k))?.[1] ?? '#64748b';
}
export const isTransparent = (name: string) => /transparente|crystal/i.test(name);
