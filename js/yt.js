// Gravação de trecho do YouTube: toca o player oficial incorporado e captura a própria aba
// (getDisplayMedia + CropTarget). Nada é baixado do YouTube. Só desktop Chrome/Edge.
export const ytId = u => { try { const x = new URL(u); if (x.hostname === 'youtu.be') return x.pathname.slice(1); if (/youtube\.com$/.test(x.hostname)) return x.searchParams.get('v') || (x.pathname.match(/\/(shorts|embed|live)\/([\w-]{11})/) || [])[2] || null; } catch {} return null; };

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

export async function mountPlayer(box, id) {
  const YT = await api(); box.innerHTML = '<div id="ytp"></div>';
  return new Promise(res => { const p = new YT.Player('ytp', { videoId: id, width: '100%', height: '100%', playerVars: { playsinline: 1, rel: 0, modestbranding: 1 }, events: { onReady: () => res(p) } }); });
}

// Grava de start até end (s). Retorna File mp4.
export async function record(player, box, { start = 0, end, onStatus = () => {} }) {
  const type = mime(); if (!type) throw new Error('Este navegador não grava MP4. Use Chrome ou Edge atualizado.');
  const dur = player.getDuration(); end = Math.min(end || dur, dur); if (!(end > start)) throw new Error('Intervalo inválido.');
  const target = await CropTarget.fromElement(box);
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true, preferCurrentTab: true, selfBrowserSurface: 'include', systemAudio: 'include' });
  const [vt] = stream.getVideoTracks();
  try { await vt.cropTo(target); } catch (e) { stream.getTracks().forEach(t => t.stop()); throw new Error('Escolha a aba atual do Tacet ao compartilhar.'); }
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
