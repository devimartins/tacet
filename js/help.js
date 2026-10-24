// Botões "?" de ajuda: mostram uma explicação curta de um botão ou opção. Sem biblioteca.
const HELP = {
  trim: ['Cortar pausas das pontas', 'Cada corte costuma começar com um tempinho de silêncio e terminar com uma pausa. Este botão encurta o começo e o fim de todos os cortes para ficar só a fala. Dá para ajustar na linha do tempo depois.'],
  ratio: ['Formato do vídeo', '“Original do vídeo” mantém a proporção da gravação. 9:16 é vertical (Reels, TikTok, Shorts), 4:5 e 1:1 servem para feed e 16:9 é horizontal (YouTube).'],
  fit: ['Enquadramento', 'Define o que acontece quando o vídeo não tem a mesma proporção do formato. “Preencher o quadro” corta as bordas; “Inteiro, fundo desfocado” mostra tudo e desfoca as laterais.'],
  face: ['Seguir o rosto', 'Ao transformar um vídeo largo em vertical, o enquadramento acompanha o rosto em vez de ficar parado no centro. A análise acontece no seu aparelho. Recurso do plano Pro.'],
  bg: ['Trocar o fundo', 'Tira o fundo da sua gravação e coloca no lugar um cenário de estúdio ou uma imagem sua. Funciona melhor com boa luz e sem pessoas atrás de você. A exportação fica mais lenta.']
};
let pop = null;
const close = () => { pop?.remove(); pop = null; removeEventListener('keydown', onKey, true); removeEventListener('pointerdown', onDown, true); };
const onKey = e => { if (e.key === 'Escape') close(); };
const onDown = e => { if (pop && !pop.contains(e.target) && !e.target.closest('.hq')) close(); };
export function helpBtn(key) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'hq'; b.dataset.help = key; b.textContent = '?';
  b.setAttribute('aria-label', 'Ajuda: ' + (HELP[key]?.[0] || '')); return b;
}
function show(b) {
  const h = HELP[b.dataset.help]; if (!h) return; const same = pop && pop._b === b; close(); if (same) return;
  pop = document.createElement('div'); pop.className = 'hqp'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', h[0]); pop._b = b;
  const t = document.createElement('b'), p = document.createElement('p'), x = document.createElement('button');
  t.textContent = h[0]; p.textContent = h[1]; x.type = 'button'; x.className = 'btn'; x.textContent = 'Entendi'; x.onclick = () => { close(); b.focus(); };
  pop.append(t, p, x); document.body.append(pop);
  const r = b.getBoundingClientRect(), w = Math.min(300, innerWidth - 24); pop.style.width = w + 'px';
  const th = pop.offsetHeight; let top = r.bottom + 8; if (top + th > innerHeight - 12) top = Math.max(12, r.top - th - 8);
  pop.style.left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), innerWidth - w - 12) + 'px'; pop.style.top = top + 'px';
  addEventListener('keydown', onKey, true); addEventListener('pointerdown', onDown, true); x.focus({ preventScroll: true });
}
document.addEventListener('click', e => { const b = e.target.closest?.('.hq[data-help]'); if (b) { e.preventDefault(); e.stopPropagation(); show(b); } }, true);
addEventListener('scroll', () => close(), true);
