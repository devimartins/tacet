// Trocar o fundo do vídeo: recorta a pessoa no próprio aparelho (MediaPipe Selfie Segmentation, Apache 2.0, WebAssembly)
// e coloca um cenário por trás. Nada do vídeo sai do aparelho.
export const SCENES = [
  { id: 'white', n: 'Estúdio branco', c: ['#ffffff', '#dfe3ea'] },
  { id: 'light', n: 'Estúdio claro', c: ['#f3f4f7', '#b9bfca'] },
  { id: 'warm', n: 'Sala aconchegante', c: ['#f7e9d7', '#c9a57a'] },
  { id: 'sky', n: 'Azul suave', c: ['#e3f1ff', '#7fb4e6'] },
  { id: 'dark', n: 'Estúdio escuro', c: ['#2b2e38', '#08090c'] },
  { id: 'black', n: 'Preto com foco', c: ['#3a3a3f', '#000000'] },
  { id: 'navy', n: 'Azul noturno', c: ['#1d2f5c', '#070b1a'] },
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
function paint(c, W, H, sc) {
  const x = c.getContext('2d'), s = SCENES.find(o => o.id === sc.id) || SCENES[0], dark = ['dark', 'black', 'navy', 'neon'].includes(s.id), R = rnd(7 + s.id.length * 31);
  const g = x.createRadialGradient(W / 2, H * (s.id === 'black' ? .38 : .42), 0, W / 2, H * .5, Math.hypot(W, H) * .62); g.addColorStop(0, s.c[0]); g.addColorStop(1, s.c[1]); x.fillStyle = g; x.fillRect(0, 0, W, H);
  if (['warm', 'navy', 'neon', 'sky'].includes(s.id)) { for (let i = 0; i < 16; i++) { const r = (.03 + R() * .06) * W, px = R() * W, py = R() * H * .7; x.fillStyle = s.id === 'warm' ? `rgba(255,236,190,${.1 + R() * .18})` : s.id === 'sky' ? `rgba(255,255,255,${.14 + R() * .2})` : s.id === 'neon' ? `rgba(${R() > .5 ? '255,90,220' : '90,200,255'},${.1 + R() * .18})` : `rgba(120,170,255,${.08 + R() * .15})`; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); } }
  if (s.id === 'neon') { for (let i = 0; i < 3; i++) { const bx = W * (.12 + i * .38), gl = x.createLinearGradient(bx, 0, bx + W * .05, 0); gl.addColorStop(0, 'rgba(255,80,220,0)'); gl.addColorStop(.5, 'rgba(255,80,220,.35)'); gl.addColorStop(1, 'rgba(255,80,220,0)'); x.fillStyle = gl; x.fillRect(bx, 0, W * .05, H * .78); } }
  const fl = x.createLinearGradient(0, H * .72, 0, H); fl.addColorStop(0, 'rgba(0,0,0,0)'); fl.addColorStop(1, dark ? 'rgba(0,0,0,.45)' : 'rgba(60,70,90,.22)'); x.fillStyle = fl; x.fillRect(0, H * .72, W, H * .28);
}
// cenário no tamanho pedido (cacheado); sc = { id } ou { img }
export function sceneCanvas(sc, W, H) {
  const key = sc.img ? null : sc.id + W + 'x' + H; if (key && cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  if (sc.img) { const x = c.getContext('2d'), iw = sc.img.width, ih = sc.img.height, k = Math.max(W / iw, H / ih); x.drawImage(sc.img, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k); x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, 0, W, H); }
  else { paint(c, W, H, sc); if (cache.size > 6) cache.delete(cache.keys().next().value); cache.set(key, c); }
  return c;
}
const small = document.createElement('canvas');
// separa a pessoa de `src` (canvas/vídeo já no enquadramento final, W×H) e devolve um canvas com fundo transparente
export async function cutout(src, W, H, out) {
  const s = await loadSeg(), k = Math.min(1, 320 / Math.max(W, H)); small.width = Math.max(2, Math.round(W * k)); small.height = Math.max(2, Math.round(H * k));
  small.getContext('2d').drawImage(src, 0, 0, small.width, small.height); lastMask = null; await s.send({ image: small });
  const c = out || document.createElement('canvas'); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  const x = c.getContext('2d'); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, W, H);
  if (!lastMask) { x.drawImage(src, 0, 0, W, H); return c; }
  if ('filter' in x) x.filter = 'blur(' + Math.max(1, W / 360).toFixed(1) + 'px)'; x.drawImage(lastMask, 0, 0, W, H); if ('filter' in x) x.filter = 'none';
  x.globalCompositeOperation = 'source-in'; x.drawImage(src, 0, 0, W, H); x.globalCompositeOperation = 'source-over'; return c;
}
const tmp = document.createElement('canvas');
// troca o fundo de `cv` (W×H) por completo: usado na exportação, quadro a quadro
export async function swapOn(ctx, cv, W, H, sc) {
  const p = await cutout(cv, W, H, tmp); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); ctx.drawImage(sceneCanvas(sc, W, H), 0, 0); ctx.drawImage(p, 0, 0);
}
