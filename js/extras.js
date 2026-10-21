// Extras de edição que rodam 100% no navegador: emojis automáticos nas legendas e efeitos sonoros sintetizados.
const D = {
  '❤️': 'amor coracao paixao love heart', '😂': 'rir risada engracado kkk haha funny lol', '🔥': 'fogo quente incrivel hot fire bomba viral', '💰': 'dinheiro grana money rico lucro ganhar faturar', '🚀': 'foguete crescer crescimento rapido lancar launch growth',
  '💡': 'ideia dica insight idea tip', '✅': 'certo correto pronto feito verdade sucesso done', '❌': 'errado erro nunca nao jamais wrong never', '⚠️': 'cuidado atencao perigo alerta warning', '🎯': 'objetivo meta foco alvo goal focus',
  '😱': 'chocante surpresa susto choque shock wow', '🤯': 'inacreditavel absurdo surreal mindblown', '👀': 'olha veja ver olhar atento watch look', '👇': 'abaixo embaixo clique link below', '👉': 'aqui isso este esse proximo',
  '🙏': 'obrigado obrigada gratidao agradecer please thanks', '💪': 'forca forte esforco disciplina strong power', '🧠': 'cerebro mente mental pensar brain mind', '⏰': 'tempo hora relogio rapido time', '📈': 'aumentar subir resultado crescimento resultados lucro',
  '📉': 'cair queda perder caiu', '🏆': 'campeao vencer vitoria premio melhor win winner', '⭐': 'estrela favorito destaque star', '🎉': 'parabens festa comemorar celebrar party', '😍': 'lindo amei adorei apaixonado love',
  '😢': 'triste chorar sofrer sad cry', '😡': 'raiva odio bravo irritado angry', '🤔': 'duvida pensar sera talvez hmm', '💬': 'conversa comentar comentario talk comment', '📱': 'celular telefone app aplicativo phone',
  '💻': 'computador site internet codigo laptop', '🎬': 'video filme cena gravar camera', '🎵': 'musica som cancao music', '🍕': 'pizza', '☕': 'cafe', '🏠': 'casa lar home', '🚗': 'carro dirigir car', '✈️': 'viagem aviao voar viajar travel',
  '🌎': 'mundo planeta global world', '🔑': 'chave segredo key secret', '🔒': 'seguro seguranca privado secure', '🎁': 'presente gratis brinde gift free', '👏': 'palmas aplauso bravo clap', '👍': 'bom otimo legal curtir like good', '🤝': 'parceria acordo deal fechar',
  '💎': 'valioso premium diamante exclusivo', '⚡': 'energia raio rapido power', '🧩': 'solucao quebra-cabeca puzzle', '📚': 'livro estudar aprender estudo book', '🎓': 'curso formatura faculdade', '🏋️': 'treino academia treinar gym', '🥇': 'primeiro primeira numero1 ouro',
};
const MAP = new Map();
for (const [e, ws] of Object.entries(D)) ws.split(' ').forEach(w => { if (!MAP.has(w)) MAP.set(w, e); });
const key = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// Acrescenta no máximo um emoji a cada ~2,5 s para não poluir; nunca no mesmo emoji duas vezes seguidas.
// Por tom: troca/limita emojis para combinar com o clima do vídeo (dramático e reflexivo ficam sóbrios).
const TONE = {
  dramatico: { gap: 4, ban: '😂🎉😍🍕👏🥇🚀', extra: { dor: '💔', morte: '🕯️', medo: '😨', sozinho: '🌑', sozinha: '🌑', perdi: '💔', guerra: '⚔️' } },
  reflexivo: { gap: 4, ban: '😂🎉🍕👏🥇🚀😡', extra: { vida: '🌱', tempo: '⏳', silencio: '🤫', caminho: '🛤️', paz: '🕊️', escolha: '🧭' } },
  inspirador: { gap: 3, ban: '😂😡', extra: { sonho: '✨', sonhos: '✨', fe: '🙏', coragem: '💪', esperanca: '🌅', vencer: '🏆', futuro: '🌄' } },
  epico: { gap: 3, ban: '😂🍕', extra: { guerra: '⚔️', batalha: '⚔️', gloria: '🏆', forca: '💪', heroi: '🦸', fogo: '🔥', lenda: '👑' } },
  calmo: { gap: 4, ban: '😂😡🔥🚀⚡', extra: { calma: '🌿', respirar: '🌬️', paz: '🕊️', tranquilo: '🌿' } },
  animado: { gap: 2, ban: '', extra: { festa: '🎉', bora: '🚀', vamos: '🚀', demais: '🤩' } },
};
export function addEmojis(words, gap = 2.5, tone = '') {
  const T = TONE[tone]; if (T) gap = Math.max(gap, T.gap);
  let last = -1e9, prev = '';
  return words.map(w => {
    const k = key(w.w); let e = T && T.extra[k] || MAP.get(k); if (e && T && T.ban.includes(e) && !(T.extra[k])) e = null;
    if (!e || e === prev || w.s - last < gap || /\p{Extended_Pictographic}/u.test(w.w)) return w;
    last = w.s; prev = e; return { ...w, w: w.w + ' ' + e };
  });
}

// Efeitos sonoros: eventos { t, kind } e síntese direta nos canais L/R (sem arquivos nem licenças).
export function sfxEvents(chunks, overlays, shift, base) {
  const ev = []; chunks.forEach((c, i) => { if (i % 2 === 1 && c[0]) ev.push({ t: c[0].s, kind: 'whoosh' }); });
  (overlays || []).forEach(o => { if (o.kind === 'title') ev.push({ t: Math.max(0, shift(o.from) - base), kind: 'pop' }); });
  return ev.sort((a, b) => a.t - b.t);
}
export function addSfx(L, R, sr, events, gain = 0.28) {
  const N = L.length;
  for (const { t, kind } of events) {
    const o = Math.round(t * sr);
    if (kind === 'whoosh') { const n = Math.round(sr * 0.32); let y = 0; for (let i = 0; i < n && o + i < N; i++) { const x = i / n, env = Math.pow(Math.sin(Math.PI * x), 2), a = 0.015 + 0.55 * x * x; y += a * ((Math.random() * 2 - 1) - y); const v = y * env * gain * 3.2; L[o + i] += v; R[o + i] += v; } }
    else { const n = Math.round(sr * 0.14); let ph = 0; for (let i = 0; i < n && o + i < N; i++) { const x = i / n, f = 1100 - 700 * x; ph += 2 * Math.PI * f / sr; const v = Math.sin(ph) * Math.exp(-6 * x) * gain; L[o + i] += v; R[o + i] += v; } }
  }
}

// Redução de ruído simples e leve: passa-altas (corta rumble) + gate adaptativo que abaixa o chiado entre as falas.
// O piso de ruído é estimado pelo percentil 15 do volume em janelas de 20 ms; abaixo de ~2,5x esse piso o áudio é atenuado.
export function denoise(L, R, sr) {
  const N = L.length, a = Math.exp(-2 * Math.PI * 80 / sr);
  for (const X of [L, R]) { let px = 0, py = 0; for (let i = 0; i < N; i++) { const x = X[i]; py = a * (py + x - px); px = x; X[i] = py; } }
  const W = Math.max(1, Math.round(sr * 0.02)), M = Math.floor(N / W); if (M < 10) return;
  const e = new Float32Array(M); for (let m = 0; m < M; m++) { let s = 0; for (let i = m * W; i < (m + 1) * W; i++) s += L[i] * L[i] + R[i] * R[i]; e[m] = Math.sqrt(s / (2 * W)); }
  const sorted = Array.from(e).sort((x, y) => x - y), floor = Math.max(sorted[Math.floor(M * 0.15)], 1e-4), thr = floor * 2.5;
  let g = 1, hold = 0;
  const atk = Math.exp(-1 / (sr * 0.004)), rel = Math.exp(-1 / (sr * 0.15));
  for (let m = 0; m < M; m++) {
    if (e[m] > thr) hold = 8; else if (hold > 0) hold--;
    const target = hold > 0 ? 1 : 0.18;
    for (let i = m * W; i < (m + 1) * W; i++) { const c = target > g ? atk : rel; g = target + (g - target) * c; L[i] *= g; R[i] *= g; }
  }
}
