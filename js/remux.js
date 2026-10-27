// Gravações feitas no navegador (MediaRecorder, principalmente no iPhone) saem como MP4 "fragmentado":
// o índice não lista as amostras e o editor não acha áudio nem vídeo. Aqui reescrevo o arquivo como MP4 comum,
// sem recodificar (só reorganiza os pacotes já gravados).
import { openMedia } from './media.js';

async function remux(file) {
  const B = window.MP4Box, M = window.Mp4Muxer; if (!B || !M) throw new Error('Biblioteca de vídeo indisponível.');
  const ab = await file.arrayBuffer(); ab.fileStart = 0;
  const mp4 = B.createFile(); let info = null, err = null; const tr = {};
  mp4.onError = e => { err = e; };
  mp4.onReady = i => { info = i; for (const t of [...i.videoTracks, ...i.audioTracks]) { tr[t.id] = { t, s: [] }; mp4.setExtractionOptions(t.id, null, { nbSamples: 500 }); } mp4.start(); };
  mp4.onSamples = (id, u, s) => { tr[id].s.push(...s); };
  mp4.appendBuffer(ab); mp4.flush();
  if (err || !info) throw new Error('Não consegui ler a gravação.');
  const vt = info.videoTracks[0], at = info.audioTracks[0];
  if (!vt || !tr[vt.id].s.length) throw new Error('A gravação não tem imagem.');
  const DS = window.DataStream || B.DataStream;
  const desc = id => { const e = mp4.getTrackById(id).mdia.minf.stbl.stsd.entries[0]; const box = e.avcC || e.hvcC || e.vpcC || e.av1C; if (box) { const ds = new DS(undefined, 0, DS.BIG_ENDIAN); box.write(ds); return new Uint8Array(ds.buffer, 8); } const d = e.esds && e.esds.esd.descs[0] && e.esds.esd.descs[0].descs[0]; return d ? new Uint8Array(d.data) : undefined; };
  const mt = mp4.getTrackById(vt.id).tkhd.matrix, rot = ((Math.round(Math.atan2(mt[1], mt[0]) * 180 / Math.PI) % 360) + 360) % 360;
  const aacOk = at && at.codec.startsWith('mp4a');
  const target = new M.ArrayBufferTarget();
  const muxer = new M.Muxer({ target, fastStart: 'in-memory', firstTimestampBehavior: 'offset',
    video: { codec: vt.codec.startsWith('hvc') || vt.codec.startsWith('hev') ? 'hevc' : 'avc', width: vt.video.width, height: vt.video.height, rotation: rot },
    ...(aacOk ? { audio: { codec: 'aac', numberOfChannels: at.audio.channel_count, sampleRate: at.audio.sample_rate } } : {}) });
  const us = (v, ts) => Math.round(v * 1e6 / ts);
  const vd = desc(vt.id), ad = aacOk ? desc(at.id) : null;
  const ev = [];
  tr[vt.id].s.forEach((s, i) => ev.push({ v: 1, ts: us(s.cts, s.timescale), k: us(s.dts ?? s.cts, s.timescale), s, first: i === 0 }));
  if (aacOk) tr[at.id].s.forEach((s, i) => ev.push({ v: 0, ts: us(s.cts, s.timescale), k: us(s.dts ?? s.cts, s.timescale), s, first: i === 0 }));
  ev.sort((a, b) => a.k - b.k);   // ordem de decodificação (importa quando há quadros B)
  for (const e of ev) {
    const d = new Uint8Array(e.s.data), dur = us(e.s.duration, e.s.timescale);
    if (e.v) muxer.addVideoChunkRaw(d, e.s.is_sync ? 'key' : 'delta', e.ts, dur, e.first ? { decoderConfig: { codec: vt.codec, description: vd, codedWidth: vt.video.width, codedHeight: vt.video.height } } : undefined, e.ts - e.k);
    else muxer.addAudioChunkRaw(d, 'key', e.ts, dur, e.first ? { decoderConfig: { codec: at.codec, description: ad, numberOfChannels: at.audio.channel_count, sampleRate: at.audio.sample_rate } } : undefined);
  }
  muxer.finalize();
  return new File([target.buffer], file.name.replace(/\.[^.]+$/, '') + '.mp4', { type: 'video/mp4' });
}

// Devolve o próprio arquivo se já for MP4 comum; senão tenta reescrever. Em falha, devolve o original.
export async function ensureProgressive(file) {
  try { const m = await openMedia(file); if (m.video && m.video.samples && m.video.samples.length) return file; } catch { /* tenta reescrever */ }
  try { return await remux(file); } catch (e) { console.warn('remux', e); return file; }
}
