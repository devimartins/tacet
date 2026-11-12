// Enquadramento em quem fala (MediaPipe Face Detection "full range", Apache 2.0, roda no aparelho em WebAssembly).
// Para cada corte: olha 3 quadros por segundo, acha os rostos e mede o quanto a boca de cada um se mexe
// (descontando o movimento da cabeça). Nos momentos com fala, quem mexe mais a boca é quem está falando.
// A câmera corta seco de uma pessoa para outra e segura cada plano por pelo menos 1,6 s (sem ficar indo e voltando).
// Resultado por corte: { v, track: [[t, x]], people: [{ x, y, h, share }] } com x, y e h de 0 a 1 no quadro original.
let det = null, lastRes = null, loading = null; const subs = [];
export const onDetect = f => { subs.push(f); };   // facetrack.js usa o mesmo detector
function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('Não consegui carregar o detector de rosto.')); document.head.append(s); }); }
export async function detector() {
  if (det) return det;
  if (!loading) loading = (async () => {
    if (!window.FaceDetection) await loadScript('vendor/face/face_detection.js');
    const d = new window.FaceDetection({ locateFile: f => 'vendor/face/' + f });
    // "full range" acha rostos pequenos e distantes (planos abertos de podcast); o "short" só acha rosto de selfie
    d.setOptions({ model: 'full', minDetectionConfidence: 0.45 }); d.onResults(r => { lastRes = r; for (const f of subs) f(r); }); await d.initialize(); det = d; return d;
  })().catch(e => { loading = null; throw e; });
  return loading;
}

const FPS = 3, MIN_SHOT = 1.6, PW = 16, PH = 10;
// recorte em tons de cinza (PW x PH) de uma região do quadro, em coordenadas 0..1
function patch(px, W, H, cx, cy, w, h) {
  const out = new Float32Array(PW * PH), x0 = (cx - w / 2) * W, y0 = (cy - h / 2) * H, dx = (w * W) / PW, dy = (h * H) / PH; let m = 0;
  for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {   // média de 3x3 pontos por célula: estável com rosto grande ou pequeno
    let g = 0;
    for (let v = 0; v < 3; v++) for (let u = 0; u < 3; u++) {
      const x = Math.min(W - 1, Math.max(0, Math.round(x0 + (i + (u + 0.5) / 3) * dx))), y = Math.min(H - 1, Math.max(0, Math.round(y0 + (j + (v + 0.5) / 3) * dy))), k = (y * W + x) * 4;
      g += 0.299 * px[k] + 0.587 * px[k + 1] + 0.114 * px[k + 2];
    }
    g /= 9; out[j * PW + i] = g; m += g;
  }
  m /= out.length; for (let k = 0; k < out.length; k++) out[k] -= m;   // tira o brilho médio (luz que muda não conta como fala)
  return out;
}
const diff = (a, b) => { let s = 0; for (let k = 0; k < a.length; k++) s += Math.abs(a[k] - b[k]); return s / a.length; };
const median = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };

// Analisa os cortes, um por vez. onClip(c, result) é chamado a cada corte pronto (para a prévia já aparecer enquadrada).
let lock = Promise.resolve();
export function analyzeCuts(...a) { const run = lock.then(() => analyzeRun(...a)); lock = run.catch(() => { }); return run; }   // uma análise por vez: o detector é um só
async function analyzeRun(file, clips, words, { onClip, onProgress, signal } = {}) {
  const d = await detector(), v = document.createElement('video'), url = URL.createObjectURL(file);
  v.muted = true; v.preload = 'auto'; v.playsInline = true; v.src = url;
  try {
    await new Promise((ok, no) => { v.onloadeddata = ok; v.onerror = () => no(new Error('Não consegui ler o vídeo.')); });
    const k = Math.min(1, 960 / Math.max(v.videoWidth, v.videoHeight)), cv = document.createElement('canvas'); cv.width = Math.round(v.videoWidth * k); cv.height = Math.round(v.videoHeight * k);
    const cx = cv.getContext('2d', { willReadFrequently: true }), total = clips.reduce((n, c) => n + (c.end - c.start), 0) || 1; let done = 0;
    for (const c of clips) {
      if (signal?.aborted) throw new Error('Cancelado.');
      const r = await analyzeOne(v, cv, cx, d, c.start, c.end, words, signal, p => onProgress && onProgress((done + p * (c.end - c.start)) / total));
      done += c.end - c.start; onClip && onClip(c, r);
    }
  } finally { v.removeAttribute('src'); v.load(); URL.revokeObjectURL(url); }
}

// Vídeo largo: procura em duas metades sobrepostas (cada rosto fica maior para o detector, que trabalha em 192 px)
// e junta os resultados nas coordenadas do quadro inteiro. Rostos repetidos na faixa comum viram um só.
const TILE = document.createElement('canvas'), TX = TILE.getContext('2d');
async function findFaces(d, cv, W, H, tiles = true) {
  const one = async (x0, w) => {
    const tw = Math.round(W * w); if (TILE.width !== tw || TILE.height !== H) { TILE.width = tw; TILE.height = H; }
    TX.drawImage(cv, Math.round(W * x0), 0, tw, H, 0, 0, tw, H); lastRes = null; await d.send({ image: TILE });
    return (lastRes?.detections || []).map(q => ({ boundingBox: { ...q.boundingBox, xCenter: x0 + q.boundingBox.xCenter * w, width: q.boundingBox.width * w }, landmarks: (q.landmarks || []).map(p => ({ x: x0 + p.x * w, y: p.y })) }));
  };
  if (!tiles || W / H < 1.3) return one(0, 1);
  const all = [...await one(0, 0.6), ...await one(0.4, 0.6)], out = [];
  for (const q of all.sort((a, b) => b.boundingBox.width - a.boundingBox.width)) if (!out.some(o => Math.abs(o.boundingBox.xCenter - q.boundingBox.xCenter) < Math.max(0.03, o.boundingBox.width * 0.5) && Math.abs(o.boundingBox.yCenter - q.boundingBox.yCenter) < o.boundingBox.height * 0.6)) out.push(q);
  return out;
}
async function analyzeOne(v, cv, cx, d, s, e, words, signal, onP) {
  const W = cv.width, H = cv.height, samples = [], trk = []; let tiles = true;
  try { d.reset && d.reset(); } catch { /* ok */ }
  for (let t = s; t <= e + 0.001; t += 1 / FPS) {
    if (signal?.aborted) throw new Error('Cancelado.');
    await new Promise(ok => { const done = () => { clearTimeout(to); ok(); }, to = setTimeout(done, 1500); v.onseeked = done; v.currentTime = Math.min(t, v.duration - 0.05); });
    cx.drawImage(v, 0, 0, W, H);
    const px = cx.getImageData(0, 0, W, H).data, faces = [], dets = await findFaces(d, cv, W, H, tiles), used = new Set();
    if (tiles && samples.length === 0 && dets.length && dets.every(q => q.boundingBox.width >= 0.07)) tiles = false;   // rostos grandes: o quadro inteiro basta (metade do trabalho)
    // posição suavizada de cada rosto (a caixa do detector treme alguns pixels de um quadro para outro; sem isso,
    // quem está calado parece mexer a boca). A boca e os olhos são medidos sempre no mesmo lugar do rosto.
    for (const q of dets) {
      const b = q.boundingBox, kp = q.landmarks || []; if (!b || b.width < 0.012) continue;
      const mo = kp[3] || { x: b.xCenter, y: b.yCenter + b.height * 0.28 }, eL = kp[0], eR = kp[1], ey = eL && eR ? { x: (eL.x + eR.x) / 2, y: (eL.y + eR.y) / 2 } : { x: b.xCenter, y: b.yCenter - b.height * 0.15 };
      const raw = { x: b.xCenter, y: b.yCenter, w: b.width, h: b.height, mx: mo.x, my: mo.y, ex: ey.x, ey: ey.y };
      let tk = null, bd = 1e9; for (const o of trk) { const dd = Math.abs(o.x - raw.x); if (dd < Math.max(0.05, o.w * 0.8) && dd < bd) { bd = dd; tk = o; } }
      if (!tk || used.has(tk)) { tk = { ...raw }; trk.push(tk); } else for (const key in raw) tk[key] += (raw[key] - tk[key]) * 0.25;
      used.add(tk);
      faces.push({ x: tk.x, y: tk.y, w: tk.w, h: tk.h,
        m: patch(px, W, H, tk.mx, tk.my, tk.w * 0.5, tk.h * 0.3),            // boca e queixo
        r: patch(px, W, H, tk.ex, tk.ey - tk.h * 0.05, tk.w * 0.6, tk.h * 0.3) });   // olhos e testa: mexem com a cabeça, não com a fala
    }
    samples.push({ t, faces }); onP && onP((t - s) / Math.max(0.5, e - s));
  }
  return decide(samples, words, s, e);
}

// Junta os rostos de quadro a quadro em pessoas (pela posição) e escolhe quem fala em cada momento.
export function decide(samples, words, s, e) {
  const people = [];
  samples.forEach((sm, i) => {
    const used = new Set();
    for (const f of sm.faces.sort((a, b) => b.w - a.w)) {
      let best = null, bd = 1e9;
      for (const p of people) { if (used.has(p)) continue; const dd = Math.abs(p.x - f.x); if (dd < Math.max(0.06, p.w * 0.9) && dd < bd) { bd = dd; best = p; } }
      if (!best) { best = { x: f.x, w: f.w, at: {} }; people.push(best); }
      used.add(best); best.at[i] = f; best.x += (f.x - best.x) * 0.3; best.w += (f.w - best.w) * 0.3;
    }
  });
  const n = samples.length, keep = people.filter(p => Object.keys(p.at).length >= Math.max(2, n * 0.25));
  if (!keep.length || !n) return { v: 1, track: null, people: [] };
  // movimento da boca descontado o da cabeça, normalizado pelo contraste do rosto
  for (const p of keep) {
    p.act = new Float32Array(n);
    for (let i = 1; i < n; i++) { const a = p.at[i], b = p.at[i - 1]; if (!a || !b) continue; const md = diff(a.m, b.m), rd = diff(a.r, b.r), ct = 8 + a.m.reduce((u, x) => u + Math.abs(x), 0) / a.m.length; p.act[i] = Math.max(0, md - 0.8 * rd) / ct; }
    const xs = Object.values(p.at); p.mx = median(xs.map(f => f.x)); p.my = median(xs.map(f => f.y)); p.mh = median(xs.map(f => f.h)); p.share = xs.length / n;
  }
  keep.sort((a, b) => a.mx - b.mx);
  const talking = samples.map(sm => words.some(w => w.s - 0.15 <= sm.t && sm.t <= w.e + 0.15));
  const lab = new Array(n).fill(-1);
  if (keep.length === 1) lab.fill(0);
  else {
    for (let i = 0; i < n; i++) {
      if (!talking[i]) continue;
      const sc = keep.map(p => { let u = 0, c = 0; for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) { u += p.act[j]; c++; } return p.at[i] ? u / c : -1; });
      const order = sc.map((v, k) => [v, k]).sort((a, b) => b[0] - a[0]);
      if (order[0][0] > 0.02 && order[0][0] > (order[1] ? order[1][0] : 0) * 1.25) lab[i] = order[0][1];
    }
    // sem decisão: segura quem estava; no começo, quem fala primeiro (ou o rosto maior)
    const firstK = lab.findIndex(x => x >= 0), def = firstK >= 0 ? lab[firstK] : keep.reduce((bi, p, k) => p.mh * p.share > keep[bi].mh * keep[bi].share ? k : bi, 0);
    let cur = def; for (let i = 0; i < n; i++) { if (lab[i] >= 0) cur = lab[i]; else lab[i] = cur; }
    // planos curtos (menos de 1,6 s) viram parte do plano vizinho: nada de câmera indo e voltando
    const minN = Math.round(MIN_SHOT * FPS);
    for (let guard = 0; guard < 50; guard++) {
      const runs = []; for (let i = 0; i < n;) { let j = i; while (j + 1 < n && lab[j + 1] === lab[i]) j++; runs.push([i, j]); i = j + 1; }
      const short = runs.map((r, k) => [r[1] - r[0] + 1, k]).filter(([len]) => len < minN).sort((a, b) => a[0] - b[0])[0];
      if (!short || runs.length < 2) break;
      const k = short[1], [a, b] = runs[k], to = k > 0 ? lab[runs[k - 1][0]] : lab[runs[k + 1][0]];
      for (let i = a; i <= b; i++) lab[i] = to;
    }
  }
  const track = [];
  if (keep.length === 1) {   // uma pessoa: segue com calma (mediana + média móvel), sem tremer
    const p = keep[0]; let last = p.mx, ema = null;
    const raw = samples.map((sm, i) => { if (p.at[i]) last = p.at[i].x; return last; });
    raw.forEach((x, i) => { const w = [raw[Math.max(0, i - 2)], raw[Math.max(0, i - 1)], x, raw[Math.min(n - 1, i + 1)], raw[Math.min(n - 1, i + 2)]].sort((a, b) => a - b)[2]; ema = ema == null ? w : ema + (w - ema) * 0.35; track.push([+samples[i].t.toFixed(2), +ema.toFixed(4)]); });
  } else {
    // a troca de pessoa cai na maior pausa entre palavras logo antes (é quando a outra pessoa começa a falar)
    const snapCut = t => { let best = t - 0.25, gap = 0.12; for (let k = 1; k < words.length; k++) { const g0 = words[k - 1].e, g1 = words[k].s; if (g1 < t - 1.2 || g0 > t + 0.3) continue; if (g1 - g0 > gap) { gap = g1 - g0; best = g1 - Math.min(0.15, (g1 - g0) / 2); } } return Math.max(s, best); };
    const cuts = []; for (let i = 0; i < n;) { let j = i; while (j + 1 < n && lab[j + 1] === lab[i]) j++; cuts.push([lab[i], i === 0 ? s : snapCut(samples[i].t)]); i = j + 1; }
    cuts.forEach(([who, t0], k) => { const x = +keep[who].mx.toFixed(4), t1 = k + 1 < cuts.length ? Math.max(t0 + 0.1, cuts[k + 1][1]) : e; track.push([+t0.toFixed(2), x], [+(t1 - 0.02).toFixed(2), x]); });
  }
  return { v: 1, track, people: keep.map(p => ({ x: +p.mx.toFixed(4), y: +p.my.toFixed(4), h: +p.mh.toFixed(4), share: +p.share.toFixed(2) })) };
}

// Tela dividida: duas pessoas empilhadas (quem está à esquerda no vídeo fica em cima). Para cada metade da saída (W x H/2),
// o retângulo do quadro original (dw x dh) com a pessoa centralizada e o rosto ocupando cerca de 30% da altura do painel.
export function splitRects(people, dw, dh, W, H) {
  const two = [...people].sort((a, b) => b.share - a.share).slice(0, 2).sort((a, b) => a.x - b.x); if (two.length < 2) return null;
  const A = W / (H / 2);
  return two.map(p => {
    let ch = Math.min(dh, Math.max(dh * 0.35, (p.h * dh) / 0.3)), cw = ch * A;
    if (cw > dw) { cw = dw; ch = cw / A; }
    const sx = Math.min(dw - cw, Math.max(0, p.x * dw - cw / 2)), sy = Math.min(dh - ch, Math.max(0, p.y * dh - ch * 0.42));
    return { sx, sy, sw: cw, sh: ch };
  });
}
// Corte que contém o tempo t (com enquadramento já analisado)
export const frameAt = (clips, t) => clips.find(c => c.frame && t >= c.start - 0.05 && t <= c.end + 0.05);
