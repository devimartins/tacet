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

function embers(host, cap = 46) {
  if (host.querySelector('canvas.embers')) return;
  const cv = document.createElement('canvas'); cv.className = 'embers'; cv.setAttribute('aria-hidden', 'true');
  host.prepend(cv);
  const ctx = cv.getContext('2d'); let W = 0, H = 0, ps = [], run = false, raf = 0, vis = true;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const size = () => { const r = host.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const mk = (init) => ({ x: Math.random() * W, y: init ? Math.random() * H : H + 10, r: .6 + Math.random() * 1.8, v: .25 + Math.random() * .7, d: Math.random() * 6.28, a: .25 + Math.random() * .6 });
  const N = () => Math.max(14, Math.min(cap, Math.round(W / 28)));
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
  const fs = `precision mediump float;uniform vec2 R;uniform float T,S,L;
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
c*=.2+.64*v*smoothstep(.1,.9,length(gl_FragCoord.xy/R-vec2(.5,.52))*1.6+.25);
vec3 l=vec3(.985,.962,.94);l=mix(l,vec3(.99,.80,.70),smoothstep(.32,.8,f)*.7);l=mix(l,vec3(1.,.56,.24),smoothstep(.62,1.,r.x*f*2.4)*.4);l+=vec3(1.,.8,.4)*pow(smoothstep(.75,1.,f*r.y*2.6),3.)*.08;l*=.93+.07*v;
gl_FragColor=vec4(mix(c,l,L),1.);}`;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
  const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs); if (!v || !f) return;
  const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return; gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const uL = gl.getUniformLocation(pr, 'L'), uR = gl.getUniformLocation(pr, 'R'), uT = gl.getUniformLocation(pr, 'T'), uS = gl.getUniformLocation(pr, 'S');
  const scale = innerWidth < 760 ? .32 : .42;
  const size = () => { cv.width = Math.max(2, Math.round(innerWidth * scale)); cv.height = Math.max(2, Math.round(innerHeight * scale)); gl.viewport(0, 0, cv.width, cv.height); };
  size(); addEventListener('resize', size, { passive: true });
  bg.prepend(cv); bg.classList.add('neb');
  let sm = 0, lm = 0, t0 = performance.now(); const mq = matchMedia('(prefers-color-scheme:light)');
  const isLight = () => { const t = document.documentElement.dataset.theme; return t ? t === 'light' : mq.matches; };
  const draw = now => {
    requestAnimationFrame(draw);
    if (document.hidden) return;
    const sp = parseFloat(document.documentElement.style.getPropertyValue('--sp')) || 0;
    sm += (sp - sm) * .08;
    gl.uniform2f(uR, cv.width, cv.height); gl.uniform1f(uT, (now - t0) / 1000); lm += ((isLight() ? 1 : 0) - lm) * .12; gl.uniform1f(uL, lm); gl.uniform1f(uS, sm * 3 + fx.vel * .02);
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

// contador: o preço "sobe" até o valor quando aparece na tela (só números; o texto final é o mesmo do HTML)
function countUp(nodes) {
  if (matchMedia('(prefers-reduced-motion:reduce)').matches || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; io.unobserve(e.target); const n = e.target, txt = n.textContent, m = /^(R\$\s*)(\d+)(?:,(\d{2}))?(.*)$/.exec(txt); if (!m) return;
    const to = +(m[2] + '.' + (m[3] || '00')), t0 = performance.now(), dec = m[3] ? 2 : 0;
    const step = now => { const p = Math.min(1, (now - t0) / 900), v = to * (1 - Math.pow(1 - p, 3)); n.textContent = m[1] + v.toFixed(dec).replace('.', ',') + m[4]; if (p < 1) requestAnimationFrame(step); else n.textContent = txt; };
    requestAnimationFrame(step);
  }), { threshold: .6 });
  nodes.forEach(n => io.observe(n));
}

// texto que se preenche conforme a rolagem (títulos .fillt)
function fillText(nodes) {
  const list = [...nodes]; if (!list.length) return;
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) { list.forEach(n => n.style.setProperty('--f', '100%')); return; }
  const upd = () => { const h = innerHeight; list.forEach(n => { const r = n.getBoundingClientRect(), p = Math.min(1, Math.max(0, (h * .92 - r.top) / (h * .42))); n.style.setProperty('--f', (p * 100).toFixed(1) + '%'); }); };
  addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
}

// Onda incandescente: fita de metal aquecido (shader procedural leve), só na apresentação.
// Pequena no topo, cresce no meio, some perto do CTA final; reage de leve ao ponteiro. Decorativa: sem eventos.
function wave() {
  const bg = document.querySelector('#bg'), login = document.querySelector('#login'); if (!bg || !login || bg.querySelector('canvas.wave')) return;
  if (document.documentElement.classList.contains('still')) return;
  const cv = document.createElement('canvas'); cv.className = 'wave'; cv.setAttribute('aria-hidden', 'true');
  const gl = cv.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' }); if (!gl) return;
  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 R,M;uniform float T,S,L,A;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
void main(){
 vec2 p=(gl_FragCoord.xy/R-.5)*vec2(R.x/R.y,1.);
 float t=T*.12,ss=smoothstep(.0,.5,S);
 float Y=mix(-.36,.02,ss)-S*.04, W=mix(.4,.95,smoothstep(.1,.5,S))*(1.-.45*smoothstep(.75,1.,S));
 vec3 col=vec3(0.);float a=0.,gl=0.;
 for(int k=0;k<3;k++){
  float fk=float(k),x=p.x;
  float ph=t*(.7+.2*fk)+fk*1.9+S*2.2+M.x*.35;
  float y0=Y+(.11+.03*fk)*sin(x*(1.5+.35*fk)+ph)+.05*sin(x*3.3-ph*1.3+fk)+.035*(fk-1.)*cos(x*2.2+ph*.7)+(n(vec2(x*1.2,t+fk))-.5)*.08+M.y*.03;
  float w=W*(.06+.035*sin(x*2.4+ph*.9+fk*2.));
  float d=p.y-y0,v=d/w;
  gl+=exp(-abs(d)/(w*2.6))*.16;
  float m=1.-smoothstep(.78,1.,abs(v));
  if(m>0.){
   float hh=sqrt(max(0.,1.-v*v)),tw=sin(x*2.+ph)*.9;
   float s=v*cos(tw)+hh*sin(tw);
   float dif=pow(max(0.,s*.7+.3),2.);
   float spec=pow(abs(sin(s*5.+x*2.+t*2.)),14.)*.7+pow(max(0.,s),7.)*.9;
   float em=pow(1.-hh,1.3)*(.55+.45*sin(x*3.+ph*2.+fk));
   vec3 c=vec3(.07,.055,.05)*(.4+dif)+vec3(.95,.84,.76)*spec*(.5+.2*hh)+vec3(1.,.36,.06)*em*1.35+vec3(1.,.55,.15)*pow(hh,6.)*dif*.18;
   col=mix(col,c,m);a=a+m*(1.-a);
  }
 }
 vec3 glc=vec3(1.,.32,.05);
 col+=glc*gl*(1.-a);a=max(a,min(1.,gl*.7));
 float e=pow(1.-smoothstep(0.,1.,length((p-vec2(M.x*.2,.12))*vec2(.9,1.3))/.38),2.);
 float tm=1.-.62*e*(1.-smoothstep(.1,.28,S));
 col=mix(col,col*vec3(1.5,1.05,.85)+vec3(.12,.04,0.),L);
 float al=a*A*tm*mix(.62,.5,L);
 gl_FragColor=vec4(col*min(1.,al/max(a,.001)),al);
}`;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
  const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs); if (!v || !f) return;
  const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return; gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const U = k => gl.getUniformLocation(pr, k), uR = U('R'), uM = U('M'), uT = U('T'), uS = U('S'), uL = U('L'), uA = U('A');
  const scale = innerWidth < 760 ? .3 : .45;
  const size = () => { cv.width = Math.max(2, Math.round(innerWidth * scale)); cv.height = Math.max(2, Math.round(innerHeight * scale)); gl.viewport(0, 0, cv.width, cv.height); };
  size(); bg.append(cv);
  const still = matchMedia('(prefers-reduced-motion:reduce)').matches, mq = matchMedia('(prefers-color-scheme:light)');
  const isLight = () => { const t = document.documentElement.dataset.theme; return t ? t === 'light' : mq.matches; };
  let sm = 0, lm = isLight() ? 1 : 0, mx = 0, my = 0, tx = 0, ty = 0, t0 = performance.now(), fr = 0;
  addEventListener('pointermove', e => { tx = e.clientX / innerWidth * 2 - 1; ty = 1 - e.clientY / innerHeight * 2; }, { passive: true });
  const prog = () => Math.min(1, Math.max(0, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)));
  const draw = now => {
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    sm += (prog() - sm) * .07; mx += (tx - mx) * .04; my += (ty - my) * .04; lm += ((isLight() ? 1 : 0) - lm) * .12;
    gl.uniform2f(uR, cv.width, cv.height); gl.uniform2f(uM, mx, my); gl.uniform1f(uT, still ? 6 : (now - t0) / 1000); gl.uniform1f(uS, sm); gl.uniform1f(uL, lm);
    gl.uniform1f(uA, 1 - smoothstep(.82, .98, sm)); gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const smoothstep = (a, b2, x) => { const q = Math.min(1, Math.max(0, (x - a) / (b2 - a))); return q * q * (3 - 2 * q); };
  addEventListener('resize', () => { size(); if (still) draw(performance.now()); }, { passive: true });
  if (still) { addEventListener('scroll', () => draw(performance.now()), { passive: true }); draw(performance.now()); return; }
  const loop = now => {
    requestAnimationFrame(loop);
    if (document.hidden || login.hidden) return;
    if (innerWidth < 760 && (fr++ & 1)) return;   // celular: metade dos quadros
    draw(now);
  };
  requestAnimationFrame(loop);
}
export function initFx() {
  wave();
  document.querySelectorAll('#about h2').forEach(h => h.classList.add('fillt')); fillText(document.querySelectorAll('.fillt'));
  countUp(document.querySelectorAll('.pcp b, .pprice b'));
  scrollLit(document.querySelector('#lit'));
  nebula();
  scrollFx();
  if (reduce) return;
  const land = document.querySelector('#landing');
  if (land) { embers(land, 16); heroDemo(); }
  const hero = document.querySelector('#home .hero');
  if (!hero) return;
  reveal(hero.querySelector('h1'));
  embers(hero);
}

// Demonstração do hero: usa o renderizador real de legendas (captions.js), alternando entre estilos reais. Ilustrativa, sem vídeo de cliente.
async function heroDemo() {
  const cv = document.querySelector('#hdc'); if (!cv) return;
  const cap = await import('./captions.js'); const ctx = cv.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2), W = 270, H = 480; cv.width = W * dpr; cv.height = H * dpr;
  const txt = 'Sua próxima grande ideia merece uma nova experiência de edição'.split(' ');
  const words = txt.map((w, i) => ({ w: i === txt.length - 1 ? w + '.' : w, s: 0.2 + i * 0.42, e: 0.2 + i * 0.42 + 0.4 }));
  const LOOP = words[words.length - 1].e + 1.3, ids = ['chama', 'iman', 'impacto', 'cascata'];
  const items = [...document.querySelectorAll('#hdst li')], ph = document.querySelector('#hdph');
  const set = ids.map(id => { const rs = cap.resolve({ preset: id, o: {} }); return { rs: { ...rs, x: .5, y: id === 'cascata' ? .6 : .66, fs: Math.min(100, rs.fs * 1.45) }, ch: cap.chunksOf(words, rs.n) }; });
  await Promise.all(set.map(o => cap.loadFont(o.rs.font, o.rs.wLight, o.rs.wActive)));
  const frame = (si, t) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createRadialGradient(W / 2, H * .38, 10, W / 2, H * .38, H * .7); g.addColorStop(0, '#4a2a1c'); g.addColorStop(1, '#0a0807'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,190,140,.08)'; ctx.beginPath(); ctx.arc(W / 2, H * .3, 38, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.ellipse(W / 2, H * .52, 70, 62, 0, Math.PI, 0); ctx.fill();
    cap.drawCaption(ctx, W, H, set[si].ch, t, set[si].rs);
    items.forEach((li, i) => li.classList.toggle('on', i === si)); if (ph) ph.style.setProperty('--p', (.06 + .88 * t / LOOP).toFixed(3));
  };
  if (reduce || document.documentElement.classList.contains('still')) { frame(0, 2.6); return; }
  let t0 = performance.now(), n = 0, vis = true, raf = 0, last = 0;
  const loop = now => {
    raf = 0; if (!vis || document.hidden) return;
    if (now - last > (innerWidth < 760 ? 32 : 15)) { last = now; const el = (now - t0) / 1000, si = Math.floor(el / LOOP) % ids.length; frame(si, el % LOOP); }
    raf = requestAnimationFrame(loop);
  };
  const go = () => { if (!raf && vis && !document.hidden) { t0 = performance.now() - (n++ ? 0 : 0); raf = requestAnimationFrame(loop); } };
  new IntersectionObserver(e => { vis = e[0].isIntersecting; go(); }).observe(cv);
  document.addEventListener('visibilitychange', go); go();
}
