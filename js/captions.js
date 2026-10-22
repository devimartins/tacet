// Motor de legendas em canvas: o MESMO código desenha a prévia e o vídeo exportado.
export const FONTS = {
  'Inter': { cat: 'Sem serifa', w: [300, 400, 500, 600, 700, 800, 900] },
  'Montserrat': { cat: 'Sem serifa', w: [300, 400, 500, 600, 700, 800, 900] },
  'Poppins': { cat: 'Sem serifa', w: [300, 400, 500, 600, 700, 800, 900] },
  'Quicksand': { cat: 'Sem serifa', w: [300, 400, 500, 600, 700] },
  'Space Grotesk': { cat: 'Moderna', w: [300, 400, 500, 600, 700] },
  'Sora': { cat: 'Moderna', w: [300, 400, 500, 600, 700, 800] },
  'Bebas Neue': { cat: 'Display', w: [400] },
  'Anton': { cat: 'Display', w: [400] },
  'Bangers': { cat: 'Display', w: [400] },
  'Playfair Display': { cat: 'Serifada', w: [400, 500, 600, 700, 800, 900] },
  'Lora': { cat: 'Serifada', w: [400, 500, 600, 700] },
  'Pacifico': { cat: 'Cursiva', w: [400] },
  'Dancing Script': { cat: 'Cursiva', w: [400, 500, 600, 700] },
  'Caveat': { cat: 'Cursiva', w: [400, 500, 600, 700] },
};
export const fontsUrl = () => 'https://fonts.googleapis.com/css2?' + Object.entries(FONTS).map(([n, f]) =>
  'family=' + n.replace(/ /g, '+') + (f.w.length > 1 ? ':wght@' + f.w.join(';') : '')).join('&') + '&display=swap';
const nearest = (font, w) => (FONTS[font] || FONTS.Montserrat).w.reduce((a, b) => Math.abs(b - w) < Math.abs(a - w) ? b : a);
export async function loadFont(font, ...weights) {
  if (!document.fonts) return;
  await Promise.all(weights.map(w => document.fonts.load(`${nearest(font, w)} 40px "${font}"`).catch(() => 0)));
}

// Presets: free = true entram no plano gratuito. Nomes próprios, exceto "Iman", pedido expressamente.
const B = { font: 'Montserrat', wLight: 800, wActive: 800, color: '#ffffff', activeColor: '#ffffff', stroke: 0, strokeColor: '#000000', bgOpacity: 0, bg: '#000000', case: 'none', n: 3, pop: 0, shadow: 1, fs: 50, mode: 'word' };
export const PRESETS = {
  iman: { ...B, name: 'Iman', free: true, wLight: 300, wActive: 600, case: 'lower', n: 4, fs: 40, shadow: 1, dim: 0.6 },
  impacto: { ...B, name: 'Impacto', free: true, font: 'Montserrat', wLight: 900, wActive: 900, case: 'upper', activeColor: '#FFD500', stroke: 55, n: 3, pop: 1, fs: 50 },
  uma_palavra: { ...B, name: 'Uma palavra', free: true, font: 'Montserrat', wLight: 900, wActive: 900, case: 'upper', stroke: 55, n: 1, pop: 1, fs: 72 },
  minimal: { ...B, name: 'Minimal', free: true, font: 'Inter', wLight: 500, wActive: 700, n: 4, fs: 38 },
  pilula: { ...B, name: 'Pílula', free: false, font: 'Inter', wLight: 600, wActive: 700, color: '#ffffff', activeColor: '#111111', bgOpacity: 92, bg: '#ffffff', n: 3, pop: 1, fs: 44, shadow: 0, mode: 'pill' },
  neon: { ...B, name: 'Neon', free: false, font: 'Poppins', wLight: 600, wActive: 700, color: '#d9fbff', activeColor: '#4DF3FF', stroke: 0, n: 3, fs: 48, mode: 'glow' },
  manuscrito: { ...B, name: 'Manuscrito', free: false, font: 'Pacifico', wLight: 400, wActive: 400, color: '#ffffff', activeColor: '#FF9EC7', stroke: 30, n: 3, fs: 50 },
  chama: { ...B, name: 'Chama', free: true, font: 'Montserrat', wLight: 900, wActive: 900, case: 'upper', color: '#ffffff', activeColor: '#FFD500', cycle: ['#FFD500', '#3DDC84', '#FF4D4D', '#4DC3FF'], stroke: 60, n: 3, anim: 'bounce', emph: 1, fs: 54, mode: 'flame', strokeColor: '#3a0a00' },
  marca_texto: { ...B, name: 'Marca-texto', free: false, font: 'Poppins', wLight: 800, wActive: 800, case: 'upper', color: '#ffffff', activeColor: '#1a0a02', hl: '#FFB020', mode: 'marker', stroke: 0, n: 3, anim: 'bounce', fs: 48 },
  onda: { ...B, name: 'Onda', free: false, font: 'Poppins', wLight: 800, wActive: 800, case: 'upper', color: '#ffffff', activeColor: '#ffffff', reveal: 1, anim: 'slide', n: 3, stroke: 40, fs: 50 },
  preenchido: { ...B, name: 'Preenchido', free: false, font: 'Montserrat', wLight: 900, wActive: 900, case: 'upper', color: 'rgba(255,255,255,.55)', activeColor: '#FF7A3D', fill: 1, stroke: 45, n: 3, fs: 52 },
  tremor: { ...B, name: 'Tremor', free: false, font: 'Anton', wLight: 400, wActive: 400, case: 'upper', color: '#ffffff', activeColor: '#FF4D4D', anim: 'shake', stroke: 50, n: 2, fs: 62 },
  cinema: { ...B, name: 'Cinema', free: false, font: 'Playfair Display', wLight: 500, wActive: 700, color: '#FDFBF7', activeColor: '#FFD9A0', reveal: 1, anim: 'fade', n: 5, fs: 40, shadow: 1 },
  pulso: { ...B, name: 'Pulso', free: false, font: 'Sora', wLight: 700, wActive: 800, case: 'upper', color: '#ffffff', activeColor: '#B8FF3D', anim: 'pulse', emph: 1, stroke: 40, n: 3, fs: 48 },
  cascata: { ...B, name: 'Cascata', free: false, font: 'Montserrat', wLight: 700, wActive: 700, color: '#ffffff', activeColor: '#ffffff', n: 12, fs: 58, shadow: 1, mode: 'cascade' },
};
const CAT = { cascata: 'Cinético', chama: 'Cinético', marca_texto: 'Cinético', onda: 'Cinético', preenchido: 'Cinético', tremor: 'Cinético', cinema: 'Cinético', pulso: 'Cinético', iman: 'Destaque', impacto: 'Viral', uma_palavra: 'Viral', minimal: 'Elegante', pilula: 'Elegante', neon: 'Divertido', manuscrito: 'Divertido' };
Object.entries(CAT).forEach(([k, v]) => { PRESETS[k].cat = v; });
export const CATS = ['Todos', 'Cinético', 'Destaque', 'Viral', 'Elegante', 'Divertido'];
export const DEFAULT_STYLE = { preset: 'iman', x: 0.5, y: 0.58, cropX: 0.5, o: {} };
export function resolve(style) {   // preset + ajustes do usuário
  const s = style || DEFAULT_STYLE;
  return { ...(PRESETS[s.preset] || PRESETS.iman), ...(s.o || {}), x: s.x ?? 0.5, y: s.y ?? 0.58, cropX: s.cropX ?? 0.5 };
}

// Área segura (quadro 1080×1920) a partir das margens publicadas para anúncios; não são regras oficiais para posts orgânicos.
export const PLATFORMS = {
  all: { name: 'Todas', t: 288, b: 672, l: 120, r: 192 },   // máximo de cada lado entre as três
  tiktok: { name: 'TikTok', t: 240, b: 660, l: 120, r: 120 },
  reels: { name: 'Reels', t: 269, b: 672, l: 65, r: 65 },
  shorts: { name: 'Shorts', t: 288, b: 672, l: 48, r: 192 },
};
export const safeRect = (p, W = 1080, H = 1920) => { const m = PLATFORMS[p] || PLATFORMS.all; return { x: m.l / 1080 * W, y: m.t / 1920 * H, w: W - (m.l + m.r) / 1080 * W, h: H - (m.t + m.b) / 1920 * H }; };

// Agrupa em blocos de até n palavras, mas nunca atravessa uma pausa (>= 0,5 s) nem um fim de frase:
// assim a próxima frase só aparece quando começa a ser falada.
export const chunksOf = (words, n) => {
  const out = []; let cur = [];
  words.forEach((w, i) => {
    cur.push(w); const nx = words[i + 1];
    if (!nx || cur.length >= n || nx.s - w.e >= 0.5 || /[.!?…]["')\]]*$/.test(w.w)) { out.push(cur); cur = []; }
  });
  return out;
};
const txt = (w, c) => c === 'upper' ? w.toLocaleUpperCase('pt-BR') : c === 'lower' ? w.toLocaleLowerCase('pt-BR') : w;
const fnt = (s, wt, px) => `${nearest(s.font, wt)} ${px}px "${s.font}", sans-serif`;
export const sizePx = (s, W) => (0.03 + s.fs * 0.0006) * W;   // slider 0–100 → 3% a 9% da largura

// Desenha a legenda do instante t. Retorna a caixa (em px) ocupada, para o alerta de safe zone.
const eo = p => 1 - (1 - p) * (1 - p) * (1 - p), spring = p => 1 - Math.exp(-7 * p) * Math.cos(11 * p), cl = v => Math.min(1, Math.max(0, v));
export function drawCaption(ctx, W, H, chunks, t, rs) {
  if (rs.mode === 'cascade') return drawCascade(ctx, W, H, chunks, t, rs);
  let k = -1; for (let i = 0; i < chunks.length; i++) if (t >= chunks[i][0].s) k = i; else break;
  const c = chunks[k]; if (!c || t > c[c.length - 1].e + 0.4) return null;
  let a = -1; for (let i = 0; i < c.length; i++) if (t >= c[i].s) a = i;
  const px0 = sizePx(rs, Math.min(W, H * 0.75)), maxW = Math.min(W * 0.86, H * 0.75 * 0.86 * 1.6);
  const words = c.map((w, i) => ({ w, i, t: txt(w.w, rs.case), on: i === a, past: i < a }));
  // quebra em no máximo 2 linhas: se passar, reduz a fonte até caber (mínimo 62%)
  let px = px0, gap = 0, lh = 0, lines = [];
  for (let f = 1; f >= 0.62; f -= 0.06) {
    px = px0 * f; ctx.font = fnt(rs, Math.max(rs.wLight, rs.wActive), px); gap = Math.max(px * 0.3, ctx.measureText(' ').width * 1.1); lh = px * 1.28;
    words.forEach(o => { o.rw = ctx.measureText(o.t).width * (rs.mode === 'flame' ? 1.03 : 1); });   // largura reservada no peso maior: a linha não "treme"
    lines = []; let cur = [], cw = 0;
    words.forEach(o => { if (cur.length && cw + gap + o.rw > maxW) { lines.push(cur); cur = []; cw = 0; } cur.push(o); cw += (cur.length > 1 ? gap : 0) + o.rw; });
    if (cur.length) lines.push(cur);
    if (lines.length <= 2) break;
  }
  const lw = l => l.reduce((s, o, i) => s + o.rw + (i ? gap : 0), 0);
  const bw = Math.max(...lines.map(lw)), bh = lines.length * lh;
  const cx = rs.x * W, cy = rs.y * H, left = cx - bw / 2, top = cy - bh / 2;
  ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.textAlign = 'left';
  lines.forEach((l, li) => {
    let x = rs.align === 'left' ? left : rs.align === 'right' ? left + bw - lw(l) : cx - lw(l) / 2; const base = top + li * lh + lh * 0.5 + px * 0.34;
    l.forEach(o => { o.x = x; x += o.rw + gap; });
    [...l].sort((p, q) => (p.on ? 1 : 0) - (q.on ? 1 : 0)).forEach(o => {
      const act = o.on, wt = act ? rs.wActive : rs.wLight, age = Math.max(0, t - o.w.s), an = rs.anim || (rs.pop ? 'pop' : 'none');
      let col = act ? rs.activeColor : rs.color; if (act && rs.cycle) col = rs.cycle[(k * 7 + o.i) % rs.cycle.length]; if (rs.fill && o.past) col = rs.activeColor;
      let sc = 1, dy = 0, rot = 0, al = 1, shown = !(rs.reveal && o.i > a);
      if (rs.reveal && !shown) al = 0;
      if (rs.dim && !act) al *= rs.dim;
      if (rs.reveal && shown) { const p0 = cl(age / 0.22); al = eo(p0); if (an === 'slide') dy = (1 - eo(p0)) * px * 0.55; }
      if (act) {
        const p1 = cl(age / 0.3);
        if (an === 'pop') sc = 1 + 0.14 * (1 - (1 - cl(age / 0.12)) * (1 - cl(age / 0.12))) * (1 - cl(age / 0.12) * 0.35);
        else if (an === 'bounce') sc = rs.mode === 'flame' ? Math.min(1.08, 0.88 + 0.22 * spring(p1)) : 0.62 + 0.5 * spring(p1);
        else if (an === 'shake') { sc = 1.08; rot = Math.sin(age * 70) * 0.05 * (1 - p1); }
        else if (an === 'tilt') { sc = 1.06 + 0.06 * eo(p1); rot = -0.055 * eo(p1); }
        else if (an === 'pulse') sc = 1 + 0.16 * Math.sin(Math.PI * cl(age / 0.35));
        if (rs.emph && o.t.length >= 7 && rs.mode !== 'flame') sc *= 1.1;
      }
      ctx.save(); ctx.globalAlpha = al; ctx.translate(o.x + o.rw / 2, base - px * 0.3 + dy); if (rot) ctx.rotate(rot); ctx.scale(sc, sc); ctx.translate(-o.rw / 2, px * 0.3);
      ctx.font = fnt(rs, wt, px);
      const w = ctx.measureText(o.t).width, off = (o.rw - w) / 2;
      if (rs.mode === 'marker' && act) { const pw = eo(cl(age / 0.16)); ctx.fillStyle = rs.hl || '#FFB020'; rr(ctx, off - px * 0.2, -px * 0.9, (w + px * 0.4) * pw, px * 1.2, px * 0.22); ctx.fill(); }
      if (rs.mode === 'pill' && act && rs.bgOpacity) { ctx.fillStyle = hexA(rs.bg, rs.bgOpacity / 100); rr(ctx, off - px * 0.25, -px * 0.92, w + px * 0.5, px * 1.3, px * 0.3); ctx.fill(); }
      if (rs.shadow && rs.mode !== 'glow' && rs.mode !== 'flame') { ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = px * 0.22; ctx.shadowOffsetY = px * 0.04; }
      if (rs.mode === 'flame' && act) {   // palavra em chamas: línguas de fogo animadas + gradiente quente + brilho laranja
        const ph = t * 9, top0 = -px * 0.5;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = 'transparent';
        const nT = Math.max(4, Math.round(w / (px * 0.3)));
        const tongue = (fx, hh, ww, sway, c0, c1, c2) => {
          const g = ctx.createLinearGradient(0, top0, 0, top0 - hh); g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, c2);
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(fx - ww, top0 + px * 0.18);
          ctx.bezierCurveTo(fx - ww * 1.1, top0 - hh * 0.35, fx - ww * 0.3 + sway * 0.6, top0 - hh * 0.7, fx + sway, top0 - hh);
          ctx.bezierCurveTo(fx + ww * 0.3 + sway * 0.6, top0 - hh * 0.7, fx + ww * 1.1, top0 - hh * 0.35, fx + ww, top0 + px * 0.18); ctx.closePath(); ctx.fill();
        };
        for (let q = 0; q < nT; q++) {
          const u = (q + 0.5) / nT, fx = off + u * w, env = 0.55 + 0.45 * Math.sin(u * Math.PI);   // mais alta no meio da palavra
          const n1 = 0.5 + 0.5 * Math.sin(ph + q * 1.9), n2 = 0.5 + 0.5 * Math.sin(ph * 1.7 + q * 2.7 + 1), hh = px * (0.85 + 1.0 * n1) * env, ww = px * (0.2 + 0.07 * n2), sway = Math.sin(ph * 0.9 + q * 1.3) * px * 0.07;
          tongue(fx, hh, ww, sway, 'rgba(255,70,0,.75)', 'rgba(255,150,20,.45)', 'rgba(255,200,60,0)');
          tongue(fx, hh * 0.62, ww * 0.55, sway * 0.6, 'rgba(255,200,60,.8)', 'rgba(255,240,150,.4)', 'rgba(255,255,220,0)');
        }
        ctx.restore();
        const gr = ctx.createLinearGradient(0, -px * 0.75, 0, px * 0.1); gr.addColorStop(0, '#FFF3B0'); gr.addColorStop(0.5, '#FFB020'); gr.addColorStop(1, '#FF3D00'); col = gr;
        ctx.shadowColor = 'rgba(255,90,0,.95)'; ctx.shadowBlur = px * 0.45;
      }
      if (rs.mode === 'glow' && act) { ctx.shadowColor = col; ctx.shadowBlur = px * 0.5; }
      if (rs.stroke > 0) { ctx.lineWidth = rs.stroke / 100 * px * 0.2; ctx.strokeStyle = rs.strokeColor; ctx.strokeText(o.t, off, 0); if (!(rs.mode === 'flame' && act)) ctx.shadowColor = 'transparent'; }
      ctx.fillStyle = col;
      if (rs.letter && act) {   // destaque por letra: as letras já ditas ficam no peso ativo
        const p = Math.min(1, Math.max(0, (t - o.w.s) / Math.max(0.01, o.w.e - o.w.s))), ch = [...o.t], n = Math.ceil(p * ch.length);
        const ws = ch.map((q, i) => { ctx.font = fnt(rs, i < n ? rs.wActive : rs.wLight, px); return ctx.measureText(q).width; });
        let lx = (o.rw - ws.reduce((s, v) => s + v, 0)) / 2; ch.forEach((q, i) => { ctx.font = fnt(rs, i < n ? rs.wActive : rs.wLight, px); ctx.fillText(q, lx, 0); lx += ws[i]; });
      } else if (rs.type && act) { const n = Math.max(1, Math.ceil(cl(age / Math.max(0.12, (o.w.e - o.w.s) * 0.8)) * o.t.length)); ctx.fillText(o.t.slice(0, n), off, 0); }
      else if (rs.fill && act) { const pr = cl(age / Math.max(0.1, o.w.e - o.w.s)); ctx.fillStyle = rs.color; ctx.fillText(o.t, off, 0); ctx.save(); ctx.beginPath(); ctx.rect(off - 4, -px * 1.3, w * pr + 4, px * 1.8); ctx.clip(); ctx.fillStyle = rs.activeColor; ctx.fillText(o.t, off, 0); ctx.restore(); }
      else ctx.fillText(o.t, off, 0);
      ctx.restore();
    });
  });
  ctx.restore();
  return { x: left, y: top, w: bw, h: bh };
}
const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
export const outsideSafe = (box, p, W, H) => { if (!box) return false; const s = safeRect(p, W, H); return box.x < s.x - 1 || box.y < s.y - 1 || box.x + box.w > s.x + s.w + 1 || box.y + box.h > s.y + s.h + 1; };

// Cascata: bloco de até 4 linhas empilhadas. Cada linha nasce de baixo (subida + rastro de movimento + fade), as palavras
// entram deslizando da direita no instante em que são faladas, as linhas anteriores sobem enquanto o bloco se recentraliza,
// a última linha (em blocos de 3+ linhas) fica em itálico e o bloco todo some em fade ao final.
function drawCascade(ctx, W, H, chunks, t, rs) {
  let k = -1; for (let i = 0; i < chunks.length; i++) if (t >= chunks[i][0].s) k = i; else break;
  const c = chunks[k]; if (!c) return null;
  const end = c[c.length - 1].e; if (t > end + 0.4) return null;
  const px0 = sizePx(rs, Math.min(W, H * 0.75)), maxW = Math.min(W * 0.86, H * 0.75 * 0.86 * 1.6);
  const words = c.map((w, i) => ({ w, i, t: txt(w.w, rs.case) }));
  let px = px0, gap = 0, lh = 0, lines = [];
  for (let f = 1; f >= 0.5; f -= 0.06) {
    px = px0 * f; ctx.font = fnt(rs, rs.wActive, px); gap = Math.max(px * 0.3, ctx.measureText(' ').width * 1.1); lh = px * 1.3;
    words.forEach(o => { o.rw = ctx.measureText(o.t).width; });
    lines = []; let cur = [], cw = 0;
    words.forEach(o => { if (cur.length && cw + gap + o.rw > maxW) { lines.push(cur); cur = []; cw = 0; } cur.push(o); cw += (cur.length > 1 ? gap : 0) + o.rw; });
    if (cur.length) lines.push(cur);
    if (lines.length <= 4) break;
  }
  const lw = l => l.reduce((s, o, i) => s + o.rw + (i ? gap : 0), 0);
  const bw = Math.max(...lines.map(lw)), D = 0.35;
  const ages = lines.map(l => t - l[0].w.s);
  const vis = ages.reduce((s, a) => s + eo(cl(a / D)), 0);       // linhas visíveis (fracionário): recentraliza o bloco suavemente
  const cx = rs.x * W, cy = rs.y * H, bh = vis * lh;
  const fade = 1 - cl((t - end) / 0.35);
  ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.textAlign = 'left'; ctx.font = fnt(rs, rs.wActive, px);
  lines.forEach((l, li) => {
    const age = ages[li]; if (age < 0) return;
    const p = eo(cl(age / D)), rise = (1 - p) * px * 0.7;
    const base = cy + (li - (vis - 1) / 2) * lh + px * 0.34 + rise;
    const ital = lines.length >= 3 && li === lines.length - 1, x0 = cx - lw(l) / 2;
    const passes = p < 1 ? [[-1, 0.18], [-0.5, 0.3], [0, 1]] : [[0, 1]];   // rastro: cópias desfocadas por movimento, abaixo da posição final
    passes.forEach(([g, ga]) => {
      let x = x0;
      l.forEach(o => {
        const wa = cl((t - o.w.s) / 0.28), we = eo(wa);
        if (wa > 0) {
          ctx.save(); ctx.globalAlpha = fade * p * we * ga;
          const y = base - g * px * 0.28 * (1 - p), ox = (1 - we) * px * 0.7;
          ctx.translate(x + ox, y); if (ital) ctx.transform(1, 0, -0.2, 1, 0, 0);
          if (rs.shadow) { ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = px * 0.22; ctx.shadowOffsetY = px * 0.04; }
          ctx.fillStyle = rs.color; ctx.fillText(o.t, 0, 0); ctx.restore();
        }
        x += o.rw + gap;
      });
    });
  });
  ctx.restore();
  return { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh };
}
