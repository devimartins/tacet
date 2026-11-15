// Grava um elemento da própria aba (imagem + som da aba) e devolve um MP4 9:16.
// Usa a captura de aba do navegador (getDisplayMedia): pede permissão ao usuário e só existe no Chrome/Edge de computador.
import { canRecordWC, startWcRecording } from './recorder.js?v=8';
export const tabCapSupport = () => { const md = navigator.mediaDevices; if (!md || !md.getDisplayMedia) return 'none'; return window.RestrictionTarget ? 'element' : window.CropTarget ? 'crop' : 'none'; };
let S = null;   // a permissão vale até o usuário parar o compartilhamento: os próximos downloads não perguntam de novo
export async function getTabStream() {
  if (S && S.active && S.getVideoTracks()[0] && S.getVideoTracks()[0].readyState === 'live') return S;
  const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30, cursor: 'never' }, audio: { suppressLocalAudioPlayback: false, echoCancellation: false, noiseSuppression: false, autoGainControl: false }, preferCurrentTab: true, selfBrowserSurface: 'include', systemAudio: 'exclude', surfaceSwitching: 'exclude' });
  const v = s.getVideoTracks()[0], set = v.getSettings ? v.getSettings() : {};
  if (set.displaySurface && set.displaySurface !== 'browser') { s.getTracks().forEach(t => t.stop()); throw new Error('Escolha “Esta guia” na janela do navegador.'); }
  if (!s.getAudioTracks().length) { s.getTracks().forEach(t => t.stop()); throw new Error('O som da guia não foi compartilhado. Tente de novo e deixe marcado “Compartilhar também o áudio da guia”.'); }
  v.addEventListener('ended', () => { if (S === s) S = null; });
  return (S = s);
}
export function releaseTabStream() { if (S) { S.getTracks().forEach(t => t.stop()); S = null; } }

// el: elemento a gravar (precisa de isolation:isolate). ctx: AudioContext criado dentro do clique.
export async function recordElement({ el, stream, ctx, w = 1080, h = 1920, fps = 30 }) {
  const vt = stream.getVideoTracks()[0], at = stream.getAudioTracks()[0], mode = tabCapSupport();
  if (mode === 'element') await vt.restrictTo(await RestrictionTarget.fromElement(el));   // só o elemento: o que estiver por cima (barra de progresso) não entra
  else if (mode === 'crop') await vt.cropTo(await CropTarget.fromElement(el));
  const vid = document.createElement('video'); vid.muted = true; vid.playsInline = true; vid.srcObject = new MediaStream([vt]); await vid.play();
  await new Promise(r => { const t0 = performance.now(), ck = () => vid.videoWidth > 2 || performance.now() - t0 > 3000 ? r() : requestAnimationFrame(ck); ck(); });
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d', { alpha: false }); g.imageSmoothingQuality = 'high';
  let run = true, n = 0;
  const paint = () => { if (!run) return; requestAnimationFrame(paint); const vw = vid.videoWidth, vh = vid.videoHeight; if (vw < 2) return; const k = Math.max(w / vw, h / vh), sw = w / k, sh = h / k; g.drawImage(vid, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, w, h); n++; };
  paint();
  let wc = null, mr = null, chunks = [], kind = '';
  if (ctx && canRecordWC()) { try { wc = await Promise.race([startWcRecording({ ctx, source: cv, audioTrack: at, fps }), new Promise((_, no) => setTimeout(() => no(new Error('tempo')), 3000))]); kind = 'mp4'; } catch { wc = null; } }
  if (!wc) {
    const mime = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t)) || '';
    mr = new MediaRecorder(new MediaStream([cv.captureStream(fps).getVideoTracks()[0], at]), mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
    mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); }; mr.start(1000); kind = (mr.mimeType || mime).includes('mp4') ? 'mp4' : 'webm';
  }
  const undo = async () => { run = false; try { vid.srcObject = null; } catch { /* ok */ } try { if (mode === 'element') await vt.restrictTo(null); else if (mode === 'crop') await vt.cropTo(null); } catch { /* ok */ } };
  return {
    kind, get frames() { return n; },
    async stop() {
      let blob;
      if (wc) blob = await wc.stop(); else { await new Promise(r => { mr.onstop = r; mr.stop(); }); blob = new Blob(chunks, { type: kind === 'mp4' ? 'video/mp4' : 'video/webm' }); try { ctx && ctx.close(); } catch { /* ok */ } }
      await undo(); return blob;
    },
    async cancel() { try { if (wc) await wc.stop(); else if (mr.state !== 'inactive') mr.stop(); } catch { /* ok */ } try { ctx && ctx.state !== 'closed' && ctx.close(); } catch { /* ok */ } await undo(); },
  };
}
