// Leitura de MP4/MOV no navegador, sem carregar o arquivo inteiro: só o índice (moov) e depois blocos de 16 MB.
const MP4Box = () => window.MP4Box;

export async function findMoov(file) {
  let pos = 0; const len = file.size;
  while (pos + 8 <= len) {
    const dv = new DataView(await file.slice(pos, Math.min(len, pos + 16)).arrayBuffer());
    let size = dv.getUint32(0); const type = String.fromCharCode(dv.getUint8(4), dv.getUint8(5), dv.getUint8(6), dv.getUint8(7));
    if (size === 1 && dv.byteLength >= 16) size = Number(dv.getBigUint64(8)); else if (size === 0) size = len - pos;
    if (type === 'moov') return { pos, size };
    if (size < 8) return null; pos += size;
  }
  return null;
}
const readLen = (u, p) => { let n = 0, i = 0, b; do { b = u[p++]; n = (n << 7) | (b & 127); i++; } while ((b & 128) && i < 4); return [n, p]; };
function findAsc(mo) {   // vídeos QuickTime (iPhone) guardam o esds numa caixa que a biblioteca não abre; leio os bytes direto
  for (let i = 4; i + 24 < mo.length; i++) {
    if (mo[i] === 101 && mo[i + 1] === 115 && mo[i + 2] === 100 && mo[i + 3] === 115) {
      let p = i + 8, l, q; if (mo[p] !== 3) continue;[l, q] = readLen(mo, p + 1); p = q + 3;
      if (mo[p] !== 4) continue;[l, q] = readLen(mo, p + 1); p = q + 13;
      if (mo[p] !== 5) continue;[l, q] = readLen(mo, p + 1); return mo.slice(q, q + l);
    }
  }
  return null;
}
export async function openMedia(file) {
  const m = await findMoov(file);
  if (!m) throw new Error('Não achei o índice do vídeo. Use um arquivo MP4 ou MOV comum (não fragmentado).');
  const mo = new Uint8Array(await file.slice(m.pos, m.pos + m.size).arrayBuffer());
  const ft = new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 105, 115, 111, 109]);
  const u = new Uint8Array(ft.length + mo.length); u.set(ft); u.set(mo, ft.length);
  const buf = u.buffer; buf.fileStart = 0;
  const mp4 = MP4Box().createFile(); let info = null, err = null;
  mp4.onError = e => { err = e; }; mp4.onReady = i => { info = i; };
  mp4.appendBuffer(buf); mp4.flush();
  if (err || !info) throw new Error('Não consegui ler o índice do vídeo.');
  const out = { duration: info.duration / info.timescale, audio: null, video: null };
  const at = info.audioTracks[0];
  if (at) {
    const e = mp4.getTrackById(at.id).mdia.minf.stbl.stsd.entries[0];
    const dsi = e.esds && e.esds.esd.descs[0] && e.esds.esd.descs[0].descs[0];
    const asc = dsi ? new Uint8Array(dsi.data) : findAsc(mo);
    const codec = (at.codec.length > 4 || !asc) ? at.codec : 'mp4a.40.' + (asc[0] >> 3);
    const FQ = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350], fi = asc && asc.length >= 2 ? ((asc[0] & 7) << 1) | (asc[1] >> 7) : 99, ach = asc && asc.length >= 2 ? (asc[1] >> 3) & 15 : 0;   // o ASC manda: o iPhone grava mono mas o índice diz 2 canais
    out.audio = { codec, sampleRate: fi <= 12 ? FQ[fi] : at.audio.sample_rate, channels: ach > 0 && ach < 8 ? ach : at.audio.channel_count, asc, samples: mp4.getTrackSamplesInfo(at.id) };
  }
  const vt = info.videoTracks[0];
  if (vt) {
    const trak = mp4.getTrackById(vt.id), e = trak.mdia.minf.stbl.stsd.entries[0];
    const box = e.avcC || e.hvcC || e.vpcC || e.av1C;
    let description = null;
    if (box) { const DS = window.DataStream || MP4Box().DataStream, ds = new DS(undefined, 0, DS.BIG_ENDIAN); box.write(ds); description = new Uint8Array(ds.buffer, 8); }
    const mt = trak.tkhd.matrix, rot = Math.round(Math.atan2(mt[1], mt[0]) * 180 / Math.PI);   // 0, 90, 180 ou -90
    out.video = { codec: vt.codec, width: vt.video.width, height: vt.video.height, rotation: ((rot % 360) + 360) % 360, description, samples: mp4.getTrackSamplesInfo(vt.id) };
  }
  if (out.video && !out.video.samples.length) await fillFragmented(file, out, info);
  return out;
}

// MP4 "fragmentado" (gravações do MediaRecorder do iPhone): o moov não lista amostras; elas estão nos blocos moof.
// Leio o arquivo inteiro só para montar a lista de amostras (offset, tamanho, tempo); os dados continuam sendo lidos do arquivo original.
async function fillFragmented(file, out, info0) {
  if (file.size > 400 << 20) throw new Error('Gravação fragmentada grande demais para abrir.');
  const ab = await file.arrayBuffer(); ab.fileStart = 0;
  const mp4 = MP4Box().createFile(); const S = {}; let info = null, err = null;
  mp4.onError = e => { err = e; };
  mp4.onReady = i => { info = i; for (const t of [...i.videoTracks, ...i.audioTracks]) { S[t.id] = []; mp4.setExtractionOptions(t.id, null, { nbSamples: 1000 }); } mp4.start(); };
  mp4.onSamples = (id, u, ss) => { for (const x of ss) S[id].push({ number: x.number, offset: x.offset, size: x.size, dts: x.dts, cts: x.cts, duration: x.duration, timescale: x.timescale, is_sync: x.is_sync }); };
  mp4.appendBuffer(ab); mp4.flush();
  if (err || !info) throw new Error('Não consegui ler a gravação fragmentada.');
  const vt = info.videoTracks[0], at = info.audioTracks[0];
  if (!S[vt.id] || !S[vt.id].length) throw new Error('A gravação não tem imagem.');
  out.video.samples = S[vt.id]; if (out.audio && at && S[at.id]) out.audio.samples = S[at.id];
  const end = t => { const a = S[t.id]; if (!a || !a.length) return 0; const l = a[a.length - 1]; return (l.cts + l.duration) / l.timescale; };
  out.duration = Math.max(out.duration || 0, end(vt), at ? end(at) : 0);
}

// Leitor com janela de 16 MB: lê trechos do arquivo sob demanda.
export function makeReader(file, BLOCK = 16 << 20) {
  let win = { s: 0, e: 0, b: null };
  return async (off, size) => {
    if (!(win.b && off >= win.s && off + size <= win.e)) { const e = Math.min(file.size, off + Math.max(size, BLOCK)); win = { s: off, e, b: new Uint8Array(await file.slice(off, e).arrayBuffer()) }; }
    return win.b.subarray(off - win.s, off - win.s + size);
  };
}

// ---- áudio → WAV mono 16 kHz em blocos de `secs` segundos (para a transcrição) ----
function wav(i16) {
  const sr = 16000, b = new ArrayBuffer(44 + i16.length * 2), v = new DataView(b), s = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  s(0, 'RIFF'); v.setUint32(4, 36 + i16.length * 2, true); s(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, i16.length * 2, true);
  new Int16Array(b, 44).set(i16); return new Blob([b], { type: 'audio/wav' });
}
async function extractAudioWC(file, media, secs, onChunk, onProgress) {
  const A = media.audio; if (!A) throw new Error('Este vídeo não tem áudio.');
  if (!A.codec.startsWith('mp4a')) throw new Error('Áudio ' + A.codec + ' ainda não é suportado (só AAC).');
  if (typeof AudioDecoder === 'undefined') throw new Error('Este navegador não consegue decodificar áudio. Use Chrome, Edge ou Safari atualizado.');
  const cfg = { codec: A.codec, sampleRate: A.sampleRate, numberOfChannels: A.channels }; if (A.asc) cfg.description = A.asc;
  if (!(await AudioDecoder.isConfigSupported(cfg)).supported) throw new Error('O aparelho não decodifica este áudio.');
  const N = 16000 * secs; let buf = new Int16Array(N), k = 0, idx = 0, pending = Promise.resolve();
  const r = A.sampleRate / 16000; let tt = 0, acc = 0, n = 0, derr = null;
  const push = f => { buf[k++] = Math.max(-32768, Math.min(32767, Math.round(f * 32767))); if (k === N) { const blob = wav(buf), o = idx++ * secs; pending = pending.then(() => onChunk(blob, o)); buf = new Int16Array(N); k = 0; } };
  const dec = new AudioDecoder({
    output: ad => { const nc = ad.numberOfChannels, nf = ad.numberOfFrames, mono = new Float32Array(nf), tmp = new Float32Array(nf);
      for (let c = 0; c < nc; c++) { ad.copyTo(tmp, { planeIndex: c, format: 'f32-planar' }); for (let i = 0; i < nf; i++) mono[i] += tmp[i] / nc; }
      ad.close(); for (let i = 0; i < nf; i++) { acc += mono[i]; n++; tt++; if (tt >= r) { push(acc / n); tt -= r; acc = 0; n = 0; } } },
    error: e => { derr = e; },
  });
  dec.configure(cfg); const read = makeReader(file);
  for (let i = 0; i < A.samples.length; i++) {
    if (derr) throw new Error('Falha ao decodificar o áudio: ' + derr.message);
    const s = A.samples[i];
    dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(s.cts * 1e6 / s.timescale), data: await read(s.offset, s.size) }));
    if (dec.decodeQueueSize > 40) await new Promise(res => dec.addEventListener('dequeue', res, { once: true }));
    if (i % 800 === 0) { onProgress && onProgress(i / A.samples.length); await new Promise(res => setTimeout(res)); }
    if (pending.then) await pending;   // transcreve cada bloco antes de seguir (limita a memória)
  }
  await dec.flush(); dec.close();
  if (k > 0) { const blob = wav(buf.subarray(0, k)), o = idx * secs; pending = pending.then(() => onChunk(blob, o)); }
  await pending; onProgress && onProgress(1);
}

// Plano B: o decodificador de áudio do navegador (AudioDecoder) falha em alguns aparelhos (ex.: iPhone com gravações do próprio navegador).
// Então o navegador decodifica o arquivo inteiro pelo caminho tradicional e eu reamostro para 16 kHz mono.
async function extractViaContext(file, secs, onChunk, onProgress) {
  if (file.size > 300 << 20) throw new Error('Arquivo grande demais para o plano B de áudio.');
  const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC();
  let buf; try { buf = await ac.decodeAudioData(await file.arrayBuffer()); } finally { try { ac.close(); } catch { /* ok */ } }
  const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, oc = new OC(1, Math.max(1, Math.ceil(buf.duration * 16000)), 16000), src = oc.createBufferSource();
  src.buffer = buf; src.connect(oc.destination); src.start(); const r = await oc.startRendering(), f = r.getChannelData(0), N = 16000 * secs;
  for (let o = 0, idx = 0; o < f.length; o += N, idx++) {
    const part = f.subarray(o, Math.min(f.length, o + N)), i16 = new Int16Array(part.length);
    for (let i = 0; i < part.length; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(part[i] * 32767)));
    await onChunk(wav(i16), idx * secs); onProgress && onProgress(Math.min(1, (o + N) / f.length));
  }
  onProgress && onProgress(1);
}
// Gravações feitas no próprio app (teleprompter) guardam o áudio bruto do microfone: não precisa decodificar o arquivo.
async function extractFromPcm(pcm, secs, onChunk, onProgress) {
  const { data, sr } = pcm, r = sr / 16000, total = Math.floor(data.length / r), N = 16000 * secs;
  for (let o = 0, idx = 0; o < total; o += N, idx++) {
    const n = Math.min(N, total - o), i16 = new Int16Array(n);
    for (let i = 0; i < n; i++) { const a = Math.floor((o + i) * r), b = Math.max(a + 1, Math.min(data.length, Math.floor((o + i + 1) * r))); let acc = 0; for (let j = a; j < b; j++) acc += data[j]; i16[i] = Math.max(-32768, Math.min(32767, Math.round(acc / (b - a) * 32767))); }
    await onChunk(wav(i16), idx * secs); onProgress && onProgress(Math.min(1, (o + n) / total));
  }
  onProgress && onProgress(1);
}
export async function extractAudio(file, media, secs, onChunk, onProgress) {
  if (file && file.__pcm && file.__pcm.data.length > 16000) { await extractFromPcm(file.__pcm, secs, onChunk, onProgress); return; }
  let sent = 0; const wrap = (b, o) => { sent++; return onChunk(b, o); };
  try { await extractAudioWC(file, media, secs, wrap, onProgress); }
  catch (e) {
    if (sent || !media.audio) throw e;
    console.warn('AudioDecoder falhou; usando decodeAudioData', e);
    try { await extractViaContext(file, secs, onChunk, onProgress); } catch (e2) { const A = media.audio; throw new Error(e.message + ' (plano B: ' + (e2.message || e2) + '; áudio ' + A.codec + ', ' + A.sampleRate + ' Hz, ' + A.channels + ' canal(is), ' + (A.samples ? A.samples.length : 0) + ' amostras, arquivo ' + (file.type || '?') + ' ' + Math.round(file.size / 1024) + ' KB)'); }
  }
}
