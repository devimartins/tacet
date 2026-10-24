// Tour guiado: escurece a tela, deixa o elemento em destaque e explica o que ele faz. Sem biblioteca externa.
const $ = s => document.querySelector(s);
const vis = e => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
let cur = null;

export function stopTour() { cur?.end(false); }

export function startTour(id, steps, { onEnd } = {}) {
  stopTour();
  const list = steps.map(s => ({ ...s, el: typeof s.sel === 'string' ? $(s.sel) : s.sel })).filter(s => vis(s.el) && (!s.when || s.when()));
  if (!list.length) return false;
  const block = document.createElement('div'), hole = document.createElement('div'), tip = document.createElement('div');
  block.className = 'tr-block'; hole.className = 'tr-hole'; tip.className = 'tr-tip';
  tip.setAttribute('role', 'dialog'); tip.setAttribute('aria-modal', 'true'); tip.setAttribute('aria-live', 'polite'); tip.setAttribute('aria-label', 'Tour do ForjaClip');
  document.body.append(block, hole, tip);
  let i = 0, done = false; const opener = document.activeElement;

  const place = () => {
    const s = list[i], r = s.el.getBoundingClientRect(), pad = 8, vw = innerWidth, vh = innerHeight, gap = 12;
    tip.style.cssText = ''; const tw = Math.min(vw < 640 ? vw - 24 : 340, vw - 24);
    Object.assign(tip.style, { width: tw + 'px', left: '12px', top: '12px' }); const th = tip.offsetHeight;
    const below = vh - r.bottom - pad - gap, above = r.top - pad - gap; let top, hb = r.bottom, ht = r.top;
    if (below >= th + 8) top = r.bottom + pad + gap;
    else if (above >= th + 8) top = r.top - pad - gap - th;
    else { top = vh - th - gap; hb = Math.min(r.bottom, top - gap - pad); }      // elemento grande: a caixa fica embaixo e o destaque cobre só o que cabe acima
    ht = Math.max(ht, pad); if (hb < ht + 24) hb = ht + 24;
    top = Math.max(gap, Math.min(top, vh - th - gap));
    const left = Math.min(Math.max(gap, r.left + r.width / 2 - tw / 2), vw - tw - gap);
    Object.assign(hole.style, { left: r.left - pad + 'px', top: ht - pad + 'px', width: r.width + pad * 2 + 'px', height: hb - ht + pad * 2 + 'px' });
    Object.assign(tip.style, { width: tw + 'px', left: left + 'px', top: top + 'px' });
  };
  const show = () => {
    const s = list[i]; tip.replaceChildren();
    const n = document.createElement('span'), t = document.createElement('b'), p = document.createElement('p'), row = document.createElement('div');
    n.className = 'tr-n'; n.textContent = `${i + 1} de ${list.length}`; t.textContent = s.title; p.textContent = typeof s.text === 'function' ? s.text() : s.text; row.className = 'tr-row';
    const mk = (label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.className = cls; b.onclick = fn; return b; };
    row.append(mk('Pular', 'tr-skip', () => end(true)));
    if (i > 0) row.append(mk('Voltar', 'tr-b', () => go(-1)));
    const nx = mk(i === list.length - 1 ? 'Concluir' : 'Próximo', 'tr-b tr-pri', () => (i === list.length - 1 ? end(true) : go(1))); row.append(nx);
    tip.append(n, t, p, row);
    s.el.scrollIntoView({ block: s.el.getBoundingClientRect().height > innerHeight * 0.45 ? 'start' : 'center', behavior: 'auto' });
    requestAnimationFrame(() => { place(); nx.focus({ preventScroll: true }); });
  };
  const go = d => { i = Math.min(list.length - 1, Math.max(0, i + d)); show(); };
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); end(true); } else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'Tab') { const f = [...tip.querySelectorAll('button')]; if (!f.length) return; const a = f.indexOf(document.activeElement); e.preventDefault(); f[(a + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); } };
  const re = () => place();
  function end(finished) {
    if (done) return; done = true; cur = null;
    removeEventListener('keydown', key, true); removeEventListener('resize', re); removeEventListener('scroll', re, true);
    block.remove(); hole.remove(); tip.remove(); try { opener?.focus?.({ preventScroll: true }); } catch { /* ok */ }
    onEnd?.(finished);
  }
  addEventListener('keydown', key, true); addEventListener('resize', re); addEventListener('scroll', re, true);
  cur = { end }; show(); return true;
}

const hasProj = () => !!document.querySelector('#plist li');
const isCaps = () => document.querySelector('#edit .edit') && !document.querySelector('#clips li');
export const HOME = [
  { sel: '#tpOpen', title: 'Gravar com teleprompter', text: 'Leia o roteiro olhando para a câmera e grave. Ao parar, a gravação abre direto no editor. Você tem uma gravação grátis; depois é do plano Pro.' },
  { sel: '#drop2', title: 'Legende seu vídeo', text: 'Envie um vídeo e receba a fala em legendas animadas, sem cortar nada. Você escolhe o estilo.' },
  { sel: '#drop', title: 'Cortes com IA', text: 'Envie um vídeo longo (podcast, aula, palestra). A IA acha os melhores momentos e já aplica as legendas.' },
  { sel: '#ytForm', title: 'Cortes do YouTube (Beta)', text: 'Cole o link de um vídeo do YouTube e veja os melhores trechos em mini players verticais. O vídeo continua no player oficial.' },
  { sel: '#gal', title: 'Estilos de legenda', text: 'Veja como cada estilo fica. Os com selo Pro são do plano pago.' },
  { sel: '#plist', when: hasProj, title: 'Seus projetos', text: 'Seus vídeos em andamento ficam aqui. No plano gratuito, os projetos são mantidos por 3 dias.' },
  { sel: '#nPro', title: 'Plano Pro', text: 'Todos os estilos, cortes por IA, teleprompter sem limite, vídeos até 1 GB e sem anúncios.' },
  { sel: '#nTour', title: 'Rever o tour', text: 'Este botão abre o tour de novo sempre que você quiser.' },
];
export const EDIT = [
  { sel: '#stage', title: 'Prévia do vídeo', text: 'Aqui você vê o vídeo com as legendas em tempo real. Toque para dar play e arraste a barra para navegar.' },
  { sel: '#ratio', title: 'Formato', text: 'Por padrão o vídeo mantém a proporção original. Escolha 9:16, 4:5, 1:1 ou 16:9 se for publicar em outra rede.' },
  { sel: '#tl', title: 'Linha do tempo', text: () => isCaps() ? 'Mostra as legendas ao longo do vídeo. Toque num ponto para ir até ele.' : 'Arraste as pontas do trecho para ajustar o começo e o fim. Os cortes sugeridos pela IA aparecem aqui.' },
  { sel: '#tabS', title: 'Estilo, Legendas e Ferramentas', text: 'Estilo muda a aparência. Legendas permite corrigir o texto e traduzir. Ferramentas reúne zoom, cortar pausas, B-roll, cor e áudio.' },
  { sel: '#presets', title: 'Escolha o estilo', text: 'Toque em um estilo para aplicar na hora. A prévia acima atualiza com a sua fala.' },
];
