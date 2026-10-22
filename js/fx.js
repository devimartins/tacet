// Efeitos de marca: brasas subindo no hero e headline que se revela palavra por palavra.
// JS próprio, sem bibliotecas. Respeita prefers-reduced-motion e pausa fora da tela.
const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
export const fx = { vel: 0 };

// rolagem: expõe progresso (--sp 0..1), deslocamento (--sy) e velocidade para o fundo e as brasas
function scrollFx() {
  if (reduce) return;
  const root = document.documentElement; let last = scrollY, ticking = false;
  const upd = () => {
    ticking = false;
    const max = Math.max(1, root.scrollHeight - innerHeight), y = scrollY;
    root.style.setProperty('--sp', Math.min(1, y / max).toFixed(3));
    root.style.setProperty('--sy', Math.min(y, 2000));
    fx.vel = Math.min(8, fx.vel + Math.abs(y - last) * .08); last = y;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
  upd();
}

function reveal(h1) {
  if (!h1 || h1.dataset.fx) return; h1.dataset.fx = 1;
  const walk = n => [...n.childNodes].forEach(c => {
    if (c.nodeType === 3) {
      const f = document.createDocumentFragment();
      c.textContent.split(/(\s+)/).forEach(w => {
        if (!w.trim()) { f.append(w); return; }
        const s = document.createElement('span'); s.className = 'w'; s.textContent = w; f.append(s);
      });
      c.replaceWith(f);
    } else if (c.nodeType === 1) walk(c);
  });
  walk(h1);
  h1.querySelectorAll('.w').forEach((s, i) => s.style.setProperty('--i', i));
  h1.classList.add('rv');
}

function embers(host) {
  if (host.querySelector('canvas.embers')) return;
  const cv = document.createElement('canvas'); cv.className = 'embers'; cv.setAttribute('aria-hidden', 'true');
  host.prepend(cv);
  const ctx = cv.getContext('2d'); let W = 0, H = 0, ps = [], run = false, raf = 0, vis = true;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const size = () => { const r = host.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const mk = (init) => ({ x: Math.random() * W, y: init ? Math.random() * H : H + 10, r: .6 + Math.random() * 1.8, v: .25 + Math.random() * .7, d: Math.random() * 6.28, a: .25 + Math.random() * .6 });
  const N = () => Math.max(14, Math.min(46, Math.round(W / 28)));
  const tick = () => {
    if (!run) return;
    fx.vel *= .94; ctx.clearRect(0, 0, W, H);
    while (ps.length < N()) ps.push(mk(ps.length < 1));
    ps.forEach((p, i) => {
      p.y -= p.v * (1 + fx.vel); p.d += .02; p.x += Math.sin(p.d) * .4; p.a -= .0016;
      if (p.y < -10 || p.a <= 0) { ps[i] = mk(false); return; }
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
      g.addColorStop(0, `rgba(255,190,90,${p.a})`); g.addColorStop(.4, `rgba(255,106,31,${p.a * .5})`); g.addColorStop(1, 'rgba(255,106,31,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, 6.28); ctx.fill();
    });
    raf = requestAnimationFrame(tick);
  };
  const go = () => { const on = vis && !document.hidden && host.offsetParent !== null; if (on && !run) { run = true; size(); ps = []; raf = requestAnimationFrame(tick); } else if (!on && run) { run = false; cancelAnimationFrame(raf); } };
  new IntersectionObserver(e => { vis = e[0].isIntersecting; go(); }).observe(host);
  document.addEventListener('visibilitychange', go);
  addEventListener('resize', () => { if (run) size(); }, { passive: true });
  go();
}


// Nebulosa de fundo (WebGL, render em baixa resolução, pausa fora de vista). Paleta forja: brasa, vermelho, laranja.
function nebula() {
  const bg = document.querySelector('#bg'); if (!bg || bg.querySelector('canvas.neb')) return;
  if (document.documentElement.classList.contains('still')) return;
  const cv = document.createElement('canvas'); cv.className = 'neb';
  const gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }); if (!gl) return;
  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `precision mediump float;uniform vec2 R;uniform float T,S;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.02+vec2(1.7,9.2);a*=.5;}return v;}
void main(){vec2 uv=gl_FragCoord.xy/R.y;uv.y+=S*.35;float t=T*.035;
vec2 q=vec2(fbm(uv*1.3+t),fbm(uv*1.3+vec2(5.2,1.3)-t));
vec2 r=vec2(fbm(uv*1.6+q*2.2+vec2(1.7,9.2)+t*1.5),fbm(uv*1.6+q*2.2+vec2(8.3,2.8)-t));
float f=fbm(uv*1.4+r*2.4);
vec3 c=vec3(.016,.007,.005);
c=mix(c,vec3(.26,.025,.035),smoothstep(.35,.8,f)*.85);
c=mix(c,vec3(.95,.28,.06),smoothstep(.66,1.,r.x*f*2.4)*.24);
c+=vec3(1.,.7,.25)*pow(smoothstep(.75,1.,f*r.y*2.6),3.)*.14;
float v=smoothstep(1.25,.25,length(gl_FragCoord.xy/R-.5)*1.5);
c*=.2+.64*v*smoothstep(.1,.9,length(gl_FragCoord.xy/R-vec2(.5,.52))*1.6+.25);gl_FragColor=vec4(c,1.);}`;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
  const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs); if (!v || !f) return;
  const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return; gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(pr, 'R'), uT = gl.getUniformLocation(pr, 'T'), uS = gl.getUniformLocation(pr, 'S');
  const scale = innerWidth < 760 ? .32 : .42;
  const size = () => { cv.width = Math.max(2, Math.round(innerWidth * scale)); cv.height = Math.max(2, Math.round(innerHeight * scale)); gl.viewport(0, 0, cv.width, cv.height); };
  size(); addEventListener('resize', size, { passive: true });
  bg.prepend(cv); bg.classList.add('neb');
  let sm = 0, t0 = performance.now();
  const draw = now => {
    requestAnimationFrame(draw);
    if (document.hidden || !cv.offsetParent && getComputedStyle(cv).display === 'none') return;
    const sp = parseFloat(document.documentElement.style.getPropertyValue('--sp')) || 0;
    sm += (sp - sm) * .08;
    gl.uniform2f(uR, cv.width, cv.height); gl.uniform1f(uT, (now - t0) / 1000); gl.uniform1f(uS, sm * 3 + fx.vel * .02);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  requestAnimationFrame(draw);
}

// Texto que acende com a rolagem (cinza desfocado → branco nítido), palavra por palavra.
function scrollLit(el) {
  if (!el || el.dataset.fx) return; el.dataset.fx = 1;
  const t = el.textContent.trim().split(/\s+/);
  el.textContent = ''; const ws = t.map(w => { const s = document.createElement('span'); s.className = 'w'; s.textContent = w + ' '; el.append(s); return s; });
  if (reduce) { ws.forEach(s => s.classList.add('on')); return; }
  let tick = false;
  const upd = () => {
    tick = false; const r = el.getBoundingClientRect(); if (!r.height || r.bottom < 0 || r.top > innerHeight) return;
    const p = Math.min(1, Math.max(0, (innerHeight * .88 - r.top) / (innerHeight * .55 + r.height * .5)));
    const n = p * ws.length; ws.forEach((s, i) => { s.classList.toggle('on', i < n); s.style.setProperty('--b', Math.max(0, Math.min(3, (i - n + 1) * 1.5)).toFixed(1) + 'px'); });
  };
  addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true }); addEventListener('resize', upd, { passive: true }); upd();
}
export function initFx() {
  scrollLit(document.querySelector('#lit'));
  nebula();
  scrollFx();
  if (reduce) return;
  const land = document.querySelector('#landing');
  if (land) embers(land);
  const hero = document.querySelector('#home .hero');
  if (!hero) return;
  reveal(hero.querySelector('h1'));
  embers(hero);
}
