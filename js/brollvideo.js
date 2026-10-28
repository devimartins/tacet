// B-roll em vídeo (Pexels, plano pago): o Worker busca e guarda em cache; o app baixa um arquivo pequeno (SD)
// e guarda só alguns quadros reduzidos na memória (12 por segundo, até ~2,5 s) para a prévia e para a exportação.
import { openMedia, makeReader } from './media.js?v=6';

export async function findBrollVideo(CFG, token, query, secs = 2.5, fps = 12, outW = 360, used = new Set()) {
  const r = await fetch(CFG.AI + '/broll', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ q: query }) });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw Object.assign(new Error(j.error || 'B-roll indisponível.'), { status: r.status }); }
  const { items = [] } = await r.json();
  for (const it of items) {
    if (used.has(it.id)) continue;
    try {
      const resp = await fetch(it.file, { mode: 'cors' }); if (!resp.ok) continue;
      const blob = await resp.blob(); if (blob.size > 12e6) continue;
      const frames = await grab(blob, secs, fps, outW); if (frames.length >= 6) { used.add(it.id); return { frames, fps, credit: it.user, page: it.page, id: it.id }; }
    } catch { /* tenta o próximo vídeo */ }
  }
  return null;
}

async function grab(blob, secs, fps, outW) {
  const m = await openMedia(blob), V = m.video; if (!V || typeof VideoDecoder === 'undefined') return [];
  const cfg = { codec: V.codec, codedWidth: V.width, codedHeight: V.height }; if (V.description) cfg.description = V.description;
  if (!(await VideoDecoder.isConfigSupported(cfg)).supported) return [];
  const frames = [], step = 1 / fps, pend = []; let next = 0, derr = null;
  const sc = outW / V.width, ow = outW, oh = Math.round(V.height * sc);
  const dec = new VideoDecoder({
    output: f => {
      const t = f.timestamp / 1e6;
      if (t >= next && frames.length + pend.length < Math.ceil(secs * fps)) { next += step; pend.push(createImageBitmap(f, { resizeWidth: ow, resizeHeight: oh, resizeQuality: 'low' }).then(b => frames.push(b))); }
      f.close();
    },
    error: e => { derr = e; },
  });
  dec.configure(cfg); const read = makeReader(blob);
  const end = secs + 1;
  for (const s of V.samples) {
    if (derr) break; const cts = s.cts / s.timescale; if (cts > end && s.is_sync) break;
    dec.decode(new EncodedVideoChunk({ type: s.is_sync ? 'key' : 'delta', timestamp: Math.round(cts * 1e6), data: await read(s.offset, s.size) }));
    if (dec.decodeQueueSize > 20) await new Promise(res => dec.addEventListener('dequeue', res, { once: true }));
  }
  try { await dec.flush(); } catch { /* fim */ } dec.close(); await Promise.all(pend);
  return frames.slice(0, Math.ceil(secs * fps));
}
