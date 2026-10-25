// Claude: TEST-ONLY stand-in for the YouTube IFrame API (AWS IPs get "confirm you're not a bot").
// Same API surface used by capture-service/public/render.js; plays a local synthetic clip in an iframe.
window.YT = { Player: class {
  constructor(host, opts) {
    const f = document.createElement('iframe');
    f.srcdoc = '<style>html,body{margin:0;background:#000;height:100%}video{width:100%;height:100%;object-fit:contain}</style><video src="https://mock.invalid/test.webm" preload="auto" playsinline></video>';
    host.replaceWith(f); this.state = -1; this.ev = opts.events || {};
    const attach = () => {
      const v = f.contentDocument?.querySelector('video'); if (!v || this.v) return; this.v = v; clearInterval(poll);
      v.addEventListener('playing', () => this.set(1)); v.addEventListener('pause', () => this.set(2));
      v.addEventListener('waiting', () => this.set(3)); v.addEventListener('ended', () => this.set(0));
      v.addEventListener('error', () => this.ev.onError?.({ data: 'mock-video-error' }));
      const ready = () => this.ev.onReady?.({ target: this });
      if (v.readyState >= 2) ready(); else v.addEventListener('loadeddata', ready, { once: true });
    };
    const poll = setInterval(attach, 50);
  }
  set(s) { this.state = s; this.ev.onStateChange?.({ data: s, target: this }); }
  getCurrentTime() { return this.v?.currentTime || 0; }
  getPlayerState() { return this.state; }
  seekTo(t) { this.v.currentTime = t; }
  playVideo() { this.v.play().catch(() => this.ev.onAutoplayBlocked?.()); }
  pauseVideo() { this.v.pause(); }
  mute() { this.v.muted = true; }
  setVolume(x) { this.v.volume = x / 100; }
  unloadModule() {}
} };
