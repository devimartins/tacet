// Assistente de ajuda (código próprio, sem custo): localiza funcionalidades, destaca o elemento na tela e faz um tour.
const $ = s => document.querySelector(s);
const norm = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const inEditor = () => !$('#edit').hidden;
const tab = id => { const b = $(id); if (b) b.click(); };

// Cada item: palavras-chave, rótulo, onde fica e o que fazer. editor:true exige um vídeo aberto.
const ITEMS = [
  { k: 'legenda caption transcrever transcricao falar texto', t: 'Adicionar legendas', home: ['#drop2', 'Escolha "Só legendas" e selecione o vídeo. A transcrição é automática.'], ed: ['#presets', 'Aqui você troca o estilo da legenda. Em "Legendas" você edita o texto.', '#tabS'] },
  { k: 'corte cortes clipe viral longo melhor momento ia', t: 'Cortar um vídeo longo com IA', home: ['#drop', 'Escolha "Cortes de vídeo longo": a IA sugere os melhores momentos.'], ed: ['#clips', 'Os cortes sugeridos aparecem aqui. Use "Gerar vídeo" para exportar cada um.', '#tabC'] },
  { k: 'estilo fonte cor tema legenda animada preset', t: 'Mudar o estilo da legenda', home: ['#gal', 'Escolha um estilo e depois envie o vídeo.'], ed: ['#presets', 'Clique num estilo; abaixo ficam fonte, cores, tamanho e posição.', '#tabS'] },
  { k: 'cinetica cinetico animada animacao bounce marca-texto preenchido tremor digitacao previa mouse', t: 'Legendas cinéticas e prévia', ed: ['#presets', 'Abra a categoria Cinético. Passe o mouse sobre um estilo para ver a legenda no seu vídeo; clique para aplicar.'], home: ['#gal', 'Os estilos da categoria Cinético têm animações palavra a palavra.'] },
  { k: 'silencio pausa vicio muleta ritmo', t: 'Remover silêncios', ed: ['#fxCut', 'Ative "Cortar pausas" para remover silêncios e vícios de fala.', '#tabC'] },
  { k: 'zoom enfase destaque', t: 'Zoom automático', ed: ['#fxZoom', 'Ative o zoom para dar ênfase nos momentos da fala.', '#tabC'] },
  { k: 'musica audio trilha som fundo', t: 'Música de fundo', ed: ['#musFile', 'Escolha um áudio e ajuste o volume. Ele é misturado ao exportar.', '#tabC'] },
  { k: 'emoji emojis carinha figurinha', t: 'Emojis nas legendas', ed: ['#fxZoom', 'Ative "Emojis nas legendas" para colocar emojis nas palavras-chave.', '#tabC'] },
  { k: 'ruido reduzir ruido chiado audio limpar som', t: 'Reduzir ruído', ed: ['#fxCut', 'Ative "Reduzir ruído" para cortar chiado e graves do áudio ao exportar.', '#tabC'] },
  { k: 'efeito sonoro sfx whoosh pop barulho', t: 'Efeitos sonoros', ed: ['#fxCut', 'Ative "Efeitos sonoros" para whoosh nas trocas de zoom e pop nos títulos.', '#tabC'] },
  { k: 'broll b-roll cena imagem fundo cobrir ilustrar', t: 'B-roll automático', ed: ['#ovBroll', 'A IA escolhe cenas e busca imagens livres (domínio público) para cobrir trechos do vídeo.', '#tabC'] },
  { k: 'audio extra locucao narracao voz efeito inserir', t: 'Áudios extras', ed: ['#audIn', 'Coloque uma locução ou efeito no ponto do vídeo que quiser.', '#tabC'] },
  { k: 'logo marca dagua watermark kit marca', t: 'Kit de marca (logo)', ed: ['#logoIn', 'Envie seu logo uma vez. Ele fica salvo e aparece em todos os cortes.', '#tabC'] },
  { k: 'titulo gancho hook imagem logo', t: 'Título de gancho e imagens', ed: ['#ovTitle', 'Crie um título de abertura ou coloque uma imagem sobre o vídeo.', '#tabC'] },
  { k: 'editar texto corrigir palavra transcricao', t: 'Corrigir o texto das legendas', ed: ['#tabT', 'Abra "Legendas" e edite as frases. O olho esconde uma frase.', '#tabT'] },
  { k: 'exportar baixar gerar salvar video mp4', t: 'Exportar o vídeo', ed: ['#clips', 'Clique em "Gerar vídeo" no corte desejado e depois em baixar.', '#tabC'] },
  { k: 'formato proporcao vertical quadrado 9:16 feed', t: 'Mudar o formato (9:16, 1:1…)', ed: ['#ratio', 'Escolha o formato do vídeo aqui.'] },
  { k: 'youtube link url', t: 'Usar um link do YouTube', home: ['#ytUrl', 'Cole o link, escolha o trecho e grave pelo player oficial (Chrome ou Edge no computador).'] },
  { k: 'projeto salvo abrir dias', t: 'Abrir meus projetos', home: ['#plist', 'Seus projetos ficam salvos por 3 dias no plano gratuito.'] },
  { k: 'plano pro preco assinar pagar pix cartao anuncio', t: 'Plano Pro e preços', home: ['#plan', 'R$ 19,90/mês nos 3 primeiros meses, depois R$ 29,90. PIX, débito ou crédito.'] },
  { k: 'tema claro escuro modo noturno', t: 'Trocar tema claro/escuro', any: ['#nTheme', 'Alterna entre o tema claro e o escuro.'] },
  { k: 'inicio home voltar', t: 'Voltar ao início', any: ['#nLogo', 'Clique no logo para voltar à tela inicial.'] },
];
const TOUR = [
  ['#drop', 'Comece aqui', 'Envie um vídeo longo para a IA achar os melhores cortes.'],
  ['#drop2', 'Só legendas', 'Prefere só legendar? Use este cartão.'],
  ['#ytUrl', 'Link do YouTube', 'Cole um link para usar um trecho de um vídeo.'],
  ['#plan', 'Plano Pro', 'Estilos completos, sem anúncios, pagamento por PIX ou cartão.'],
  ['#gal', 'Estilos de legenda', 'Escolha um visual antes de enviar o vídeo.'],
  ['#plist', 'Seus projetos', 'Tudo que você começou fica salvo por 3 dias.'],
  ['#nTheme', 'Tema', 'Alterne entre claro e escuro quando quiser.'],
];
const clickFx = (k, on) => document.querySelector(`button[data-k="${k}"][data-v="${on ? 1 : 0}"]`)?.click();
function commands(q) {   // frases como "ligar zoom", "tirar silêncios", "estilo neon" executam a ação direto
  const on = /\b(lig|ativ|us|colo|aplic|adicion|quer|bota)/.test(q), off = /\b(deslig|desativ|tir|remov|sem)/.test(q), out = [];
  if (/zoom/.test(q) && (on || off)) out.push([(off ? 'Desligar' : 'Ligar') + ' zoom automático', () => clickFx('zoom', !off)]);
  if (/emoji/.test(q) && (on || off)) out.push([(off ? 'Desligar' : 'Ligar') + ' emojis nas legendas', () => clickFx('emoji', !off)]);
  if (/(silenc|pausa)/.test(q) && (on || off)) out.push([(off ? 'Desligar' : 'Ligar') + ' remoção de silêncios', () => clickFx('cut', !off)]);
  if (/(estilo|preset|legenda)/.test(q) || on) [...document.querySelectorAll('#presets .gcard')].forEach(c => { const n = norm(c.querySelector('.gn')?.textContent || ''); if (n && new RegExp('\\b' + n + '\\b').test(q)) out.push(['Usar o estilo ' + c.querySelector('.gn').textContent, () => c.click()]); });
  return out;
}
let mark = null, bubble = null, timer = 0;
function clear() { clearTimeout(timer); mark?.remove(); bubble?.remove(); mark = bubble = null; }
function spot(sel, title, text, nav) {   // destaca um elemento e mostra uma dica ao lado
  clear(); const t = $(sel); if (!t || t.closest('[hidden]')) return false;
  t.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth' });
  setTimeout(() => {
    const r = t.getBoundingClientRect(); mark = document.createElement('div'); mark.className = 'g-mark';
    Object.assign(mark.style, { left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
    bubble = document.createElement('div'); bubble.className = 'g-tip'; bubble.setAttribute('role', 'status');
    bubble.innerHTML = (title ? '<b></b>' : '') + '<p></p><div class="g-row"></div>'; if (title) bubble.querySelector('b').textContent = title; bubble.querySelector('p').textContent = text;
    const row = bubble.querySelector('.g-row'); (nav || [['Entendi', clear, true]]).forEach(([l, f, pri]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (pri ? ' pri' : ''); b.textContent = l; b.onclick = f; row.append(b); });
    document.body.append(mark, bubble);
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight; let x = Math.min(innerWidth - bw - 12, Math.max(12, r.left)), y = r.bottom + 14; if (y + bh > innerHeight - 12) y = Math.max(12, r.top - bh - 14);
    Object.assign(bubble.style, { left: x + 'px', top: y + 'px' }); if (!nav) timer = setTimeout(clear, 9000);
  }, 380); return true;
}
export function initGuide({ home }) {
  const btn = document.createElement('button'); btn.id = 'bot'; btn.type = 'button'; btn.setAttribute('aria-label', 'Abrir ajuda'); btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg><span>Ajuda</span>';
  const panel = document.createElement('div'); panel.id = 'botp'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Assistente do ForjaClip');
  panel.innerHTML = '<div class="bh"><b>Assistente</b><button type="button" class="bx" aria-label="Fechar">✕</button></div><p class="bm"></p><input id="botq" type="search" placeholder="O que você quer fazer? Ex.: legenda, música, zoom" autocomplete="off" aria-label="Buscar funcionalidade"><ul id="botl"></ul><button type="button" class="btn" id="botTour">Fazer um tour rápido</button>';
  document.body.append(btn, panel);
  const list = $('#botl'), input = $('#botq'), msg = panel.querySelector('.bm');
  const close = () => { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  const open = () => { panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); render(); input.value = ''; setTimeout(() => input.focus(), 50); };
  function render() {
    const ed = inEditor(), q = norm(input.value.trim()); msg.textContent = ed ? 'Você está no editor. Pergunte onde fica algo ou escolha abaixo.' : 'Oi! Eu mostro onde fica cada recurso. O que você quer fazer?';
    list.replaceChildren(); if (q && inEditor()) commands(q).forEach(([t, f]) => { const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.className = 'cmd'; b.textContent = '▶ ' + t; b.onclick = () => { f(); close(); }; li.append(b); list.append(li); });
    const items = ITEMS.filter(i => !q || norm(i.k + ' ' + i.t).includes(q) || q.split(/\s+/).some(w => w.length > 2 && norm(i.k + ' ' + i.t).includes(w))); 
    items.slice(0, q ? 6 : 9).forEach(i => { const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.textContent = i.t; b.onclick = () => go(i); li.append(b); list.append(li); });
    if (!items.length) { const li = document.createElement('li'); li.className = 'bn'; li.textContent = 'Não achei isso. Tente "legenda", "corte", "música" ou "plano".'; list.append(li); }
  }
  async function go(i) {
    close(); const ed = inEditor(); let a = i.any || (ed ? i.ed : i.home);
    if (!a && ed && i.home) { await home(); a = i.home; }
    if (!a) { spot('#nNew', i.t, 'Esse recurso fica no editor. Primeiro escolha um vídeo (botão "Novo vídeo" ou os cartões da tela inicial).'); return; }
    if (ed && a[2]) tab(a[2]); spot(a[0], i.t, a[1]);
  }
  function tour(n = 0) {
    close(); if (inEditor()) { home().then(() => setTimeout(() => tour(n), 300)); return; }
    while (n < TOUR.length && !spot(...[TOUR[n][0], TOUR[n][1], TOUR[n][2], [['Pular', clear], ...(n ? [['Voltar', () => tour(n - 1)]] : []), [n < TOUR.length - 1 ? 'Próximo' : 'Concluir', () => (n < TOUR.length - 1 ? tour(n + 1) : (clear(), tourDone())), true]]])) n++;
  }
  const tourDone = () => { try { localStorage.setItem('forjaclip-tour', '1'); } catch { /* sem armazenamento */ } };
  btn.onclick = () => (panel.hidden ? open() : close()); panel.querySelector('.bx').onclick = close; $('#botTour').onclick = () => tour(0);
  input.oninput = render; input.onkeydown = e => { if (e.key === 'Enter') list.querySelector('button')?.click(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { close(); clear(); } });
  addEventListener('resize', clear);
  let seen = null; try { seen = localStorage.getItem('forjaclip-tour') || localStorage.getItem('tacet-tour'); } catch { /* sem armazenamento */ }
  if (!seen) setTimeout(() => { if (!$('#rail').hidden && panel.hidden && !$('#bot').dataset.nudged) { btn.dataset.nudged = 1; btn.classList.add('nudge'); } }, 4000);
}
