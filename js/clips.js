// Seleção de cortes: monta janelas de transcrição, ajusta os limites às palavras reais e descarta sobreposições.
export const WINDOW = 480, STEP = 450;
// Frases: terminam em pontuação final ou numa pausa longa. Toda a seleção de limites usa frases inteiras.
const END = /[.?!…]["”')\]]*$/;
const CONN = /^(e|mas|ent[aã]o|a[ií]|isso|porque|pois|que|ou|tipo|tamb[eé]m|por isso|ali[aá]s|ent[aã]o)$/;
export function sentences(words) {
  const out = []; let a = 0;
  words.forEach((w, i) => { const last = i === words.length - 1; if (last || END.test(w.w) || words[i + 1].s - w.e > 1.2) { out.push({ a, b: i, s: words[a].s, e: w.e, w: words[a].w.toLowerCase().replace(/[^\p{L}]/gu, '') }); a = i + 1; } });
  return out;
}
// Linhas para a IA: uma frase por linha (quebra em 28 palavras), cada uma com o tempo em que começa.
export const linesFor = (words, t0, win = WINDOW, S = sentences(words)) => {
  const out = [];
  for (const x of S) {
    if (x.s < t0 || x.s >= t0 + win) continue;
    for (let i = x.a; i <= x.b; i += 28) out.push(`[${words[i].s.toFixed(1)}] ` + words.slice(i, Math.min(x.b + 1, i + 28)).map(y => y.w).join(' '));
  }
  return out.join('\n');
};
// Folga: começa um pouco antes da primeira palavra (pega a pausa) e termina logo depois do ponto final, sem invadir a fala vizinha.
export const padEdges = (S, i, j) => {
  const prev = i > 0 ? S[i - 1].e : 0, next = j < S.length - 1 ? S[j + 1].s : Infinity;
  const start = Math.max(Math.min(S[i].s, prev + 0.05), S[i].s - 0.6), end = Math.max(S[j].e, Math.min(next - 0.05, S[j].e + 0.5));
  return { start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100 };
};
// Ajusta o corte sugerido: começa no início de uma frase (voltando se ela depender da anterior) e termina no ponto final.
export function snap(words, c, S = sentences(words)) {
  const s0 = Number(c.start), e0 = Number(c.end);
  if (!Number.isFinite(s0) || !Number.isFinite(e0) || !(e0 - s0 >= 12 && e0 - s0 <= 90) || !S.length) return null;
  let i = S.findIndex(x => x.e > s0 + 0.05); if (i < 0) return null;
  for (let n = 0; n < 3 && i > 0 && CONN.test(S[i].w) && S[i].s - S[i - 1].s < 40; n++) i--;
  let j = i; for (let k = i; k < S.length; k++) if (Math.abs(S[k].e - e0) < Math.abs(S[j].e - e0)) j = k;
  while (j > i && S[j].e - S[i].s > 75) j--;
  while (j < S.length - 1 && S[j].e - S[i].s < 15) j++;
  const len = S[j].e - S[i].s; if (len < 10 || len > 80) return null;
  const { start, end } = padEdges(S, i, j);
  return { start, end, title: String(c.title || '').slice(0, 80), reason: String(c.reason || '').slice(0, 200), score: Math.max(0, Math.min(100, Math.round(Number(c.score) || 0))) };
}
export function pick(cands, dur) {
  const sorted = [...cands].sort((a, b) => b.score - a.score), keep = [];
  for (const c of sorted) if (keep.every(k => c.end <= k.start || c.start >= k.end)) keep.push(c);
  return keep.slice(0, Math.max(5, Math.min(20, Math.round(dur / 200)))).sort((a, b) => a.start - b.start).map((c, i) => ({ ...c, id: 'c' + (i + 1) }));
}
export async function suggestClips(words, dur, ask, onProgress) {
  const cands = [], S = sentences(words); let t0 = 0, n = 0; const total = Math.max(1, Math.ceil(dur / STEP));
  while (t0 < dur) {
    const lines = linesFor(words, t0, WINDOW, S);
    if (lines.length >= 20) { try { for (const c of await ask(lines)) { const s = snap(words, c, S); if (s) cands.push(s); } } catch (e) { if (e && e.fatal) throw e; } }
    t0 += STEP; onProgress && onProgress(++n / total);
  }
  return pick(cands, dur);
}

// Seleção local (sem IA): janelas de 25 a 60 s em limites de frase, pontuadas por gancho, densidade de fala e pausas.
const HOOK = /^(voc[eê]|ningu[eé]m|nunca|sempre|segredo|erro|verdade|cuidado|aten[cç][aã]o|por que|porque|como|quando|o que|quem|n[aã]o|sabe|imagine|entenda|lembre|pare|olha)\b/i;
const STRONG = /(deus|vida|amor|f[eé]|dinheiro|medo|sucesso|verdade|tempo|segredo|erro|valor|esperan[cç]a|mudar|mudan[cç]a|importante|principal|exemplo|problema|solu[cç][aã]o)/i;
export function localClips(words, dur, taken = [], want = 8) {
  if (!words.length) return [];
  const sent = sentences(words);
  const cands = [];
  for (let i = 0; i < sent.length; i++) {
    if (CONN.test(sent[i].w)) continue;
    let j = i; while (j < sent.length - 1 && sent[j].e - sent[i].s < 25) j++;
    const len = sent[j].e - sent[i].s; if (len < 20 || len > 60) continue;
    const ws = words.slice(sent[i].a, sent[j].b + 1), txt = ws.map(x => x.w).join(' ');
    let pauses = 0; for (let k = 1; k < ws.length; k++) if (ws[k].s - ws[k - 1].e > 0.8) pauses++;
    const rate = ws.length / len, first = ws.slice(0, 14).map(x => x.w).join(' ');
    let sc = 50 + (HOOK.test(first) ? 10 : 0) + (/\?/.test(first) ? 8 : 0) + (/\d/.test(first) ? 4 : 0) + Math.min(10, (txt.match(new RegExp(STRONG.source, 'gi')) || []).length * 2) + (rate >= 2 && rate <= 3.8 ? 8 : 0) - pauses * 2;
    sc = Math.max(40, Math.min(85, Math.round(sc)));
    const t = ws.slice(0, 7).map(x => x.w).join(' ').replace(/[.,;:!?…]+$/, '');
    cands.push({ ...padEdges(sent, i, j), title: t.charAt(0).toUpperCase() + t.slice(1) + '…', reason: 'Seleção automática: fala contínua, com começo claro e sentido próprio.', score: sc, auto: 1 });
  }
  const out = [], free = c => [...taken, ...out].every(k => c.end <= k.start - 3 || c.start >= k.end + 3);
  for (const c of cands.sort((x, y) => y.score - x.score)) { if (out.length >= want) break; if (free(c)) out.push(c); }
  return out.sort((x, y) => x.start - y.start);
}
export const cutsWanted = dur => Math.max(6, Math.min(16, Math.round(dur / 240)));
