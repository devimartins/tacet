import { paintCaptureOverlay } from '/js/capture-scene.js';
import { resolve, fontsUrl, loadFont } from '/js/captions.js';
let scene, players = [], started = false, finished = false, failed = '', warmed = false, startAt = 0, endAt = 0;
let firstTime = 0, lastTick = 0, lastMedia = 0, beganClock = 0;
const stage = document.getElementById('stage');
const overlay = document.getElementById('overlay');
const clamp = x => Math.max(0, Math.min(1, x));
function speaker(time) { let p = scene.segments[0]?.p || 'solo'; for (const seg of scene.segments) { if (seg.s - .3 <= time) p = seg.p; else break; } return p; }
function position(time) {
  const key = scene.mode === 'follow' ? speaker(time + scene.sync) : (scene.segments[0]?.p || 'solo');
  stage.style.setProperty('--cx', clamp(((scene.positions[key] ?? 50) / 100 - .12656) / (1 - 2 * .12656)).toFixed(3));
}
function noCaptions(p) { try { p.unloadModule('captions'); p.unloadModule('cc'); } catch {} }
function tick() {
  if (scene && players[0]) {
    const p = players[0], t = p.getCurrentTime?.() || 0, state = p.getPlayerState?.();
    position(t); paintCaptureOverlay(overlay, scene, t + scene.sync);
    if (started && !finished && !failed) {
      if (!startAt && state === 1 && t >= scene.start - .08) {
        if (t > scene.start + .35) failed = 'Playback missed requested start';
        startAt = performance.now(); firstTime = t; lastMedia = t; beganClock = startAt;
      }
      if (startAt) {
        if (state === 3) failed = 'Playback buffered during recording';
        if (state === 0 && t < scene.end - .15) failed = 'Playback ended early';
        if (state === 1 && t < lastMedia - .1) failed = 'Playback moved backwards';
        if (state === 1 && Math.abs((performance.now() - beganClock) / 1000 - (t - firstTime)) > 1) failed = 'Playback timing mismatch';
        if (players[1] && (players[1].getPlayerState() !== 1 || Math.abs(players[1].getCurrentTime() - t) > .35)) failed = 'Split players out of sync';
        lastMedia = t;
        if (t >= scene.end - .02) { endAt = performance.now(); finished = true; players.forEach(q => q.pauseVideo()); }
      }
    }
  }
  lastTick = performance.now(); requestAnimationFrame(tick);
}
async function youtube() {
  if (window.YT?.Player) return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('YouTube API timeout')), 20000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); resolve(); };
    const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; script.onerror = reject; document.head.append(script);
  });
}
window.captureRenderer = {
  async prepare(data) {
    scene = data; stage.classList.toggle('crop', data.crop);
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = fontsUrl();
    const fontsLoaded = new Promise((resolve, reject) => { link.onload = resolve; link.onerror = () => reject(new Error('Fonts unavailable')); });
    document.head.append(link); await fontsLoaded;
    const rs = resolve({preset:data.style}); await loadFont(rs.font, rs.wLight, rs.wActive); await document.fonts.ready;
    if (data.captions && (!document.fonts.check(`${rs.wActive} 40px "${rs.font}"`))) throw new Error('Caption font unavailable');
    await youtube();
    const slot = document.getElementById('slot'), two = data.crop && data.mode === 'split'; slot.classList.toggle('sp', two);
    const keys = two ? data.pair : [null];
    players = await Promise.all(keys.map((key, index) => new Promise((resolve, reject) => {
      // Create the iframe before navigation so the referrer policy applies to its request.
      const host = document.createElement('iframe');
      host.title = 'YouTube video player';
      host.referrerPolicy = 'strict-origin-when-cross-origin';
      host.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      host.allowFullscreen = true;
      const params = new URLSearchParams({enablejsapi:'1', autoplay:'0', controls:'0', playsinline:'1', rel:'0', cc_load_policy:'0', origin:location.origin});
      host.src = 'https://www.youtube.com/embed/' + encodeURIComponent(data.videoId) + '?' + params;
      if (two) { const half = document.createElement('div'); half.className = 'hf'; half.style.setProperty('--hx',clamp(((data.positions[key] ?? 50)/100-.253)/(1-2*.253)).toFixed(3)); half.append(host); slot.append(half); }
      else slot.append(host);
      const player = new YT.Player(host, {videoId:data.videoId, playerVars:{autoplay:0,controls:0,playsinline:1,rel:0,cc_load_policy:0,origin:location.origin},events:{
        onReady:e=>{ if(index) e.target.mute(); else e.target.setVolume(100); noCaptions(e.target); resolve(e.target); },
        onStateChange:e=>{if(e.data===1) noCaptions(e.target);},
        onError:e=>{failed='YouTube playback error '+e.data;reject(new Error(failed));},
        onAutoplayBlocked:()=>{failed='Playback blocked';}
      }});
    })));
    position(data.start); requestAnimationFrame(tick);
    // Warm decoding before recording; this playback only exists in the server browser.
    players.forEach(p=>{p.seekTo(data.start,true);p.playVideo();});
  },
  warmStatus() { return { error:failed, ready:players.length>0 && players.every(p=>p.getPlayerState()===1 && p.getCurrentTime() >= scene.start && p.getCurrentTime() < scene.start+4) }; },
  pause() { players.forEach(p=>p.pauseVideo()); },
  cue() { players.forEach(p=>{p.seekTo(scene.start,true);p.pauseVideo();}); warmed=true; },
  begin() { if (!warmed) throw new Error('Not prepared'); started=true; players.forEach(p=>p.playVideo()); },
  status() { const t=players[0]?.getCurrentTime?.()||0; return { error:failed, finished, startAt, endAt, firstTime, time:t, percent:Math.floor(clamp((t-scene.start)/(scene.end-scene.start))*100), now:performance.now(), lastTick }; }
};
