const fail = () => { throw Object.assign(new Error('Dados do corte inválidos.'), { status: 400 }); };
const number = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fail();
const string = (v, max) => typeof v === 'string' && v.length <= max ? v : fail();
const boolean = v => typeof v === 'boolean' ? v : fail();
const object = v => v && typeof v === 'object' && !Array.isArray(v) ? v : fail();
export function validateScene(input, styles) {
  const x = object(input);
  if (!/^[a-zA-Z0-9_-]{11}$/.test(x.videoId)) fail();
  const start = number(x.start, 0, 86400), end = number(x.end, start + 1, Math.min(start + 120, 86400));
  if (!styles.has(x.style) || !['center', 'follow', 'split'].includes(x.mode)) fail();
  if (!Array.isArray(x.words) || x.words.length > 2000 || !Array.isArray(x.segments) || x.segments.length > 2000) fail();
  const words = x.words.map(w => ({ w: string(w.w, 120), p: string(w.p, 40), s: number(w.s, 0, 86410), e: number(w.e, w.s, 86410) }));
  if (words.some((w, i) => w.s < start - .1 || w.s >= end || (i && w.s < words[i-1].s))) fail();
  const segments = x.segments.map(g => ({ p: string(g.p, 40), s: number(g.s, 0, 86410), e: number(g.e, g.s, 86410) }));
  const names = Object.fromEntries(Object.entries(object(x.names)).map(([k, v]) => [string(k, 40), string(v, 40)]));
  const positions = Object.fromEntries(Object.entries(object(x.positions)).map(([k, v]) => [string(k, 40), number(v, 0, 100)]));
  if (Object.keys(names).length > 6 || Object.keys(positions).length > 6 || !Array.isArray(x.pair) || x.pair.length > 2) fail();
  if (x.mode === 'split' && x.pair.length !== 2) fail();
  return { videoId: x.videoId, start, end, style: x.style, captions: boolean(x.captions), crop: boolean(x.crop), mode: x.mode,
    x: number(x.x, .25, .75), y: number(x.y, .12, .92), sync: number(x.sync, -2, 3),
    words, segments, names, positions, pair: x.pair.map(p => string(p, 40)) };
}
