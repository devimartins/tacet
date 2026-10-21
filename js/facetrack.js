// Seguir o rosto no reenquadramento (MediaPipe Face Detection, Apache 2.0, roda local em WebAssembly).
// Amostra o vídeo a cada `step` s, acha o rosto maior e devolve [[t, x]] (x = centro do rosto, 0..1), já suavizado.
let det = null, lastRes = null;
function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('Não consegui carregar o detector de rosto.')); document.head.append(s); }); }
async function getDetector() {
  if (det) return det;
  await loadScript('vendor/face/face_detection.js');
  const d = new window.FaceDetection({ locateFile: f => 'vendor/face/' + f });
  d.setOptions({ model: 'short', minDetectionConfidence: 0.5 }); d.onResults(r => { lastRes = r; }); await d.initialize(); return (det = d);
}
export async function trackFaces(file, from, to, { step = 0.5, onProgress, signal } = {}) {
  const d = await getDetector(), v = document.createElement('video'), url = URL.createObjectURL(file); v.muted = true; v.preload = 'auto'; v.src = url; v.playsInline = true;
  await new Promise((ok, no) => { v.onloadeddata = ok; v.onerror = () => no(new Error('Não consegui ler o vídeo.')); });
  const c = document.createElement('canvas'), k = Math.min(1, 480 / Math.max(v.videoWidth, v.videoHeight)); c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k); const x = c.getContext('2d'), raw = [];
  try {
    for (let t = from; t <= to; t += step) {
      if (signal?.aborted) throw new Error('Cancelado.');
      await new Promise(ok => { v.onseeked = ok; v.currentTime = Math.min(t, v.duration - 0.05); });
      x.drawImage(v, 0, 0, c.width, c.height); lastRes = null; await d.send({ image: c });
      const f = (lastRes?.detections || []).map(q => q.boundingBox).filter(Boolean).sort((a, b) => b.width * b.height - a.width * a.height)[0];
      raw.push([t, f ? f.xCenter : null]); onProgress && onProgress((t - from) / Math.max(1, to - from));
    }
  } finally { URL.revokeObjectURL(url); }
  return smooth(raw);
}
// preenche buracos com o último valor conhecido e suaviza (mediana de 3 + média exponencial) para a câmera não tremer
export function smooth(raw) {
  let last = null; const a = raw.map(([t, x]) => { if (x != null) last = x; return [t, last]; });
  const first = a.find(p => p[1] != null); if (!first) return [];
  a.forEach(p => { if (p[1] == null) p[1] = first[1]; });
  const med = a.map((p, i) => { const w = [a[Math.max(0, i - 1)][1], p[1], a[Math.min(a.length - 1, i + 1)][1]].sort((u, v) => u - v); return [p[0], w[1]]; });
  let e = med[0][1]; return med.map(([t, v]) => { e += (v - e) * 0.5; return [t, e]; });
}
// posição do enquadramento (0..1) no tempo t, interpolada entre as amostras
export function trackAt(tr, t) {
  if (!tr || !tr.length) return null; if (t <= tr[0][0]) return tr[0][1]; const n = tr.length; if (t >= tr[n - 1][0]) return tr[n - 1][1];
  let i = 0; while (i + 1 < n && tr[i + 1][0] < t) i++; const [t0, x0] = tr[i], [t1, x1] = tr[i + 1], u = (t - t0) / (t1 - t0); return x0 + (x1 - x0) * u;
}
