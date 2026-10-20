// Recursos de IA (via Worker + Groq): tradução das legendas, título de gancho e descrição com hashtags.
export async function assist(CFG, token, task, text, lang) {
  const r = await fetch(CFG.AI + '/assist', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ task, text, lang }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Falha na IA (' + r.status + ').');
  return j.result || {};
}
// Agrupa palavras em linhas curtas (pausa, fim de frase ou limite) para traduzir mantendo o contexto.
export function toLines(words, max = 9, gap = 0.7) {
  const out = []; let cur = [];
  words.forEach((w, i) => { cur.push(w); const nx = words[i + 1]; if (!nx || cur.length >= max || nx.s - w.e > gap || /[.!?…]$/.test(w.w)) { out.push(cur); cur = []; } });
  return out;
}
// Distribui as palavras traduzidas no mesmo intervalo de tempo da linha original, proporcional ao tamanho.
export function spread(line, translated) {
  const tk = String(translated || '').trim().split(/\s+/).filter(Boolean); if (!tk.length) return [];
  const s0 = line[0].s, span = Math.max(0.2, line[line.length - 1].e - s0), wt = tk.map(t => t.length + 1), tot = wt.reduce((a, b) => a + b, 0); let acc = 0;
  return tk.map((w, i) => { const s = s0 + span * acc / tot; acc += wt[i]; return { w, s, e: s0 + span * acc / tot }; });
}
export async function translateWords(words, call, lang, onProgress) {
  const L = toLines(words), out = [];
  for (let i = 0; i < L.length; i += 80) {
    const part = L.slice(i, i + 80), r = await call('translate', part.map((l, k) => (k + 1) + '|' + l.map(w => w.w).join(' ')).join('\n'), lang);
    if (!Array.isArray(r.lines) || r.lines.length !== part.length) throw new Error('A IA devolveu um formato inesperado. Tente de novo.');
    part.forEach((l, k) => out.push(...spread(l, String(r.lines[k]).replace(/^\s*\d+\s*[|.:)-]\s*/, ''))));
    onProgress && onProgress(Math.min(1, (i + 80) / L.length));
  }
  return out;
}
