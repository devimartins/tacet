// Shared caption rendering: preview and capture use the same canvas coordinates.
import { resolve, chunksOf, perChunk, drawCaption } from './captions.js';
const chunkCache = new WeakMap();
export function paintCaptureOverlay(canvas, scene, time) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 540, 960);
  if (!scene.captions || !scene.words.length) return;
  const rs = resolve({ preset: scene.style, x: scene.x, y: scene.y, o: {} });
  const count = perChunk(rs); let cached = chunkCache.get(scene.words);
  if (!cached || cached.count !== count) { cached = { count, chunks: chunksOf(scene.words, count) }; chunkCache.set(scene.words, cached); }
  drawCaption(ctx, 540, 960, cached.chunks, time, rs);
  const word = [...scene.words].reverse().find(w => w.s <= time + .05) || scene.words[0];
  const name = scene.names[word.p] || (word.p === 'solo' ? '' : word.p);
  if (!name) return;
  ctx.font = '600 26px system-ui,sans-serif'; ctx.textBaseline = 'middle';
  const width = ctx.measureText(name).width;
  ctx.fillStyle = 'rgba(0,0,0,.62)'; ctx.beginPath();
  (ctx.roundRect || ctx.rect).call(ctx, 20, 24, width + 28, 42, 21);
  ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(name, 34, 46);
}
export function snapshotCapture(videoId, k, ui, speakers, mode, pair) {
  return structuredClone({
    videoId, start: k.c.start, end: k.c.end,
    captions: k.on, style: ui.sty, x: k.px, y: k.py, sync: k.sync,
    words: k.cw, names: speakers.names, positions: speakers.pos,
    crop: k.stage.classList.contains('crop'), mode,
    segments: k.segs, pair,
  });
}
