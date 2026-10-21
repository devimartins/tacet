// Painel "Cor e look": controles, prévia em GPU e parâmetros para a exportação. Carregado sob demanda.
import { NEUTRAL, LOOKS, isNeutral, lookLut, parseCube, createGrader } from './color.js';

export function initColor({ S, $, el, canPro, saveSoon, flash }) {
  const vid = $('#vid'), stage = $('#stage');
  let gc = null, gr = null, importedLut = null, importedName = '';
  const G = () => (S.style.grade = { ...NEUTRAL, ...(S.style.grade || {}) });
  const lut = () => (importedLut && G().look === 'import') ? importedLut : (G().look && G().look !== 'import' ? lookLut(G().look) : null);
  const ctrls = [];
  const set = (k, v) => { G()[k] = v; saveSoon('style', { style: S.style }); };
  const slider = (k, label, min, max, pro) => {
    const inp = el('input', { type: 'range', min, max, value: 0, ariaLabel: label, oninput: e => { if (pro && !canPro()) { e.target.value = 0; $('#pay').showModal(); return; } set(k, +e.target.value / 100); } });
    ctrls.push(() => { inp.value = Math.round((G()[k] || 0) * 100); });
    return el('label', { className: 'row' }, el('span', { textContent: label }), inp);
  };
  const curve = (i, label) => {
    const inp = el('input', { type: 'range', min: -100, max: 100, value: 0, ariaLabel: 'Curva: ' + label, oninput: e => { if (!canPro()) { e.target.value = 0; $('#pay').showModal(); return; } const c = [...G().curve]; c[i] = +e.target.value / 100; set('curve', c); } });
    ctrls.push(() => { inp.value = Math.round((G().curve[i] || 0) * 100); });
    return el('label', { className: 'row' }, el('span', { textContent: label }), inp);
  };
  const lookBtns = [];
  const pick = id => { if (id && !canPro()) { $('#pay').showModal(); return; } set('look', id); sync(); };
  const looks = el('div', { className: 'seg', role: 'group', ariaLabel: 'Look' }, ...[{ id: '', name: 'Nenhum' }, ...LOOKS].map(l => { const b = el('button', { type: 'button', textContent: l.name, onclick: () => pick(l.id) }); lookBtns.push([l.id, b]); return b; }));
  looks.style.flexWrap = 'wrap';
  const amt = slider('lutAmt', 'Intensidade do look', 0, 100, false); const amtIn = amt.querySelector('input'); amtIn.oninput = e => set('lutAmt', +e.target.value / 100); ctrls.push(() => { amtIn.value = Math.round((G().lutAmt ?? 1) * 100); });
  const file = el('input', { type: 'file', accept: '.cube', hidden: true, onchange: async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return; if (!canPro()) { $('#pay').showModal(); return; }
    if (f.size > 12e6) { flash('Arquivo grande demais para um .cube.'); return; }
    try { importedLut = parseCube(await f.text()); importedName = f.name; set('look', 'import'); sync(); flash('LUT carregada: ' + f.name); } catch (err) { flash(err.message); }
  } });
  const imp = el('label', { className: 'btn', style: 'cursor:pointer', textContent: 'Importar LUT (.cube)' }, file);
  const reset = el('button', { className: 'btn', type: 'button', textContent: 'Zerar cor', onclick: () => { S.style.grade = { ...NEUTRAL, curve: [0, 0, 0] }; importedLut = null; saveSoon('style', { style: S.style }); sync(); } });
  const note = el('small', { className: 'mut' });
  const box = $('#fxColor');
  box.append(el('p', { className: 'mut', textContent: 'A cor aparece na prévia e vai para o vídeo gerado. Nada é enviado: o ajuste roda na placa de vídeo do seu aparelho.' }),
    slider('bright', 'Brilho', -100, 100), slider('contrast', 'Contraste', -100, 100), slider('sat', 'Saturação', -100, 100), slider('vig', 'Vinheta', 0, 100),
    el('details', {}, el('summary', { textContent: 'Curvas (plano pago)' }), curve(0, 'Sombras'), curve(1, 'Meios-tons'), curve(2, 'Realces')),
    el('div', { className: 'grp' }, el('b', { textContent: 'Looks (plano pago)' }), looks, amt, el('div', { className: 'row' }, imp, note)), el('div', { className: 'row' }, reset));
  function sync() {
    ctrls.forEach(f => f());
    const cur = G().look; lookBtns.forEach(([id, b]) => b.setAttribute('aria-pressed', String(id === cur)));
    note.textContent = cur === 'import' && importedName ? importedName : '';
  }
  // prévia: o vídeo é desenhado por um canvas WebGL por cima do <video>, com o mesmo recorte (cover) e zoom
  function preview() {
    const g = G(), on = !isNeutral(g, lut()) && vid.videoWidth > 0 && !$('#edit').hidden && !S.blurOn;
    if (!on) { if (gc && gc.style.display !== 'none') { gc.style.display = 'none'; vid.style.visibility = ''; } return; }
    if (!gc) {
      const c = el('canvas', { id: 'gcv' }); c.style.pointerEvents = 'none';
      gr = createGrader(2, 2, c); if (!gr) { S.noGL = true; flash('Este aparelho não aceita a correção de cor em tempo real (WebGL2). A cor só será aplicada ao gerar o vídeo.'); return; }
      gc = c; vid.after(gc);
    }
    if (!gr || !gc) return;
    const r = stage.getBoundingClientRect(), d = Math.min(1.5, devicePixelRatio || 1), W = Math.min(720, Math.round(r.width * d)), H = Math.min(1280, Math.round(r.height * d));
    gr.resize(W, H);
    const va = vid.videoWidth / vid.videoHeight, sa = W / H, px = S.style.cropX ?? 0.5; let uv = [1, 1, 0, 0];
    if (va > sa) { const sx = sa / va; uv = [sx, 1, (1 - sx) * px, 0]; } else { const sy = va / sa; uv = [1, sy, 0, (1 - sy) * 0.5]; }
    try { gr.apply(vid, g, lut(), uv); } catch { return; }
    gc.style.display = 'block'; gc.style.transform = vid.style.transform; vid.style.visibility = 'hidden';
  }
  // parâmetros para a exportação (nulo quando não há ajuste, para não gastar nada)
  const forExport = () => { const g = G(), l = lut(); return isNeutral(g, l) ? null : { g: { ...g }, lut: l }; };
  sync();
  return { preview, sync, forExport };
}
