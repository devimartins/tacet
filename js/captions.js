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
  iman: { ...B, name: 'Iman', free: true, wLight: 300, wActive: 500, case: 'lower', n: 4, fs: 40, shadow: 1 },
  impacto: { ...B, name: 'Impacto', free: true, font: 'Montserrat', wLight: 900, wActive: 900, case: 'upper', activeColor: '#FFD500', stroke: 55, n: 3, pop: 1, fs: 50 },
  uma_palavra: { ...B, name: 'Uma palavra', free: true, font: 'Montserrat', wLight: 900, wActive: 900, case: 'upper', stroke: 55, n: 1, pop: 1, fs: 72 },
  minimal: { ...B, name: 'Minimal', free: true, font: 'Inter', wLight: 500, wActive: 700, n: 4, fs: 38 },
  tabloide: { ...B, name: 'Tabloide', free: false, font: 'Anton', wLight: 400, wActive: 400, case: 'upper', color: '#ffffff', activeColor: '#FFD500', stroke: 45, n: 3, pop: 1, fs: 56 },
  karaoke: { ...B, name: 'Karaokê', free: false, font: 'Poppins', wLight: 700, wActive: 800, color: '#ffffff', activeColor: '#3DDC84', stroke: 40, n: 4, fs: 46 },
  pilula: { ...B, name: 'Pílula', free: false, font: 'Inter', wLight: 600, wActive: 700, color: '#ffffff', activeColor: '#111111', bgOpacity: 85, bg: '#000000', n: 3, pop: 1, fs: 44, shadow: 0, mode: 'pill' },
  editorial: { ...B, name: 'Editorial', free: false, font: 'Playfair Display', wLight: 500, wActive: 800, color: '#FDFBF7', activeColor: '#FDFBF7', case: 'none', n: 4, fs: 44 },
  neon: { ...B, name: 'Neon', free: false, font: 'Poppins', wLight: 600, wActive: 700, color: '#d9fbff', activeColor: '#4DF3FF', stroke: 0, n: 3, fs: 48, mode: 'glow' },
  manuscrito: { ...B, name: 'Manuscrito', free: false, font: 'Pacifico', wLight: 400, wActive: 400, color: '#ffffff', activeColor: '#FF9EC7', stroke: 30, n: 3, fs: 50 },
  moderno: { ...B, name: 'Moderno', free: false, font: 'Space Grotesk', wLight: 400, wActive: 700, case: 'lower', color: '#ffffff', activeColor: '#B8FF3D', n: 4, fs: 42 },
  quadrinhos: { ...B, name: 'Quadrinhos', free: false, font: 'Bangers', wLight: 400, wActive: 400, case: 'upper', color: '#ffffff', activeColor: '#FF4D4D', stroke: 70, n: 3, pop: 1, fs: 56 },
};
const CAT = { iman: 'Destaque', impacto: 'Viral', uma_palavra: 'Viral', tabloide: 'Viral', minimal: 'Elegante', pilula: 'Elegante', editorial: 'Elegante', moderno: 'Elegante', karaoke: 'Divertido', neon: 'Divertido', manuscrito: 'Divertido', quadrinhos: 'Divertido' };
Object.entries(CAT).forEach(([k, v]) => { PRESETS[k].cat = v; });
export const CATS = ['Todos', 'Destaque', 'Viral', 'Elegante', 'Divertido'];
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

export const chunksOf = (words, n) => { const out = []; for (let i = 0; i < words.length; i += n) out.push(words.slice(i, i + n)); return out; };
const txt = (w, c) => c === 'upper' ? w.toLocaleUpperCase('pt-BR') : c === 'lower' ? w.toLocaleLowerCase('pt-BR') : w;
const fnt = (s, wt, px) => `${nearest(s.font, wt)} ${px}px "${s.font}", sans-serif`;
export const sizePx = (s, W) => (0.03 + s.fs * 0.0006) * W;   // slider 0–100 → 3% a 9% da largura

// Desenha a legenda do instante t. Retorna a caixa (em px) ocupada, para o alerta de safe zone.
export function drawCaption(ctx, W, H, chunks, t, rs) {
  let k = -1; for (let i = 0; i < chunks.length; i++) if (t >= chunks[i][0].s) k = i; else break;
  const c = chunks[k]; if (!c || t > c[c.length - 1].e + 0.4) return null;
  let a = -1; for (let i = 0; i < c.length; i++) if (t >= c[i].s) a = i;
  const px = sizePx(rs, W), maxW = W * 0.86, gap = px * 0.28, lh = px * 1.28;
  const words = c.map((w, i) => ({ w, t: txt(w.w, rs.case), on: i === a }));
  words.forEach(o => { ctx.font = fnt(rs, Math.max(rs.wLight, rs.wActive), px); o.rw = ctx.measureText(o.t).width; });   // largura reservada no peso maior: a linha não "treme"
  const lines = []; let cur = [], cw = 0;
  words.forEach(o => { if (cur.length && cw + gap + o.rw > maxW) { lines.push(cur); cur = []; cw = 0; } cur.push(o); cw += (cur.length > 1 ? gap : 0) + o.rw; });
  if (cur.length) lines.push(cur);
  const lw = l => l.reduce((s, o, i) => s + o.rw + (i ? gap : 0), 0);
  const bw = Math.max(...lines.map(lw)), bh = lines.length * lh;
  const cx = rs.x * W, cy = rs.y * H, left = cx - bw / 2, top = cy - bh / 2;
  ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.textAlign = 'left';
  lines.forEach((l, li) => {
    let x = cx - lw(l) / 2; const base = top + li * lh + lh * 0.5 + px * 0.34;
    l.forEach(o => {
      const act = o.on, wt = act ? rs.wActive : rs.wLight, col = act ? rs.activeColor : rs.color;
      let sc = 1; if (act && rs.pop) { const p = Math.min(1, (t - o.w.s) / 0.12); sc = 1 + 0.14 * (1 - (1 - p) * (1 - p)) * (1 - p * 0.35); }
      ctx.save(); ctx.translate(x + o.rw / 2, base - px * 0.3); ctx.scale(sc, sc); ctx.translate(-o.rw / 2, px * 0.3);
      ctx.font = fnt(rs, wt, px);
      const w = ctx.measureText(o.t).width, off = (o.rw - w) / 2;
      if (rs.mode === 'pill' && act && rs.bgOpacity) { ctx.fillStyle = hexA(rs.bg, rs.bgOpacity / 100); rr(ctx, off - px * 0.25, -px * 0.92, w + px * 0.5, px * 1.3, px * 0.3); ctx.fill(); }
      if (rs.shadow && rs.mode !== 'glow') { ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = px * 0.22; ctx.shadowOffsetY = px * 0.04; }
      if (rs.mode === 'glow' && act) { ctx.shadowColor = col; ctx.shadowBlur = px * 0.5; }
      if (rs.stroke > 0) { ctx.lineWidth = rs.stroke / 100 * px * 0.2; ctx.strokeStyle = rs.strokeColor; ctx.strokeText(o.t, off, 0); ctx.shadowColor = 'transparent'; }
      ctx.fillStyle = col;
      if (rs.letter && act) {   // destaque por letra: as letras já ditas ficam no peso ativo
        const p = Math.min(1, Math.max(0, (t - o.w.s) / Math.max(0.01, o.w.e - o.w.s))), ch = [...o.t], n = Math.ceil(p * ch.length);
        const ws = ch.map((q, i) => { ctx.font = fnt(rs, i < n ? rs.wActive : rs.wLight, px); return ctx.measureText(q).width; });
        let lx = (o.rw - ws.reduce((s, v) => s + v, 0)) / 2; ch.forEach((q, i) => { ctx.font = fnt(rs, i < n ? rs.wActive : rs.wLight, px); ctx.fillText(q, lx, 0); lx += ws[i]; });
      } else ctx.fillText(o.t, off, 0);
      ctx.restore(); x += o.rw + gap;
    });
  });
  ctx.restore();
  return { x: left, y: top, w: bw, h: bh };
}
const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
export const outsideSafe = (box, p, W, H) => { if (!box) return false; const s = safeRect(p, W, H); return box.x < s.x - 1 || box.y < s.y - 1 || box.x + box.w > s.x + s.w + 1 || box.y + box.h > s.y + s.h + 1; };
