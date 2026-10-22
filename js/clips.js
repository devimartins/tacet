// Seleção de cortes: monta janelas de transcrição, ajusta os limites às palavras reais e descarta sobreposições.
export const WINDOW = 480, STEP = 450;
export const linesFor = (words, t0, win = WINDOW) => {
  const seg = words.filter(w => w.s >= t0 && w.s < t0 + win), out = [];
  for (let i = 0; i < seg.length; i += 12) out.push(`[${seg[i].s.toFixed(1)}] ` + seg.slice(i, i + 12).map(x => x.w).join(' '));
  return out.join('\n');
};
export function snap(words, c) {
  const s0 = Number(c.start), e0 = Number(c.end);
  if (!Number.isFinite(s0) || !Number.isFinite(e0) || !(e0 - s0 >= 15 && e0 - s0 <= 75) || !words.length) return null;
  const near = (key, v) => words.reduce((a, b) => Math.abs(b[key] - v) < Math.abs(a[key] - v) ? b : a);
  const start = near('s', s0).s, end = near('e', e0).e;
  if (end - start < 10) return null;
  return { start, end, title: String(c.title || '').slice(0, 80), reason: String(c.reason || '').slice(0, 200), score: Math.max(0, Math.min(100, Math.round(Number(c.score) || 0))) };
}
export function pick(cands, dur) {
  const sorted = [...cands].sort((a, b) => b.score - a.score), keep = [];
  for (const c of sorted) if (keep.every(k => c.end <= k.start || c.start >= k.end)) keep.push(c);
  return keep.slice(0, Math.max(5, Math.min(20, Math.round(dur / 200)))).sort((a, b) => a.start - b.start).map((c, i) => ({ ...c, id: 'c' + (i + 1) }));
}
export async function suggestClips(words, dur, ask, onProgress) {
  const cands = []; let t0 = 0, n = 0; const total = Math.max(1, Math.ceil(dur / STEP));
  while (t0 < dur) {
    const lines = linesFor(words, t0);
    if (lines.length >= 20) { try { for (const c of await ask(lines)) { const s = snap(words, c); if (s) cands.push(s); } } catch (e) { if (e && e.fatal) throw e; } }
    t0 += STEP; onProgress && onProgress(++n / total);
  }
  return pick(cands, dur);
}

// Seleção local (sem IA): janelas de 25 a 60 s em limites de frase, pontuadas por gancho, densidade de fala e pausas.
const HOOK = /^(voc[eê]|ningu[eé]m|nunca|sempre|segredo|erro|verdade|cuidado|aten[cç][aã]o|por que|porque|como|quando|o que|quem|n[aã]o|sabe|imagine|entenda|lembre|pare|olha)\b/i;
const STRONG = /(deus|vida|amor|f[eé]|dinheiro|medo|sucesso|verdade|tempo|segredo|erro|valor|esperan[cç]a|mudar|mudan[cç]a|importante|principal|exemplo|problema|solu[cç][aã]o)/i;
export function localClips(words, dur, taken = [], want = 8) {
  if (!words.length) return [];
  const sent = []; let a = 0;
  words.forEach((w, i) => { const last = i === words.length - 1, gap = !last && words[i + 1].s - w.e > 1.2; if (last || gap || /[.?!…]["”)]?$/.test(w.w)) { sent.push({ a, b: i, s: words[a].s, e: w.e }); a = i + 1; } });
  const cands = [];
  for (let i = 0; i < sent.length; i++) {
    let j = i; while (j < sent.length - 1 && sent[j].e - sent[i].s < 25) j++;
    const len = sent[j].e - sent[i].s; if (len < 20 || len > 60) continue;
    const ws = words.slice(sent[i].a, sent[j].b + 1), txt = ws.map(x => x.w).join(' ');
    let pauses = 0; for (let k = 1; k < ws.length; k++) if (ws[k].s - ws[k - 1].e > 0.8) pauses++;
    const rate = ws.length / len, first = ws.slice(0, 14).map(x => x.w).join(' ');
    let sc = 50 + (HOOK.test(first) ? 10 : 0) + (/\?/.test(first) ? 8 : 0) + (/\d/.test(first) ? 4 : 0) + Math.min(10, (txt.match(new RegExp(STRONG.source, 'gi')) || []).length * 2) + (rate >= 2 && rate <= 3.8 ? 8 : 0) - pauses * 2;
    sc = Math.max(40, Math.min(85, Math.round(sc)));
    const t = ws.slice(0, 7).map(x => x.w).join(' ').replace(/[.,;:!?…]+$/, '');
    cands.push({ start: sent[i].s, end: sent[j].e, title: t.charAt(0).toUpperCase() + t.slice(1) + '…', reason: 'Seleção automática: fala contínua, com começo claro e sentido próprio.', score: sc, auto: 1 });
  }
  const out = [], free = c => [...taken, ...out].every(k => c.end <= k.start - 3 || c.start >= k.end + 3);
  for (const c of cands.sort((x, y) => y.score - x.score)) { if (out.length >= want) break; if (free(c)) out.push(c); }
  return out.sort((x, y) => x.start - y.start);
}
export const cutsWanted = dur => Math.max(6, Math.min(16, Math.round(dur / 240)));
