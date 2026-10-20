// Gera um corte 9:16 com legendas, 100% no navegador: decodifica, recorta, desenha as legendas, codifica e grava o MP4.
// O áudio original (AAC) é copiado sem recodificar.
import { drawCaption, chunksOf, resolve, loadFont } from './captions.js';
import { makeReader } from './media.js';
import { silences, makeShift, inRange, zoomAt } from './edit.js';

export async function pickCodec(W, H, fps) {
  if (typeof VideoEncoder === 'undefined') throw new Error('Este navegador não consegue gerar vídeo (VideoEncoder). Use Chrome, Edge ou Safari atualizado.');
  const tries = [['avc', 'avc1.640028'], ['avc', 'avc1.64002A'], ['vp9', 'vp09.00.40.08']];
  for (const [mux, codec] of tries) {
    const cfg = { codec, width: W, height: H, bitrate: 8e6, framerate: fps, ...(mux === 'avc' ? { avc: { format: 'avc' } } : {}) };
    try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return { mux, cfg }; } catch { /* próximo */ }
  }
  throw new Error('Este aparelho não codifica vídeo H.264.');
}

export async function renderClip({ file, media, clip, words, style, onProgress, W = 1080, H = 1920, fps = 30, opts = {} }) {
  const V = media.video; if (!V) throw new Error('O arquivo não tem vídeo.');
  const start = clip.start, end = Math.min(clip.end, media.duration);
  const rem = opts.cutSilence ? silences(words, start, end) : [], shift = makeShift(rem), base = shift(start), len = shift(end) - base;
  if (!(len > 0.5)) throw new Error('Corte curto demais.');
  const rs = resolve(style);
  await loadFont(rs.font, rs.wLight, rs.wActive);
  const cw = words.filter(w => w.s >= start - 0.05 && w.e <= end + 0.05 && !inRange(rem, w.s)).map(w => ({ ...w, s: Math.max(0, shift(w.s) - base), e: shift(w.e) - base }));
  const chunks = chunksOf(cw, Math.max(1, rs.n | 0));
  const rot = V.rotation, swap = rot === 90 || rot === 270, dw = swap ? V.height : V.width, dh = swap ? V.width : V.height;
  const sc = Math.max(W / dw, H / dh), sw = W / sc, sh = H / sc, sx = (dw - sw) * rs.cropX, sy = (dh - sh) / 2;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');

  const { mux, cfg } = await pickCodec(W, H, fps);
  const M = window.Mp4Muxer, target = new M.ArrayBufferTarget(), A = media.audio;
  const muxer = new M.Muxer({ target, fastStart: 'in-memory', firstTimestampBehavior: 'offset', video: { codec: mux, width: W, height: H, frameRate: fps },
    ...(A ? { audio: { codec: 'aac', numberOfChannels: A.channels, sampleRate: A.sampleRate } } : {}) });
  let eerr = null, derr = null;
  const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => { eerr = e; } });
  enc.configure(cfg);

  const q = []; let nextT = 0, n = 0, lastT = 0;
  const dec = new VideoDecoder({ output: f => q.push(f), error: e => { derr = e; } });
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
    const z = opts.zoom ? zoomAt(chunks, t) : 1;
    ctx.setTransform(z, 0, 0, z, W * (1 - z) / 2, H * (1 - z) / 2); ctx.transform(sc, 0, 0, sc, -sx * sc, -sy * sc);
    if (rot === 90) { ctx.translate(V.height, 0); ctx.rotate(Math.PI / 2); } else if (rot === 180) { ctx.translate(V.width, V.height); ctx.rotate(Math.PI); } else if (rot === 270) { ctx.translate(0, V.width); ctx.rotate(-Math.PI / 2); }
    ctx.drawImage(f, 0, 0); f.close();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawCaption(ctx, W, H, chunks, t, rs);
    const vf = new VideoFrame(cv, { timestamp: Math.round(t * 1e6), duration: Math.round(1e6 / fps) });
    enc.encode(vf, { keyFrame: n++ % (fps * 2) === 0 }); vf.close();
    while (enc.encodeQueueSize > 6) await new Promise(r => enc.addEventListener('dequeue', r, { once: true }));
    onProgress && onProgress(Math.min(0.98, t / len));
  }

  const S = V.samples, tm = s => s.cts / s.timescale;
  let i0 = 0; for (let i = 0; i < S.length; i++) { if (tm(S[i]) > start + 2) break; if (S[i].is_sync && tm(S[i]) <= start + 1e-6) i0 = i; }   // último quadro-chave antes do início
  const read = makeReader(file);
  for (let i = i0; i < S.length; i++) {
    const s = S[i]; if (s.dts / s.timescale > end + 0.6) break;
    if (derr || eerr) throw new Error('Falha ao gerar o vídeo: ' + (derr || eerr).message);
    dec.decode(new EncodedVideoChunk({ type: s.is_sync ? 'key' : 'delta', timestamp: Math.round(s.cts * 1e6 / s.timescale), duration: Math.round(s.duration * 1e6 / s.timescale), data: await read(s.offset, s.size) }));
    while (dec.decodeQueueSize > 8 || q.length > 4) { if (q.length) await process(q.shift()); else await new Promise(r => setTimeout(r, 2)); }
  }
  await dec.flush(); while (q.length) await process(q.shift()); dec.close();
  await enc.flush(); enc.close();
  if (derr || eerr) throw new Error('Falha ao gerar o vídeo: ' + (derr || eerr).message);

  if (A) {   // copia os blocos de áudio do trecho, sem recodificar
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
