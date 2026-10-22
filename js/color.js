// Correção de cor em WebGL2, num único passe de GPU: exposição, contraste, saturação, curvas, LUT 3D e vinheta.
// Sem dependências. Só é carregado (e o contexto WebGL só é criado) quando o usuário mexe na cor.

export const NEUTRAL = { bright: 0, contrast: 0, sat: 0, vig: 0, curve: [0, 0, 0], look: '', lutAmt: 1 };
export const isNeutral = (g, lut) => !g || (!g.bright && !g.contrast && !g.sat && !g.vig && !(g.curve || []).some(Boolean) && !g.look && !lut);

// ---------- looks (LUTs geradas por fórmula, sem arquivos nem licenças de terceiros) ----------
const L = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b, cl = x => x < 0 ? 0 : x > 1 ? 1 : x, mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const sat = (c, s) => { const l = L(c[0], c[1], c[2]); return [l + (c[0] - l) * s, l + (c[1] - l) * s, l + (c[2] - l) * s]; };
const scurve = (c, k) => c.map(v => cl(v + k * (sm(0, 1, v) - v)));
const split = (c, sh, hi, a) => { const l = L(c[0], c[1], c[2]), ws = 1 - sm(0.1, 0.6, l), wh = sm(0.4, 0.9, l); return c.map((v, i) => v + a * (ws * sh[i] + wh * hi[i])); };
const lift = (c, b, w) => c.map(v => b + v * (w - b));
const gray = c => { const l = L(c[0], c[1], c[2]); return [l, l, l]; };
export const LOOKS = [
  { id: 'cinema', name: 'Cinema', f: c => scurve(split(sat(c, 1.05), [-0.03, 0.02, 0.06], [0.07, 0.02, -0.06], 1), 0.55) },
  { id: 'dourado', name: 'Dourado', f: c => scurve(sat([c[0] * 1.07, c[1] * 1.0, c[2] * 0.86], 1.1), 0.3) },
  { id: 'frio', name: 'Frio', f: c => scurve(sat([c[0] * 0.92, c[1] * 0.99, c[2] * 1.09], 1.02), 0.3) },
  { id: 'vibrante', name: 'Vibrante', f: c => scurve(sat(c, 1.4), 0.4) },
  { id: 'fosco', name: 'Fosco', f: c => sat(lift(c, 0.07, 0.94), 0.9) },
  { id: 'vintage', name: 'Vintage', f: c => sat(lift(split(c, [-0.02, 0.025, 0.0], [0.06, 0.03, -0.05], 1), 0.06, 0.92), 0.82) },
  { id: 'pb', name: 'Preto e branco', f: c => scurve(gray(c), 0.5) },
  { id: 'noir', name: 'Noir', f: c => scurve(gray(c).map(v => Math.pow(v, 1.15)), 1.0) },
  { id: 'pastel', name: 'Pastel', f: c => lift(sat(c, 0.78), 0.08, 1.0).map(v => cl(v + 0.03)) },
  { id: 'filme', name: 'Filme', f: c => sat(scurve(split(c, [-0.015, 0.02, 0.035], [0.035, 0.015, -0.03], 1), 0.35), 0.95) },
  { id: 'por', name: 'Pôr do sol', f: c => scurve(split(sat(c, 1.15), [0.03, -0.01, 0.05], [0.1, 0.02, -0.08], 1), 0.4) },
  { id: 'neon', name: 'Neon', f: c => scurve(split(sat(c, 1.3), [0.02, -0.03, 0.1], [-0.04, 0.06, 0.08], 1), 0.5) },
];
const lutCache = new Map();
export function lookLut(id, n = 17) {   // 17 pontos por eixo bastam (cerca de 20 KB) e a GPU interpola
  if (lutCache.has(id)) return lutCache.get(id);
  const lk = LOOKS.find(x => x.id === id); if (!lk) return null;
  const d = new Uint8Array(n * n * n * 4); let i = 0;
  for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) {
    const o = lk.f([r / (n - 1), g / (n - 1), b / (n - 1)]); d[i++] = Math.round(cl(o[0]) * 255); d[i++] = Math.round(cl(o[1]) * 255); d[i++] = Math.round(cl(o[2]) * 255); d[i++] = 255;
  }
  const lut = { n, data: d }; lutCache.set(id, lut); return lut;
}
// .cube do usuário (formato texto de código aberto, lido no próprio navegador; nada é enviado)
export function parseCube(txt) {
  let n = 0; const v = [];
  for (const ln of String(txt).split(/\r?\n/)) {
    const s = ln.trim(); if (!s || s[0] === '#') continue;
    if (s.startsWith('LUT_3D_SIZE')) { n = parseInt(s.split(/\s+/)[1], 10); continue; }
    if (/^[A-Za-z]/.test(s)) continue;   // TITLE, DOMAIN_MIN, LUT_1D_SIZE...
    const p = s.split(/\s+/).map(Number); if (p.length >= 3 && p.every(Number.isFinite)) v.push(p[0], p[1], p[2]);
  }
  if (!n || n < 2 || n > 65 || v.length !== n * n * n * 3) throw new Error('Arquivo .cube inválido ou sem LUT 3D (o formato precisa ter LUT_3D_SIZE).');
  const d = new Uint8Array(n * n * n * 4);
  for (let i = 0, j = 0; i < v.length; i += 3, j += 4) { d[j] = Math.round(cl(v[i]) * 255); d[j + 1] = Math.round(cl(v[i + 1]) * 255); d[j + 2] = Math.round(cl(v[i + 2]) * 255); d[j + 3] = 255; }
  return { n, data: d };
}

// ---------- curva tonal: 5 pontos (sombras, meios, realces ajustáveis) -> tabela de 256 valores ----------
function curveTable(a) {
  const xs = [0, 0.25, 0.5, 0.75, 1], ys = [0, 0.25 + 0.2 * (a[0] || 0), 0.5 + 0.2 * (a[1] || 0), 0.75 + 0.2 * (a[2] || 0), 1];
  const t = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const x = i / 255; let k = 0; while (k < 3 && x > xs[k + 1]) k++;
    const x0 = xs[k], x1 = xs[k + 1], u = (x - x0) / (x1 - x0), p0 = ys[Math.max(0, k - 1)], p1 = ys[k], p2 = ys[k + 1], p3 = ys[Math.min(4, k + 2)];
    const y = 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u);   // Catmull-Rom
    t[i] = Math.round(cl(y) * 255);
  }
  for (let i = 1; i < 256; i++) if (t[i] < t[i - 1]) t[i] = t[i - 1];   // nunca inverte tons
  return t;
}

const VS = `#version 300 es
in vec2 p; out vec2 v;
void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `#version 300 es
precision highp float; precision highp sampler3D;
in vec2 v; out vec4 o;
uniform sampler2D uTex, uCurve; uniform sampler3D uLut;
uniform vec4 uA, uUV; uniform vec3 uL;   // uA: exposição, contraste, saturação, vinheta | uUV: escala e deslocamento da imagem | uL: tamanho, intensidade e liga da LUT
uniform float uCurveOn;
void main(){
  vec2 t = v * uUV.xy + uUV.zw;
  vec3 c = texture(uTex, t).rgb;
  c *= exp2(uA.x * 0.8);
  c = (c - 0.5) * (1.0 + uA.y) + 0.5;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, 1.0 + uA.z);
  c = clamp(c, 0.0, 1.0);
  if (uCurveOn > 0.5) c = vec3(texture(uCurve, vec2(c.r * 0.99609 + 0.00195, 0.5)).r, texture(uCurve, vec2(c.g * 0.99609 + 0.00195, 0.5)).r, texture(uCurve, vec2(c.b * 0.99609 + 0.00195, 0.5)).r);
  if (uL.z > 0.5) { float n = uL.x; c = mix(c, texture(uLut, c * ((n - 1.0) / n) + 0.5 / n).rgb, uL.y); }
  float r = length(v - 0.5) * 1.4142; c *= 1.0 - uA.w * 0.9 * smoothstep(0.35, 1.05, r);
  o = vec4(c, 1.0);
}`;

export function createGrader(W, H, target) { try { return build(W, H, target); } catch { return null; } }
function build(W, H, target) {
  const c = target || (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H }));
  c.width = W; c.height = H;
  const gl = c.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n);
  const tex = (unit, target) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(target, t); gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); if (target === gl.TEXTURE_3D) gl.texParameteri(target, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE); return t; };
  tex(0, gl.TEXTURE_2D); tex(1, gl.TEXTURE_2D); tex(2, gl.TEXTURE_3D);
  gl.uniform1i(U('uTex'), 0); gl.uniform1i(U('uCurve'), 1); gl.uniform1i(U('uLut'), 2);
  let lutRef = null, curveKey = '';
  const api = {
    canvas: c,
    resize(w, h) { if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } },
    // src: canvas, vídeo ou imagem. uv = [escala x, escala y, deslocamento x, deslocamento y] para recortar (cover) a imagem de origem.
    apply(src, g, lut, uv = [1, 1, 0, 0]) {
      gl.viewport(0, 0, c.width, c.height);
      gl.activeTexture(gl.TEXTURE0); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      const cv = g.curve || [0, 0, 0], key = cv.join(',');
      if (key !== curveKey) { curveKey = key; gl.activeTexture(gl.TEXTURE1); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 256, 1, 0, gl.RED, gl.UNSIGNED_BYTE, curveTable(cv)); }
      if (lut !== lutRef) { lutRef = lut; if (lut) { gl.activeTexture(gl.TEXTURE2); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, lut.n, lut.n, lut.n, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut.data); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); } }
      gl.uniform4f(U('uA'), g.bright || 0, g.contrast || 0, g.sat || 0, g.vig || 0); gl.uniform4f(U('uUV'), uv[0], uv[1], uv[2], uv[3]);
      gl.uniform1f(U('uCurveOn'), cv.some(Boolean) ? 1 : 0); gl.uniform3f(U('uL'), lut ? lut.n : 1, g.lutAmt ?? 1, lut ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return c;
    },
    dispose() { try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* já liberado */ } },
  };
  return api;
}
