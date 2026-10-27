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

export async function startWcRecording({ source, audioTrack, ctx, fps = 30, profile = 'mp4', onError }) {
  const P = PROFILES[profile], sw = source.width || source.videoWidth, sh = source.height || source.videoHeight;
  if (!sw || !sh) throw new Error('Sem imagem para gravar.');
  const w = even(sw), h = even(sh), bitrate = Math.max(3e6, Math.min(12e6, Math.round(w * h * fps * 0.07)));
  let vcfg = null, vmux = null;
  for (const [codec, mux] of P.v) { const cfg = { codec, width: w, height: h, bitrate, framerate: fps, latencyMode: 'realtime', ...(mux === 'avc' ? { avc: { format: 'avc' } } : {}) }; try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) { vcfg = cfg; vmux = mux; break; } } catch { /* próximo */ } }
  if (!vcfg) throw new Error('Sem codificador de vídeo.');
  const sr = ctx.sampleRate, acfg = { codec: P.a[0], sampleRate: sr, numberOfChannels: 1, bitrate: 96000 };
  if (!(await AudioEncoder.isConfigSupported(acfg)).supported) throw new Error('Sem codificador de áudio.');
  if (ctx.state !== 'running') { try { await ctx.resume(); } catch { /* ok */ } }
  const target = new window.Mp4Muxer.ArrayBufferTarget();
  const muxer = new window.Mp4Muxer.Muxer({ target, fastStart: 'in-memory', firstTimestampBehavior: 'offset', video: { codec: vmux, width: w, height: h, frameRate: fps }, audio: { codec: P.a[1], sampleRate: sr, numberOfChannels: 1 } });
  let failed = null; const fail = e => { failed = failed || e; onError && onError(e); };
  const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: fail }); venc.configure(vcfg);
  const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: fail }); aenc.configure(acfg);
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
  raf = requestAnimationFrame(loop);
  return {
    get frames() { return vf; }, get error() { return failed; },
    async stop() {
      run = false; cancelAnimationFrame(raf); try { sp.disconnect(); srcNode.disconnect(); mute.disconnect(); } catch { /* ok */ }
      if (failed) { try { ctx.close(); } catch { /* ok */ } throw failed; }
      await venc.flush(); await aenc.flush(); venc.close(); aenc.close(); muxer.finalize(); try { ctx.close(); } catch { /* ok */ }
      if (!vf) throw new Error('Nenhum quadro gravado.');
      return new Blob([target.buffer], { type: 'video/mp4' });
    },
  };
}
