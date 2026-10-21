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
// Auto-zoom: aproxima só em momentos de ênfase (início de frase após pausa, perguntas/exclamações, palavra longa),
// com entrada suave, no máximo uma vez a cada ~2,5 s, e volta ao normal depois. Intensidade ajustável (nível 1.04–1.16).
const zCache = new WeakMap();
function zoomPlan(chunks) {
  const segs = []; let lastEnd = -9, lastStart = -9;
  chunks.forEach((c, i) => {
    const prev = chunks[i - 1], pw = prev && prev[prev.length - 1], s = c[0].s, e = c[c.length - 1].e;
    const sentenceStart = !pw || /[.!?…]$/.test(pw.w) || s - pw.e > 0.5, emph = c.some(w => /[!?]$/.test(w.w) || w.w.replace(/[^\p{L}]/gu, '').length >= 9);
    if ((sentenceStart || emph) && s - lastStart >= 2.5) { segs.push([s, Math.min(e + 0.5, s + 2.2)]); lastStart = s; lastEnd = segs[segs.length - 1][1]; }
  });
  return segs;
}
export function zoomAt(chunks, t, level = 1.1, ramp = 0.35) {
  let p = zCache.get(chunks); if (!p) { p = zoomPlan(chunks); zCache.set(chunks, p); }
  const e = x => x * x * (3 - 2 * x); let z = 0;
  for (const [a, b] of p) { if (t < a) break; const k = t < b ? Math.min(1, (t - a) / ramp) : Math.max(0, 1 - (t - b) / 0.5); z = Math.max(z, e(k)); }
  return 1 + (level - 1) * z;
}
// Auto-corte: contagem regressiva no início, hesitações e vícios de fala isolados por pausas (usos com sentido ficam).
const NUM = { '0': 0, zero: 0, '1': 1, um: 1, uma: 1, '2': 2, dois: 2, '3': 3, três: 3, tres: 3, '4': 4, quatro: 4, '5': 5, cinco: 5 };
const HES = /^(a+h*m+|ã+h*n?|h+m+|u+h+m*|e+h+m*|é{2,}h*|a{3,}h*|hum+|ahn+|ãhn+|uhm+)$/;
const SOFT = new Set(['né', 'tipo', 'assim', 'então', 'aí', 'ai', 'é', 'tá', 'ta', 'bom', 'tipo assim']);
const nrm = w => w.toLowerCase().replace(/[.,!?;:…"'()-]/g, '');
export function autoCuts(words, from, to, sens = 2) {
  const w = words.filter(x => x.e > from && x.s < to), out = [], thr = [0.45, 0.28, 0.16][sens - 1] ?? 0.28;
  const used = new Set(), add = (a, b, kind, text, key) => out.push({ a: Math.max(from, a), b: Math.min(to, b), kind, text, key });
  // contagem regressiva nos primeiros 8 s: sequência decrescente de ≥3 números terminando em 1 ou 0
  const t0 = w.length ? w[0].s : from;
  for (let i = 0; i < w.length && w[i].s < t0 + 8; i++) {
    if (NUM[nrm(w[i].w)] == null) continue;
    let j = i, prev = NUM[nrm(w[i].w)]; const seq = [i];
    while (j + 1 < w.length && NUM[nrm(w[j + 1].w)] === prev - 1 && w[j + 1].s - w[j].e < 1.2) { j++; prev--; seq.push(j); }
    if (seq.length >= 3 && prev <= 1) { add(w[i].s - 0.02, w[j].e + 0.05, 'contagem', w.slice(i, j + 1).map(x => x.w).join(' '), +w[i].s.toFixed(2)); seq.forEach(k => used.add(k)); break; }
  }
  // hesitações óbvias (aaam, hum, ééé…) e vícios isolados por pausa ou repetidos
  for (let i = 0; i < w.length; i++) {
    if (used.has(i)) continue; const n = nrm(w[i].w);
    if (HES.test(n)) { add(w[i].s - 0.03, w[i].e + 0.03, 'hesitação', w[i].w, +w[i].s.toFixed(2)); used.add(i); continue; }
    if (!SOFT.has(n)) continue;
    let j = i; while (j + 1 < w.length && SOFT.has(nrm(w[j + 1].w)) && w[j + 1].s - w[j].e < 0.25) j++;
    const before = i ? w[i].s - w[i - 1].e : 9, after = j + 1 < w.length ? w[j + 1].s - w[j].e : 9, rep = j > i || (i && nrm(w[i - 1].w) === n);
    if (before >= thr || after >= thr || (rep && sens >= 2)) {
      if (!(i === 0 && after < thr)) { add(w[i].s - 0.03, w[j].e + 0.03, 'vício', w.slice(i, j + 1).map(x => x.w).join(' '), +w[i].s.toFixed(2)); for (let k = i; k <= j; k++) used.add(k); }
    }
    i = j;
  }
  return out.filter(r => r.b > r.a);
}
// junta pausas longas + auto-cortes (sem os que o usuário desmarcou) em intervalos ordenados e sem sobreposição
export function cutRanges(words, from, to, fx = {}, all = words) {
  let r = fx.cut ? silences(words, from, to) : [];
  if (fx.acut) r = r.concat(autoCuts(all, from, to, fx.acutS || 2).filter(c => !(fx.acutSkip || []).includes(c.key)).map(c => [c.a, c.b]));
  r.sort((x, y) => x[0] - y[0]); const m = [];
  for (const q of r) { const l = m[m.length - 1]; if (l && q[0] <= l[1] + 0.02) l[1] = Math.max(l[1], q[1]); else m.push([q[0], q[1]]); }
  return m;
}
