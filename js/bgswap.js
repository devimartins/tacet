// Trocar o fundo do vídeo: recorta a pessoa no próprio aparelho (MediaPipe Selfie Segmentation, Apache 2.0, WebAssembly)
// e coloca um cenário por trás. Nada do vídeo sai do aparelho.
export const SCENES = [
  { id: 'white', n: 'Estúdio branco', c: ['#ffffff', '#dfe3ea'] },
  { id: 'light', n: 'Estúdio claro', c: ['#f3f4f7', '#b9bfca'] },
  { id: 'meet', n: 'Sala de reunião', c: ['#dfe6ee', '#8fa3b8'] },
  { id: 'office', n: 'Escritório moderno', c: ['#efe3d2', '#b08a5f'] },
  { id: 'podl', n: 'Estúdio de podcast claro', c: ['#f1e6d6', '#c9a77c'] },
  { id: 'dark', n: 'Estúdio escuro', c: ['#2b2e38', '#08090c'] },
  { id: 'exec', n: 'Escritório executivo', c: ['#3b2a20', '#0d0907'] },
  { id: 'podd', n: 'Estúdio de podcast escuro', c: ['#2a2230', '#09070c'] },
  { id: 'podn', n: 'Podcast com neon', c: ['#1d2a52', '#06070f'] },
  { id: 'neon', n: 'Roxo neon', c: ['#5b2a96', '#12051f'] },
];
let seg = null, loading = null, lastMask = null;
const loadScript = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('Não consegui carregar o recorte de fundo.')); document.head.append(s); });
export async function loadSeg() {
  if (seg) return seg;
  if (!loading) loading = (async () => {
    await loadScript('vendor/seg/selfie_segmentation.js');
    const s = new window.SelfieSegmentation({ locateFile: f => 'vendor/seg/' + f });
    s.setOptions({ modelSelection: 1 }); s.onResults(r => { lastMask = r.segmentationMask; }); await s.initialize(); return (seg = s);
  })().catch(e => { loading = null; throw e; });
  return loading;
}
const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const cache = new Map();
const blurred = (x, W, H, px, fn) => { const t = document.createElement('canvas'); t.width = W; t.height = H; fn(t.getContext('2d')); if ('filter' in x) x.filter = 'blur(' + px + 'px)'; x.drawImage(t, 0, 0); if ('filter' in x) x.filter = 'none'; };
const rr = (x, a, b, w, h, r) => { x.beginPath(); x.roundRect ? x.roundRect(a, b, w, h, r) : x.rect(a, b, w, h); };
function skyline(x, a, b, w, h, night, R) {   // janela com a cidade ao fundo
  const g = x.createLinearGradient(0, b, 0, b + h); if (night) { g.addColorStop(0, '#0d1633'); g.addColorStop(1, '#2b3566'); } else { g.addColorStop(0, '#bcd9f2'); g.addColorStop(1, '#eaf3fb'); }
  x.fillStyle = g; x.fillRect(a, b, w, h); let px = a;
  while (px < a + w) { const bw = w * (.04 + R() * .07), bh = h * (.25 + R() * .45); x.fillStyle = night ? 'rgba(10,14,34,.92)' : 'rgba(120,145,170,.55)'; x.fillRect(px, b + h - bh, bw, bh);
    if (night) for (let k = 0; k < 14; k++) { x.fillStyle = R() > .5 ? 'rgba(255,214,130,.9)' : 'rgba(150,200,255,.8)'; x.fillRect(px + R() * (bw - 4), b + h - bh + R() * (bh - 6), 3, 4); } px += bw + w * .006; }
}
function shelf(x, a, b, w, h, R, dark) {   // estante com livros e objetos
  x.fillStyle = dark ? '#1c1410' : '#8b6a47'; x.fillRect(a, b, w, h); const rows = 4, rh = h / rows;
  for (let r = 0; r < rows; r++) { let px = a + w * .03; const y = b + r * rh; x.fillStyle = dark ? '#0b0806' : '#5a4129'; x.fillRect(a, y + rh - 5, w, 5);
    while (px < a + w * .93) { const bw = w * (.02 + R() * .035), bh = rh * (.5 + R() * .38); x.fillStyle = `hsl(${Math.floor(R() * 360)},${dark ? 25 : 35}%,${dark ? 28 : 52}%)`; x.fillRect(px, y + rh - 5 - bh, bw, bh); px += bw + 1.5; if (R() > .9) px += w * .05; } }
}
function plant(x, cx, by, s, col) { x.fillStyle = col; for (let i = 0; i < 9; i++) { const ang = -Math.PI / 2 + (i - 4) * .26; x.save(); x.translate(cx, by); x.rotate(ang + Math.PI / 2); x.beginPath(); x.ellipse(0, -s * .55, s * .09, s * (.45 + (i % 3) * .08), 0, 0, 7); x.fill(); x.restore(); } x.fillStyle = '#7a5a3c'; x.fillRect(cx - s * .12, by - 2, s * .24, s * .2); }
function slats(x, a, b, w, h, c1, c2) { const n = Math.round(w / (w * .035)); for (let i = 0; i < n; i++) { const sx = a + i * w / n, g = x.createLinearGradient(sx, 0, sx + w / n, 0); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(sx, b, w / n - 2, h); } }
function foam(x, a, b, w, h) { const n = 7, cw = w / n, rows = Math.ceil(h / cw); for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) { const cx = a + i * cw + cw / 2, cy = b + r * cw + cw / 2, g = x.createRadialGradient(cx, cy, 0, cx, cy, cw * .6); g.addColorStop(0, '#2d2d33'); g.addColorStop(1, '#0c0c10'); x.fillStyle = g; rr(x, cx - cw * .46, cy - cw * .46, cw * .92, cw * .92, cw * .14); x.fill(); } }
function neon(x, col, fn) { x.save(); x.strokeStyle = col; x.lineWidth = 5; x.lineCap = 'round'; x.shadowColor = col; x.shadowBlur = 28; fn(x); x.stroke(); x.shadowBlur = 8; x.stroke(); x.restore(); }
function glow(x, cx, cy, r, col) { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
function mic(x, W, H, dark) { x.strokeStyle = dark ? '#15151a' : '#3a3a42'; x.lineWidth = W * .012; x.lineCap = 'round'; x.beginPath(); x.moveTo(W * .94, H * .02); x.lineTo(W * .78, H * .2); x.lineTo(W * .72, H * .34); x.stroke(); x.fillStyle = dark ? '#0d0d11' : '#2a2a31'; rr(x, W * .66, H * .33, W * .13, H * .09, W * .05); x.fill(); }
function paint(c, W, H, sc) {
  const x = c.getContext('2d'), s = SCENES.find(o => o.id === sc.id) || SCENES[0], R = rnd(11 + s.id.length * 37), dark = ['dark', 'exec', 'podd', 'podn', 'neon'].includes(s.id);
  const base = x.createRadialGradient(W / 2, H * .42, 0, W / 2, H * .5, Math.hypot(W, H) * .62); base.addColorStop(0, s.c[0]); base.addColorStop(1, s.c[1]); x.fillStyle = base; x.fillRect(0, 0, W, H);
  if (s.id === 'meet') {   // sala de reunião: janela panorâmica, mesa e plantas
    blurred(x, W, H, W * .012, t => { skyline(t, W * .06, H * .08, W * .88, H * .46, false, R); t.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 1; i < 4; i++) t.fillRect(W * (.06 + i * .22) - 3, H * .08, 6, H * .46); plant(t, W * .1, H * .7, W * .3, '#4f7a4a'); plant(t, W * .92, H * .72, W * .26, '#5b8a54'); });
    const g = x.createLinearGradient(0, H * .74, 0, H); g.addColorStop(0, '#c9ced6'); g.addColorStop(1, '#8c929c'); x.fillStyle = g; x.fillRect(0, H * .76, W, H * .24);
  } else if (s.id === 'office') {   // escritório moderno: estante, luminária e parede quente
    blurred(x, W, H, W * .01, t => { shelf(t, W * .02, H * .1, W * .38, H * .5, R, false); shelf(t, W * .64, H * .16, W * .34, H * .42, R, false); plant(t, W * .5, H * .66, W * .28, '#4f7a4a'); });
    glow(x, W * .52, H * .14, W * .45, 'rgba(255,224,170,.55)'); x.fillStyle = 'rgba(70,45,25,.18)'; x.fillRect(0, H * .74, W, H * .26);
  } else if (s.id === 'podl') {   // estúdio de podcast claro: painel ripado, luz quente, braço de microfone
    blurred(x, W, H, W * .008, t => { slats(t, 0, 0, W, H * .78, '#d9b98d', '#b99063'); glow(t, W * .22, H * .12, W * .5, 'rgba(255,230,180,.7)'); plant(t, W * .9, H * .8, W * .3, '#4f7a4a'); mic(t, W, H, false); });
    x.fillStyle = 'rgba(90,60,35,.25)'; x.fillRect(0, H * .78, W, H * .22);
  } else if (s.id === 'exec') {   // escritório executivo escuro: painéis de madeira e cidade à noite
    blurred(x, W, H, W * .01, t => { slats(t, 0, 0, W, H, '#3a281d', '#241810'); skyline(t, W * .12, H * .1, W * .76, H * .42, true, R); t.fillStyle = 'rgba(0,0,0,.55)'; for (let i = 0; i < 4; i++) t.fillRect(W * (.12 + i * .19) - 4, H * .1, 8, H * .42); glow(t, W * .15, H * .06, W * .4, 'rgba(255,190,120,.35)'); });
    x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, H * .76, W, H * .24);
  } else if (s.id === 'podd') {   // estúdio de podcast escuro: espuma acústica e fita de LED
    blurred(x, W, H, W * .006, t => { foam(t, 0, 0, W, H); neon(t, '#ff3fa4', c2 => { c2.beginPath(); c2.moveTo(W * .08, H * .12); c2.lineTo(W * .92, H * .12); }); neon(t, '#3fa8ff', c2 => { c2.beginPath(); c2.moveTo(W * .08, H * .8); c2.lineTo(W * .92, H * .8); }); mic(t, W, H, true); });
  } else if (s.id === 'podn') {   // podcast com neon: estante escura e anéis de luz
    blurred(x, W, H, W * .008, t => { shelf(t, W * .03, H * .14, W * .3, H * .5, R, true); shelf(t, W * .68, H * .2, W * .29, H * .44, R, true); neon(t, '#3fd0ff', c2 => { c2.beginPath(); c2.arc(W * .5, H * .22, W * .17, 0, 7); }); neon(t, '#ff3fa4', c2 => { c2.beginPath(); c2.arc(W * .5, H * .22, W * .11, 0, 7); }); });
    glow(x, W * .5, H * .22, W * .5, 'rgba(70,120,255,.28)');
  } else if (s.id === 'neon') {
    for (let i = 0; i < 16; i++) { const r = (.03 + R() * .06) * W; x.fillStyle = `rgba(${R() > .5 ? '255,90,220' : '90,200,255'},${.1 + R() * .18})`; x.beginPath(); x.arc(R() * W, R() * H * .7, r, 0, 7); x.fill(); }
    for (let i = 0; i < 3; i++) { const bx = W * (.12 + i * .38), gl = x.createLinearGradient(bx, 0, bx + W * .05, 0); gl.addColorStop(0, 'rgba(255,80,220,0)'); gl.addColorStop(.5, 'rgba(255,80,220,.35)'); gl.addColorStop(1, 'rgba(255,80,220,0)'); x.fillStyle = gl; x.fillRect(bx, 0, W * .05, H * .78); }
  }
  const fl = x.createLinearGradient(0, H * .72, 0, H); fl.addColorStop(0, 'rgba(0,0,0,0)'); fl.addColorStop(1, dark ? 'rgba(0,0,0,.45)' : 'rgba(60,70,90,.2)'); x.fillStyle = fl; x.fillRect(0, H * .72, W, H * .28);
  const vg = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.hypot(W, H) * .6); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, dark ? 'rgba(0,0,0,.5)' : 'rgba(40,40,50,.22)'); x.fillStyle = vg; x.fillRect(0, 0, W, H);
}
// cenário no tamanho pedido (cacheado); sc = { id } ou { img }
export function sceneCanvas(sc, W, H) {
  const key = sc.img ? null : sc.id + W + 'x' + H; if (key && cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  if (sc.img) { const x = c.getContext('2d'), iw = sc.img.width, ih = sc.img.height, k = Math.max(W / iw, H / ih); x.drawImage(sc.img, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k); x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, 0, W, H); }
  else { paint(c, W, H, sc); if (cache.size > 6) cache.delete(cache.keys().next().value); cache.set(key, c); }
  return c;
}
const small = document.createElement('canvas'), mc = document.createElement('canvas'), pcv = document.createElement('canvas');
let prev = null, prevKey = '';   // máscara anterior (suaviza no tempo para não piscar)
export const resetMask = () => { prev = null; };
// separa a pessoa de `src` (canvas/vídeo já no enquadramento final, W×H) e devolve um canvas com fundo transparente.
// Refina a máscara: endurece a borda (limiar suave), mistura com o quadro anterior e dá um leve desfoque.
export async function cutout(src, W, H, out) {
  const s = await loadSeg(), k = Math.min(1, 320 / Math.max(W, H)), sw = Math.max(2, Math.round(W * k)), sh = Math.max(2, Math.round(H * k));
  small.width = sw; small.height = sh; small.getContext('2d').drawImage(src, 0, 0, sw, sh); lastMask = null; await s.send({ image: small });
  const c = out || document.createElement('canvas'); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  const x = c.getContext('2d'); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, W, H);
  if (!lastMask) { x.drawImage(src, 0, 0, W, H); return c; }
  mc.width = sw; mc.height = sh; const mx = mc.getContext('2d', { willReadFrequently: true }); mx.clearRect(0, 0, sw, sh); mx.drawImage(lastMask, 0, 0, sw, sh);
  const img = mx.getImageData(0, 0, sw, sh), d = img.data, key = sw + 'x' + sh; if (!prev || prevKey !== key || prev.length !== d.length / 4) { prev = new Float32Array(d.length / 4); prevKey = key; for (let i = 0; i < prev.length; i++) prev[i] = d[i * 4 + 3] / 255; }
  for (let i = 0; i < prev.length; i++) {
    let a = d[i * 4 + 3] / 255; a = prev[i] * 0.45 + a * 0.55; prev[i] = a;       // suavização no tempo
    const t = Math.min(1, Math.max(0, (a - 0.38) / 0.34)); const v = t * t * (3 - 2 * t);   // limiar suave: tira o "halo" e fecha buracos pequenos
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255; d[i * 4 + 3] = Math.round(v * 255);
  }
  mx.putImageData(img, 0, 0);
  if ('filter' in x) x.filter = 'blur(' + Math.max(1.2, W / 300).toFixed(1) + 'px)'; x.drawImage(mc, 0, 0, W, H); if ('filter' in x) x.filter = 'none';
  x.globalCompositeOperation = 'source-in'; x.drawImage(src, 0, 0, W, H); x.globalCompositeOperation = 'source-over'; return c;
}
const tmp = document.createElement('canvas');
// troca o fundo de `cv` (W×H) por completo: usado na exportação, quadro a quadro
export async function swapOn(ctx, cv, W, H, sc) {
  const p = await cutout(cv, W, H, tmp); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); ctx.drawImage(sceneCanvas(sc, W, H), 0, 0); ctx.drawImage(p, 0, 0);
}
