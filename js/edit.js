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
// Auto-zoom com motivação (técnicas de edição): só entra quando a fala justifica, lendo o texto transcrito.
//  - slow:   aproximação lenta em fala emocional/seriedade/depoimento (dor, fé, verdade, perda…)
//  - punch:  zoom rápido em choque, revelação ou virada ("incrível", "de repente", "segredo", "!")
//  - detail: aproximação média quando o narrador aponta algo ("olha isso", "aqui", "esse botão")
//  - jump:   troca de escala seca (plano médio → fechado) no início de uma frase importante
//  - creep:  aproximação quase imperceptível em falas longas sem outro movimento
// Cada candidato recebe uma nota; só os melhores passam, com intervalo mínimo e no máximo 1 movimento forte a cada ~14 s.
const nrmW = w => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const setOf = s => new Set(s.split(' '));
const EMO = setOf('dor perdi perdeu perda morte morreu medo saudade amor fe deus jesus verdade serio seria sinceramente coragem sofri sofrimento vida familia mae pai filho filha lagrimas chorei chorar culpa perdao esperanca alma coracao nunca');
const SHOCK = setOf('incrivel absurdo chocante surpresa surpreendente impressionante inacreditavel repente segredo revelacao descobri descobriu imagina imagine milagre loucura');
const DET = setOf('olha olhem veja vejam repara perceba aqui esse essa isso botao clique clica tela link detalhe exemplo');
const sensOf = L => (L <= 1.065 ? 1 : L <= 1.125 ? 2 : 3);
const zCache = new WeakMap();
function zoomPlan(chunks, sens) {
  const words = chunks.flat(); if (words.length < 6) return [];
  const sents = []; let cur = [];
  words.forEach((w, i) => { cur.push(w); const nx = words[i + 1]; if (!nx || /[.!?…]$/.test(w.w.replace(/[^\p{L}\p{N}.!?…]+$/u, '')) || nx.s - w.e > 0.7) { sents.push(cur); cur = []; } });
  const thr = [4, 3, 2][sens - 1], cand = [];
  sents.forEach((sn, si) => {
    const s0 = sn[0].s, e0 = sn[sn.length - 1].e, d = e0 - s0, ks = sn.map(w => nrmW(w.w)), txt = sn.map(w => w.w).join(' ');
    const emo = ks.filter(k => EMO.has(k)).length, sh = ks.filter(k => SHOCK.has(k)).length, de = ks.filter(k => DET.has(k)).length;
    const bang = /!/.test(txt), q = /\?/.test(txt), pause = si ? s0 - sents[si - 1][sents[si - 1].length - 1].e : 0, n = sn.length;
    let kind = null, score = 0;
    if (sh || bang) { kind = 'punch'; score = 2 * sh + (bang ? 2 : 0); }
    else if (emo) { kind = 'slow'; score = 2 * emo + (d > 3 ? 1 : 0); }
    else if (de) { kind = 'detail'; score = de + 1; }
    if (q && n >= 4) score += 1;
    if (pause > 0.6 && n >= 5) score += 1;
    if (!kind && n >= 7 && pause > 0.6 && score >= 1) kind = 'jump';
    if (kind && score >= thr && d >= 0.8) cand.push({ a: s0, b: Math.min(e0 + 0.3, s0 + (kind === 'punch' ? 1.4 : 4.5)), kind, score });
  });
  // escolhe os melhores respeitando intervalos: 5 s entre movimentos, 14 s entre os fortes (punch/jump)
  const gapAny = [7, 5, 4][sens - 1], gapStrong = [18, 14, 10][sens - 1], out = [];
  cand.sort((x, y) => y.score - x.score || x.a - y.a).forEach(c => {
    const strong = c.kind === 'punch' || c.kind === 'jump';
    if (out.some(o => Math.abs(o.a - c.a) < gapAny || (strong && (o.kind === 'punch' || o.kind === 'jump') && Math.abs(o.a - c.a) < gapStrong))) return; out.push(c);
  });
  out.sort((x, y) => x.a - y.a);
  // aproximação lentíssima em trechos longos de fala sem nenhum movimento (mín. 18 s)
  let from = words[0].s; const marks = [...out.map(o => [o.a, o.b]), [words[words.length - 1].e + 1, words[words.length - 1].e + 1]];
  for (const [a, b] of marks) { if (a - from >= 18) out.push({ a: from + 2, b: Math.min(a - 0.5, from + 22), kind: 'creep', score: 0 }); from = Math.max(from, b); }
  return out.sort((x, y) => x.a - y.a);
}
export function zoomAt(chunks, t, level = 1.1) {
  const sens = sensOf(level); let m = zCache.get(chunks); if (!m) { m = {}; zCache.set(chunks, m); }
  const p = m[sens] || (m[sens] = zoomPlan(chunks, sens)), e = x => x * x * (3 - 2 * x), A = level - 1; let z = 0;
  for (const c of p) {
    if (t < c.a) break; const k = c.kind;
    if (k === 'slow') z = Math.max(z, A * (t < c.b ? e(Math.min(1, (t - c.a) / 1.2)) : Math.max(0, 1 - (t - c.b) / 0.6)));
    else if (k === 'punch') z = Math.max(z, 1.25 * A * (t < c.b ? e(Math.min(1, (t - c.a) / 0.2)) : e(Math.max(0, 1 - (t - c.b) / 0.5))));
    else if (k === 'detail') z = Math.max(z, 0.9 * A * (t < c.b ? e(Math.min(1, (t - c.a) / 0.4)) : Math.max(0, 1 - (t - c.b) / 0.4)));
    else if (k === 'jump') z = Math.max(z, 0.8 * A * (t < c.b ? e(Math.min(1, (t - c.a) / 0.25)) : e(Math.max(0, 1 - (t - c.b) / 0.4))));
    else if (k === 'creep') z = Math.max(z, 0.45 * A * (t < c.b ? (t - c.a) / (c.b - c.a) : Math.max(0, 1 - (t - c.b) / 0.5)));
  }
  return 1 + z;
}
export const zoomMoments = (chunks, level = 1.1) => { zoomAt(chunks, 0, level); return zCache.get(chunks)[sensOf(level)]; };
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
