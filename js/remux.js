// Gravações feitas no navegador (MediaRecorder, principalmente no iPhone) saem como MP4 "fragmentado":
// o índice não lista as amostras e o editor não acha áudio nem vídeo. Aqui reescrevo o arquivo como MP4 comum,
// sem recodificar (só reorganiza os pacotes já gravados).
import { openMedia } from './media.js?v=3';

const FREQ = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
const rl = (u, p) => { let n = 0, i = 0, b; do { b = u[p++]; n = (n << 7) | (b & 127); i++; } while ((b & 128) && i < 4); return [n, p]; };
// Lê o AudioSpecificConfig direto dos bytes do índice (a caixa esds de gravações do iPhone nem sempre é aberta pela biblioteca).
function ascFromBytes(mo) {
  for (let i = 4; i + 24 < mo.length; i++) {
    if (mo[i] === 101 && mo[i + 1] === 115 && mo[i + 2] === 100 && mo[i + 3] === 115) {
      let p = i + 8, l, q; if (mo[p] !== 3) continue; [l, q] = rl(mo, p + 1); p = q + 3;
      if (mo[p] !== 4) continue; [l, q] = rl(mo, p + 1); p = q + 13;
      if (mo[p] !== 5) continue; [l, q] = rl(mo, p + 1); return mo.slice(q, q + l);
    }
  }
  return null;
}
function ascInfo(a) { if (!a || a.length < 2) return null; const ot = a[0] >> 3, fi = ((a[0] & 7) << 1) | (a[1] >> 7); if (fi > 12) return null; return { ot, sr: FREQ[fi], ch: (a[1] >> 3) & 15 }; }

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
  let ad = null, ai = null;
  if (aacOk) { ad = desc(at.id) || null; if (!ad) ad = ascFromBytes(new Uint8Array(ab, 0, Math.min(ab.byteLength, 1 << 20))); ai = ascInfo(ad); }
  const aSr = ai ? ai.sr : at && at.audio.sample_rate, aCh = ai && ai.ch ? ai.ch : at && at.audio.channel_count;
  const target = new M.ArrayBufferTarget();
  const muxer = new M.Muxer({ target, fastStart: 'in-memory', firstTimestampBehavior: 'offset',
    video: { codec: vt.codec.startsWith('hvc') || vt.codec.startsWith('hev') ? 'hevc' : 'avc', width: vt.video.width, height: vt.video.height, rotation: rot },
    ...(aacOk ? { audio: { codec: 'aac', numberOfChannels: aCh, sampleRate: aSr } } : {}) });
  const us = (v, ts) => Math.round(v * 1e6 / ts);
  const vd = desc(vt.id);
  const ev = [];
  tr[vt.id].s.forEach((s, i) => ev.push({ v: 1, ts: us(s.cts, s.timescale), k: us(s.dts ?? s.cts, s.timescale), s, first: i === 0 }));
  if (aacOk) tr[at.id].s.forEach((s, i) => ev.push({ v: 0, ts: us(s.cts, s.timescale), k: us(s.dts ?? s.cts, s.timescale), s, first: i === 0 }));
  ev.sort((a, b) => a.k - b.k);   // ordem de decodificação (importa quando há quadros B)
  for (const e of ev) {
    const d = new Uint8Array(e.s.data), dur = us(e.s.duration, e.s.timescale);
    if (e.v) muxer.addVideoChunkRaw(d, e.s.is_sync ? 'key' : 'delta', e.ts, dur, e.first ? { decoderConfig: { codec: vt.codec, description: vd, codedWidth: vt.video.width, codedHeight: vt.video.height } } : undefined, e.ts - e.k);
    else muxer.addAudioChunkRaw(d, 'key', e.ts, dur, e.first ? { decoderConfig: { codec: 'mp4a.40.' + (ai ? ai.ot : 2), description: ad || undefined, numberOfChannels: aCh, sampleRate: aSr } } : undefined);
  }
  muxer.finalize();
  return new File([target.buffer], file.name.replace(/\.[^.]+$/, '') + '.mp4', { type: 'video/mp4' });
}

// Devolve o próprio arquivo se já for MP4 comum; senão tenta reescrever. Em falha, devolve o original.
export async function ensureProgressive(file) {
  try { const m = await openMedia(file); if (m.video && m.video.samples && m.video.samples.length) return file; } catch { /* tenta reescrever */ }
  try { return await remux(file); } catch (e) { console.warn('remux', e); return file; }
}
