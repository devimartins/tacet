// Edição da transcrição preservando o tempo das palavras que o usuário não mexeu.
const norm = s => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export const tokens = t => t.trim().split(/\s+/).filter(Boolean);
export function spread(toks, a, b) { const t = toks.reduce((x, w) => x + w.length + 2, 0) || 1; let c = a; return toks.map(w => { const d = (w.length + 2) / t * (b - a); const o = { w, s: +c.toFixed(2), e: +(c + d).toFixed(2) }; c += d; return o; }); }
export function retime(old, toks, dur) {
  if (!old.length) return spread(toks, 0, dur);
  if (old.length === toks.length) return old.map((o, i) => ({ ...o, w: toks[i] }));
  let p = 0; while (p < old.length && p < toks.length && norm(old[p].w) === norm(toks[p])) p++;
  let q = 0; while (q < old.length - p && q < toks.length - p && norm(old[old.length - 1 - q].w) === norm(toks[toks.length - 1 - q])) q++;
  const a = old.slice(p, old.length - q), b = toks.slice(p, toks.length - q);
  const s = p ? old[p - 1].e : 0, e = q ? old[old.length - q].s : Math.max(dur, old[old.length - 1].e);
  let mid;
  if (!b.length) mid = [];
  else if (!a.length || a.length * b.length > 2e6) mid = spread(b, s, Math.max(e, s + .05 * b.length));
  else {
    const m = a.length, n = b.length, L = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
    for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = (norm(a[i].w) && norm(a[i].w) === norm(b[j])) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    mid = []; let i = 0, j = 0;
    while (j < n) {
      if (i < m && norm(a[i].w) && norm(a[i].w) === norm(b[j]) && L[i][j] === L[i + 1][j + 1] + 1) { mid.push({ ...a[i], w: b[j] }); i++; j++; }
      else if (i < m && L[i + 1][j] >= L[i][j + 1]) i++;
      else { mid.push({ w: b[j], _n: 1 }); j++; }
    }
    let k = 0;
    while (k < mid.length) {
      if (!mid[k]._n) { k++; continue; }
      let k2 = k; while (k2 < mid.length && mid[k2]._n) k2++;
      const lo = k ? mid[k - 1].e : s, hi = k2 < mid.length ? mid[k2].s : e;
      spread(mid.slice(k, k2).map(x => x.w), lo, Math.max(hi, lo + .05 * (k2 - k))).forEach((x, t) => mid[k + t] = x); k = k2;
    }
  }
  return [...old.slice(0, p), ...mid, ...old.slice(old.length - q)];
}
// Resposta do Whisper (palavras com start/end) → [{w,s,e}], somando o deslocamento do bloco.
// O Whisper devolve palavras sem pontuação nem maiúsculas; o texto completo (data.text) vem pontuado.
// Alinha as duas listas para cada palavra herdar a pontuação e a capitalização do texto do modelo.
const nz = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
function punctuate(words, text) {
  const toks = String(text || '').trim().split(/\s+/).filter(Boolean); if (!toks.length) return words;
  let j = 0;
  return words.map(o => {
    const k = nz(o.w); if (!k) return o;
    for (let d = 0; d < 4 && j + d < toks.length; d++) {
      if (nz(toks[j + d]) === k) { const w = toks[j + d]; j += d + 1; return w === o.w ? o : { ...o, w }; }
    }
    return o;
  });
}
export const fromWhisper = (data, offset) => punctuate((data.words || []).map(x => ({ w: String(x.word).trim(), s: +(x.start + offset).toFixed(2), e: +(x.end + offset).toFixed(2) })).filter(x => x.w), data.text);

// Capitalização contextual (só maiúsculas/minúsculas; nunca troca nem apaga palavras):
// início de frase, nomes sagrados e próprios comuns, "Espírito Santo".
const PROPER = new Set(['deus', 'jesus', 'cristo', 'jeová', 'javé', 'bíblia', 'brasil', 'portugal', 'israel', 'jerusalém', 'maria', 'pai nosso'].filter(x => !x.includes(' ') && x !== 'maria'));
const split = w => { const m = /^(\P{L}*)(\p{L}[\p{L}\p{N}'’-]*)(.*)$/su.exec(w); return m ? [m[1], m[2], m[3]] : null; };
const cap = w => { const p = split(w); return p ? p[0] + p[1][0].toLocaleUpperCase('pt-BR') + p[1].slice(1) + p[2] : w; };
// Fim de frase por pausa: se o modelo não pontuou e há silêncio longo até a próxima palavra, fecha a frase com ponto.
const END = /[.!?…]["')\]]*$/, ANY = /[.,;:!?…]["')\]]*$/;
export function endSentences(words, gap = 0.8) {
  return words.map((o, i) => {
    const n = words[i + 1], last = !n;
    if (END.test(o.w)) return o;
    if (last || (n.s - o.e >= gap)) return { ...o, w: o.w.replace(/[,;:]+(["')\]]*)$/, '$1') + '.' };
    return o;
  });
}
// Vírgulas: pausa curta sem pontuação vira vírgula, e conjunções adversativas pedem vírgula antes ("..., mas ...").
const CONJ = new Set(['mas', 'porém', 'contudo', 'todavia', 'entretanto', 'senão', 'portanto', 'logo']);
export function commas(words, lo = 0.35, hi = 0.8) {
  let run = 0;
  return words.map((o, i) => {
    const n = words[i + 1]; let w = o.w;
    if (ANY.test(w)) { run = 0; return o; }
    run++;
    if (n) {
      const gap = n.s - o.e, nc = split(n.w)?.[1].toLocaleLowerCase('pt-BR');
      if (run >= 3 && ((gap >= lo && gap < hi) || (CONJ.has(nc) && !ANY.test(w)))) { run = 0; return { ...o, w: w + ',' }; }
    }
    return o;
  });
}
// Perguntas: frase curta, sem vírgula, que começa por palavra interrogativa e terminou em ponto, vira "?".
const Q1 = new Set(['qual', 'quais', 'quanto', 'quantos', 'quanta', 'quantas']);
export function questions(words) {
  let a = 0;
  return words.map((o, i) => {
    if (!END.test(o.w)) return o;
    const seg = words.slice(a, i + 1); a = i + 1;
    if (seg.length > 12 || seg.some((x, k) => k < seg.length - 1 && /[,;:]/.test(x.w))) return o;
    const f = split(seg[0].w)?.[1].toLocaleLowerCase('pt-BR'), f2 = seg[1] ? split(seg[1].w)?.[1].toLocaleLowerCase('pt-BR') : '';
    const q = Q1.has(f) || (f === 'por' && f2 === 'que') || (f === 'será' && f2 === 'que') || (f === 'você' && /\b(sabe|já|tem|quer|acha)\b/.test(seg.slice(1, 3).map(x => x.w.toLowerCase()).join(' ')) && false);
    return q && /\.$/.test(o.w) ? { ...o, w: o.w.replace(/\.$/, '?') } : o;
  });
}
// Palavras comuns que o modelo às vezes capitaliza no meio da frase.
const LOW = new Set(['e', 'de', 'da', 'do', 'das', 'dos', 'que', 'para', 'pra', 'com', 'mas', 'em', 'na', 'no', 'nas', 'nos', 'um', 'uma', 'os', 'as', 'a', 'o', 'por', 'se', 'ou', 'eu', 'você', 'ele', 'ela', 'nós', 'não', 'é', 'foi', 'são', 'tem', 'muito', 'mais', 'quando', 'como', 'então', 'porque', 'também', 'já', 'só', 'isso', 'esse', 'essa', 'este', 'esta']);
export function fixCase(words) {
  words = questions(endSentences(commas(words)));
  let start = true;
  return words.map((o, i) => {
    let w = o.w; const p = split(w), core = p ? p[1].toLocaleLowerCase('pt-BR') : '', prev = i ? split(words[i - 1].w)?.[1].toLocaleLowerCase('pt-BR') : '', next = words[i + 1] ? split(words[i + 1].w)?.[1].toLocaleLowerCase('pt-BR') : '';
    if (!start && p && LOW.has(core) && p[1] !== p[1].toLocaleLowerCase('pt-BR') && p[1] !== p[1].toLocaleUpperCase('pt-BR')) w = p[0] + core + p[2];
    if (start || PROPER.has(core) || (core === 'santo' && prev === 'espírito') || (core === 'espírito' && next === 'santo')) w = cap(w);
    start = /[.!?…]["')\]]*$/.test(o.w);
    return w === o.w ? o : { ...o, w };
  });
}
