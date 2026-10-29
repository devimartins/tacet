// Trilhas originais geradas no navegador (WebAudio): sem arquivos, sem direitos autorais, sem rede.
// Cada tom define andamento, escala, timbre e percussão; o resultado é um WAV de ~30 s que a mistura repete.
export const TONES = {
  dramatico: { name: 'Dramático', bpm: 72, root: 50, prog: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]], pad: 'sawtooth', lp: 700, arp: null, bass: 1, kick: 'heart', hat: 0, swell: 1, lead: 'cello', verb: 0.34, alt: [[[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -2, 2]], [[0, 3, 7], [-4, 0, 3], [-5, -2, 2], [-7, -3, 0]]] },
  reflexivo: { name: 'Reflexivo', bpm: 64, root: 57, prog: [[0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-2, 2, 5]], pad: 'sine', lp: 1800, arp: 'bell', bass: 0, kick: null, hat: 0, lead: 'bell', verb: 0.4, alt: [[[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-7, -3, 0]], [[0, 3, 7], [-5, -2, 2], [-4, 0, 3], [-2, 2, 5]]] },
  inspirador: { name: 'Inspirador', bpm: 92, root: 60, prog: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], pad: 'triangle', lp: 2600, arp: 'pluck', bass: 1, kick: 'soft', hat: 1, lead: 'pluck', snare: 1, verb: 0.25, alt: [[[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0]], [[0, 4, 7], [-7, -3, 0], [-3, 0, 4], [-5, -1, 2]]] },
  epico: { name: 'Épico', bpm: 104, root: 50, prog: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -2, 2]], pad: 'sawtooth', lp: 1500, arp: null, bass: 1, kick: 'big', hat: 0, swell: 1, stab: 1, lead: 'brass', snare: 1, verb: 0.3, alt: [[[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]], [[0, 3, 7], [-5, -2, 2], [-2, 2, 5], [-4, 0, 3]]] },
  calmo: { name: 'Calmo', bpm: 58, root: 53, prog: [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0]], pad: 'sine', lp: 1400, arp: null, bass: 0, kick: null, hat: 0, lead: 'soft', verb: 0.42, alt: [[[0, 4, 7], [-3, 0, 4], [-5, -1, 2], [-7, -3, 0]], [[0, 4, 7], [-7, -3, 0], [-5, -1, 2], [-3, 0, 4]]] },
  animado: { name: 'Animado', bpm: 120, root: 55, prog: [[0, 4, 7], [-3, 0, 4], [-5, -1, 2], [2, 5, 9]], pad: 'triangle', lp: 3200, arp: 'pluck', bass: 1, kick: 'four', hat: 1, lead: 'pluck', snare: 1, verb: 0.2, alt: [[[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [2, 5, 9]], [[0, 4, 7], [2, 5, 9], [-3, 0, 4], [-5, -1, 2]]] },
};
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

export async function generateMusic(toneKey, secs = 30, sr = 44100) {
  const T0 = TONES[toneKey] || TONES.inspirador, T = { ...T0, prog: T0.alt ? [T0.prog, ...T0.alt][Math.floor(Math.random() * (T0.alt.length + 1))] : T0.prog }, beat = 60 / T.bpm, bar = beat * 4, bars = Math.max(4, Math.round(secs / bar / 4) * 4), len = bars * bar;
  const ctx = new OfflineAudioContext(2, Math.ceil(len * sr), sr), out = ctx.createGain(); out.gain.value = 0.7;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; out.connect(comp); comp.connect(ctx.destination);
  { const il = Math.round(sr * 2.4), ir = ctx.createBuffer(2, il, sr); for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < il; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / il, 2.8); }
    const conv = ctx.createConvolver(), wet = ctx.createGain(); conv.buffer = ir; wet.gain.value = T.verb ?? 0.25; out.connect(wet); wet.connect(conv); conv.connect(comp); }   // reverberação: dá espaço e tira o som "seco" de sintetizador
  const rnd = (a, b) => a + Math.random() * (b - a), hum = () => (Math.random() - 0.5) * 0.02;   // pequena variação humana de tempo
  const noise = ctx.createBuffer(1, sr, sr), nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const tone = (type, f, t, d, v, { a = 0.02, r = 0.25, lp = 4000, det = 0, pan = 0 } = {}) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter(); o.type = type; o.frequency.value = f; if (det) o.detune.value = det;
    fl.type = 'lowpass'; fl.frequency.value = lp; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.setValueAtTime(v, Math.max(t + a, t + d - r)); g.gain.linearRampToValueAtTime(0, t + d);
    o.connect(fl); fl.connect(g); if (pan && ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = pan; g.connect(pn); pn.connect(out); } else g.connect(out); o.start(t); o.stop(t + d + 0.05);
  };
  const kick = (t, v) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3); };
  const hat = (t, v) => { const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter(); s.buffer = noise; f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06); s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + 0.08); };
  const swell = (t, d, v) => { const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter(); s.buffer = noise; s.loop = true; f.type = 'bandpass'; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3000, t + d); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + d * 0.9); g.gain.linearRampToValueAtTime(0, t + d); s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + d); };
  const major = T.prog[0][1] - T.prog[0][0] === 4, scale = major ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
  const mkMotif = () => { let deg = Math.floor(rnd(0, 5)); return Array.from({ length: 16 }, (_, i) => { if (Math.random() < (i % 4 === 0 ? 0.12 : 0.4)) return null; deg = Math.max(0, Math.min(9, deg + Math.round(rnd(-2, 2)))); return deg; }); };   // 2 compassos de melodia (colcheias)
  const degMidi = d => T.root + 12 + scale[d % 7] + 12 * Math.floor(d / 7);
  const LEAD = { cello: ['sawtooth', 0.07, 900, 0.9], bell: ['sine', 0.09, 5000, 1.6], pluck: ['triangle', 0.08, 4200, 0.45], brass: ['sawtooth', 0.06, 2000, 0.8], soft: ['sine', 0.07, 2500, 1.2] };
  let motif = mkMotif();
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar, ch = T.prog[b % 4], pr = T.root, intro = b < 2, last = b === bars - 1;
    if (b % 4 === 0) motif = Math.random() < 0.5 ? mkMotif() : motif;   // frase nova a cada 4 compassos; às vezes repete
    if (T.lead && !intro) { const L = LEAD[T.lead], half = (b % 2) * 8; for (let s2 = 0; s2 < 8; s2++) { const dg = motif[half + s2]; if (dg == null) continue; const f = hz(degMidi(dg) - (T.lead === 'cello' ? 12 : 0)); tone(L[0], f, t0 + s2 * beat / 2 + hum(), beat * (T.lead === 'bell' ? 1.6 : 0.5), L[1] * rnd(0.8, 1.1), { a: 0.01, r: L[3], lp: L[2], pan: rnd(-0.25, 0.25), det: rnd(-5, 5) }); } }
    if (T.snare && !intro) for (const q of [1, 3]) { const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter(), t = t0 + q * beat; s.buffer = noise; f.type = 'bandpass'; f.frequency.value = 1800; g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + 0.2); }
    if (T.bass && !intro) for (const [q, o] of [[0, 0], [1.5, 7], [2, 0], [3, 7]]) tone('sine', hz(pr - 24 + ch[0] + o), t0 + q * beat, beat * 0.9, 0.17, { a: 0.02, r: 0.25 });
    if (last) swell(t0 + beat * 2, beat * 2, 0.1);
    ch.forEach((n, i) => { const f = hz(pr + n); tone(T.pad, f, t0, bar, 0.1, { a: 0.35, r: 0.5, lp: T.lp, det: i * 4 - 4 }); tone(T.pad, f * 2.004, t0, bar, 0.04, { a: 0.5, r: 0.5, lp: T.lp }); });
    if (T.bass && intro) tone('sine', hz(pr - 24 + ch[0]), t0, bar, 0.22, { a: 0.03, r: 0.3 });
    if (T.arp) for (let s = 0; s < 8; s++) { const n = ch[(s * (T.arp === 'bell' ? 2 : 1)) % 3] + (s % 3 === 2 ? 12 : 0); if (T.arp === 'bell' && s % 2) continue; tone(T.arp === 'bell' ? 'sine' : 'triangle', hz(pr + 12 + n), t0 + s * beat / 2, T.arp === 'bell' ? beat * 1.8 : beat * 0.6, T.arp === 'bell' ? 0.07 : 0.06, { a: 0.005, r: T.arp === 'bell' ? 1 : 0.3, lp: 5000 }); }
    if (T.stab) for (const q of [0, 1.5, 3]) ch.forEach(n => tone('sawtooth', hz(pr + 12 + n), t0 + q * beat, beat * 0.9, 0.05, { a: 0.01, r: 0.3, lp: 2200 }));
    for (let q = 0; q < 4; q++) {
      const t = t0 + q * beat; if (intro) continue;
      if (T.kick === 'heart') { if (q % 2 === 0) { kick(t, 0.5); kick(t + beat * 0.28, 0.32); } }
      else if (T.kick === 'big') kick(t, q % 2 ? 0.45 : 0.7);
      else if (T.kick === 'four') kick(t, 0.5);
      else if (T.kick === 'soft' && q % 2 === 0) kick(t, 0.3);
      if (T.hat) { hat(t + beat * 0.5, 0.06); }
    }
    if (T.swell && b % 4 === 3) swell(t0, bar, 0.12);
  }
  const buf = await ctx.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), fadeN = Math.round(sr * 0.05);
  for (let i = 0; i < fadeN; i++) { const g = i / fadeN; L[i] *= g; R[i] *= g; L[L.length - 1 - i] *= g; R[R.length - 1 - i] *= g; }
  return toWav(L, R, sr);
}
function toWav(L, R, sr) {
  const n = L.length, b = new ArrayBuffer(44 + n * 4), v = new DataView(b), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
  return new Blob([b], { type: 'audio/wav' });
}

// Tom do conteúdo por léxico em português (rápido, local e sem custo): devolve a chave de TONES.
const LEX = {
  dramatico: 'morte morreu perdi perdeu dor sofri sofrimento medo guerra tragedia crise pior sozinho sozinha chorar choro perigo culpa destruiu destruir doenca falencia fracasso',
  reflexivo: 'pensar pense reflita refletir vida tempo sentido silencio lembro lembrar aprendi aprender caminho sabedoria paz consciencia essencia propósito proposito escolha',
  inspirador: 'sonho sonhos conquista conquistar vencer acreditar coragem esperanca superar fe transformar vitoria futuro possivel crescer evoluir persistir recomecar gratidao',
  epico: 'batalha gloria lenda heroi forca poder imperio destino imparavel guerreiro legado historia nunca desista vencedor campeao',
  animado: 'incrivel bora vamos demais feliz festa rir diversao top dica rapido facil gratis novidade olha',
  calmo: 'calma tranquilo tranquilidade respirar relaxar suave descansar sereno meditar silenciar leve',
};
const LEXS = Object.fromEntries(Object.entries(LEX).map(([k, v]) => [k, new Set(v.split(' '))]));
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
export function detectTone(words) {
  const sc = {}; for (const w of words) { const n = norm(w.w); if (!n) continue; for (const [k, set] of Object.entries(LEXS)) if (set.has(n) || [...set].some(x => x.length > 5 && n.startsWith(x.slice(0, -1)))) sc[k] = (sc[k] || 0) + 1; }
  const best = Object.entries(sc).sort((a, b) => b[1] - a[1])[0]; return best && best[1] >= 2 ? best[0] : 'inspirador';
}
