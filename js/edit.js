// Edições automáticas: remover silêncios (pelos vãos entre palavras) e auto-zoom. Usado na prévia e na exportação.
export function silences(words, from, to, gap = 0.6, pad = 0.12) {
  const w = words.filter(x => x.e > from && x.s < to), out = [];
  if (!w.length) return out;
  if (w[0].s - from > gap) out.push([from, w[0].s - pad]);
  for (let i = 1; i < w.length; i++) if (w[i].s - w[i - 1].e > gap) out.push([w[i - 1].e + pad, w[i].s - pad]);
  if (to - w[w.length - 1].e > gap) out.push([w[w.length - 1].e + pad, to]);
  return out.filter(r => r[1] - r[0] > 0.2);
}
export function makeShift(rem) {   // tempo original → tempo sem os trechos removidos
  return t => { let d = 0; for (const [a, b] of rem) { if (t <= a) break; d += Math.min(t, b) - a; } return t - d; };
}
export const inRange = (rem, t) => rem.some(([a, b]) => t >= a && t < b);
// Auto-zoom: a cada frase alterna entre enquadramento normal e aproximado, com uma entrada rápida.
export function zoomAt(chunks, t, level = 1.12, ramp = 0.18) {
  let k = -1; for (let i = 0; i < chunks.length; i++) if (t >= chunks[i][0].s) k = i; else break;
  if (k < 0) return 1;
  const at = i => (i % 2 ? level : 1), p = Math.min(1, Math.max(0, (t - chunks[k][0].s) / ramp)), e = 1 - (1 - p) * (1 - p);
  return at(k - 1) + (at(k) - at(k - 1)) * e;
}
