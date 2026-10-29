// Gravador próprio com WebCodecs: codifica imagem (H.264) e áudio (AAC) e já grava um MP4 comum, com índice completo.
// Evita o MediaRecorder do iPhone, que gera MP4 "fragmentado" e, com canvas, quadros irregulares.
const even = n => Math.round(n / 2) * 2;
const PROFILES = {
  mp4: { v: [['avc1.64002A', 'avc'], ['avc1.640028', 'avc'], ['avc1.4D0028', 'avc'], ['avc1.42E028', 'avc'], ['avc1.42001F', 'avc']], a: ['mp4a.40.2', 'aac'] },
  test: { v: [['vp09.00.10.08', 'vp9']], a: ['opus', 'opus'] },   // só para testar em navegadores sem H.264
};
export const canRecordWC = () => !!(window.VideoEncoder && window.AudioEncoder && window.VideoFrame && window.AudioData && window.Mp4Muxer && (window.AudioContext || window.webkitAudioContext));

// Cria o contexto de áudio dentro do toque do usuário (exigência do iOS) e passa para startWcRecording.
export function primeAudio() { const AC = window.AudioContext || window.webkitAudioContext, c = new AC(); try { c.resume(); } catch { /* ok */ } return c; }


// Alguns navegadores (Safari) não entregam a descrição do H.264 (avcC) junto do primeiro quadro. Monto a partir do SPS/PPS do próprio quadro-chave.
export function avcFromData(d) {
  const nals = []; let annexb = false;
  if ((d[0] === 0 && d[1] === 0 && d[2] === 0 && d[3] === 1) || (d[0] === 0 && d[1] === 0 && d[2] === 1)) {
    annexb = true; let i = 0, st = -1;
    const mark = () => { if (st >= 0) { let e = i; while (e > st && d[e - 1] === 0) e--; nals.push(d.subarray(st, e)); } };
    while (i + 3 <= d.length) { if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 1) { mark(); st = i + 3; i += 3; } else i++; }
    i = d.length; mark();
  } else { let o = 0; while (o + 4 < d.length) { const n = ((d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]) >>> 0; if (!n || o + 4 + n > d.length) break; nals.push(d.subarray(o + 4, o + 4 + n)); o += 4 + n; } }
  const sps = nals.find(n => (n[0] & 31) === 7), pps = nals.find(n => (n[0] & 31) === 8); if (!sps || !pps) return null;
  const desc = new Uint8Array(11 + sps.length + pps.length); let k = 0;
  desc.set([1, sps[1], sps[2], sps[3], 0xFF, 0xE1, sps.length >> 8, sps.length & 255], k); k += 8; desc.set(sps, k); k += sps.length;
  desc.set([1, pps.length >> 8, pps.length & 255], k); k += 3; desc.set(pps, k);
  return { annexb, desc, codec: 'avc1.' + [sps[1], sps[2], sps[3]].map(b => b.toString(16).padStart(2, '0')).join('') };
}
export function toAvcc(d) {   // Annex B -> quadros com prefixo de tamanho de 4 bytes
  const parts = []; let i = 0, st = -1, len = 0;
  const mark = () => { if (st >= 0) { let e = i; while (e > st && d[e - 1] === 0) e--; parts.push(d.subarray(st, e)); len += 4 + e - st; } };
  while (i + 3 <= d.length) { if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 1) { mark(); st = i + 3; i += 3; } else i++; }
  i = d.length; mark();
  const out = new Uint8Array(len); let o = 0; for (const p of parts) { out[o] = p.length >>> 24; out[o + 1] = (p.length >> 16) & 255; out[o + 2] = (p.length >> 8) & 255; out[o + 3] = p.length & 255; out.set(p, o + 4); o += 4 + p.length; } return out;
}
export let wcStage = '';
export async function startWcRecording({ source, audioTrack, ctx, fps = 30, profile = 'mp4', onError }) {
  wcStage = 'config vídeo';
  const P = PROFILES[profile], sw = source.width || source.videoWidth, sh = source.height || source.videoHeight;
  if (!sw || !sh) throw new Error('Sem imagem para gravar.');
  const w = even(sw), h = even(sh), bitrate = Math.max(3e6, Math.min(12e6, Math.round(w * h * fps * 0.07)));
  let vcfg = null, vmux = null;
  for (const [codec, mux] of P.v) { const cfg = { codec, width: w, height: h, bitrate, framerate: fps, latencyMode: 'realtime', ...(mux === 'avc' ? { avc: { format: 'avc' } } : {}) }; try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) { vcfg = cfg; vmux = mux; break; } } catch { /* próximo */ } }
  if (!vcfg) throw new Error('Sem codificador de vídeo.');
  wcStage = 'config áudio';
  const sr = ctx.sampleRate, acfg = { codec: P.a[0], sampleRate: sr, numberOfChannels: 1, bitrate: 96000 };
  if (!(await AudioEncoder.isConfigSupported(acfg)).supported) throw new Error('Sem codificador de áudio.');
  if (ctx.state !== 'running') { try { ctx.resume(); } catch { /* ok */ } }
  wcStage = 'muxer';
  const target = new window.Mp4Muxer.ArrayBufferTarget();
  const muxer = new window.Mp4Muxer.Muxer({ target, fastStart: 'in-memory', firstTimestampBehavior: 'offset', video: { codec: vmux, width: w, height: h, frameRate: fps }, audio: { codec: P.a[1], sampleRate: sr, numberOfChannels: 1 } });
  let failed = null; const fail = e => { failed = failed || e; onError && onError(e); };
  let hasCfg = false, built = null, firstV = true;
  const vout = (c, m) => {
    try {
      if (vmux !== 'avc' || hasCfg || (m && m.decoderConfig && m.decoderConfig.description)) { hasCfg = true; muxer.addVideoChunk(c, m); return; }
      const d = new Uint8Array(c.byteLength); c.copyTo(d);
      if (!built) { built = avcFromData(d); if (!built) { fail(new Error('Sem descrição do H.264')); return; } }
      muxer.addVideoChunkRaw(built.annexb ? toAvcc(d) : d, c.type, c.timestamp, c.duration, firstV ? { decoderConfig: { codec: built.codec, description: built.desc, codedWidth: w, codedHeight: h } } : undefined);
      firstV = false;
    } catch (e) { fail(e); }
  };
  const venc = new VideoEncoder({ output: vout, error: fail }); venc.configure(vcfg);
  const aacAsc = (sr, ch) => { const F = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350], i = Math.max(0, F.indexOf(sr)); return new Uint8Array([(2 << 3) | (i >> 1), ((i & 1) << 7) | (ch << 3)]); };   // AudioSpecificConfig AAC-LC: o Safari não entrega esta descrição junto do áudio codificado
  let aFirst = true;
  const aenc = new AudioEncoder({ output: (c, m) => { try { const mm = aFirst && P.a[1] === 'aac' ? { decoderConfig: { codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: 1, description: aacAsc(sr, 1) } } : m; aFirst = false; muxer.addAudioChunk(c, mm); } catch (e) { fail(e); } }, error: fail }); aenc.configure(acfg);
  wcStage = 'ligando microfone';
  const srcNode = ctx.createMediaStreamSource(new MediaStream([audioTrack])), sp = ctx.createScriptProcessor(4096, 1, 1), mute = ctx.createGain();
  mute.gain.value = 0; srcNode.connect(sp); sp.connect(mute); mute.connect(ctx.destination);
  let t0 = null, n = 0, run = true, lastV = -1e9, vf = 0, raf = 0;
  sp.onaudioprocess = e => {
    if (!run) return; const d = e.inputBuffer.getChannelData(0); if (t0 === null) t0 = ctx.currentTime - d.length / sr;
    const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: d.length, numberOfChannels: 1, timestamp: Math.round(n * 1e6 / sr), data: new Float32Array(d) });
    n += d.length; try { aenc.encode(ad); } catch (er) { fail(er); } ad.close();
  };
  const loop = () => {
    if (!run) return; raf = requestAnimationFrame(loop); if (t0 === null || failed) return;
    const ts = Math.max(0, ctx.currentTime - t0) * 1e6; if (ts - lastV < 1e6 / fps * 0.85 || venc.encodeQueueSize > 8) return; lastV = ts;
    try { const f = new VideoFrame(source, { timestamp: Math.round(ts) }); venc.encode(f, { keyFrame: vf % (fps * 2) === 0 }); f.close(); vf++; } catch (er) { fail(er); }
  };
  raf = requestAnimationFrame(loop); wcStage = 'gravando';
  return {
    get frames() { return vf; }, get audioFrames() { return n; }, get error() { return failed; },
    async stop() {
      run = false; cancelAnimationFrame(raf); try { sp.disconnect(); srcNode.disconnect(); mute.disconnect(); } catch { /* ok */ }
      if (failed) { try { ctx.close(); } catch { /* ok */ } throw failed; }
      await venc.flush(); await aenc.flush(); venc.close(); aenc.close(); muxer.finalize(); try { ctx.close(); } catch { /* ok */ }
      if (!vf) throw new Error('Nenhum quadro gravado.');
      return new Blob([target.buffer], { type: 'video/mp4' });
    },
  };
}

// Guarda o áudio bruto do microfone (mono) durante a gravação, para transcrever sem decodificar o arquivo.
export function startPcmTap(ctx, audioTrack) {
  const src = ctx.createMediaStreamSource(new MediaStream([audioTrack])), sp = ctx.createScriptProcessor(4096, 1, 1), mute = ctx.createGain(), parts = []; let len = 0, on = true;
  mute.gain.value = 0; src.connect(sp); sp.connect(mute); mute.connect(ctx.destination);
  sp.onaudioprocess = e => { if (!on) return; const d = new Float32Array(e.inputBuffer.getChannelData(0)); parts.push(d); len += d.length; };
  return { stop() { on = false; try { sp.disconnect(); src.disconnect(); mute.disconnect(); } catch { /* ok */ } const data = new Float32Array(len); let o = 0; for (const p of parts) { data.set(p, o); o += p.length; } return { data, sr: ctx.sampleRate }; } };
}
