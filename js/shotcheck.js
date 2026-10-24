// Verifica enquadramento e iluminação pela câmera, no aparelho (MediaPipe Face Detection, o mesmo detector do reenquadramento).
// Regras (headroom e olhos no terço superior: vidpros.com, ASU; luz de frente e sem contraluz: Univ. de Buffalo).
// Os limites numéricos (margens, distância, brilho) são ajustes práticos deste app, não normas.
let det = null, lastRes = null;
const loadScript = src => new Promise((ok, no) => { if (window.FaceDetection) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('detector')); document.head.append(s); });
async function detector() {
  if (det) return det;
  await loadScript('vendor/face/face_detection.js');
  const d = new window.FaceDetection({ locateFile: f => 'vendor/face/' + f });
  d.setOptions({ model: 'short', minDetectionConfidence: 0.5 }); d.onResults(r => { lastRes = r; }); await d.initialize(); return (det = d);
}
// prioridade: o que mais atrapalha vem primeiro
export const MSG = {
  noface: 'Não encontrei seu rosto. Fique de frente para a câmera.',
  headcut: 'Pouco espaço acima da cabeça. Afaste-se ou incline a câmera para cima.',
  edge: 'Seu rosto está perto da borda. Fique mais ao centro.',
  dark: 'Pouca luz. Fique de frente para uma janela ou acenda uma luz à sua frente.',
  backlit: 'Há luz forte atrás de você. Vire de frente para a luz.',
  far: 'Você está longe. Aproxime-se da câmera.',
  close: 'Você está perto demais. Afaste-se um pouco.',
  lowface: 'Muito espaço acima da cabeça. Suba a câmera até a altura dos olhos.',
  uneven: 'A luz vem só de um lado. Use outra luz do lado oposto.',
  over: 'Luz forte demais no rosto. Afaste a luz ou use uma cortina fina.',
  tilt: 'A câmera está torta. Deixe o aparelho reto.',
};
const ORDER = Object.keys(MSG);
// face: {x,y,w,h (caixa, 0..1), eyes:[[x,y],[x,y]]|null}; lum: {face,left,right,bg}; asp = largura/altura do quadro
export function analyze(face, lum, asp) {
  if (!face) return ['noface'];
  const out = [], top = face.y - face.h / 2, headTop = top - 0.3 * face.h, eyeY = face.eyes ? (face.eyes[0][1] + face.eyes[1][1]) / 2 : top + 0.3 * face.h;
  if (headTop < 0.015) out.push('headcut'); else if (eyeY > 0.5) out.push('lowface');
  if (face.x - face.w / 2 < 0.1 || face.x + face.w / 2 > 0.9) out.push('edge');
  const hh = asp < 1 ? [0.11, 0.3] : [0.2, 0.5];   // altura do rosto no quadro: vertical x horizontal
  if (face.h < hh[0]) out.push('far'); else if (face.h > hh[1]) out.push('close');
  if (face.eyes) { const dx = (face.eyes[0][0] - face.eyes[1][0]) * asp, dy = face.eyes[0][1] - face.eyes[1][1]; let a = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI); if (a > 90) a = 180 - a; if (a > 9) out.push('tilt'); }
  if (lum) {
    if (lum.face < 65) out.push('dark'); else if (lum.face > 205) out.push('over');
    if (lum.bg - lum.face > 50 && lum.bg > 110) out.push('backlit');
    const m = (lum.left + lum.right) / 2 || 1; if (Math.abs(lum.left - lum.right) / m > 0.35 && lum.face >= 65) out.push('uneven');
  }
  return ORDER.filter(k => out.includes(k));
}
export async function startShotCheck(video, onUpdate) {
  let d; try { d = await detector(); } catch { return null; }
  const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true }); let on = true, busy = false; const hist = [];
  const lumOf = (img, W, H, f) => {
    const L = (x0, y0, x1, y1) => { x0 = Math.max(0, Math.floor(x0 * W)); x1 = Math.min(W, Math.ceil(x1 * W)); y0 = Math.max(0, Math.floor(y0 * H)); y1 = Math.min(H, Math.ceil(y1 * H)); let s = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 4; s += 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2]; n++; } return n ? s / n : 0; };
    const fx0 = f.x - f.w * 0.35, fx1 = f.x + f.w * 0.35, fy0 = f.y - f.h * 0.35, fy1 = f.y + f.h * 0.4;
    let s = 0, n = 0; const ex = f.w * 0.65, ey = f.h * 0.65;   // fundo: fora da caixa ampliada
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const nx = x / W, ny = y / H; if (Math.abs(nx - f.x) < ex && Math.abs(ny - f.y) < ey) continue; const i = (y * W + x) * 4; s += 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2]; n++; }
    return { face: L(fx0, fy0, fx1, fy1), left: L(fx0, fy0, f.x, fy1), right: L(f.x, fy0, fx1, fy1), bg: n ? s / n : 0 };
  };
  const step = async () => {
    if (!on || busy || !video.videoWidth || video.readyState < 2) return; busy = true;
    try {
      const k = Math.min(1, 320 / Math.max(video.videoWidth, video.videoHeight)); cv.width = Math.round(video.videoWidth * k); cv.height = Math.round(video.videoHeight * k); cx.drawImage(video, 0, 0, cv.width, cv.height);
      lastRes = null; await d.send({ image: cv });
      const q = (lastRes?.detections || []).sort((a, b) => b.boundingBox.width * b.boundingBox.height - a.boundingBox.width * a.boundingBox.height)[0];
      let face = null, lum = null;
      if (q && q.boundingBox) { const b = q.boundingBox, lm = q.landmarks; face = { x: b.xCenter, y: b.yCenter, w: b.width, h: b.height, eyes: lm && lm.length >= 2 ? [[lm[0].x, lm[0].y], [lm[1].x, lm[1].y]] : null }; lum = lumOf(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height, face); }
      hist.push(analyze(face, lum, video.videoWidth / video.videoHeight)); if (hist.length > 6) hist.shift(); onUpdate && onUpdate(issues());
    } catch { /* sem leitura neste quadro */ } finally { busy = false; }
  };
  // um problema só conta se aparece na maioria das leituras recentes (evita piscar)
  const issues = () => { if (hist.length < 3) return null; const c = {}; hist.forEach(a => a.forEach(k => { c[k] = (c[k] || 0) + 1; })); return ORDER.filter(k => c[k] >= Math.ceil(hist.length * 0.6)); };
  const iv = setInterval(step, 600); step();
  return { issues, stop() { on = false; clearInterval(iv); } };
}
