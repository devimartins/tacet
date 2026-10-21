// Avatares 2D originais (SVG gerado no código, sem bibliotecas nem licenças de terceiros).
const SKIN = ['#FFD9B8', '#F4B98C', '#D99A6C', '#A8693F', '#7A4A2B', '#FBE3C8'];
const BG = ['#FF6A3D', '#FFB020', '#3DDC84', '#4DC3FF', '#7C6CFF', '#FF5DA2', '#2A2D34', '#E8E2DA'];
export const AV_COUNT = 12, BG_COUNT = BG.length;
const eyes = [
  c => `<circle cx="38" cy="50" r="4" fill="#1b1d21"/><circle cx="62" cy="50" r="4" fill="#1b1d21"/>`,
  c => `<path d="M33 52q5-7 10 0M57 52q5-7 10 0" stroke="#1b1d21" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
  c => `<circle cx="38" cy="50" r="4" fill="#1b1d21"/><path d="M57 51q5 -5 10 0" stroke="#1b1d21" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
  c => `<rect x="30" y="44" width="17" height="13" rx="6" fill="none" stroke="#1b1d21" stroke-width="3"/><rect x="53" y="44" width="17" height="13" rx="6" fill="none" stroke="#1b1d21" stroke-width="3"/><path d="M47 50h6" stroke="#1b1d21" stroke-width="3"/><circle cx="38.5" cy="50.5" r="2.6" fill="#1b1d21"/><circle cx="61.5" cy="50.5" r="2.6" fill="#1b1d21"/>`,
];
const mouth = [
  `<path d="M40 66q10 10 20 0" stroke="#1b1d21" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
  `<path d="M40 64q10 16 20 0z" fill="#7a1f1f"/>`,
  `<path d="M42 68h16" stroke="#1b1d21" stroke-width="3.5" stroke-linecap="round"/>`,
];
const acc = [
  ``,
  `<path d="M18 38q32-26 64 0" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/>`,
  `<path d="M20 36q30-34 60 0z" fill="#1b1d21"/><circle cx="50" cy="13" r="5" fill="#FFB020"/>`,
  `<path d="M24 46q-2-30 26-30t26 30" stroke="#1b1d21" stroke-width="5" fill="none"/><rect x="16" y="42" width="10" height="20" rx="5" fill="#1b1d21"/><rect x="74" y="42" width="10" height="20" rx="5" fill="#1b1d21"/>`,
  `<path d="M50 14q-9 10-2 17 1-6 6-8-1 5 3 8 6-8-7-17z" fill="#FF6A3D"/>`,
  `<path d="M26 30l8 8 8-14 8 14 8-14 8 14 8-8-6 18H32z" fill="#FFB020"/>`,
];
export function avatarSvg(i = 0, bg = 0, size = 64) {
  i = ((+i || 0) % AV_COUNT + AV_COUNT) % AV_COUNT; bg = ((+bg || 0) % BG_COUNT + BG_COUNT) % BG_COUNT;
  const skin = SKIN[i % SKIN.length], e = eyes[i % 4], m = mouth[Math.floor(i / 4) % 3], a = acc[i % 6];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="Avatar"><rect width="100" height="100" fill="${BG[bg]}"/><ellipse cx="50" cy="104" rx="34" ry="24" fill="${SKIN[(i + 2) % SKIN.length]}" opacity=".0"/><path d="M14 100q6-22 36-22t36 22z" fill="#1b1d21" opacity=".85"/><ellipse cx="50" cy="54" rx="29" ry="31" fill="${skin}"/><ellipse cx="32" cy="64" rx="5" ry="3" fill="#ff7a7a" opacity=".35"/><ellipse cx="68" cy="64" rx="5" ry="3" fill="#ff7a7a" opacity=".35"/>${e()}${m}${a}</svg>`;
}
export const parseAv = s => { const m = /^a(\d+)-(\d+)$/.exec(s || ''); return m ? [+m[1] % AV_COUNT, +m[2] % BG_COUNT] : null; };
