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
  return keep.slice(0, Math.max(3, Math.min(12, Math.round(dur / 300)))).sort((a, b) => a.start - b.start).map((c, i) => ({ ...c, id: 'c' + (i + 1) }));
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
