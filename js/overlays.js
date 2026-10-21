// Títulos e imagens sobre o vídeo. Tempos em segundos do vídeo original.
export function hookTitle(words) {
  // Primeira frase do vídeo, curta e em caixa alta, como gancho de abertura.
  const txt = words.slice(0, 40).map(w => w.w).join(' '), first = (txt.split(/(?<=[.!?])\s/)[0] || txt).split(/\s+/).slice(0, 8).join(' ');
  return first.replace(/[.,;:]+$/, '').toUpperCase();
}
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
export function drawOverlays(ctx, W, H, list, t, font = 'sans-serif') {
  for (const o of list) {
    if (o.kind === 'broll' || t < o.from || t >= o.to) continue;
    const a = o.kind === 'logo' ? 0.9 : Math.min(1, (t - o.from) / 0.25, (o.to - t) / 0.25);   // entrada e saída suaves
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    if (o.kind === 'logo' && o.img) {   // marca d'água do kit de marca: canto superior esquerdo
      const s = Math.min(W * 0.2 / o.img.width, H * 0.1 / o.img.height); ctx.drawImage(o.img, W * 0.04, H * 0.035, o.img.width * s, o.img.height * s);
    } else
    if (o.kind === 'image' && o.img) {
      const mw = W * 0.7, mh = H * 0.28, s = Math.min(mw / o.img.width, mh / o.img.height), w = o.img.width * s, h = o.img.height * s, x = (W - w) / 2, y = H * 0.12;
      rr(ctx, x, y, w, h, W * 0.02); ctx.clip(); ctx.drawImage(o.img, x, y, w, h);
    } else if (o.kind === 'title') {
      const fs = W * 0.065; ctx.font = `800 ${fs}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const words = o.text.split(' '), lines = []; let cur = '';
      for (const w of words) { const n = cur ? cur + ' ' + w : w; if (ctx.measureText(n).width > W * 0.8 && cur) { lines.push(cur); cur = w; } else cur = n; }
      if (cur) lines.push(cur);
      const lh = fs * 1.25, bw = Math.min(W * 0.88, Math.max(...lines.map(l => ctx.measureText(l).width)) + fs), bh = lines.length * lh + fs * 0.6, y0 = H * 0.1;
      ctx.fillStyle = 'rgba(0,0,0,.72)'; rr(ctx, (W - bw) / 2, y0, bw, bh, fs * 0.35); ctx.fill();
      ctx.fillStyle = '#fff'; lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + fs * 0.3 + lh * (i + 0.5)));
    }
    ctx.restore();
  }
}

// B-roll: imagem em tela cheia (cobre o quadro) com zoom lento, desenhada ANTES das legendas.
export function drawBroll(ctx, W, H, list, t) {
  for (const o of list) {
    if (o.kind !== 'broll' || !(o.img || o.frames) || t < o.from || t >= o.to) continue;
    const img = o.frames ? o.frames[Math.min(o.frames.length - 1, Math.floor((t - o.from) * o.fps))] : o.img;   // vídeo: quadro pelo tempo
    const p = (t - o.from) / Math.max(0.1, o.to - o.from), a = Math.min(1, (t - o.from) / 0.2, (o.to - t) / 0.2);
    const s = Math.max(W / img.width, H / img.height) * (1 + (o.frames ? 0 : 0.1) * p), w = img.width * s, h = img.height * s;
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
}
