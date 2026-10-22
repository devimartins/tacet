// Gravação de trecho do YouTube: toca o player oficial incorporado e captura a própria aba
// (getDisplayMedia + CropTarget). Nada é baixado do YouTube. Só desktop Chrome/Edge.
export const ytId = u => { try { const x = new URL(u); if (x.hostname === 'youtu.be') return x.pathname.slice(1); if (/youtube\.com$/.test(x.hostname)) return x.searchParams.get('v') || (x.pathname.match(/\/(shorts|embed|live)\/([\w-]{11})/) || [])[2] || null; } catch {} return null; };

// segundo inicial de links como ?t=1759, ?t=29m19s ou ?start=1759
export const ytStart = u => { try { const x = new URL(u), v = x.searchParams.get('t') || x.searchParams.get('start') || ''; const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(v); return m && v ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; } catch { return 0; } };
export function ytSupported() {
  return !!(navigator.mediaDevices?.getDisplayMedia && window.MediaRecorder && window.CropTarget && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
}
const mime = () => ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t));

let apiP;
const api = () => apiP ||= new Promise((ok, no) => {
  if (window.YT?.Player) return ok(window.YT);
  const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = () => no(new Error('Não foi possível carregar o player do YouTube.'));
  window.onYouTubeIframeAPIReady = () => ok(window.YT); document.head.append(s);
});

const ERR = { 2: 'O link do vídeo parece inválido.', 5: 'O YouTube não conseguiu reproduzir este vídeo aqui.', 100: 'Vídeo não encontrado (removido ou privado).', 101: 'Não foi possível confirmar a disponibilidade deste vídeo para prévia aqui (a incorporação está desativada). Envie o arquivo do vídeo para editar.', 150: 'Não foi possível confirmar a disponibilidade deste vídeo para prévia aqui (a incorporação está desativada). Envie o arquivo do vídeo para editar.' };
export async function mountPlayer(box, id) {
  const YT = await Promise.race([api(), new Promise((_, no) => setTimeout(() => no(new Error('O player do YouTube não carregou. Desative bloqueadores de anúncio/privacidade para este site e confira a conexão.')), 15000))]);
  box.innerHTML = '<div id="ytp"></div>';
  return new Promise((res, no) => {
    const t = setTimeout(() => no(new Error('O vídeo demorou demais para abrir. Confira o link, a conexão e se há bloqueador de anúncios ativo.')), 20000);
    const p = new YT.Player('ytp', { videoId: id, width: '100%', height: '100%', playerVars: { playsinline: 1, rel: 0, modestbranding: 1 }, events: {
      onReady: () => { clearTimeout(t); res(p); },
      onError: e => { clearTimeout(t); no(new Error(ERR[e.data] || 'Não foi possível abrir este vídeo.')); } } });
  });
}

// Grava de start até end (s). Retorna File mp4.
export async function record(player, box, { start = 0, end, onStatus = () => {} }) {
  const type = mime(); if (!type) throw new Error('Este navegador não grava MP4. Use Chrome ou Edge atualizado.');
  const dur = player.getDuration(); end = Math.min(end || dur, dur); if (!(end > start)) throw new Error('Intervalo inválido.');
  const target = await CropTarget.fromElement(box);
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true, preferCurrentTab: true, selfBrowserSurface: 'include', systemAudio: 'include' });
  const [vt] = stream.getVideoTracks();
  try { await vt.cropTo(target); } catch (e) { stream.getTracks().forEach(t => t.stop()); throw new Error('Escolha a aba atual do ForjaClip ao compartilhar.'); }
  if (!stream.getAudioTracks().length) { stream.getTracks().forEach(t => t.stop()); throw new Error('Marque "Compartilhar áudio da aba" na janela do navegador.'); }
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6e6 }), parts = [];
  rec.ondataavailable = e => e.data.size && parts.push(e.data);
  const done = new Promise(r => rec.onstop = r);
  player.seekTo(start, true); player.pauseVideo(); await new Promise(r => setTimeout(r, 700));
  rec.start(1000); player.playVideo();
  await new Promise(res => {
    const t = setInterval(() => {
      const c = player.getCurrentTime(); onStatus(Math.max(0, c - start), end - start);
      if (c >= end - 0.05 || player.getPlayerState() === 0 || vt.readyState === 'ended') { clearInterval(t); res(); }
    }, 250);
    rec.stopNow = () => { clearInterval(t); res(); };
    box._stop = rec.stopNow;
  });
  player.pauseVideo(); rec.stop(); stream.getTracks().forEach(t => t.stop()); await done;
  return new File(parts, 'youtube.mp4', { type: 'video/mp4' });
}

// O MediaRecorder gera MP4 fragmentado (sem índice completo). Reempacota em MP4 comum
// para o restante do ForjaClip, que lê o índice 'moov'.
export async function flatten(file) {
  const buf = await file.arrayBuffer(); buf.fileStart = 0;
  const mp4 = MP4Box.createFile(), got = {}; let info;
  await new Promise((ok, no) => {
    mp4.onError = no;
    mp4.onReady = i => { info = i; i.tracks.forEach(t => { got[t.id] = []; mp4.setExtractionOptions(t.id, null, { nbSamples: 1e6 }); }); mp4.start(); };
    mp4.onSamples = (id, _u, s) => { got[id].push(...s); };
    mp4.appendBuffer(buf); mp4.flush(); setTimeout(ok, 50);
  });
  const vt = info.videoTracks[0], at = info.audioTracks[0]; if (!vt) throw new Error('Gravação sem vídeo.');
  const desc = (id) => { const e = mp4.getTrackById(id).mdia.minf.stbl.stsd.entries[0], bx = e.avcC; if (!bx) return null; const DS = window.DataStream || MP4Box.DataStream, ds = new DS(undefined, 0, DS.BIG_ENDIAN); bx.write(ds); return new Uint8Array(ds.buffer, 8); };
  const aAsc = at && (() => { const e = mp4.getTrackById(at.id).mdia.minf.stbl.stsd.entries[0], d = e.esds?.esd.descs[0]?.descs[0]; return d ? new Uint8Array(d.data) : null; })();
  const M = window.Mp4Muxer, target = new M.ArrayBufferTarget();
  const muxer = new M.Muxer({ target, fastStart: 'in-memory', firstTimestampBehavior: 'offset', video: { codec: 'avc', width: vt.video.width, height: vt.video.height },
    ...(at ? { audio: { codec: 'aac', sampleRate: at.audio.sample_rate, numberOfChannels: at.audio.channel_count } } : {}) });
  const us = (v, ts) => Math.round(v * 1e6 / ts), vd = desc(vt.id);
  for (const s of got[vt.id]) muxer.addVideoChunkRaw(s.data, s.is_sync ? 'key' : 'delta', us(s.cts, s.timescale), us(s.duration, s.timescale), { decoderConfig: { codec: vt.codec, description: vd, codedWidth: vt.video.width, codedHeight: vt.video.height } });
  if (at) for (const s of got[at.id]) muxer.addAudioChunkRaw(s.data, 'key', us(s.cts, s.timescale), us(s.duration, s.timescale), { decoderConfig: { codec: at.codec.length > 4 || !aAsc ? at.codec : 'mp4a.40.' + (aAsc[0] >> 3), sampleRate: at.audio.sample_rate, numberOfChannels: at.audio.channel_count, description: aAsc } });
  muxer.finalize();
  return new File([target.buffer], 'youtube.mp4', { type: 'video/mp4' });
}
