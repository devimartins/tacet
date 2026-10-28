// Gera um corte 9:16 com legendas, 100% no navegador: decodifica, recorta, desenha as legendas, codifica e grava o MP4.
// O áudio original (AAC) é copiado sem recodificar.
import { drawCaption, chunksOf, perChunk, resolve, loadFont } from './captions.js';
import { makeReader } from './media.js?v=6';
import { drawOverlays, drawBroll } from './overlays.js';
import { cutRanges, makeShift, inRange, zoomAt } from './edit.js';
import { trackAt } from './facetrack.js';
import { createGrader } from './color.js?v=2';
import { addEmojis, sfxEvents, addSfx, denoise, denoiseAI } from './extras.js';

export async function pickCodec(W, H, fps) {
  if (typeof VideoEncoder === 'undefined') throw new Error('Este navegador não consegue gerar vídeo (VideoEncoder). Use Chrome, Edge ou Safari atualizado.');
  const tries = [['avc', 'avc1.640028'], ['avc', 'avc1.64002A'], ['vp9', 'vp09.00.40.08']];
  for (const [mux, codec] of tries) {
    const cfg = { codec, width: W, height: H, bitrate: 8e6, framerate: fps, ...(mux === 'avc' ? { avc: { format: 'avc' } } : {}) };
    try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return { mux, cfg }; } catch { /* próximo */ }
  }
  throw new Error('Este aparelho não codifica vídeo H.264.');
}

// 'auto': fundo desfocado quando o quadro de saída é bem mais largo que o vídeo (ex.: vertical em 16:9)
export const useBlur = (fit, dw, dh, W, H) => fit === 'blur' || (fit !== 'cover' && W / H > (dw / dh) * 1.25);
export async function renderClip({ file, media, clip, words, style, onProgress, W = 1080, H = 1920, fps = 30, opts = {} }) {
  const V = media.video; if (!V) throw new Error('O arquivo não tem vídeo.');
  const start = clip.start, end = Math.min(clip.end, media.duration);
  const rem = cutRanges(words, start, end, opts.cutFx || { cut: opts.cutSilence }, opts.allWords || words), shift = makeShift(rem), base = shift(start), len = shift(end) - base;
  if (!(len > 0.5)) throw new Error('Corte curto demais.');
  const rs = resolve(style);
  await loadFont(rs.font, rs.wLight, rs.wActive);
  for (const o of Object.values(rs.seg || {})) if (o.font) await loadFont(o.font, rs.wLight, rs.wActive);
  const cw = words.filter(w => w.s >= start - 0.05 && w.e <= end + 0.05 && !inRange(rem, w.s)).map(w => ({ ...w, s0: w.s, s: Math.max(0, shift(w.s) - base), e: shift(w.e) - base }));
  const chunks = chunksOf(opts.emoji ? addEmojis(cw, 2.5, opts.tone) : cw, perChunk(rs));
  const rot = V.rotation, swap = rot === 90 || rot === 270, dw = swap ? V.height : V.width, dh = swap ? V.width : V.height;
  const blur = useBlur(style.fit || 'auto', dw, dh, W, H), sc = blur ? Math.min(W / dw, H / dh) : Math.max(W / dw, H / dh), sw = W / sc, sh = H / sc, sx = (dw - sw) * (blur ? 0.5 : rs.cropX), sy = (dh - sh) / 2;
  const scB = Math.max(W / dw, H / dh), bgc = blur && !opts.bgScene ? document.createElement('canvas') : null; if (bgc) { bgc.width = Math.ceil(W / 14); bgc.height = Math.ceil(H / 14); }
  const rotate = (c, k) => { if (rot === 90) { c.translate(V.height, 0); c.rotate(Math.PI / 2); } else if (rot === 180) { c.translate(V.width, V.height); c.rotate(Math.PI); } else if (rot === 270) { c.translate(0, V.width); c.rotate(-Math.PI / 2); } };
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');

  const gP = opts.grade || null, grader = gP ? createGrader(W, H) : null;   // correção de cor em GPU (só se houver ajuste)
  const cssF = gP && !grader ? `brightness(${1 + gP.g.bright * 0.6}) contrast(${1 + gP.g.contrast}) saturate(${1 + gP.g.sat})` : '';
  const { mux, cfg } = await pickCodec(W, H, fps);
  const M = window.Mp4Muxer, target = new M.ArrayBufferTarget(), A = media.audio;
  const muxer = new M.Muxer({ target, fastStart: 'in-memory', firstTimestampBehavior: 'offset', video: { codec: mux, width: W, height: H, frameRate: fps },
    ...(opts.music || opts.sfx || opts.denoise || opts.fadeIn > 0 || opts.fadeOut > 0 || (opts.tracks && opts.tracks.length) ? { audio: { codec: 'aac', numberOfChannels: 2, sampleRate: A ? A.sampleRate : 48000 } } : A ? { audio: { codec: 'aac', numberOfChannels: A.channels, sampleRate: A.sampleRate } } : {}) });
  let eerr = null, derr = null;
  const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => { eerr = e; } });
  enc.configure(cfg);

  let bgM = null, bgWarned = false;
  const q = []; let nextT = 0, n = 0, lastT = 0;
  let ci = -1, nout = 0;
  const dec = new VideoDecoder({ output: f => { nout++; q.push(f); }, error: e => { derr = new Error((e && e.message || 'erro') + ' [amostra ' + ci + ', quadros ' + nout + ', ' + V.codec + ' ' + V.width + 'x' + V.height + ', desc ' + (V.description ? V.description.length : 0) + ']'); } });
  const dcfg = { codec: V.codec, codedWidth: V.width, codedHeight: V.height }; if (V.description) dcfg.description = V.description;
  if (!(await VideoDecoder.isConfigSupported(dcfg)).supported) throw new Error('O aparelho não decodifica este vídeo (' + V.codec + ').');
  dec.configure(dcfg);

  async function process(f) {
    const ta = f.timestamp / 1e6;
    if (inRange(rem, ta)) { f.close(); return; }
    const t = shift(ta) - base;
    if (t < -0.0005 || t > len || t < nextT - 0.001) { f.close(); return; }
    nextT = Math.max(nextT + 1 / fps, t + 0.5 / fps); lastT = t;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const z = opts.zoom ? zoomAt(chunks, t, opts.zoomLevel || 1.1) : 1;
    if (bgc) {   // fundo: o próprio vídeo ampliado e desfocado (reduz a 1/14 e amplia, barato)
      const b = bgc.getContext('2d'), k = bgc.width / W; b.setTransform(1, 0, 0, 1, 0, 0); b.transform(k * scB, 0, 0, k * scB, -k * scB * (dw - W / scB) * 0.5, -k * scB * (dh - H / scB) / 2); rotate(b); b.drawImage(f, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.drawImage(bgc, 0, 0, W, H); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(0, 0, W, H);
    }
    ctx.setTransform(z, 0, 0, z, W * (1 - z) / 2, H * (1 - z) * 0.42); const fx = !blur && opts.faceTrack ? trackAt(opts.faceTrack, ta) : null, sxF = fx != null && dw > sw ? (dw - sw) * Math.min(1, Math.max(0, (fx * dw - sw / 2) / (dw - sw))) : sx;
    ctx.transform(sc, 0, 0, sc, -sxF * sc, -sy * sc);
    rotate(ctx);
    if (cssF && 'filter' in ctx) ctx.filter = cssF;
    ctx.drawImage(f, 0, 0); f.close();
    ctx.setTransform(1, 0, 0, 1, 0, 0); if (cssF && 'filter' in ctx) ctx.filter = 'none';
    if (opts.bgScene) { try { if (!bgM) { bgM = await import('./bgswap.js?v=2'); bgM.resetMask(); } await bgM.swapOn(ctx, cv, W, H, opts.bgScene); } catch (e) { if (!bgWarned) { bgWarned = true; console.warn('fundo', e); } } }
    if (grader) { try { ctx.drawImage(grader.apply(cv, gP.g, gP.lut), 0, 0); } catch { /* segue sem cor */ } }
    if (opts.overlays && opts.overlays.length) drawBroll(ctx, W, H, opts.overlays, ta);
    drawCaption(ctx, W, H, chunks, t, rs);
    if (opts.overlays && opts.overlays.length) drawOverlays(ctx, W, H, opts.overlays, ta, rs.font);
    if (opts.fadeIn > 0 || opts.fadeOut > 0) { const a = Math.max(opts.fadeIn > 0 ? 1 - t / opts.fadeIn : 0, opts.fadeOut > 0 ? (t - (len - opts.fadeOut)) / opts.fadeOut : 0); if (a > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, a).toFixed(3)})`; ctx.fillRect(0, 0, W, H); } }
    const vf = new VideoFrame(cv, { timestamp: Math.round(t * 1e6), duration: Math.round(1e6 / fps) });
    enc.encode(vf, { keyFrame: n++ % (fps * 2) === 0 }); vf.close();
    while (enc.encodeQueueSize > 6) await new Promise(r => enc.addEventListener('dequeue', r, { once: true }));
    if (opts.signal && opts.signal.aborted) { try { enc.close(); } catch { /* já fechado */ } throw new Error('Geração cancelada.'); }
    onProgress && onProgress(Math.min(0.98, t / len));
  }

  const S = V.samples, tm = s => s.cts / s.timescale;
  let i0 = 0; for (let i = 0; i < S.length; i++) { if (tm(S[i]) > start + 2) break; if (S[i].is_sync && tm(S[i]) <= start + 1e-6) i0 = i; }   // último quadro-chave antes do início
  const read = makeReader(file);
  for (let i = i0; i < S.length; i++) {
    const s = S[i]; if (s.dts / s.timescale > end + 0.6) break; ci = i;
    if (derr || eerr) throw new Error('Falha ao gerar o vídeo: ' + (derr || eerr).message);
    dec.decode(new EncodedVideoChunk({ type: s.is_sync ? 'key' : 'delta', timestamp: Math.round(s.cts * 1e6 / s.timescale), duration: Math.round(s.duration * 1e6 / s.timescale), data: await read(s.offset, s.size) }));
    while (dec.decodeQueueSize > 8 || q.length > 4) { if (q.length) await process(q.shift()); else await new Promise(r => setTimeout(r, 2)); }
  }
  await dec.flush(); while (q.length) await process(q.shift()); dec.close();
  await enc.flush(); enc.close(); if (grader) grader.dispose();
  if (derr || eerr) throw new Error('Falha ao gerar o vídeo: ' + (derr || eerr).message);

  if (opts.music || opts.sfx || opts.denoise || opts.fadeIn > 0 || opts.fadeOut > 0 || (opts.tracks && opts.tracks.length)) await mixAudio({ file, A, muxer, read, start, end, rem, shift, base, len, tracks: opts.tracks, fadeIn: opts.fadeIn, fadeOut: opts.fadeOut, denoise: opts.denoise, music: opts.music, sfx: opts.sfx ? sfxEvents(chunks, opts.overlays, shift, base) : null });
  else if (A) {   // copia os blocos de áudio do trecho, sem recodificar
    let first = true;
    for (const s of A.samples) {
      const t = s.cts / s.timescale; if (t < start - 1e-6) continue; if (t >= end) break; if (inRange(rem, t)) continue;
      const data = (await read(s.offset, s.size)).slice();
      const meta = first ? { decoderConfig: { codec: A.codec, numberOfChannels: A.channels, sampleRate: A.sampleRate, description: A.asc } } : undefined; first = false;
      muxer.addAudioChunkRaw(data, 'key', Math.round((shift(t) - base) * 1e6), Math.round(s.duration * 1e6 / s.timescale), meta);
    }
  }
  muxer.finalize(); onProgress && onProgress(1);
  return { blob: new Blob([target.buffer], { type: 'video/mp4' }), codec: mux, seconds: lastT };
}

// Mistura o áudio original (decodificado) com a música e recodifica em AAC estéreo.
// music = { buffer: AudioBuffer (já na taxa do vídeo), volume: 0..1 }
async function mixAudio({ A, muxer, read, start, end, rem, shift, base, len, music, sfx, tracks, fadeIn, fadeOut, denoise: dn }) {
  if (typeof AudioEncoder === 'undefined') throw new Error('Este navegador não codifica áudio. Use Chrome ou Edge atualizado, ou remova a música.');
  const sr = A ? A.sampleRate : 48000, N = Math.ceil(len * sr), L = new Float32Array(N), R = new Float32Array(N);
  if (A) {
    const dec = new AudioDecoder({ output: ad => {
      const t = ad.timestamp / 1e6, nf = ad.numberOfFrames, nc = ad.numberOfChannels;
      if (t >= start - 0.05 && t < end && !inRange(rem, t)) {
        const pos = Math.round((shift(t) - base) * sr), a = new Float32Array(nf), b = nc > 1 ? new Float32Array(nf) : a;
        ad.copyTo(a, { planeIndex: 0, format: 'f32-planar' }); if (nc > 1) ad.copyTo(b, { planeIndex: 1, format: 'f32-planar' });
        for (let i = 0; i < nf; i++) { const k = pos + i; if (k >= 0 && k < N) { L[k] += a[i]; R[k] += b[i]; } }
      }
      ad.close(); }, error: () => { } });
    const cfg = { codec: A.codec, sampleRate: A.sampleRate, numberOfChannels: A.channels }; if (A.asc) cfg.description = A.asc;
    dec.configure(cfg);
    for (const s of A.samples) {
      const t = s.cts / s.timescale; if (t < start - 0.1) continue; if (t >= end) break;
      dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(t * 1e6), data: await read(s.offset, s.size) }));
      if (dec.decodeQueueSize > 40) await new Promise(r => dec.addEventListener('dequeue', r, { once: true }));
    }
    await dec.flush(); dec.close();
  }
  if (dn && A) await denoiseAI(L, R, sr);
  if (music) {
    const mb = music.buffer, mc = mb.numberOfChannels, ml = mb.length, g = Math.max(0, Math.min(1, music.volume ?? 0.25)), fade = Math.min(N, Math.round(sr * 1.2));
    const m0 = mb.getChannelData(0), m1 = mc > 1 ? mb.getChannelData(1) : m0;
    for (let i = 0; i < N; i++) { const k = i % ml, f = i > N - fade ? (N - i) / fade : 1; L[i] += m0[k] * g * f; R[i] += m1[k] * g * f; }
  }
  for (const tk of tracks || []) {   // áudios extras posicionados no tempo do vídeo original
    const t0 = Math.round((shift(Math.min(Math.max(tk.at, start), end)) - base) * sr); if (tk.at < start || tk.at >= end) continue;
    const c0 = tk.buf.getChannelData(0), c1 = tk.buf.numberOfChannels > 1 ? tk.buf.getChannelData(1) : c0, g = tk.vol ?? 1;
    for (let i = 0; i < c0.length; i++) { const k = t0 + i; if (k >= N) break; if (k >= 0) { L[k] += c0[i] * g; R[k] += c1[i] * g; } }
  }
  if (sfx) addSfx(L, R, sr, sfx);
  const fi = Math.round((fadeIn || 0) * sr), fo = Math.round((fadeOut || 0) * sr);
  if (fi > 0 || fo > 0) for (let i = 0; i < N; i++) { const g = Math.min(fi > 0 && i < fi ? i / fi : 1, fo > 0 && i > N - fo ? (N - i) / fo : 1); L[i] *= g; R[i] *= g; }
  for (let i = 0; i < N; i++) { L[i] = Math.max(-1, Math.min(1, L[i])); R[i] = Math.max(-1, Math.min(1, R[i])); }
  let first = true, err = null;
  const enc = new AudioEncoder({ output: (c, m) => { muxer.addAudioChunk(c, first ? m : undefined); first = false; }, error: e => { err = e; } });
  const ecfg = { codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: 2, bitrate: 128000 };
  if (!(await AudioEncoder.isConfigSupported(ecfg)).supported) throw new Error('Este navegador não codifica AAC. Remova a música ou use Chrome/Edge atualizado.');
  enc.configure(ecfg);
  const B = 4096;
  for (let o = 0; o < N; o += B) {
    const n = Math.min(B, N - o), d = new Float32Array(n * 2); d.set(L.subarray(o, o + n), 0); d.set(R.subarray(o, o + n), n);
    enc.encode(new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(o / sr * 1e6), data: d }));
    if (enc.encodeQueueSize > 20) await new Promise(r => enc.addEventListener('dequeue', r, { once: true }));
  }
  await enc.flush(); enc.close(); if (err) throw new Error('Falha no áudio: ' + err.message);
}
