// Seleção de cortes: monta janelas de transcrição, ajusta os limites às palavras reais e descarta sobreposições.
export const WINDOW = 480, STEP = 450;
// Frases: terminam em pontuação final ou numa pausa longa. Toda a seleção de limites usa frases inteiras.
const END = /[.?!…]["”')\]]*$/;
const CONN = /^(e|mas|ent[aã]o|a[ií]|da[ií]|isso|isto|esse|essa|esses|essas|este|esta|aquilo|aquele|aquela|ele|ela|eles|elas|ali|l[aá]|assim|porque|pois|que|ou|tipo|tamb[eé]m|ali[aá]s|ent[aã]o|s[oó]|por)$/;
export function sentences(words) {
  const out = []; let a = 0;
  words.forEach((w, i) => { const last = i === words.length - 1; if (last || END.test(w.w) || words[i + 1].s - w.e > 1.2) { out.push({ a, b: i, n: i - a + 1, s: words[a].s, e: w.e, l: w.w, w: words[a].w.toLowerCase().replace(/[^\p{L}]/gu, '') }); a = i + 1; } });
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
// Folga que depende da pausa real entre as frases. Sem pausa (fala emendada), quase nenhuma folga antes e uma cauda curta depois;
// com pausa, usa parte dela. Os tempos da transcrição têm precisão de cerca de 1 s, então o início não recua muito (não puxa a frase anterior)
// e o fim ganha cauda (não corta a última palavra). O ajuste fino por cartão cobre o restante.
export const padEdges = (S, i, j) => {
  const prev = i > 0 ? S[i - 1].e : -Infinity, next = j < S.length - 1 ? S[j + 1].s : Infinity;
  const gb = S[i].s - prev, ga = next - S[j].e;
  const lead = gb >= 0.8 ? Math.min(0.3, gb * 0.3) : 0.05, tail = ga >= 0.9 ? Math.min(0.9, ga * 0.6) : ga >= 0.3 ? Math.min(0.5, ga * 0.7) : 0.3;
  const start = Math.max(0, S[i].s - lead, prev + 0.05), end = Math.max(S[j].e, Math.min(next - 0.02, S[j].e + tail));
  return { start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100 };
};
// Abertura que depende do que veio antes: respostas e continuações. Fechamento aberto: pergunta sem resposta, dois-pontos, vírgula.
const ANS = /^(sim|n[aã]o|exato|exatamente|claro|com certeza|porque|pois|por isso|ou seja|ent[aã]o|a[ií]|e|mas|tamb[eé]m)$/;
const CONT = /^(porque|pois|por isso|ou seja|ent[aã]o|isso significa|isso quer dizer|e por isso|ali[aá]s|mas|e|a[ií])$/;
const isQ = x => /\?["”')\]]*$/.test(x.l), isOpen = x => /[:,;]["”')\]]*$/.test(x.l) || !END.test(x.l);
export function lead(S, i) {   // volta ao começo do raciocínio (até 3 frases, no máximo 22 s)
  for (let n = 0; n < 3 && i > 0; n++) {
    const x = S[i], p = S[i - 1], need = CONN.test(x.w) || ANS.test(x.w) || x.n < 5 || isQ(p) || isOpen(p);
    if (!need || x.s - p.s > 22 || x.s - p.e > 3) break; i--;
  }
  return i;
}
export function tailTo(S, j, i, max = 80) {   // avança até a ideia fechar (resposta da pergunta, continuação), respeitando o limite
  for (let n = 0; n < 3 && j < S.length - 1; n++) {
    const x = S[j], q = S[j + 1], more = isQ(x) || isOpen(x) || x.n < 4 || (CONT.test(q.w) && q.s - x.e < 1.5);
    if (!more || q.s - x.e > 2.5 || q.e - S[i].s > max) break; j++;
  }
  while (j > i && S[j].e - S[i].s > max) j--;
  while (j > i && (isQ(S[j]) || isOpen(S[j])) && S[j].e - S[i].s > 20) j--;   // sem resposta cabível: termina na frase anterior
  return j;
}
// Ajusta o corte sugerido: começa no início de uma frase (voltando se ela depender da anterior) e termina no ponto final.
export function snap(words, c, S = sentences(words)) {
  const s0 = Number(c.start), e0 = Number(c.end);
  if (!Number.isFinite(s0) || !Number.isFinite(e0) || !(e0 - s0 >= 12 && e0 - s0 <= 90) || !S.length) return null;
  let i = S.findIndex(x => x.e > s0 + 0.05); if (i < 0) return null;
  i = lead(S, i);
  let j = i; for (let k = i; k < S.length; k++) if (Math.abs(S[k].e - e0) < Math.abs(S[j].e - e0)) j = k;
  while (j < S.length - 1 && S[j].e - S[i].s < 15) j++;
  j = tailTo(S, j, i, 78);
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
    if (CONN.test(sent[i].w) || sent[i].n < 5) continue;
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
