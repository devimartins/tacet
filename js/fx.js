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

export function initFx() {
  scrollFx();
  if (reduce) return;
  const land = document.querySelector('#landing');
  if (land) embers(land);
  const hero = document.querySelector('#home .hero');
  if (!hero) return;
  reveal(hero.querySelector('h1'));
  embers(hero);
}
