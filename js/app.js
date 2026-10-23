import { CATS, FONTS, fontsUrl, loadFont, PRESETS, PLATFORMS, DEFAULT_STYLE, resolve, chunksOf, drawCaption, safeRect, outsideSafe } from './captions.js';
import { openMedia, extractAudio } from './media.js';
import { useBlur, renderClip } from './render.js';
import { silences, zoomAt, autoCuts, cutRanges } from './edit.js';
import { suggestClips, localClips, cutsWanted } from './clips.js?v=2';
import { retime, tokens, fromWhisper, fixCase } from './transcript.js?v=2';
import { ICONS } from './icons.js';
import { drawOverlays, drawBroll, hookTitle } from './overlays.js';
import { findBroll } from './broll.js';
import { ytId, ytStart, ytSupported, mountPlayer, record, flatten } from './yt.js';
import { initGuide } from './guide.js';
import { trackFaces, trackAt } from './facetrack.js';
import { avatarSvg, parseAv, AV_COUNT, BG_COUNT } from './avatar.js';
import { assist, translateWords, toLines } from './ai.js';
import { addEmojis } from './extras.js';
import { detectTone, TONES } from './musicgen.js';

const $ = s => document.querySelector(s), CFG = window.CFG || {};
const LIVE = !!(CFG.AI && CFG.SB_URL && CFG.SB_ANON && window.supabase);
const MB = 1024 ** 2, LIMIT = { free: 350 * MB, pro: 1024 * MB }, SAMPLE = 'o segredo não é trabalhar mais horas. é escolher melhor onde colocar a sua energia todos os dias.';
const el = (t, a = {}, ...c) => { const e = document.createElement(t); Object.assign(e, a); c.forEach(x => e.append(x)); return e; };
const mmss = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } } };
// Retoma o trabalho após recarregar: guarda o id do projeto e o arquivo de vídeo (IndexedDB) neste aparelho.
const vstore = (() => {
  const open = () => new Promise((ok, no) => { const r = indexedDB.open('forjaclip', 1); r.onupgradeneeded = () => r.result.createObjectStore('v'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  const run = async (mode, fn) => { try { const db = await open(); return await new Promise(ok => { const q = fn(db.transaction('v', mode).objectStore('v')); q.onsuccess = () => ok(q.result); q.onerror = () => ok(null); }); } catch { return null; } };
  return { put: (pid, file) => run('readwrite', st => st.put({ pid, file }, 'cur')), get: () => run('readonly', st => st.get('cur')), del: () => run('readwrite', st => st.delete('cur')) };
})();
const keep = pid => { if (pid) ls.set('forjaclip.cur', pid); };
const forget = () => { try { localStorage.removeItem('forjaclip.cur'); } catch { /* ok */ } vstore.del(); };
const S = { ov: [], sb: null, user: null, plan: 'free', pid: null, title: '', file: null, media: null, words: [], dur: 8, clips: [], style: structuredClone(DEFAULT_STYLE), chunks: [], safeOn: false, safeP: 'all', prev: null, busy: false, box: null, cur: 0, playing: false, bbox: null };
let EG = null, HG = null;
S.fx = { cut: 0, zoom: 0 }; S.hid = new Set(); S.ratio = '9:16'; S.mode = 'clips';
const DIMS = { '9:16': [1080, 1920], '4:5': [1080, 1350], '1:1': [1080, 1080], '16:9': [1920, 1080] };
const canPro = () => !CFG.GATE || S.plan === 'pro';
const flash = (m, cta) => { const f = $('#flash'); f.textContent = m; if (cta) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = cta.label; b.style.marginLeft = '10px'; b.onclick = () => { f.hidden = true; cta.fn(); }; f.append(b); } f.hidden = false; clearTimeout(flash.t); flash.t = setTimeout(() => { f.hidden = true; }, 6000); };

// ---------- tema ----------
function theme(t) { if (t) { document.documentElement.dataset.theme = t; ls.set('theme', t); } const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches; $('#themeLbl').textContent = dark ? 'Tema claro' : 'Tema escuro'; if (t) { document.querySelectorAll('meta[name=theme-color]').forEach(m => m.remove()); const m = document.createElement('meta'); m.name = 'theme-color'; m.content = dark ? '#0f0a08' : '#fbf6f1'; document.head.append(m); } return dark; }
$('#nTheme').onclick = () => theme(theme() ? 'light' : 'dark');
if (ls.get('theme')) document.documentElement.dataset.theme = ls.get('theme');
theme();

// ---------- navegação ----------
function view(v) { for (const id of ['login', 'home', 'edit']) $('#' + id).hidden = id !== v; $('#rail').hidden = v === 'login'; $('#nHome').setAttribute('aria-current', v === 'home' ? 'page' : 'false'); window.scrollTo(0, 0); }
$('#nHome').onclick = () => home();
$('#nLogo').onclick = e => { e.preventDefault(); home(); };
$('#nNew').onclick = () => { if (!$('#home').hidden) $('#newfile').click(); else home().then(() => $('#newfile').click()); };
$('#nOut').onclick = async () => { if (S.sb) { await S.sb.auth.signOut(); } else flash('Modo demonstração: não há sessão.'); };

// ---------- login ----------
const PROVIDERS = [['google', 'Google', 'google'], ['apple', 'Apple', 'apple'], ['github', 'GitHub', 'github'], ['azure', 'Microsoft', 'microsoft']];
for (const [id, name, ic] of PROVIDERS.filter(p => !CFG.PROVIDERS || CFG.PROVIDERS.includes(p[0]))) {
  const b = el('button', { type: 'button', className: 'btn', onclick: async () => {
    $('#lmsg').textContent = '';
    const { error } = await S.sb.auth.signInWithOAuth({ provider: id, options: { redirectTo: location.origin + location.pathname } });
    if (error) $('#lmsg').textContent = /provider|not enabled|unsupported/i.test(error.message) ? 'O login com ' + name + ' ainda está sendo ativado. Use outra opção por enquanto.' : 'Não foi possível entrar com ' + name + ': ' + error.message;
  } });
  b.innerHTML = ICONS[ic]; b.append(el('span', { textContent: 'Continuar com ' + name })); $('#prov').append(b);
}

// login por e-mail (link mágico, sem senha)
{
  const f = el('form', { className: 'em', noValidate: true });
  f.innerHTML = '<div class="or"><span>ou</span></div><label class="sr" for="lemail">E-mail</label><input id="lemail" type="email" inputmode="email" autocomplete="email" placeholder="seu@email.com" required><div id="cft" class="cft"></div><button type="submit" class="btn pri">Entrar com e-mail</button>';
  let tk = '', wid = null;
  if (CFG.TURNSTILE) {
    window.__tsLoad = () => { wid = window.turnstile.render('#cft', { sitekey: CFG.TURNSTILE, callback: t => { tk = t; }, 'expired-callback': () => { tk = ''; }, 'error-callback': () => { tk = ''; }, language: 'pt-br' }); };
    document.head.append(el('script', { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__tsLoad', async: true, defer: true }));
  }
  f.onsubmit = async e => {
    e.preventDefault(); const em = f.querySelector('input').value.trim(), msg = $('#lmsg'); msg.className = 'warn';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { msg.textContent = 'Digite um e-mail válido.'; return; }
    if (!S.sb) { msg.textContent = 'Login indisponível no modo demonstração.'; return; }
    if (CFG.TURNSTILE && !tk) { msg.textContent = 'Aguarde a verificação de segurança e tente de novo.'; return; }
    const btn = f.querySelector('button'); btn.disabled = true; msg.textContent = 'Enviando…';
    const { error } = await S.sb.auth.signInWithOtp({ email: em, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true, ...(CFG.TURNSTILE ? { captchaToken: tk } : {}) } });
    btn.disabled = false;
    if (CFG.TURNSTILE && window.turnstile && wid !== null) { tk = ''; window.turnstile.reset(wid); }
    if (error) { msg.textContent = /rate|limit/i.test(error.message) ? 'Muitos pedidos agora. Tente de novo em alguns minutos.' : 'Não foi possível enviar o link: ' + error.message; return; }
    msg.className = 'ok'; msg.textContent = 'Enviamos um link de acesso para ' + em + '. Abra o e-mail neste aparelho (veja também o spam).';
  };
  $('#prov').after(f);
}

// ---------- projetos ----------
async function home() {
  view('home'); S.pid = null; stopPlay(); forget();
  if (!LIVE) { $('#plist').replaceChildren(); $('#pempty').hidden = false; $('#pempty').textContent = 'Modo demonstração: os projetos não são salvos.'; return; }
  const { data, error } = await S.sb.from('projects').select('id,title,duration,expires_at,created_at').order('created_at', { ascending: false });
  if (error) { flash('Não foi possível listar os projetos: ' + error.message); return; }
  PJ.mode = false; PJ.sel.clear(); const ul = $('#plist'); ul.replaceChildren(); $('#pempty').hidden = data.length > 0; $('#pempty').textContent = 'Nenhum projeto ainda.';
  for (const [i, p] of data.entries()) {
    const days = Math.max(0, Math.ceil((new Date(p.expires_at) - Date.now()) / 864e5));
    const th = ls.get('th_' + p.id);
    const ico = el('span', { className: 'pic' }); ico.innerHTML = '<svg viewBox="0 0 64 64" width="26" height="26" aria-hidden="true"><use href="#fc-mark"/></svg>';
    const cb = el('input', { type: 'checkbox', className: 'psel', hidden: true }); cb.setAttribute('aria-label', 'Selecionar ' + (p.title || 'projeto')); cb.onchange = () => pjToggle(p.id, cb.checked);
    const li = el('li', { className: 'item pj' }, cb, ...(th ? [el('img', { className: 'th', src: th, alt: '' })] : [ico]),
      el('div', { className: 'grow' }, el('b', { textContent: p.title || 'Sem título' }), el('div', { className: 'mut pm' }, el('span', { textContent: p.duration ? mmss(p.duration) : 'Projeto' }), el('span', { className: 'exp' + (days <= 1 ? ' soon' : ''), textContent: 'expira em ' + days + (days === 1 ? ' dia' : ' dias') }))),
      el('div', { className: 'pa' },
        el('button', { className: 'btn pri', textContent: 'Abrir', onclick: () => openProject(p.id) }),
        el('button', { className: 'btn', textContent: 'Excluir', onclick: () => { if (PJ.mode) pjToggle(p.id, !PJ.sel.has(p.id)); else { PJ.mode = true; PJ.sel = new Set([p.id]); pjSel(); } } })),
      el('span', { className: 'pn', ariaHidden: 'true', textContent: String(i + 1).padStart(2, '0') }));
    li.dataset.id = p.id; li.onclick = e => { if (PJ.mode && !e.target.closest('button,input,a')) pjToggle(p.id, !PJ.sel.has(p.id)); }; ul.append(li);
  }
  pjSel(); ads();
}
// lista de projetos: recolhida (3 primeiros), abre ao passar o mouse; seleção em massa para excluir
const PJ = { sel: new Set(), mode: false, open: false, pin: false };
function pjFit() {
  const ul = $('#plist'), w = $('#pwrap'), n = ul.children.length, more = n > 3, open = PJ.open || PJ.mode || PJ.pin;
  w.classList.toggle('open', open); w.classList.toggle('fade', more && !open);
  let h = ul.scrollHeight; if (more && !open) { const l = ul.children[2]; h = l.offsetTop + l.offsetHeight + 2; }
  ul.style.maxHeight = n ? h + 'px' : '';
  const b = $('#pmore'); b.hidden = !more; b.textContent = open ? 'Mostrar menos' : 'Ver todos (' + n + ')'; b.setAttribute('aria-expanded', String(open));
}
function pjSel() {
  const items = [...document.querySelectorAll('#plist .pj')], ids = items.map(li => li.dataset.id);
  items.forEach(li => { const on = PJ.sel.has(li.dataset.id), cb = li.querySelector('.psel'); li.classList.toggle('sel', on); cb.checked = on; cb.hidden = !PJ.mode; });
  $('#pwrap').classList.toggle('selmode', PJ.mode); $('#pbar').hidden = !PJ.mode;
  const all = ids.length > 0 && ids.every(i => PJ.sel.has(i)), b = $('#pall');
  b.setAttribute('aria-pressed', String(all)); b.textContent = all ? 'Desmarcar todos' : 'Selecionar todos';
  $('#pcount').textContent = PJ.sel.size + ' de ' + ids.length + ' selecionados'; $('#pdel').disabled = !PJ.sel.size; pjFit();
}
function pjToggle(id, on) { on ? PJ.sel.add(id) : PJ.sel.delete(id); pjSel(); }
function pjCancel() { PJ.mode = false; PJ.sel.clear(); pjSel(); }
$('#pall').onclick = () => { const ids = [...document.querySelectorAll('#plist .pj')].map(li => li.dataset.id); if (ids.every(i => PJ.sel.has(i))) PJ.sel.clear(); else ids.forEach(i => PJ.sel.add(i)); pjSel(); };
$('#pcancel').onclick = pjCancel;
$('#pdel').onclick = async () => {
  const ids = [...PJ.sel]; if (!ids.length) return;
  if (!confirm(ids.length === 1 ? 'Excluir este projeto? Isso não pode ser desfeito.' : 'Excluir ' + ids.length + ' projetos? Isso não pode ser desfeito.')) return;
  $('#pdel').disabled = true; const r = await S.sb.from('projects').delete().in('id', ids);
  if (r.error) { flash(r.error.message); pjSel(); return; }
  flash(ids.length === 1 ? 'Projeto excluído.' : ids.length + ' projetos excluídos.'); home();
};
$('#pmore').onclick = () => { PJ.pin = !PJ.pin; if (!PJ.pin) PJ.open = false; pjFit(); };
{ const w = $('#pwrap'), canHover = matchMedia('(hover:hover)').matches;
  if (canHover) { w.onmouseenter = () => { PJ.open = true; pjFit(); }; w.onmouseleave = () => { PJ.open = false; pjFit(); }; }
  w.addEventListener('focusin', () => { PJ.open = true; pjFit(); }); w.addEventListener('focusout', e => { if (!w.contains(e.relatedTarget)) { PJ.open = false; pjFit(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && PJ.mode && !document.querySelector('dialog[open]')) pjCancel(); }); }
const adConsent = () => { try { return (localStorage.getItem('forjaclip-ads') || localStorage.getItem('tacet-ads')); } catch { return null; } };
function adBanner() {   // LGPD: pergunta antes de carregar qualquer anúncio (só o plano gratuito vê)
  if (document.getElementById('adc')) return;
  const set = v => { try { localStorage.setItem('forjaclip-ads', v); } catch { /* sem armazenamento */ } b.remove(); if (v === 'ok') ads(); };
  const b = el('div', { id: 'adc' }, el('span', { textContent: 'O plano gratuito é mantido por anúncios, que podem usar cookies para exibir propagandas. Aceitar? Recusando, você usa o ForjaClip sem anúncios personalizados.' }),
    el('button', { className: 'btn', textContent: 'Recusar', onclick: () => set('no') }), el('button', { className: 'btn pri', textContent: 'Aceitar', onclick: () => set('ok') }));
  b.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:50;display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px;border-radius:12px;background:#1b1b22;color:#fff;font-size:13px;box-shadow:0 4px 20px #0008';
  document.body.append(b);
}
function ads() {   // anúncios só no plano gratuito, com ID do AdSense configurado e consentimento
  const box = $('#ad'); if (!CFG.ADS_CLIENT || !CFG.ADS_SLOT || S.plan === 'pro' || box.dataset.on) return;
  const c = adConsent(); if (c === 'no') return; if (c !== 'ok') { adBanner(); return; }
  box.dataset.on = '1'; box.hidden = false;
  const s = el('script', { async: true, src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(CFG.ADS_CLIENT), crossOrigin: 'anonymous' });
  const ins = el('ins', { className: 'adsbygoogle' }); ins.style.display = 'block'; Object.assign(ins.dataset, { adClient: CFG.ADS_CLIENT, adSlot: CFG.ADS_SLOT, adFormat: 'auto', fullWidthResponsive: 'true' });
  box.append(s, ins); s.onload = () => { try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* bloqueado */ } };
}
const fp = f => `${f.name}|${f.size}|${f.lastModified}`;
async function newVideo(f, mode = 'clips') {
  if (!f) return; S.mode = mode;
  const pro = S.plan === 'pro', max = S.isAdmin ? Infinity : pro ? LIMIT.pro : LIMIT.free, mb = Math.round(f.size / MB);
  if (f.size > max) { flash(pro ? `Este vídeo tem ${mb} MB e o limite do Pro é 1 GB. Tente comprimir o vídeo antes de enviar.` : `Este vídeo tem ${mb} MB. O plano gratuito aceita até 350 MB. Com o Pro você envia até 1 GB, ou pode comprimir o vídeo antes.`, { label: 'Ver Pro', fn: () => $('#nPro').onclick && $('#nPro').onclick() }); return; }
  if (/iPhone|iPad/.test(navigator.userAgent) && f.size > 500 * MB) flash('Vídeo grande para o iPhone (' + mb + ' MB). Se travar, tente no computador ou use um trecho menor.');
  let media; try { media = await openMedia(f); } catch (e) { flash(e.message); return; }
  S.file = f; S.media = media; S.title = f.name; S.words = []; S.clips = []; S.dur = media.duration; S.style = { ...structuredClone(DEFAULT_STYLE), preset: S.homePreset || 'iman' }; S.fx = { cut: 0, zoom: 0 }; S.track = null; S.faceOn = false; S.tone = 'auto'; $('#toneSel').value = 'auto'; S.hid = new Set(); S.ratio = '9:16'; S.ov = [];
  if (LIVE) {
    const { data, error } = await S.sb.from('projects').insert({ title: f.name, fingerprint: fp(f), duration: media.duration, style: S.style }).select('id').single();
    if (error) { flash('Não foi possível criar o projeto: ' + error.message); return; }
    S.pid = data.id; keep(S.pid); vstore.put(S.pid, f);
  } else S.pid = null;
  enterEdit(); setVideo(f); rebuild(); sync();
  if (S.ytRef && Date.now() - S.ytRef.t < 3600e3 && media.duration && Math.abs(media.duration - S.ytRef.dur) / S.ytRef.dur > 0.03) flash('Atenção: este arquivo tem ' + tfmt(media.duration) + ' e o vídeo do link tem ' + tfmt(S.ytRef.dur) + '. Confira se é o mesmo vídeo, senão os trechos sugeridos não vão bater.');
  S.ytRef = null;
  pipeline();
}
async function openProject(id) {
  const { data: p, error } = await S.sb.from('projects').select('*').eq('id', id).single();
  if (error) { flash('Não foi possível abrir: ' + error.message); return; }
  S.pid = id; keep(id); S.file = null; S.media = null; S.title = p.title || ''; S.dur = p.duration || 8; S.words = p.transcript?.words || []; S.clips = (p.clips || []).map(c => ({ ...c }));
  S.style = { ...structuredClone(DEFAULT_STYLE), ...(p.style || {}) }; if (!PRESETS[S.style.preset]) S.style.preset = 'iman'; S.fp = p.fingerprint; S.fx = { cut: 0, zoom: 0, ...(p.style?.fx || {}) }; S.track = null; S.faceOn = false; S.tone = p.style?.tone || 'auto'; $('#toneSel').value = S.tone; S.ratio = p.style?.ratio || '9:16'; S.hid = new Set(p.style?.hid || []);
  enterEdit(); rebuild(); sync(); clipsUI(); $('#txt').value = S.words.map(w => w.w).join(' ');
  $('#phTxt').textContent = 'Selecione de novo o vídeo deste projeto para pré-visualizar e gerar.';
  status(S.words.length ? 'Projeto carregado. A transcrição e os cortes estão salvos.' : 'Este projeto ainda não tem transcrição. Selecione o vídeo para continuar.');
}
$('#newfile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; newVideo(f, 'clips'); };
$('#newfile2').onchange = e => { const f = e.target.files[0]; e.target.value = ''; newVideo(f, 'captions'); };
if (!ytSupported()) { const f = $('#ytForm'); f.querySelector('label').textContent = 'Link do YouTube (disponível só no computador)'; $('#ytUrl').disabled = true; $('#ytUrl').placeholder = 'Abra no Chrome ou Edge do computador'; f.querySelector('button').disabled = true; $('#ytMsg').textContent = 'Celulares e o Safari não permitem gravar a aba do navegador. Aqui, use o arquivo do vídeo: no iPhone, grave a tela (Central de Controle) ou salve o vídeo na Galeria e envie em “Novo vídeo”. Se o vídeo é seu, o YouTube Studio tem a opção de baixar o arquivo original (Conteúdo › ⋮ › Baixar).'; }
// tempo digitado como 1759, 29:19 ou 1:02:03 (também aceita 29m19s) -> segundos
const tsec = v => { v = String(v || '').trim().toLowerCase(); if (!v) return 0; const hms = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(v); if (hms && /[hms]/.test(v)) return (+hms[1] || 0) * 3600 + (+hms[2] || 0) * 60 + (+hms[3] || 0); const p = v.split(':').map(Number); if (p.some(n => !Number.isFinite(n) || n < 0) || p.length > 3) return 0; return p.reduce((t, n) => t * 60 + n, 0); };
const tfmt = t => { t = Math.max(0, Math.round(t)); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
// Registro da declaração de direitos (quem aceitou, quando e sobre qual vídeo). Falha de rede não bloqueia o uso.
async function logRights(kind, ref, s, e) { try { if (!S.sb || !S.user) return; await S.sb.from('rights_log').insert({ kind, video_ref: ref, start_s: s, end_s: e, termo: 'v1', ua: navigator.userAgent.slice(0, 200) }); } catch { /* sem registro */ } }
$('#ytForm').onsubmit = async e => {
  e.preventDefault(); const id = ytId($('#ytUrl').value.trim()), m = $('#ytMsg'), say = (t, bad) => { m.textContent = t; m.style.color = bad ? '#ff6a6a' : ''; m.style.fontWeight = bad ? '600' : ''; };
  if (!id) { say('Cole um link do YouTube válido (youtube.com ou youtu.be).', 1); return; }
  if (!ytSupported()) { say('Gravar do YouTube funciona no Chrome ou Edge no computador. No celular ou no Safari, envie o arquivo do vídeo.', 1); return; }
  const btn = e.submitter || $('#ytForm button'); btn.disabled = true; say('Abrindo o vídeo no player oficial do YouTube…');
  try {
    const box = $('#ytbox'), player = await mountPlayer(box, id); say('');
    const st = $('#ytSt'), bar = $('#ytBar'), step = (t, v) => { st.textContent = t; if (v == null) bar.hidden = true; else { bar.hidden = false; bar.value = v; } };
    $('#ytd').showModal(); $('#ytOk').checked = false; $('#ytS').value = tfmt(ytStart($('#ytUrl').value) || 0); { const o = $('#ytOpen'), up = () => { o.href = 'https://youtu.be/' + id + '?t=' + (Math.floor(tsec($('#ytS').value)) || 0); }; up(); $('#ytS').oninput = up; } let pv = 0; const stopPv = () => { clearInterval(pv); pv = 0; }; $('#ytPrev').onclick = () => { stopPv(); const s0 = tsec($('#ytS').value) || 0, e0 = tsec($('#ytE').value) || 0; try { player.seekTo(s0, true); player.playVideo(); } catch { return; } pv = setInterval(() => { try { if (e0 && player.getCurrentTime() >= e0) { player.pauseVideo(); stopPv(); } } catch { stopPv(); } }, 250); }; box._stopPv = stopPv; const dur0 = Math.floor(player.getDuration() || 0); S.ytRef = dur0 ? { dur: dur0, t: Date.now() } : null; $('#ytFile').onclick = () => { $('#ytX').onclick(); $('#newfile').click(); }; const st0 = tsec($('#ytS').value) || 0; $('#ytE').value = tfmt(dur0 ? Math.min(dur0, st0 + 600) : st0 + 600); const est = () => { const len = Math.max(0, (tsec($('#ytE').value) || dur0) - (tsec($('#ytS').value) || 0)), m = Math.ceil(len / 60), e = $('#ytEst'); e.textContent = 'A gravação acontece em tempo real: este trecho leva cerca de ' + (m < 1 ? 'menos de 1 minuto' : m + (m === 1 ? ' minuto' : ' minutos')) + '.' + (len > 1200 ? ' É longo. Para vídeos longos, escolha só o trecho que interessa ou envie o arquivo do vídeo (do YouTube Studio, se for seu canal).' : ''); e.style.color = len > 1200 ? '#ffb454' : ''; }; $('#ytS').addEventListener('input', est); $('#ytE').addEventListener('input', est); const fix = () => { if (dur0) { if (tsec($('#ytE').value) > dur0) $('#ytE').value = tfmt(dur0); if (tsec($('#ytS').value) >= dur0) $('#ytS').value = tfmt(Math.max(0, dur0 - 60)); } est(); }; $('#ytS').addEventListener('change', fix); $('#ytE').addEventListener('change', fix); est(); $('#ytRec').disabled = false; $('#ytStop').hidden = true;
    step('Passo 1: escolha o trecho. Passo 2: marque que tem os direitos. Passo 3: clique em “Gravar e transcrever” e, na janela do navegador, escolha ESTA ABA e marque “Compartilhar áudio”.', null);
    $('#ytX').onclick = () => { box._stopPv?.(); try { player.destroy(); } catch {} $('#ytd').close(); };
    $('#ytStop').onclick = () => box._stop?.();
    $('#ytRec').onclick = async () => {
      if (!$('#ytOk').checked) { step('Marque a caixa de direitos sobre o vídeo para continuar.', null); return; }
      logRights('youtube', id, tsec($('#ytS').value) || 0, tsec($('#ytE').value) || 0);
      $('#ytRec').disabled = true; $('#ytStop').hidden = false; step('Aguardando você escolher “Esta aba” e ativar o áudio na janela do navegador…', 0);
      try {
        const f = await record(player, box, { start: tsec($('#ytS').value) || 0, end: tsec($('#ytE').value) || 0, onStatus: (a, b2) => step(`Gravando o trecho… ${mmss(a)} / ${mmss(b2)} — não feche nem troque de aba.`, b2 ? a / b2 : 0) });
        step('Gravação concluída. Preparando o vídeo…', null); $('#ytStop').hidden = true;
        const flat = await flatten(f); $('#ytd').close(); try { player.destroy(); } catch {} flash('Trecho do YouTube gravado. Abrindo no editor…'); await newVideo(flat, 'clips');
      } catch (err) { step((err && err.message) || 'Falha na gravação. Tente de novo.', null); $('#ytRec').disabled = false; $('#ytStop').hidden = true; return; }
    };
  } catch (err) { say((err && err.message) || 'Não foi possível abrir o vídeo.', 1); }
  btn.disabled = false;
};

$('#tpOpen').onclick = async () => { if (!canPro()) { $('#pay').showModal(); return; } const m = await import('./teleprompter.js?v=9');
  const ai = LIVE && S.user ? {
    script: async body => { const r = await fetch(CFG.AI + '/script', { method: 'POST', headers: { authorization: 'Bearer ' + await token(), 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Falha na IA (' + r.status + ').'); return j; },
    transcribe: async wav => { const r = await fetch(CFG.AI + '/transcribe?lang=pt', { method: 'POST', headers: { authorization: 'Bearer ' + await token(), 'content-type': 'audio/wav' }, body: wav }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Falha na transcrição (' + r.status + ').'); return j.text || ''; },
  } : null;
  m.openTeleprompter({ flash, ai, onUse: f => { S.autoEdit = true; newVideo(f, 'captions'); } }); };
$('#drop').ondragover = e => { e.preventDefault(); $('#drop').classList.add('on'); }; $('#drop').ondragleave = () => $('#drop').classList.remove('on');
$('#drop').ondrop = e => { e.preventDefault(); $('#drop').classList.remove('on'); newVideo(e.dataTransfer.files[0], 'clips'); };
$('#drop2').ondragover = e => { e.preventDefault(); $('#drop2').classList.add('on'); }; $('#drop2').ondragleave = () => $('#drop2').classList.remove('on');
$('#drop2').ondrop = e => { e.preventDefault(); $('#drop2').classList.remove('on'); newVideo(e.dataTransfer.files[0], 'captions'); };
async function attachFile(f) {
  let media; try { media = await openMedia(f); } catch (er) { flash(er.message); return false; }
  if (S.pid && Math.abs(media.duration - S.dur) > 1.5) { flash('Este arquivo tem duração diferente do projeto. Escolha o mesmo vídeo.'); return false; }
  S.file = f; S.media = media; if (!S.words.length) { S.dur = media.duration; pipeline(); } setVideo(f); if (S.pid) vstore.put(S.pid, f); return true;
}
$('#attach').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) attachFile(f); };
// ao carregar: volta ao projeto aberto (e ao vídeo, se foi guardado) em vez da tela inicial
async function resume() {
  const pid = ls.get('forjaclip.cur'); if (!pid || !LIVE) { home(); return; }
  await openProject(pid);
  if (S.pid !== pid) { home(); return; }
  const r = await vstore.get(); if (r && r.pid === pid && r.file) { await attachFile(r.file); }
}

// ---------- transcrição automática e cortes ----------
async function token() { const { data } = await S.sb.auth.getSession(); return data.session?.access_token; }
async function ai(path, body, type) {
  for (let t = 0; ; t++) {
    const r = await fetch(CFG.AI + path, { method: 'POST', headers: { authorization: 'Bearer ' + await token(), ...(type ? { 'content-type': type } : {}) }, body });
    if (r.ok) return r.json();
    const j = await r.json().catch(() => ({})), ra = Number(r.headers.get('retry-after'));
    if (r.status === 429 && ra > 0 && t < 3) { status('Serviço ocupado. Tentando de novo em ' + Math.min(ra, 60) + ' s…'); await sleep(Math.min(ra, 60) * 1000); continue; }
    const e = new Error(j.error || 'Erro ' + r.status); e.status = r.status; e.code = j.code; e.fatal = [401, 402, 413, 429].includes(r.status); throw e;
  }
}
const prog = p => { const b = $('#pg'); b.hidden = p == null; if (p != null) b.value = p; };
const status = m => { $('#status').textContent = m; };
async function pipeline() {
  if (S.busy) return; S.busy = true; $('#txt').readOnly = true;
  try {
    const parts = Math.max(1, Math.ceil(S.media.duration / 600)); let n = 0, words = [];
    status('Lendo o áudio do vídeo…'); prog(0);
    await extractAudio(S.file, S.media, 600, async (blob, off) => {
      n++; status(`Transcrevendo automaticamente (parte ${n} de ${parts})…`);
      words = words.concat(await part(blob, off));
    }, p => prog(p));
    if (!words.length) throw new Error('Não encontrei fala neste vídeo.');
    words = fixCase(words); S.words = words; $('#txt').value = words.map(w => w.w).join(' '); rebuild();
    await save({ transcript: { words }, duration: S.media.duration });
    if (S.mode === 'captions') { S.clips = [{ id: 'full', start: 0, end: S.media.duration, title: 'Vídeo completo', reason: '' }]; await save({ clips: S.clips }); clipsUI(); status(S.media.duration > 120 ? 'Transcrição pronta. A exportação no navegador vai até 2 minutos: crie cortes de até 2 min na aba Ferramentas.' : 'Transcrição pronta. Escolha o estilo e exporte na aba Ferramentas.'); if (S.autoEdit) { S.autoEdit = false; if (canPro() && aeVertical()) $('#aeD').showModal(); } return; }
    const fill = (cl = []) => { const w = cutsWanted(S.media.duration); let all = cl.slice(); if (all.length < w) all = all.concat(localClips(words, S.media.duration, all, w - all.length).map((c, k) => ({ ...c, id: 'l' + (k + 1) }))); return all.sort((x, y) => x.start - y.start); };
    if (!LIVE) { S.clips = fill(); await save({ clips: S.clips }); clipsUI(); status('Transcrição pronta. ' + S.clips.length + ' trechos relevantes separados para você decidir.'); return; }
    status('Transcrição pronta. Procurando os melhores cortes…'); prog(0);
    try { const cl = await suggestClips(words, S.media.duration, async lines => (await ai('/clips', JSON.stringify({ lines }), 'application/json')).clips, p => prog(p)); S.clips = fill(cl); await save({ clips: S.clips }); clipsUI(); status(S.clips.length ? 'Pronto: transcrição e ' + S.clips.length + (S.clips.length === 1 ? ' corte sugerido.' : ' cortes sugeridos.') + (cl.length < S.clips.length ? ' Alguns são seleção automática.' : '') : 'Transcrição pronta. Não achei trechos; crie um corte manual.'); }
    catch (e) { S.clips = fill(); await save({ clips: S.clips }); clipsUI(); status(e.code === 'paid' ? 'Transcrição pronta. Separei trechos relevantes; a seleção por IA faz parte do plano pago.' : 'Transcrição pronta. A IA falhou (' + e.message + '); separei trechos relevantes automaticamente.'); }
  } catch (e) { status('Não foi possível transcrever: ' + (/fetch|network|import/i.test(e.message) && !LIVE ? 'o download do modelo de voz foi bloqueado neste ambiente (a prévia do Claude não permite). Publique o app (GitHub Pages) ou conecte o Worker.' : e.message)); }
  finally { prog(null); S.busy = false; $('#txt').readOnly = false; if (S.mode === 'clips' && S.words.length && !$('#edit').hidden) { tab('clips'); if (S.clips.length && S.file) cutsOpen(); } }
}
// Transcrição no próprio aparelho (Whisper via transformers.js): funciona sem servidor e sem conta.
let ASR = null;
async function localAsr() {
  if (ASR) return ASR;
  status('Baixando o modelo de voz (só na primeira vez, cerca de 80 MB)…');
  const T = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2');
  T.env.allowLocalModels = false;
  let gpu = null; try { gpu = navigator.gpu && await navigator.gpu.requestAdapter(); } catch { /* sem WebGPU */ }
  if (!gpu) T.env.backends.onnx.wasm.proxy = true;
  ASR = await T.pipeline('automatic-speech-recognition', 'onnx-community/whisper-base_timestamped', { device: gpu ? 'webgpu' : 'wasm', ...(gpu ? {} : { dtype: 'q8' }), progress_callback: p => { if (p.status === 'progress' && p.progress != null) { prog(p.progress / 100); status('Baixando o modelo de voz… ' + Math.round(p.progress) + '%'); } } });
  return ASR;
}
async function localPart(blob, off) {
  const asr = await localAsr(), buf = await blob.arrayBuffer(), i16 = new Int16Array(buf, 44, (buf.byteLength - 44) >> 1), f = new Float32Array(i16.length);
  for (let i = 0; i < f.length; i++) f[i] = i16[i] / 32768;
  status('Transcrevendo no seu aparelho… isso pode levar alguns minutos.'); prog(null);
  const r = await asr(f, { return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5, language: 'portuguese', task: 'transcribe' });
  return fromWhisper({ words: (r.chunks || []).map(c => ({ word: c.text, start: c.timestamp[0], end: c.timestamp[1] ?? c.timestamp[0] + 0.3 })) }, off);
}
let useLocal = !LIVE;
async function part(blob, off) {
  if (!useLocal) { try { return fromWhisper(await ai('/transcribe?lang=pt', blob, 'audio/wav'), off); } catch (e) { if (e.status !== 429 && e.status !== 502) throw e; useLocal = true; flash('O serviço em nuvem está no limite. Transcrevendo no seu aparelho.'); } }
  return localPart(blob, off);
}
const pend = {};
function save(patch) { if (!LIVE || !S.pid) return Promise.resolve(); return S.sb.from('projects').update(patch).eq('id', S.pid).then(r => { if (r.error) flash('Não foi possível salvar: ' + r.error.message); }); }
function saveSoon(key, patch, ms = 900) { clearTimeout(pend[key]); pend[key] = setTimeout(() => save(patch), ms); }

// ---------- editor ----------
// Formato inicial = proporção nativa do vídeo (projetos salvos mantêm o formato escolhido)
const nativeRatio = () => { const v = $('#vid'), w = v.videoWidth || S.media?.videoWidth || S.media?.width, h = v.videoHeight || S.media?.videoHeight || S.media?.height; if (!w || !h) return '9:16'; const a = w / h; return a >= 1.1 ? '16:9' : a >= 0.9 ? '1:1' : a >= 0.65 ? '4:5' : '9:16'; };
function enterEdit() { view('edit'); tab('style'); S.ratioAuto = !DIMS[S.style.ratio]; setRatio(S.ratioAuto ? nativeRatio() : S.style.ratio); S.cur = 0; S.prev = null; $('#scrub').max = S.dur; prog(null); S.bbox = null; }
$('#vid').addEventListener('loadedmetadata', () => { if (S.ratioAuto && !$('#edit').hidden) { const r = nativeRatio(); if (r !== S.ratio) setRatio(r); } });
function setVideo(f) {
  const v = $('#vid'); v.src = URL.createObjectURL(f); v.style.display = 'block'; $('#ph').hidden = true; v.onloadedmetadata = () => { if (v.currentTime === 0) v.currentTime = 0.05; $('#scrub').max = v.duration; S.dur = v.duration; drawTimeline(); applyFit(); }; v.onloadeddata = () => thumb(S.pid); S.playing = false; $('#pp').textContent = 'Reproduzir';
}
function tab(t) { $('#vidSet').classList.remove('sheet'); document.documentElement.style.removeProperty('--sh'); for (const [id, k] of [['pStyle', 'style'], ['pText', 'text'], ['pClips', 'clips']]) $('#' + id).hidden = k !== t; document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.t === t)); }
document.querySelectorAll('.tabs button').forEach(b => { b.onclick = () => tab(b.dataset.t); });
const rs = () => resolve(S.tmp ? { ...S.style, preset: S.tmp, o: {} } : S.style);
const hkey = w => +w.s.toFixed(2), visible = () => S.words.filter(w => !S.hid.has(hkey(w)));
S.tone = 'auto';
let toneC = { w: null, n: -1, v: 'inspirador' };
const effTone = () => { if (S.tone && S.tone !== 'auto') return S.tone; if (!S.words || !S.words.length) return 'inspirador'; if (toneC.w !== S.words || toneC.n !== S.words.length) toneC = { w: S.words, n: S.words.length, v: detectTone(S.words) }; return toneC.v; };
function rebuild() { S.chunks = chunksOf(S.fx.emoji ? addEmojis(visible(), 2.5, effTone()) : visible(), Math.max(1, rs().n | 0)); drawTimeline(); phrasesUI(); toneInfo(); }
function setO(k, v) { if (['x', 'y', 'cropX'].includes(k)) S.style[k] = v; else S.style.o = { ...S.style.o, [k]: v }; rebuild(); applyCrop(); saveSoon('style', { style: S.style }); }
function applyFit() {   // fundo desfocado (prévia): vídeo inteiro por cima de uma cópia pequena e desfocada
  const v = $('#vid'); if (!v.videoWidth) return; const [W, H] = DIMS[S.ratio], on = useBlur(S.style.fit || 'auto', v.videoWidth, v.videoHeight, W, H);
  S.blurOn = on; v.style.objectFit = on ? 'contain' : 'cover'; $('#bgv').style.display = on ? 'block' : 'none'; $('#fitSel').value = S.style.fit || 'auto';
}
let bgT = 0; function drawBg() { if (!S.blurOn) return; const n = performance.now(); if (n - bgT < 120) return; bgT = n; const v = $('#vid'), c = $('#bgv'); try { c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); } catch { /* sem quadro */ } }
$('#fitSel').onchange = e => { S.style.fit = e.target.value; applyFit(); saveSoon('style', { style: S.style }); };
function applyCrop() { $('#vid').style.objectPosition = rs().cropX * 100 + '% 50%'; }
let rows = [];
const sync = () => { rows.forEach(f => f()); EG && EG.mark(); };
function mkRange(k, label, min, max, step = 1, unit = '%', scale = 1) {
  const out = el('output'), inp = el('input', { type: 'range', min, max, step, id: 'c_' + k, oninput: () => { setO(k, +inp.value / scale); out.textContent = Math.round(+inp.value) + unit; } });
  rows.push(() => { inp.value = rs()[k] * scale; out.textContent = Math.round(inp.value) + unit; });
  return el('div', { className: 'row' }, el('label', { htmlFor: 'c_' + k, textContent: label }), el('div', { className: 'rng' }, inp, out));
}
function mkColor(k, label) { const inp = el('input', { type: 'color', id: 'c_' + k, oninput: () => setO(k, inp.value) }); rows.push(() => { inp.value = rs()[k]; }); return el('div', { className: 'row' }, el('label', { htmlFor: 'c_' + k, textContent: label }), inp); }
function mkSeg(k, label, opts) {
  const wrap = el('div', { className: 'seg', role: 'group', ariaLabel: label }), bs = opts.map(([v, t]) => el('button', { type: 'button', textContent: t, onclick: () => { setO(k, v); sync(); } }));
  bs.forEach(b => wrap.append(b)); rows.push(() => bs.forEach((b, i) => b.setAttribute('aria-pressed', String(!!rs()[k] === !!opts[i][0] && (typeof opts[i][0] !== 'string' || rs()[k] === opts[i][0]))))); return el('div', { className: 'row' }, el('span', { textContent: label }), wrap);
}
function mkWeight(k, label) {
  const sel = el('select', { id: 'c_' + k, onchange: () => setO(k, +sel.value) });
  rows.push(() => { const ws = FONTS[rs().font]?.w || [400]; sel.replaceChildren(...ws.map(w => el('option', { value: w, textContent: ({ 300: 'Light 300', 400: 'Regular 400', 500: 'Medium 500', 600: 'Semibold 600', 700: 'Bold 700', 800: 'Extrabold 800', 900: 'Black 900' })[w] || w }))); sel.value = ws.reduce((a, b) => Math.abs(b - rs()[k]) < Math.abs(a - rs()[k]) ? b : a); });
  return el('div', { className: 'row' }, el('label', { htmlFor: 'c_' + k, textContent: label }), sel);
}
function mkAlign(label, key, vals) {
  const wrap = el('div', { className: 'seg', role: 'group', ariaLabel: label });
  vals.forEach(([v, t]) => wrap.append(el('button', { type: 'button', textContent: t, onclick: () => { S.style[key] = v; rebuild(); sync(); saveSoon('style', { style: S.style }); } })));
  return el('div', { className: 'row' }, el('span', { textContent: label }), wrap);
}
function buildControls() {
  const grp = (t, ...c) => el('div', { className: 'grp' }, el('b', { textContent: t }), ...c), ctl = $('#ctl');
  const font = el('select', { id: 'c_font', onchange: async () => { await loadFont(font.value, rs().wLight, rs().wActive); setO('font', font.value); sync(); } });
  const cats = {}; Object.entries(FONTS).forEach(([n, f]) => { (cats[f.cat] ||= []).push(n); });
  for (const [c, ns] of Object.entries(cats)) { const og = el('optgroup', { label: c }); ns.forEach(n => og.append(el('option', { value: n, textContent: n }))); font.append(og); }
  rows.push(() => { font.value = rs().font; });
  const platform = el('select', { id: 'c_plat', onchange: () => { S.safeP = platform.value; } }); Object.entries(PLATFORMS).forEach(([k, p]) => platform.append(el('option', { value: k, textContent: p.name })));
  const safe = el('input', { type: 'checkbox', id: 'c_safe', checked: false, onchange: () => { S.safeOn = safe.checked; } });
  ctl.append(
    grp('Texto', el('div', { className: 'row' }, el('label', { htmlFor: 'c_font', textContent: 'Fonte' }), font), mkRange('fs', 'Tamanho da fonte', 0, 100), mkSeg('case', 'Caixa', [['none', 'Aa'], ['upper', 'AA'], ['lower', 'aa']]), mkWeight('wLight', 'Peso das palavras'), mkWeight('wActive', 'Peso da palavra falada'), mkRange('n', 'Palavras por linha', 1, 5, 1, ''), mkSeg('letter', 'Destaque por', [[false, 'Palavra'], [true, 'Letra']])),
    grp('Cores', mkColor('color', 'Texto'), mkColor('activeColor', 'Palavra falada'), mkColor('strokeColor', 'Contorno'), mkRange('stroke', 'Espessura do contorno', 0, 100), mkColor('bg', 'Fundo'), mkRange('bgOpacity', 'Opacidade do fundo', 0, 100)),
    grp('Efeitos', mkSeg('pop', 'Entrada com pulo', [[0, 'Não'], [1, 'Sim']]), mkSeg('shadow', 'Sombra', [[0, 'Não'], [1, 'Sim']])),
    grp('Posição', mkSeg('align', 'Alinhar o texto', [['left', 'Esq.'], ['center', 'Centro'], ['right', 'Dir.']]), mkAlign('Alinhar na horizontal', 'x', [[0.2, 'Esq.'], [0.5, 'Centro'], [0.8, 'Dir.']]), mkAlign('Alinhar na vertical', 'y', [[0.2, 'Topo'], [0.5, 'Meio'], [0.72, 'Base']]), mkRange('x', 'Horizontal', 0, 100, 1, '%', 100), mkRange('y', 'Vertical', 0, 100, 1, '%', 100), mkRange('cropX', 'Enquadramento do vídeo', 0, 100, 1, '%', 100), el('div', { className: 'row' }, el('label', { htmlFor: 'c_plat', textContent: 'Área segura' }), platform), el('div', { className: 'row' }, el('label', { htmlFor: 'c_safe', textContent: 'Mostrar área segura' }), safe), el('p', { className: 'mut', textContent: 'Dica: arraste a legenda direto no vídeo. A área segura usa margens publicadas para anúncios; não são regras oficiais para posts orgânicos.' })));
}
// galeria de estilos: prévia animada de cada estilo, filtro por categoria e busca
const PREV = [{ w: 'Palavras', s: 0, e: .6 }, { w: 'que', s: .6, e: 1.1 }, { w: 'prendem', s: 1.1, e: 1.8 }, { w: 'a', s: 1.8, e: 2.1 }, { w: 'tela', s: 2.1, e: 2.9 }], PCH = chunksOf(PREV, 3);
// Carrossel da home: rola sozinho (linha 1 para a esquerda, linha 2 para a direita) e pode ser arrastado com o dedo ou mouse, com inércia
function driveMarquee(grid) {
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;   // sem movimento: o CSS deixa a linha rolável com o dedo
  const rows = [...grid.querySelectorAll('.mq-row')].map((r, i) => ({ r, t: r.firstElementChild, x: 0, auto: (i ? 1 : -1) * 38, v: (i ? 1 : -1) * 38, drag: false, hover: false, moved: 0, half: 0, ready: false }));
  rows.forEach(o => {
    o.t.style.animation = 'none'; Object.assign(o.r.style, { touchAction: 'pan-y', cursor: 'grab', userSelect: 'none', webkitUserSelect: 'none' });
    o.r.addEventListener('pointerdown', e => { o.drag = true; o.moved = 0; o.sx = o.lx = e.clientX; o.lt = performance.now(); o.cap = false; });
    o.r.addEventListener('pointermove', e => {
      if (!o.drag) return; const now = performance.now(), dx = e.clientX - o.lx, dt = Math.max(1, now - o.lt);
      if (!o.cap && Math.abs(e.clientX - o.sx) > 6) { o.cap = true; try { o.r.setPointerCapture(e.pointerId); } catch { /* sem captura */ } o.r.style.cursor = 'grabbing'; }
      if (!o.cap) return; o.x += dx; o.moved += Math.abs(dx); o.v = Math.max(-1600, Math.min(1600, dx / dt * 1000 * 0.6 + o.v * 0.4)); o.lx = e.clientX; o.lt = now;
    });
    const end = () => { o.drag = false; o.r.style.cursor = 'grab'; };
    o.r.addEventListener('pointerup', end); o.r.addEventListener('pointercancel', end);
    o.r.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') o.hover = true; }); o.r.addEventListener('pointerleave', () => { o.hover = false; });
    o.r.addEventListener('click', e => { if (o.moved > 6) { e.preventDefault(); e.stopPropagation(); o.moved = 0; } }, true);
  });
  let last = performance.now(), vis = true; new IntersectionObserver(en => { vis = en[0].isIntersecting; }).observe(grid);
  const tick = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (vis && !document.hidden) rows.forEach(o => {
      if (!o.half) { const d = o.t.querySelector('.dup'); o.half = d ? d.offsetLeft - o.t.firstElementChild.offsetLeft : 0; if (!o.half) return; if (!o.ready) { o.ready = true; o.x = o.auto > 0 ? -o.half : 0; } }
      if (!o.drag) { o.v += (o.auto - o.v) * Math.min(1, dt * 2.2); if (!o.hover || Math.abs(o.v - o.auto) > 5) o.x += o.v * dt; }
      while (o.x <= -o.half) o.x += o.half; while (o.x > 0) o.x -= o.half;
      o.t.style.transform = `translate3d(${o.x.toFixed(1)}px,0,0)`;
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function mountGallery(box, getCur, onPick, hover) {
  box.replaceChildren(); let cat = 'Todos', q = ''; const mq = box.id === 'gal';
  const chips = el('div', { className: 'chips', role: 'group', ariaLabel: 'Categorias' }), search = el('input', { type: 'search', placeholder: 'Buscar estilo', ariaLabel: 'Buscar estilo', id: 'gs_' + (box.id || 'x') }), grid = el('div', { className: mq ? 'mq' : 'gal' });
  const mark = () => grid.querySelectorAll('.gcard').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === getCur())));
  const paint = () => {
    grid.replaceChildren();
    for (const [id, p] of Object.entries(PRESETS)) {
      if ((cat !== 'Todos' && p.cat !== cat) || (q && !p.name.toLowerCase().includes(q))) continue;
      const locked = !canPro() && !p.free, cv = el('canvas', { width: mq ? 270 : 300, height: mq ? 480 : 170 }); cv.dataset.p = id; if (mq) cv.dataset.img = String(grid.children.length);
      const b = el('button', { type: 'button', className: 'gcard', onclick: async () => { if (locked) { $('#pay').showModal(); return; } await onPick(id); mark(); } }, cv, el('span', { className: 'gn', textContent: p.name }), el('span', { className: 'lk' + (p.free ? ' fr' : ''), textContent: p.free ? 'GRÁTIS' : 'PRO' }));
      b.dataset.id = id; if (hover && !locked) { const on = async () => { await loadFont(p.font, p.wLight, p.wActive); S.tmp = id; rebuild(); }, off = () => { if (S.tmp) { S.tmp = null; rebuild(); } }; b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && S.file) on(); }); b.addEventListener('pointerleave', off); b.addEventListener('focus', () => { if (S.file) on(); }); b.addEventListener('blur', off); b.addEventListener('click', () => { S.tmp = null; }); } grid.append(b);
    }
    if (mq) for (let i = 0; i < PEX.length; i++) photo(i);
    if (mq) {   // carrossel infinito em 2 linhas: cada linha repete os cartões (cópias só decorativas)
      const cards = [...grid.children]; grid.replaceChildren();
      [0, 1].forEach(r => {
        const tr = el('div', { className: 'mq-track' }), mine = cards.filter((_, i) => i % 2 === r);
        mine.forEach(c => tr.append(c));
        mine.forEach(c => { const k = c.cloneNode(true); k.tabIndex = -1; k.setAttribute('aria-hidden', 'true'); k.className = 'gcard dup'; k.onclick = () => c.click(); tr.append(k); });
        grid.append(el('div', { className: 'mq-row' + (r ? ' rev' : '') }, tr));
      });
      driveMarquee(grid);
    }
    if (!grid.children.length) grid.append(el('p', { className: 'mut', textContent: 'Nenhum estilo encontrado.' }));
    mark();
  };
  CATS.forEach(c => { const b = el('button', { type: 'button', textContent: c, onclick: () => { cat = c; [...chips.children].forEach(x => x.setAttribute('aria-pressed', String(x === b))); paint(); } }); b.setAttribute('aria-pressed', String(c === 'Todos')); chips.append(b); });
  search.oninput = () => { q = search.value.trim().toLowerCase(); paint(); };
  if (mq) box.append(grid); else box.append(el('div', { className: 'gbar' }, chips, search), grid); paint(); return { mark };
}
let lastG = 0;
const snap = document.createElement('canvas'); snap.width = 300; snap.height = 170; let snapOk = false, pvKey = '', pvCh = PCH;
function previewChunks() {   // usa as palavras reais do vídeo perto do ponto atual; senão, a frase de exemplo
  if (!S.words || S.words.length < 3) return PCH;
  let i = S.words.findIndex(w => w.s >= S.cur); if (i < 0 || i > S.words.length - 5) i = Math.max(0, S.words.length - 5);
  const key = i + '|' + S.words.length; if (key === pvKey) return pvCh;
  pvKey = key; pvCh = chunksOf(S.words.slice(i, i + 5).map((w, j) => ({ w: w.w, s: j * 0.6, e: j * 0.6 + 0.55 })), 3); return pvCh;
}
// Fotos de pessoas (banco gratuito Pexels, licença livre) como fundo das prévias do carrossel da página inicial
const PEX = [31868676, 23224670, 20636759, 7562179, 35555305, 37679581, 36729739, 33715994, 7514831, 37148308, 3965246, 36712860, 7793634, 17910791, 3775526];
const PH = {}; const pexUrl = id => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=360`;
const photo = n => { const id = PEX[n % PEX.length]; let m = PH[id]; if (!m) { m = PH[id] = new Image(); m.decoding = 'async'; m.referrerPolicy = 'no-referrer'; m.src = pexUrl(id); } return m.complete && m.naturalWidth ? m : null; };
function animGal(now) {
  if (now - lastG > 45) {
    lastG = now; const t = (now / 1000) % 3.2, pc = previewChunks();
    snapOk = false; if (S.file && vid.readyState >= 2 && vid.videoWidth) { try { const c = snap.getContext('2d'), r = Math.max(300 / vid.videoWidth, 170 / vid.videoHeight); c.drawImage(vid, (300 - vid.videoWidth * r) / 2, (170 - vid.videoHeight * r) / 2, vid.videoWidth * r, vid.videoHeight * r); snapOk = true; } catch { /* sem quadro */ } }
    document.querySelectorAll('.gcard canvas').forEach(cv => {
      if (!cv.offsetParent) return; const c = cv.getContext('2d'), r = resolve({ preset: cv.dataset.p });
      if (cv.dataset.img) {   // cartão 9:16 do carrossel: foto + legenda animada do estilo
        const bb = cv.getBoundingClientRect(); if (bb.right < 0 || bb.left > innerWidth) return;
        const im = photo(+cv.dataset.img);
        if (im) { const k = Math.max(cv.width / im.naturalWidth, cv.height / im.naturalHeight); c.drawImage(im, (cv.width - im.naturalWidth * k) / 2, (cv.height - im.naturalHeight * k) * 0.12, im.naturalWidth * k, im.naturalHeight * k); }
        else { const g = c.createLinearGradient(0, 0, 0, cv.height); g.addColorStop(0, '#3a2a22'); g.addColorStop(1, '#0d0e10'); c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height); }
        const sh = c.createLinearGradient(0, cv.height * .45, 0, cv.height); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.62)'); c.fillStyle = sh; c.fillRect(0, 0, cv.width, cv.height);
        drawCaption(c, cv.width, cv.height, pc, t, { ...r, x: .5, y: .68, n: 3, fs: Math.min(100, r.fs * 1.7) }); return;
      }
      if (snapOk) { c.drawImage(snap, 0, 0, cv.width, cv.height); c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(0, 0, cv.width, cv.height); }
      else { const g = c.createLinearGradient(0, 0, 0, cv.height); g.addColorStop(0, '#1b1d21'); g.addColorStop(1, '#0d0e10'); c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height); }
      drawCaption(c, cv.width, cv.height, pc, t, { ...r, x: .5, y: .5, n: 3, fs: Math.min(100, r.fs * 2.2) });
    });
  }
  requestAnimationFrame(animGal);
}
function buildPresets() {
  const pick = async id => { const p = PRESETS[id]; await loadFont(p.font, p.wLight, p.wActive); S.style = { ...S.style, preset: id, o: {} }; rebuild(); sync(); saveSoon('style', { style: S.style }); };
  EG = mountGallery($('#presets'), () => S.style.preset, pick, true);
  HG = mountGallery($('#gal'), () => S.homePreset || 'iman', async id => { await loadFont(PRESETS[id].font, PRESETS[id].wLight, PRESETS[id].wActive); S.homePreset = id; });
}

// linha do tempo: faixa de legendas e faixa de cortes, com cabeça de reprodução
S.tlz = 1;
function tlZoom(z) { S.tlz = Math.min(12, Math.max(1, z)); $('#tl .tw').style.width = S.tlz * 100 + '%'; $('#tlZv').textContent = (Math.round(S.tlz * 10) / 10) + '×'; }
$('#tlTrim').onclick = () => {   // tira a preparação do começo e a pausa do final: início ≈ 0,3 s antes da 1ª fala, fim ≈ 0,7 s depois da última
  let n = 0, cut = 0;
  S.clips.forEach(c => { if (c.state === 'rendering') return; const ws = S.words.filter(w => w.e > c.start && w.s < c.end); if (!ws.length) return;
    const ns = Math.max(c.start, ws[0].s - 0.3), ne = Math.min(c.end, ws[ws.length - 1].e + 0.7); if (ne - ns < 3 || (Math.abs(ns - c.start) < 0.05 && Math.abs(ne - c.end) < 0.05)) return;
    cut += (ns - c.start) + (c.end - ne); c.start = ns; c.end = ne; delete c.url; delete c.state; n++; });
  if (!n) { flash(S.words.length ? 'Os cortes já começam e terminam na fala.' : 'Ainda não há transcrição para achar onde a fala começa e termina.'); return; }
  save({ clips: S.clips.map(({ url, state, p, err, ...c }) => c) }); clipsUI(); flash('Aparei ' + n + ' corte(s): ' + cut.toFixed(1) + ' s de preparação e pausa removidos. Você ainda pode arrastar as bordas.');
};
$('#tlZp').onclick = () => tlZoom(S.tlz * 1.6); $('#tlZm').onclick = () => tlZoom(S.tlz / 1.6);
const hnd = h => { const u = el('u', { className: 'h ' + h }); u.dataset.h = h; return u; };
function drawTimeline() {
  const c = $('#trkC'), k = $('#trkK'); if (!c) return; c.replaceChildren(); k.replaceChildren(); const D = Math.max(S.dur, 1);
  S.chunks.forEach(ch => { const s0 = ch[0].s, e0 = ch[ch.length - 1].e; c.append(el('i', { style: `left:${s0 / D * 100}%;width:${Math.max(.35, (e0 - s0) / D * 100)}%`, title: ch.map(w => w.w).join(' ') })); });
  S.clips.forEach((cl, i) => { const b = el('i', { className: 'drag', style: `left:${cl.start / D * 100}%;width:${Math.max(.8, (cl.end - cl.start) / D * 100)}%`, title: mmss(cl.start) + ' a ' + mmss(cl.end) + ' · arraste para mover; as bordas ajustam o início e o fim' }, hnd('l'), el('span', { textContent: cl.title || 'Corte ' + (i + 1) }), hnd('r')); k.append(b); if (cl.state !== 'rendering') tlDrag(b, k, cl, 'start', 'end', 3, () => { delete cl.url; delete cl.state; save({ clips: S.clips.map(({ url, state, p, err, ...c }) => c) }); clipsUI(); }); });
  // faixas extras: áudios (arrastáveis), música e imagens/B-roll/títulos
  document.querySelectorAll('#tl .x').forEach(n => n.remove());
  const nc = document.querySelector('#tl .tnc'), tw = document.querySelector('#tl .tw'), ph = $('#ph2');
  const addTrack = (name, fill) => { const t = el('div', { className: 'trk x' }); nc.append(el('span', { className: 'tn x', textContent: name })); tw.insertBefore(t, ph); fill(t); };
  if ((S.aud || []).length) addTrack('Áudio', t => S.aud.forEach(o => {
    const b = el('i', { className: 'drag', style: `left:${o.at / D * 100}%;width:${Math.max(1.5, o.buf.duration / D * 100)}%`, textContent: o.name, title: 'Arraste para mover o áudio' });
    b.onpointerdown = e => { e.stopPropagation(); b.setPointerCapture(e.pointerId); const r = t.getBoundingClientRect(), x0 = e.clientX, a0 = o.at;
      b.onpointermove = ev => { o.at = Math.max(0, Math.min(D - 0.2, a0 + (ev.clientX - x0) / r.width * D)); b.style.left = o.at / D * 100 + '%'; };
      b.onpointerup = () => { b.onpointermove = b.onpointerup = null; audUI(); }; };
    b.onclick = e => e.stopPropagation(); t.append(b); }));
  if (S.music) addTrack('Música', t => t.append(el('i', { style: 'left:0;width:100%;opacity:.55', textContent: S.music.name })));
  const ovs = (S.ov || []).filter(o => o.from != null);
  if (ovs.length) addTrack('Imagens', t => ovs.forEach(o => { const b = el('i', { className: 'drag', style: `left:${o.from / D * 100}%;width:${Math.max(1.5, (o.to - o.from) / D * 100)}%`, title: (o.kind === 'broll' ? 'B-roll' : o.kind === 'title' ? 'Título' : 'Imagem') + ' · arraste para mover; as bordas ajustam o tempo' }, hnd('l'), el('span', { textContent: o.kind === 'title' ? o.text : o.name }), hnd('r')); t.append(b); tlDrag(b, t, o, 'from', 'to', 0.5, () => ovUI()); }));
  // régua de tempo (no topo) e guia do ímã
  { const w = tw.getBoundingClientRect().width || 560, steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600], st = steps.find(x => x / D * w >= 58) || 600, rl = el('div', { className: 'trk x rl', ariaHidden: 'true' });
    for (let t0 = 0; t0 <= D + 0.01; t0 += st) rl.append(el('s', { style: `left:${t0 / D * 100}%`, textContent: mmss(t0) }));
    nc.prepend(el('span', { className: 'tn x', textContent: ' ' })); tw.prepend(rl); tw.insertBefore(el('b', { className: 'x snapG', id: 'tlSnapG' }), ph); }
}
// ímã: pontos de encaixe = início/fim do vídeo, cabeça de reprodução, bordas de legendas, cortes e imagens
function tlPoints(skip) { const a = [0, S.dur, S.cur || 0]; S.chunks.forEach(ch => a.push(ch[0].s, ch[ch.length - 1].e)); S.clips.forEach(c => { if (c !== skip) a.push(c.start, c.end); }); (S.ov || []).forEach(o => { if (o !== skip && o.from != null) a.push(o.from, o.to); }); return a; }
function tlSnap(t, skip) { const D = Math.max(S.dur, 1), w = $('#tl .tw').getBoundingClientRect().width || 560, th = 9 / w * D; let best = null, bd = th; for (const p of tlPoints(skip)) { const d = Math.abs(p - t); if (d < bd) { bd = d; best = p; } } return best; }
function tlGuide(t) { const g = $('#tlSnapG'); if (!g) return; if (t == null) { g.style.display = 'none'; return; } g.style.display = 'block'; g.style.left = t / Math.max(S.dur, 1) * 100 + '%'; }
// arrastar um bloco da linha do tempo: corpo move, bordas (.h) ajustam início/fim; encaixa nos pontos próximos
function tlDrag(b, track, o, kS, kE, min, done) {
  b.onpointerdown = e => {
    e.stopPropagation(); const D = Math.max(S.dur, 1), mode = e.target.dataset?.h || 'move'; b.setPointerCapture(e.pointerId);
    const r = track.getBoundingClientRect(), x0 = e.clientX, s0 = o[kS], e0 = o[kE], len = e0 - s0; let moved = false;
    b.onpointermove = ev => {
      moved = true; const dt = (ev.clientX - x0) / r.width * D; let s = s0, en = e0, at = null;
      if (mode === 'move') { s = Math.max(0, Math.min(D - len, s0 + dt)); const a = tlSnap(s, o), c = tlSnap(s + len, o); if (a != null) { s = a; at = a; } else if (c != null) { s = c - len; at = c; } en = s + len; }
      else if (mode === 'l') { s = Math.max(0, Math.min(e0 - min, s0 + dt)); const a = tlSnap(s, o); if (a != null && a <= e0 - min) { s = a; at = a; } }
      else { en = Math.min(D, Math.max(s0 + min, e0 + dt)); const a = tlSnap(en, o); if (a != null && a >= s0 + min) { en = a; at = a; } }
      o[kS] = s; o[kE] = en; b.style.left = s / D * 100 + '%'; b.style.width = (en - s) / D * 100 + '%'; tlGuide(at);
    };
    b.onpointerup = b.onpointercancel = () => { b.onpointermove = b.onpointerup = b.onpointercancel = null; tlGuide(null); if (moved) done(); };
  };
  b.onclick = e => e.stopPropagation();
}
function thumb(pid) {
  if (!pid) return; const v = $('#vid');
  v.addEventListener('seeked', () => { try { const c = document.createElement('canvas'); c.width = 108; c.height = 192; const x = c.getContext('2d'), r = Math.max(108 / v.videoWidth, 192 / v.videoHeight); x.drawImage(v, (108 - v.videoWidth * r) / 2, (192 - v.videoHeight * r) / 2, v.videoWidth * r, v.videoHeight * r); ls.set('th_' + pid, c.toDataURL('image/jpeg', .7)); } catch { /* sem miniatura */ } v.currentTime = 0; }, { once: true });
  v.currentTime = Math.min(1, (v.duration || 2) / 2);
}

// lista de frases: texto editável, tempo, olho para esconder
function phrasesUI() {
  const box = $('#phr'); if (!box || box.contains(document.activeElement)) return;
  box.replaceChildren(); const all = chunksOf(S.words, Math.max(1, rs().n | 0));
  all.forEach(ch => {
    const off = ch.every(w => S.hid.has(hkey(w))), inp = el('input', { value: ch.map(w => w.w).join(' '), ariaLabel: 'Frase' });
    inp.onchange = () => { const txt = [...box.querySelectorAll('input')].map(i => i.value).join(' '); S.words = retime(S.words, tokens(txt), S.dur); $('#txt').value = S.words.map(w => w.w).join(' '); rebuild(); saveSoon('tr', { transcript: { words: S.words } }, 600); };
    const eye = el('button', { type: 'button', textContent: off ? 'Mostrar' : 'Esconder', onclick: () => { ch.forEach(w => off ? S.hid.delete(hkey(w)) : S.hid.add(hkey(w))); S.style.hid = [...S.hid]; rebuild(); saveSoon('style', { style: S.style }); } });
    const t = el('small', { textContent: ch[0].s.toFixed(2) + ' – ' + ch[ch.length - 1].e.toFixed(2), onclick: () => { S.prev = null; seek(ch[0].s); } });
    const row = el('div', { className: 'pr' + (off ? ' off' : '') }, t, inp, eye); box.append(row);
  });
}
function setRatio(r) {
  S.ratio = r; S.style.ratio = r; const [w, h] = DIMS[r], ar = w / h; $('#ratio').value = r;
  $('#stage').style.aspectRatio = w + '/' + h; const sw = `min(100%,calc(var(--sh,74) * ${ar.toFixed(4)} * 1dvh))`; document.documentElement.style.setProperty('--ar', ar.toFixed(4)); applyFit(); $('#stage').style.width = sw; document.querySelector('.transport').style.width = sw;
  saveSoon('style', { style: S.style });
}
$('#ratio').onchange = e => { S.ratioAuto = false; setRatio(e.target.value); };

// transcrição editável
$('#txt').oninput = () => { S.words = retime(S.words, tokens($('#txt').value), S.dur); rebuild(); saveSoon('tr', { transcript: { words: S.words } }, 1200); };

// cortes
const fxBtns = [];
function mkFx(k, label, hint) {
  const wrap = el('div', { className: 'seg', role: 'group', ariaLabel: label });
  [[0, 'Não'], [1, 'Sim']].forEach(([v, t]) => { const b = el('button', { type: 'button', textContent: t, onclick: () => { if (v && !canPro()) { $('#pay').showModal(); return; } S.fx[k] = v; S.style.fx = S.fx; syncFx(); if (k === 'emoji') rebuild(); saveSoon('style', { style: S.style }); } }); b.dataset.k = k; b.dataset.v = v; fxBtns.push(b); wrap.append(b); });
  return el('div', { className: 'row' }, el('span', {}, label, el('br'), el('small', { className: 'mut', textContent: hint })), wrap);
}
const syncFx = () => { fadeUI && fadeUI(); fxBtns.forEach(b => b.setAttribute('aria-pressed', String(!!S.fx[b.dataset.k] === !!+b.dataset.v))); if (colorUI) colorUI.sync(); };
let colorUI = null;   // painel de cor: módulo carregado sob demanda, só quando o usuário abre a seção
const ensureColor = async () => { if (!colorUI) { const m = await import('./colorui.js?v=3'); colorUI = m.initColor({ S, $, el, canPro, saveSoon, flash }); } return colorUI; };
$('#fxColorD').addEventListener('toggle', e => { if (e.target.open) ensureColor(); });
const ZL = { 1: 1.05, 2: 1.1, 3: 1.16 };
const FILLERS = new Set(['hum', 'ahn', 'ãh', 'ah', 'éh', 'hm', 'hmm', 'uh', 'um', 'né', 'tipo', 'então', 'ééé', 'eh']);
function fillerBtn() {
  const b = el('button', { type: 'button', className: 'ghost', textContent: 'Esconder vícios de fala nas legendas', onclick: () => {
    const norm = s => s.toLowerCase().replace(/[.,!?;:…]/g, '');
    let n = 0; S.words.forEach(w => { if (FILLERS.has(norm(w.w)) && !S.hid.has(hkey(w))) { S.hid.add(hkey(w)); n++; } });
    S.style.hid = [...S.hid]; rebuild(); saveSoon('style', { style: S.style }); b.textContent = n ? `${n} palavras escondidas` : 'Nenhum vício encontrado';
  } });
  return b;
}
function acutPanel() {
  const sel = el('select', { id: 'acutS', onchange: () => { S.fx.acutS = +sel.value; S.fx.acutSkip = []; S.style.fx = S.fx; saveSoon('style', { style: S.style }); list(); } }, ...[[1, 'Suave: só pausas claras'], [2, 'Média (recomendada)'], [3, 'Forte: corta mais']].map(([v, t]) => el('option', { value: v, textContent: t })));
  const box = el('div', { className: 'acut' }), wrap = el('details', { className: 'grp' }, el('summary', { textContent: 'Ver o que será cortado' }), el('div', { className: 'row' }, el('label', { htmlFor: 'acutS', textContent: 'Sensibilidade' }), sel), box);
  function list() {
    sel.value = S.fx.acutS || 2; box.replaceChildren();
    const c0 = S.clips[0] ? [S.clips.reduce((a, c) => Math.min(a, c.start), 1e9), S.clips.reduce((a, c) => Math.max(a, c.end), 0)] : [0, S.dur], cuts = S.words.length ? autoCuts(S.words, c0[0], c0[1], S.fx.acutS || 2) : [];
    if (!cuts.length) { box.append(el('p', { className: 'mut', textContent: S.words.length ? 'Nada para cortar nesta sensibilidade.' : 'Transcreva o vídeo para ver os cortes.' })); return; }
    const skip = new Set(S.fx.acutSkip || []);
    box.append(el('p', { className: 'mut', textContent: cuts.length + ' trechos, ' + cuts.reduce((s, c) => s + c.b - c.a, 0).toFixed(1) + ' s no total. Desmarque o que quiser manter; desligar o auto-corte desfaz tudo.' }));
    cuts.forEach(c => {
      const cb = el('input', { type: 'checkbox', checked: !skip.has(c.key), onchange: () => { const k = new Set(S.fx.acutSkip || []); cb.checked ? k.delete(c.key) : k.add(c.key); S.fx.acutSkip = [...k]; S.style.fx = S.fx; saveSoon('style', { style: S.style }); } });
      box.append(el('div', { className: 'row' }, el('label', {}, cb, ' ' + mmss(c.a) + ' · ' + c.kind + ': “' + c.text + '”'), el('button', { type: 'button', className: 'ghost', textContent: 'Ir', onclick: () => { S.prev = null; seek(Math.max(0, c.a - 1.5)); play(true); } })));
    });
  }
  wrap.addEventListener('toggle', () => wrap.open && list()); return wrap;
}
function buildFx() { $('#fxCut').append(fillerBtn()); $('#fxCut').append(mkFx('cut', 'Remover silêncios', 'Corta pausas longas entre as falas.')); $('#fxCut').append(mkFx('acut', 'Auto-corte inteligente', 'Tira contagem regressiva (3, 2, 1), hesitações e vícios isolados. Dá para ver e desmarcar cada corte.')); $('#fxCut').append(acutPanel()); $('#fxZoom').append(mkFx('zoom', 'Zoom automático', 'Só aproxima quando a fala justifica (emoção, revelação, detalhe), no máximo a cada poucos segundos. Lê a transcrição para decidir.')); { const z = el('select', { id: 'zoomL', onchange: () => { S.fx.zoomL = +z.value; S.style.fx = S.fx; saveSoon('style', { style: S.style }); } }, ...[[1, 'Suave'], [2, 'Média'], [3, 'Forte']].map(([v, t]) => el('option', { value: v, textContent: t }))); z.value = S.fx.zoomL || 2; $('#fxZoom').append(el('div', { className: 'row' }, el('label', { htmlFor: 'zoomL', textContent: 'Intensidade do zoom' }), z)); } $('#fxZoom').append(mkFx('emoji', 'Emojis nas legendas', 'Adiciona emojis nas palavras-chave, sem exagero.')); $('#fxCut').append(mkFx('denoise', 'Reduzir ruído', 'Limpa o ruído de fundo com IA que roda no seu aparelho (aplicado ao exportar).')); $('#fxCut').append(mkFx('sfx', 'Efeitos sonoros', 'Whoosh nas trocas de zoom e pop nos títulos (ouvidos ao exportar).')); syncFx(); }
function clipsUI() {
  if ($('#cuts').open) cutsUI();
  kwSuggest(); drawTimeline(); syncFx(); const ul = $('#clips'); ul.replaceChildren();
  $('#cmsg').textContent = S.clips.length ? 'Escolha o que gerar. A seleção usa IA e serve de ponto de partida.' : 'Nenhum corte forte encontrado. Busque um momento por palavra ou crie um corte manualmente abaixo.';
  S.clips.forEach((c, i) => {
    const acts = el('div', { className: 'acts' }, el('button', { className: 'btn', textContent: 'Pré-visualizar', onclick: () => previewClip(c) }));
    if (c.state === 'rendering') { const p = el('progress', { max: 1, value: c.p || 0 }); p.style.maxWidth = '160px'; const eta = el('span', { className: 'mut eta', role: 'status', textContent: 'Preparando…' }); acts.append(p, eta, el('button', { className: 'btn', textContent: 'Cancelar', onclick: () => S.abort && S.abort.abort() })); }
    else acts.append(el('button', { className: 'btn pri', textContent: c.url ? 'Gerar de novo' : 'Gerar vídeo', disabled: S.busy, onclick: () => renderOne(c) }));
    if (c.url) acts.append(el('a', { className: 'btn', textContent: 'Baixar', href: c.url, download: `forjaclip-corte-${i + 1}.mp4` }));
    { const d = el('button', { className: 'btn', textContent: 'Descrição e hashtags', onclick: () => describeClip(c, d) }); acts.append(d); }
    if (c.state === 'error') acts.append(el('span', { className: 'warn', textContent: c.err }));
    const mp = miniClip(c); ul.append(el('li', { className: 'clip' + (mp ? ' hm' : '') }, ...(mp ? [mp] : []), el('div', {}, el('b', { textContent: c.title || 'Corte ' + (i + 1) }), ' ', el('span', { className: 'score', textContent: c.score != null ? 'nota ' + c.score : 'manual' })), el('div', { className: 'mut', textContent: mmss(c.start) + ' a ' + mmss(c.end) + (c.reason ? ' · ' + c.reason : '') }), acts));
  });
}
// ---------- tela de cortes sugeridos (grade 9:16: o usuário aprova, rejeita, ajusta ou baixa) ----------
let cutsF = 'all';
const cutSave = () => save({ clips: S.clips.map(({ url, state, p, err, t0, ...c }) => c) });
function cutsOpen() { if (!S.clips.length) { flash('Ainda não há cortes. Crie um manual.'); return; } cutsUI(); if (!$('#cuts').open) $('#cuts').showModal(); }
function cutsClose() { if (miniOn) miniStop(miniOn); $('#cuts').close(); }
async function cutDl(c) {
  if (!c.url) await renderOne(c);
  if (c.url) { const a = el('a', { href: c.url, download: `forjaclip-corte-${S.clips.indexOf(c) + 1}.mp4` }); document.body.append(a); a.click(); a.remove(); }
}
function cutCard(c, i) {
  const src = $('#vid').src, card = el('div', { className: 'cc' + (c.status === 'no' ? ' no' : '') }); card.dataset.id = c.id;
  const box = el('div', { className: 'cvid' + (c.state === 'rendering' ? ' rend' : '') }), v = document.createElement('video'), pl = el('span', { className: 'mpl', textContent: '▶' });
  v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.setAttribute('aria-hidden', 'true'); box._c = c; box._src = src; box.setAttribute('aria-label', 'Prévia do corte ' + (c.title || i + 1) + ': tocar');
  const tool = el('div', { className: 'ctool' }); tool.setAttribute('role', 'toolbar'); tool.setAttribute('aria-label', 'Ações do corte');
  const btn = (txt, label, fn, cls = '') => { const b = el('button', { type: 'button', textContent: txt, title: label, className: cls }); b.setAttribute('aria-label', label); b.onclick = e => { e.stopPropagation(); fn(); }; return b; };
  tool.append(
    btn('✎', 'Ajustar título e trecho', () => cutEdit(c)),
    btn('⬇', c.url ? 'Baixar o corte' : 'Gerar e baixar o corte', () => cutDl(c)),
    btn('✓', 'Aprovar', () => { c.status = c.status === 'ok' ? '' : 'ok'; cutSave(); cutsUI(); }, c.status === 'ok' ? 'on' : ''),
    btn('✕', 'Rejeitar', () => { c.status = c.status === 'no' ? '' : 'no'; cutSave(); cutsUI(); }, c.status === 'no' ? 'x on' : 'x'));
  const sc = el('span', { className: 'cs' + (c.auto ? ' a' : ''), textContent: c.auto ? 'Relevante' : c.score != null ? c.score + '%' : 'Manual' });
  const pr = el('progress', { max: 1, value: c.p || 0 });
  box.append(v, sc, el('span', { className: 'cb', textContent: 'Prévia' }), pl, el('span', { className: 'cd', textContent: mmss(c.end - c.start) }), tool, pr);
  v.ontimeupdate = () => { if (v.currentTime >= c.end) miniStop(box); };
  let ht = 0; const hover = matchMedia('(hover:hover)').matches && !matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (hover) { box.onmouseenter = () => { ht = setTimeout(() => miniPlay(box, false), 300); }; box.onmouseleave = () => { clearTimeout(ht); if (box.classList.contains('on') && v.muted) miniStop(box); }; }
  box.onclick = () => { clearTimeout(ht); if (box.classList.contains('on') && !v.muted) miniStop(box); else miniPlay(box, true); };
  box.onkeydown = e => { if (e.key === 'Escape') miniStop(box); };
  if (src) { if (miniIO) miniIO.observe(box); else v.src = src + '#t=' + c.start; }
  card.append(box, el('h3', { textContent: c.title || 'Corte ' + (i + 1) }), el('p', { textContent: mmss(c.start) + ' a ' + mmss(c.end) + (c.reason ? ' · ' + c.reason : '') }));
  return card;
}
function cutsUI() {
  if (miniOn) miniStop(miniOn);
  const all = S.clips, n = { all: all.length, ok: all.filter(c => c.status === 'ok').length, no: all.filter(c => c.status === 'no').length };
  document.querySelectorAll('#cutsTabs button').forEach(b => { const f = b.dataset.f; b.textContent = { all: 'Todos', ok: 'Aprovados', no: 'Rejeitados' }[f] + ' (' + n[f] + ')'; b.setAttribute('aria-selected', String(f === cutsF)); b.onclick = () => { cutsF = f; cutsUI(); }; });
  $('#cutsSub').textContent = (S.title || '') + ' · ' + n.all + ' trechos separados. Você decide quais usar.';
  const g = $('#cutsGrid'); g.replaceChildren();
  const list = all.map((c, i) => [c, i]).filter(([c]) => cutsF === 'all' || (c.status || '') === cutsF);
  if (!list.length) g.append(el('p', { className: 'mut', textContent: 'Nenhum corte nesta aba.' }));
  for (const [c, i] of list) g.append(cutCard(c, i));
}
function cutEdit(c) {
  const d = $('#cedit'); $('#ceT').value = c.title || ''; $('#ceS').value = tfmt(c.start); $('#ceE').value = tfmt(c.end); $('#ceM').textContent = ''; d.showModal();
  $('#ceNo').onclick = () => d.close();
  $('#ceOk').onclick = () => {
    const s0 = tsec($('#ceS').value), e0 = tsec($('#ceE').value);
    if (!(e0 - s0 >= 3) || e0 > S.dur + 0.5) { $('#ceM').textContent = 'O corte precisa ter pelo menos 3 segundos e ficar dentro do vídeo (' + tfmt(S.dur) + ').'; return; }
    if (e0 - s0 > 120) { $('#ceM').textContent = 'No navegador, cada corte pode ter até 2 minutos.'; return; }
    c.title = $('#ceT').value.trim().slice(0, 80) || c.title; c.start = s0; c.end = e0; if (c.url) { URL.revokeObjectURL(c.url); delete c.url; c.state = 'idle'; } cutSave(); d.close(); cutsUI(); drawTimeline();
  };
}
$('#cutsX').onclick = cutsClose; $('#cuts').addEventListener('close', () => { if (miniOn) miniStop(miniOn); });
$('#cutsOpen').onclick = cutsOpen;
$('#cutsMan').onclick = () => { cutsClose(); tab('clips'); try { $('#ms').scrollIntoView({ block: 'center' }); $('#ms').focus(); } catch { /* ok */ } };

// ---------- exportar (botão sempre visível no editor) ----------
async function saveVideo(url, name) {
  try { const b = await (await fetch(url)).blob(), f = new File([b], name, { type: b.type || 'video/mp4' }); if (/iPhone|iPad|Android/.test(navigator.userAgent) && navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f] }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = el('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
}
function expOpen() {
  if (!S.file && !S.words.length) { flash('Abra um vídeo primeiro.'); return; }
  const d = $('#expD'), real = S.clips.filter(c => c.id !== 'full');
  $('#expCuts').hidden = !real.length; $('#expCuts').textContent = 'Escolher entre os cortes sugeridos (' + real.length + ')';
  $('#expSave').hidden = !(S.expClip && S.expClip.url); $('#expMsg').textContent = ''; $('#expPg').hidden = true; $('#expFull').disabled = !!S.busy;
  if (!d.open) d.showModal();
}
$('#expBtn').onclick = $('#expBtn2').onclick = expOpen; $('#expX').onclick = () => $('#expD').close();
$('#expCuts').onclick = () => { $('#expD').close(); cutsOpen(); };
$('#expFull').onclick = async () => {
  if (!S.file) { $('#expD').close(); flash('Selecione o vídeo original para exportar.'); $('#ph').hidden = false; return; }
  let c = S.mode === 'captions' ? S.clips.find(x => x.id === 'full') : S.fullClip;
  if (!c) { c = { id: 'full', start: 0, end: S.dur, title: 'Vídeo completo', reason: '' }; if (S.mode === 'captions') S.clips.unshift(c); else S.fullClip = c; }
  c.start = 0; c.end = S.dur || S.media.duration;
  if (c.end - c.start > 120) { $('#expMsg').textContent = 'No navegador, cada exportação pode ter até 2 minutos. Use um corte menor (aba Ferramentas) ou um vídeo mais curto.'; return; }
  S.expClip = c; $('#expSave').hidden = true; $('#expPg').hidden = false; $('#expPg').value = 0; $('#expMsg').textContent = 'Gerando…'; $('#expFull').disabled = true;
  await renderOne(c);
  $('#expFull').disabled = false; $('#expPg').hidden = true;
  if (c.url) { $('#expMsg').textContent = 'Pronto! Toque em “Salvar vídeo pronto”.'; $('#expSave').hidden = false; } else $('#expMsg').textContent = c.state === 'error' ? (c.err || 'Falha ao gerar.') : 'Geração cancelada.';
};
$('#expSave').onclick = () => { const c = S.expClip; if (c && c.url) saveVideo(c.url, 'forjaclip-' + (S.title || 'video').replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').slice(0, 40) + '.mp4'); };

// botão X (ícone) para fechar qualquer janela (dialog), inclusive as criadas depois
{
  const X = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const addX = d => {
    if (d.querySelector(':scope > .dx')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'dx'; b.innerHTML = X; b.setAttribute('aria-label', 'Fechar janela'); b.title = 'Fechar';
    b.onclick = () => { if (d.id === 'ytd' && document.getElementById('ytX')) document.getElementById('ytX').click(); else d.close(); };
    d.prepend(b);
  };
  document.querySelectorAll('dialog').forEach(addX);
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeName === 'DIALOG') addX(n); }).observe(document.body, { childList: true });
}

$('#addManual').onclick = () => {
  const s = +$('#ms').value, e = +$('#me').value;
  if (!(e - s >= 3)) { flash('O corte precisa ter pelo menos 3 segundos.'); return; }
  S.clips.push({ id: 'm' + Date.now(), start: s, end: e, title: 'Corte manual', reason: '' }); save({ clips: S.clips.map(({ url, state, p, err, ...c }) => c) }); clipsUI();
};
function previewClip(c) { S.prev = { s: c.start, e: c.end }; S.prevRem = cutRanges(visible(), c.start, c.end, S.fx, S.words); seek(c.start); play(true); $('#stage').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
async function renderOne(c) {
  if (S.busy) return;
  if (!S.file) { flash('Selecione o vídeo original para gerar o corte.'); $('#ph').hidden = false; return; }
  if (c.end - c.start > 120) { flash('No navegador, cada corte pode ter até 2 minutos.'); return; }
  S.busy = true; c.state = 'rendering'; c.p = 0; c.t0 = performance.now(); S.abort = new AbortController(); clipsUI(); let wl; try { wl = await navigator.wakeLock.request('screen'); } catch { /* sem wake lock */ }
  try { await loadFont(rs().font, rs().wLight, rs().wActive); if (c.url) URL.revokeObjectURL(c.url); const r = await renderClip({ file: S.file, media: S.media, clip: c, words: visible(), style: S.style, W: dimsNow()[0], H: dimsNow()[1], fps: S.fps, opts: { signal: S.abort.signal, cutSilence: !!S.fx.cut, cutFx: S.fx, faceTrack: S.faceOn ? S.track : null, allWords: S.words, zoom: !!S.fx.zoom, zoomLevel: ZL[S.fx.zoomL || 2], emoji: !!S.fx.emoji, tone: effTone(), sfx: !!S.fx.sfx, denoise: !!S.fx.denoise, tracks: S.aud, music: S.music ? { buffer: S.music.buf, volume: S.music.vol } : null, overlays: ovAll(), grade: (await ensureColor())?.forExport() ?? null, fadeIn: S.style.fi || 0, fadeOut: S.style.fo || 0 }, onProgress: p => { c.p = p; const pr = $('#clips progress'); if (pr) pr.value = p; const cp = document.querySelector('#cutsGrid [data-id="' + c.id + '"] progress'); if (cp) cp.value = p; if (c === S.expClip) { $('#expPg').value = p; $('#expMsg').textContent = 'Gerando ' + Math.round(p * 100) + '%. Mantenha a tela aberta.'; } const eta = $('#clips .eta'); if (eta) { const el0 = (performance.now() - c.t0) / 1000, left = p > 0.03 ? Math.ceil(el0 * (1 - p) / p) : null; eta.textContent = 'Gerando ' + Math.round(p * 100) + '%' + (left != null ? ', faltam cerca de ' + (left > 60 ? Math.ceil(left / 60) + ' min' : left + ' s') : '') + '. Mantenha a tela aberta.'; } } }); c.url = URL.createObjectURL(r.blob); c.state = 'done'; flash('Corte pronto. Toque em Baixar.'); beep(); }
  catch (e) { c.state = e.message === 'Geração cancelada.' ? 'idle' : 'error'; c.err = e.message; if (c.state === 'idle') flash('Geração cancelada.'); }
  finally { S.busy = false; S.abort = null; if (wl) wl.release().catch(() => { }); clipsUI(); }
}

// ---------- reprodução e prévia ----------
const vid = $('#vid');
const hasVid = () => !!S.file;
function play(on) { S.playing = on; if (hasVid()) { on ? vid.play().catch(() => { S.playing = false; $('#pp').textContent = 'Reproduzir'; $('#stPlay').hidden = false; }) : vid.pause(); } $('#pp').textContent = on ? 'Pausar' : 'Reproduzir'; $('#stPlay').hidden = on; }
$('#stPlay').onclick = () => { S.prev = null; play(true); };
$('#stage').addEventListener('click', e => { if (e.target.closest('label,button,input,a')) return; S.prev = null; play(!S.playing); });
const stopPlay = () => { if (!$('#edit').hidden || S.playing) { S.playing = false; try { vid.pause(); } catch { /* sem vídeo */ } } };
function seek(t) { S.cur = t; if (hasVid()) vid.currentTime = t; }
$('#pp').onclick = () => { if (S.playing) play(false); else { if (!S.prev) S.prev = null; play(true); } };
$('#scrub').oninput = e => { S.prev = null; e.target.style.setProperty('--p', (+e.target.value / Math.max(S.dur, 1) * 100).toFixed(2) + '%'); seek(+e.target.value); };
let last = performance.now();
const cv = $('#cv'), ctx = cv.getContext('2d');
function fit() { const r = $('#stage').getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); if (cv.width !== Math.round(r.width * d) || cv.height !== Math.round(r.height * d)) { cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); } }
function frame(now) {
  const dt = (now - last) / 1000; last = now;
  if (!$('#edit').hidden) {
    if (hasVid()) S.cur = vid.currentTime; else if (S.playing) S.cur += dt;
    if (S.prev && S.cur >= S.prev.e) seek(S.prev.s); else if (S.prev && S.prevRem && S.prevRem.length && S.prevRem.some(([a, b]) => S.cur >= a && S.cur < b)) seek(S.prevRem.find(([a, b]) => S.cur >= a && S.cur < b)[1]); else if (!hasVid() && S.cur >= S.dur) S.cur = 0;
    vid.style.transform = S.fx.zoom ? 'scale(' + zoomAt(S.chunks, S.cur, ZL[S.fx.zoomL || 2]).toFixed(3) + ')' : '';
    if (S.faceOn && S.track && hasVid() && !S.blurOn) { const fx = trackAt(S.track, S.cur), vw = vid.videoWidth, vh = vid.videoHeight, st = $('#stage').getBoundingClientRect(); if (fx != null && vw && st.height) { const sw = vh * st.width / st.height; vid.style.objectPosition = (vw > sw ? Math.min(1, Math.max(0, (fx * vw - sw / 2) / (vw - sw))) * 100 : 50) + '% 50%'; } }
    if (colorUI) colorUI.preview(); drawBg();
    $('#scrub').value = S.cur; $('#scrub').style.setProperty('--p', (S.cur / Math.max(S.dur, 1) * 100).toFixed(2) + '%'); $('#ph2').style.left = Math.min(100, S.cur / Math.max(S.dur, 1) * 100) + '%'; if (S.tlz > 1 && S.playing) { const sc = $('#twS'), x = S.cur / Math.max(S.dur, 1) * sc.scrollWidth; if (x < sc.scrollLeft || x > sc.scrollLeft + sc.clientWidth * 0.9) sc.scrollLeft = x - sc.clientWidth * 0.2; } $('#tm').textContent = mmss(S.cur) + ' / ' + mmss(S.dur);
    fit(); const W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
    const r = rs(); if (S.ov.length) drawBroll(ctx, W, H, S.ov, S.cur); S.bbox = drawCaption(ctx, W, H, S.chunks, S.cur, r); if (S.ov.length || S.logo) drawOverlays(ctx, W, H, ovAll(), S.cur, r.font);
    const out = S.bbox && outsideSafe(S.bbox, S.safeP, W, H);
    if (S.safeOn && !S.playing && S.ratio === '9:16') { const s = safeRect(S.safeP, W, H); ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.rect(s.x, s.y, s.w, s.h); ctx.fill('evenodd'); ctx.setLineDash([8, 6]); ctx.lineWidth = 2; ctx.strokeStyle = out ? '#ff4d4d' : 'rgba(255,255,255,.7)'; ctx.strokeRect(s.x, s.y, s.w, s.h); if (out) { ctx.fillStyle = 'rgba(255,60,60,.14)'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = '#ff4d4d'; ctx.strokeRect(S.bbox.x, S.bbox.y, S.bbox.w, S.bbox.h); } ctx.restore(); }
    const boxOut = S.bbox ? outsideSafe(S.bbox, S.safeP, W, H) : (r.y * H < safeRect(S.safeP, W, H).y || r.y * H > safeRect(S.safeP, W, H).y + safeRect(S.safeP, W, H).h);
    $('#warn').textContent = boxOut ? 'A legenda está fora da área segura e pode ficar coberta pelos botões do app (' + PLATFORMS[S.safeP].name + ').' : '';
  }
  requestAnimationFrame(frame);
}
// arrastar a legenda
let drag = null;
$('#stage').addEventListener('pointerdown', e => { if (e.target.closest('label,button')) return; const r = $('#stage').getBoundingClientRect();
  const lb = S.logo && logoOv.box, px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
  if (lb && px * $('#cv').width >= lb.x && px * $('#cv').width <= lb.x + lb.w && py * $('#cv').height >= lb.y && py * $('#cv').height <= lb.y + lb.h) { drag = { logo: true, x: e.clientX, y: e.clientY, sx: S.logoCfg.x, sy: S.logoCfg.y, w: r.width, h: r.height }; $('#stage').classList.add('drag'); $('#stage').setPointerCapture(e.pointerId); return; }
  drag = { x: e.clientX, y: e.clientY, sx: rs().x, sy: rs().y, w: r.width, h: r.height }; $('#stage').classList.add('drag'); $('#stage').setPointerCapture(e.pointerId); });
$('#stage').addEventListener('pointermove', e => { if (!drag) return; if (drag.logo) { S.logoCfg.x = Math.min(1, Math.max(0, drag.sx + (e.clientX - drag.x) / drag.w)); S.logoCfg.y = Math.min(1, Math.max(0, drag.sy + (e.clientY - drag.y) / drag.h)); saveLogoCfg(); return; } const nx = Math.min(0.92, Math.max(0.08, drag.sx + (e.clientX - drag.x) / drag.w)), ny = Math.min(0.97, Math.max(0.03, drag.sy + (e.clientY - drag.y) / drag.h)); S.style.x = nx; S.style.y = ny; sync(); saveSoon('style', { style: S.style }); });
const endDrag = () => { drag = null; $('#stage').classList.remove('drag'); }; $('#stage').addEventListener('pointerup', endDrag); $('#stage').addEventListener('pointercancel', endDrag);

// ---------- início ----------
async function boot() {
  const l = el('link', { rel: 'stylesheet', href: fontsUrl() }); document.head.append(l);
  buildControls(); buildFx(); buildPresets(); requestAnimationFrame(frame); requestAnimationFrame(animGal); Object.values(PRESETS).forEach(p => loadFont(p.font, p.wLight, p.wActive));
  { const T = $('#tl'), at = e => { const r = $('#tl .tw').getBoundingClientRect(); S.prev = null; seek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * S.dur); }; let dn = false;
    T.onpointerdown = e => { dn = true; try { T.setPointerCapture(e.pointerId); } catch { /* ok */ } at(e); };
    T.onpointermove = e => { if (dn) at(e); }; T.onpointerup = T.onpointercancel = () => { dn = false; }; }
  await loadFont('Montserrat', 300, 500, 900);
  if (!LIVE) { view('home'); $('#homeSub').textContent = 'Sem conta: a transcrição roda no seu aparelho e nada é salvo. Entre para guardar projetos.'; $('#nOut').hidden = true; return; }
  S.sb = window.supabase.createClient(CFG.SB_URL, CFG.SB_ANON);
  const avSet = v => { S.av = v; const a = parseAv(v); $('#avBadge').innerHTML = a ? avatarSvg(a[0], a[1], 28) : ''; $('#nAv').hidden = false; };
  const avOpen = () => {
    const cur = parseAv(S.av) || [0, 0]; let sel = cur[0], bg = cur[1]; const g = $('#avG'), c = $('#avC');
    const draw = () => { g.replaceChildren(); c.replaceChildren(); for (let i = 0; i < AV_COUNT; i++) { const b = el('button', { type: 'button', ariaLabel: 'Avatar ' + (i + 1), onclick: () => { sel = i; draw(); } }); b.innerHTML = avatarSvg(i, bg, 64); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(i === sel)); g.append(b); } for (let j = 0; j < BG_COUNT; j++) { const b = el('button', { type: 'button', ariaLabel: 'Cor ' + (j + 1), onclick: () => { bg = j; draw(); } }); b.innerHTML = avatarSvg(sel, j, 30); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(j === bg)); c.append(b); } };
    draw(); $('#avOk').onclick = async () => { const v = 'a' + sel + '-' + bg; avSet(v); try { localStorage.setItem('forjaclip.av', v); } catch { /* ok */ } $('#avD').close(); try { await S.sb.auth.updateUser({ data: { avatar: v } }); } catch { /* fica só neste aparelho */ } };
    $('#avLater').onclick = () => { try { localStorage.setItem('forjaclip.avSkip', '1'); } catch { /* ok */ } $('#avD').close(); };
    $('#avD').showModal();
  };
  $('#nAv').onclick = avOpen;
  const apply = async s => {
    if (!s) { S.user = null; forget(); view('login'); return; }
    if (S.user?.id === s.user.id) return; S.user = s.user; $('#who').textContent = 'Sair'; { let v = s.user.user_metadata?.avatar; if (!v) try { v = localStorage.getItem('forjaclip.av'); } catch { /* ok */ } avSet(v || null); let skip = false; try { skip = !!localStorage.getItem('forjaclip.avSkip'); } catch { /* ok */ } if (!v && !skip) setTimeout(avOpen, 700); } $('#nOut').title = s.user.email || '';
    const p = await S.sb.from('profiles').select('plan,pro_until').maybeSingle(); S.plan = (p.data?.plan === 'pro' || (p.data?.pro_until && new Date(p.data.pro_until) > new Date())) ? 'pro' : 'free'; S.proUntil = p.data?.pro_until || null; try { const ad = await S.sb.rpc('is_admin'); S.isAdmin = ad.data === true; } catch { S.isAdmin = false; } if (S.isAdmin) S.plan = 'pro'; $('#nAdm').hidden = !S.isAdmin; if (!canPro() && PRESETS[S.style?.preset] && !PRESETS[S.style.preset].free) S.style.preset = 'iman'; buildPresets(); planUI(); resume();
  };
  const { data } = await S.sb.auth.getSession(); apply(data.session); S.sb.auth.onAuthStateChange((_, s) => apply(s));
}

// Antes e depois: dois vídeos sincronizados (baixa qualidade sem legenda × qualidade melhor com legenda); arrastar com dedo/mouse ou teclado.
(() => {
  const box = $('#cmp'); if (!box) return;
  const A = $('#cmpA'), B = $('#cmpB'), cap = $('#cmpCap'), rng = box.querySelector('input');
  const set = v => { v = Math.max(0, Math.min(100, v)); box.style.setProperty('--c', v + '%'); rng.value = v; };
  let drag = false; const at = e => { const r = box.getBoundingClientRect(); set((e.clientX - r.left) / r.width * 100); };
  box.addEventListener('pointerdown', e => { if (e.button) return; drag = true; box.setPointerCapture?.(e.pointerId); at(e); });
  box.addEventListener('pointermove', e => { if (drag) at(e); });
  const end = () => { drag = false; }; box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  rng.addEventListener('input', () => set(+rng.value));
  const W = [['FORJACLIP', 'TRANSFORMA'], ['SEU', 'VÍDEO', 'EM'], ['CORTES', 'VIRAIS'], ['COM', 'LEGENDAS', 'ANIMADAS']], N = W.flat().length; let last = '';
  const draw = t => { const d = B.duration || 7.7, k = Math.min(N - 1, Math.floor(((t % d) / d) * (N + 1))); let i = 0, row = 0; for (; row < W.length; row++) { if (k < i + W[row].length) break; i += W[row].length; } const key = row + ':' + k; if (key === last) return; last = key; cap.replaceChildren(...(W[row] || []).map((w, j) => { const sp = document.createElement('span'); sp.textContent = w; if (i + j === k) sp.className = 'on'; return sp; })); };
  const rm = matchMedia('(prefers-reduced-motion:reduce)').matches; let raf = 0;
  const tick = () => { if (Math.abs(A.currentTime - B.currentTime) > 0.2) A.currentTime = B.currentTime; draw(B.currentTime); raf = requestAnimationFrame(tick); };
  const play = () => { if (rm) { draw(1.2); return; } A.play().catch(() => { }); B.play().catch(() => { }); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); };
  const stop = () => { A.pause(); B.pause(); cancelAnimationFrame(raf); };
  draw(1.2); new IntersectionObserver(es => es[0].isIntersecting ? play() : stop(), { threshold: .25 }).observe(box);
})();
if ('serviceWorker' in navigator) {   // atualiza sozinho: busca versão nova ao abrir/voltar ao app e recarrega uma vez quando ela assume
  const had = !!navigator.serviceWorker.controller; let rl = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !rl) { rl = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => { const up = () => r.update().catch(() => { }); document.addEventListener('visibilitychange', () => { if (!document.hidden) up(); }); setInterval(up, 30 * 60e3); }).catch(() => { });
}
boot();
window.__forjaclip = { S };
initGuide({ home: () => home() });   // útil para testes

// ---------- música de fundo ----------
S.aud = [];
// ---------- configurações do vídeo, trocar e remover ----------
S.res = 1; S.fps = 30;
const dimsNow = () => { const [w, h] = DIMS[S.ratio], k = S.res; return [Math.round(w * k / 2) * 2, Math.round(h * k / 2) * 2]; };
$('#ratio2').onchange = e => { S.ratioAuto = false; setRatio(e.target.value); };
$('#ratio').addEventListener('change', () => { $('#ratio2').value = $('#ratio').value; });
var fadeUI = () => { $('#fiR').value = S.style.fi || 0; $('#foR').value = S.style.fo || 0; $('#fiO').textContent = (S.style.fi || 0) + ' s'; $('#foO').textContent = (S.style.fo || 0) + ' s'; };
$('#fiR').oninput = e => { S.style.fi = +e.target.value; $('#fiO').textContent = S.style.fi + ' s'; saveSoon('style', { style: S.style }); };
$('#foR').oninput = e => { S.style.fo = +e.target.value; $('#foO').textContent = S.style.fo + ' s'; saveSoon('style', { style: S.style }); };
let beepOn = true; try { beepOn = localStorage.getItem('fc_beep') !== '0'; } catch { /* sem armazenamento */ } $('#beepC').checked = beepOn;
$('#beepC').onchange = e => { beepOn = e.target.checked; try { localStorage.setItem('fc_beep', beepOn ? '1' : '0'); } catch { /* ok */ } };
function beep() {   // dois tons curtos; usa o áudio do navegador (liberado pelo clique em "Gerar")
  if (!beepOn) return; try { const ac = new AudioContext(), t = ac.currentTime; [[660, 0], [880, 0.16]].forEach(([f, d]) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.25, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.18); o.connect(g).connect(ac.destination); o.start(t + d); o.stop(t + d + 0.2); }); setTimeout(() => ac.close(), 800); } catch { /* sem áudio */ }
}
$('#resSel').onchange = e => { S.res = +e.target.value; };
$('#fpsSel').onchange = e => { S.fps = +e.target.value; };
const vidSheet = on => { const mob = matchMedia('(max-width:899px)').matches; if (!on || !mob) { $('#vidSet').classList.remove('sheet'); document.documentElement.style.removeProperty('--sh'); if (on) $('#vidSet').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; } $('#vidSet').classList.add('sheet'); document.documentElement.style.setProperty('--sh', '36'); $('#stage').scrollIntoView({ block: 'start' }); window.scrollBy(0, -8); };
$('#vidCfg').onclick = () => { tab('clips'); vidSheet(!$('#vidSet').classList.contains('sheet')); };
$('#vidClose').onclick = () => vidSheet(false);
async function dropProject() { forget(); if (LIVE && S.pid) { const r = await S.sb.from('projects').delete().eq('id', S.pid); if (r.error) { flash('Não foi possível apagar: ' + r.error.message); return false; } } return true; }
async function swapVideo(e) {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (!confirm('Trocar o vídeo apaga a transcrição e os cortes deste projeto. Continuar?')) return;
  const mode = S.mode, old = S.pid; if (!(await dropProject())) return; S.pid = null; stopPlay(); await newVideo(f, mode); if (old && !S.pid && LIVE) home();
}
$('#swapIn').onchange = swapVideo; $('#swapIn2').onchange = swapVideo;
$('#vidDel').onclick = async () => { if (!confirm('Remover o vídeo e descartar este projeto?')) return; if (!(await dropProject())) return; S.file = null; S.media = null; S.words = []; S.clips = []; S.ov = []; S.aud = []; home(); flash('Projeto descartado.'); };
const dbFmt = d => (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d) + ' dB', dbLin = d => Math.pow(10, d / 20);
function audUI() {
  const ul = $('#audList'); ul.replaceChildren();
  S.aud.forEach((o, i) => {
    if (o.db == null) o.db = Math.round(20 * Math.log10(o.vol || 1));
    const at = el('input', { type: 'number', min: 0, step: 0.5, value: +o.at.toFixed(1), ariaLabel: 'Início do áudio (s)' }); at.style.width = '64px'; at.onchange = () => { o.at = Math.max(0, +at.value || 0); drawTimeline(); };
    const out = el('output', { textContent: dbFmt(o.db) });
    const vol = el('input', { type: 'range', min: -30, max: 12, step: 1, value: o.db, ariaLabel: 'Volume do áudio em decibéis' }); vol.oninput = () => { o.db = +vol.value; o.vol = dbLin(o.db); out.textContent = dbFmt(o.db); };
    ul.append(el('li', {}, el('span', { className: 'nm', textContent: o.name + ' (' + o.buf.duration.toFixed(1) + ' s)', title: o.name }),
      el('div', { className: 'rg' }, el('span', { textContent: 'Início (s)' }), at, el('span')),
      el('div', { className: 'rg' }, el('span', { textContent: 'Volume' }), vol, out),
      el('button', { type: 'button', className: 'btn', textContent: 'Remover', onclick: () => { S.aud.splice(i, 1); audUI(); } })));
  });
  drawTimeline();
}
$('#audIn').onchange = async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  try { const ac = new AudioContext({ sampleRate: S.media?.audio?.sampleRate || 48000 }), buf = await ac.decodeAudioData(await f.arrayBuffer()); ac.close(); S.aud.push({ buf, name: f.name, at: Math.max(0, +S.cur.toFixed(1)), vol: 1 }); audUI(); flash('Áudio adicionado em ' + S.cur.toFixed(1) + ' s. Ajuste o ponto se precisar.'); }
  catch { flash('Não consegui ler este áudio. Tente MP3, M4A ou WAV.'); }
};
S.music = null; let musEl = null;
function musSync() { if (!musEl) return; musEl.volume = S.music.vol; if (S.playing) { if (musEl.paused) musEl.play().catch(() => { }); } else musEl.pause(); }
async function loadMusic(f, label) {
  const m = $('#musMsg'); m.textContent = 'Lendo o áudio…';
  try {
    const sr = S.media?.audio?.sampleRate || 48000, ac = new AudioContext({ sampleRate: sr });
    const buf = await ac.decodeAudioData(await f.arrayBuffer()); ac.close();
    if (musEl) { musEl.pause(); URL.revokeObjectURL(musEl.src); }
    musEl = new Audio(URL.createObjectURL(f)); musEl.loop = true; label = label || f.name;
    S.music = { buf, vol: dbLin(+$('#musVol').value), name: label }; $('#musRow').hidden = false; $('#musName').textContent = label; drawTimeline(); m.textContent = 'Música pronta. Será misturada ao gerar o corte.'; musSync();
  } catch (err) { m.textContent = 'Não consegui ler este áudio (' + (err.message || 'formato') + '). Tente MP3, M4A ou WAV.'; }
}
$('#musFile').onchange = e => { const f = e.target.files[0]; if (f) loadMusic(f); };
$('#toneSel').onchange = e => { S.tone = e.target.value; S.style.tone = S.tone; saveSoon('style', { style: S.style }); toneInfo(); rebuild(); };
function toneInfo() { $('#toneAuto').textContent = S.tone === 'auto' && S.words.length ? '(detectado: ' + (TONES[effTone()]?.name || '') + ')' : ''; }
$('#musGen').onclick = async () => {
  const b = $('#musGen'), t = effTone(); b.disabled = true; b.textContent = 'Criando música…';
  try { const { generateMusic } = await import('./musicgen.js?v=1'); const blob = await generateMusic(t, 30, 44100); await loadMusic(new File([blob], 'musica.wav', { type: 'audio/wav' }), 'Música ' + TONES[t].name.toLowerCase() + ' (original)'); }
  catch (e) { $('#musMsg').textContent = 'Não consegui gerar a música neste navegador.'; }
  b.disabled = false; b.textContent = 'Gerar música deste tom';
};
$('#musVol').oninput = e => { $('#musDb').textContent = dbFmt(+e.target.value); if (S.music) { S.music.vol = dbLin(+e.target.value); musSync(); } };
$('#musOff').onclick = () => { if (musEl) { musEl.pause(); URL.revokeObjectURL(musEl.src); musEl = null; } S.music = null; $('#musRow').hidden = true; $('#musFile').value = ''; drawTimeline(); $('#musMsg').textContent = 'Adicione uma trilha. Ela é misturada ao áudio ao gerar o corte.'; };
setInterval(() => { if (musEl) { if (S.playing && musEl.paused) musEl.play().catch(() => { }); if (!S.playing && !musEl.paused) musEl.pause(); } }, 300);

// ---------- assinatura (Mercado Pago: PIX, débito e crédito) ----------
async function checkout(btn, msg, plan) {
  btn.disabled = true; msg.textContent = 'Abrindo o Mercado Pago…';
  try { const { data } = await S.sb.auth.getSession(); const r = await fetch(CFG.AI + '/checkout', { method: 'POST', headers: { authorization: 'Bearer ' + data.session.access_token, 'content-type': 'application/json' }, body: JSON.stringify({ plan: plan || 'month' }) }); const j = await r.json(); if (!r.ok || !j.url) throw new Error(j.error || 'Falha ao iniciar o pagamento.'); location.href = j.url; }
  catch (e) { msg.textContent = e.message; btn.disabled = false; }
}
$('#refBtn').onclick = async () => {
  if (!confirm('Pedir reembolso integral dos pagamentos feitos nos últimos 7 dias? O plano Pro será encerrado agora.')) return;
  const b = $('#refBtn'), m = $('#planMsg'); b.disabled = true; m.textContent = 'Solicitando o reembolso…';
  try {
    const { data } = await S.sb.auth.getSession(); const r = await fetch(CFG.AI + '/refund', { method: 'POST', headers: { authorization: 'Bearer ' + data.session.access_token, 'content-type': 'application/json' }, body: '{}' });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Não foi possível pedir o reembolso agora.');
    m.textContent = 'Reembolso solicitado. O valor volta pela mesma forma de pagamento (cartão: na fatura; PIX: na conta). Seu plano voltou ao gratuito.'; S.plan = 'free'; S.proUntil = null; setTimeout(() => location.reload(), 4000);
  } catch (e) { m.textContent = e.message; b.disabled = false; }
};
function planUI() {   // pontos de entrada visíveis para o plano Pro: menu lateral e cartão na tela inicial
  if (!(CFG.PAY && LIVE)) return;
  $('#nPro').hidden = false; const pro = S.plan === 'pro', card = $('#plan'); card.hidden = false; card.classList.toggle('on', pro);
  const until = S.proUntil ? new Date(S.proUntil).toLocaleDateString('pt-BR') : '';
  $('#planT').textContent = pro ? 'ForjaClip Pro ativo' : 'ForjaClip Pro'; $('#nProL').textContent = pro ? 'Pro ativo' : 'Plano Pro';
  $('#planS').textContent = pro ? (until ? 'Seu acesso vai até ' + until + '. Renove quando quiser: cada pagamento soma 31 dias (ou 1 ano no plano anual).' : 'Obrigado por apoiar o ForjaClip.') : 'Estilos exclusivos, cortes por IA sem limite e sem anúncios.';
  $('#planPrice').hidden = pro; $('#refBtn').hidden = !pro; $('#planBtn').textContent = pro ? 'Renovar por mais 31 dias' : 'Assinar o Pro'; $('#planBtnY').textContent = pro ? 'Renovar por 1 ano · R$ 199' : 'Plano anual · R$ 199/ano'; $('#yrS').innerHTML = 'Só <b>R$ 16,58 por mês</b>. Economize mais de R$ 100 por ano.';
}
if (CFG.PAY && LIVE) {
  const d = $('#pay'); d.querySelector('p').textContent = 'Este recurso faz parte do plano Pro. R$ 19,90 por mês nos 3 primeiros meses, depois R$ 29,90, ou R$ 199 por ano (economize mais de R$ 100). Pague por PIX, cartão de débito ou crédito (Mercado Pago).';
  const m = el('p', { className: 'mut pm', role: 'status' }), b = el('button', { type: 'button', className: 'btn pri', textContent: 'Assinar o Pro', onclick: () => checkout(b, m) });
  d.querySelector('form').before(b, m);
  const pm = $('#planMsg'); $('#planBtn').onclick = () => checkout($('#planBtn'), pm); $('#planBtnY').onclick = () => checkout($('#planBtnY'), pm, 'year'); $('#nPro').onclick = async () => { await home(); $('#plan').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
}

// ---------- seguir o rosto ----------
$('#faceBtn').onclick = async () => {
  const b = $('#faceBtn'), m = $('#faceMsg');
  if (S.faceOn) { S.faceOn = false; b.textContent = 'Analisar e seguir'; applyCrop(); m.textContent = 'Seguir o rosto desligado.'; return; }
  if (!canPro()) { $('#pay').showModal(); return; }
  if (!S.file) { flash('Abra um vídeo primeiro.'); return; }
  b.disabled = true; S.faceAbort = new AbortController();
  try {
    if (!S.track) { const step = Math.max(0.5, S.dur / 600); S.track = await trackFaces(S.file, 0, S.dur, { step, signal: S.faceAbort.signal, onProgress: p => { m.textContent = 'Analisando rostos… ' + Math.round(p * 100) + '%'; } }); }
    if (!S.track.length) { m.textContent = 'Não encontrei rostos neste vídeo.'; S.track = null; }
    else { S.faceOn = true; b.textContent = 'Parar de seguir'; m.textContent = 'O enquadramento agora acompanha o rosto (vale na prévia e na exportação).'; }
  } catch (e) { m.textContent = 'Não consegui analisar: ' + (e.message || 'erro'); }
  b.disabled = false;
};

// ---------- arquivo de legenda (.srt / .vtt), no navegador ----------
function subFile(kind) {
  const w = visible(); if (!w.length) { flash('Ainda não há transcrição.'); return; }
  const ts = t => { const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, r = ms % 1000, p2 = (n, k = 2) => String(n).padStart(k, '0'); return p2(h) + ':' + p2(m) + ':' + p2(s) + (kind === 'vtt' ? '.' : ',') + p2(r, 3); };
  const lines = toLines(w, 9, 0.7).map(l => ({ s: l[0].s, e: l[l.length - 1].e, t: l.map(x => x.w).join(' ') }));
  lines.forEach((l, i) => { const n = lines[i + 1]; if (n && l.e > n.s) l.e = n.s - 0.01; if (l.e - l.s < 0.4) l.e = l.s + 0.4; });
  const body = lines.map((l, i) => (kind === 'vtt' ? '' : (i + 1) + '\n') + ts(l.s) + ' --> ' + ts(l.e) + '\n' + l.t + '\n').join('\n');
  const url = URL.createObjectURL(new Blob([(kind === 'vtt' ? 'WEBVTT\n\n' : '') + body], { type: kind === 'vtt' ? 'text/vtt' : 'application/x-subrip' }));
  const a = el('a', { href: url, download: (S.title || 'legenda').replace(/\.[^.]+$/, '') + '.' + kind }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}
$('#srtBtn').onclick = () => subFile('srt'); $('#vttBtn').onclick = () => subFile('vtt');

// ---------- tradução das legendas (IA) ----------
$('#trGo').onclick = async () => {
  if (!(LIVE && S.user)) { flash('Entre na sua conta para traduzir as legendas.'); return; }
  if (!S.words.length) { flash('Ainda não há transcrição para traduzir.'); return; }
  const go = $('#trGo'), msg = $('#trMsg'), lang = $('#trLang').value; go.disabled = true; msg.textContent = 'Traduzindo…';
  try {
    const t = await token(), res = await translateWords(visible(), (task, text, l) => assist(CFG, t, task, text, l), lang, p => { msg.textContent = 'Traduzindo… ' + Math.round(p * 100) + '%'; });
    S.orig = S.orig || structuredClone(S.words); S.words = res; S.hid = new Set(); S.style.hid = []; $('#txt').value = S.words.map(w => w.w).join(' '); rebuild();
    saveSoon('tr', { transcript: { words: S.words } }, 300); saveSoon('style', { style: S.style }, 300); $('#trUndo').hidden = false; msg.textContent = 'Pronto. Revise o texto abaixo e edite se quiser.';
  } catch (e) { msg.textContent = e.message; }
  go.disabled = false;
};
$('#trUndo').onclick = () => { if (!S.orig) return; S.words = S.orig; S.orig = null; S.hid = new Set(); S.style.hid = []; $('#txt').value = S.words.map(w => w.w).join(' '); rebuild(); saveSoon('tr', { transcript: { words: S.words } }, 300); $('#trUndo').hidden = true; $('#trMsg').textContent = 'Texto original restaurado.'; };

// ---------- descrição e hashtags (IA) ----------
async function describeClip(c, btn) {
  if (!(LIVE && S.user)) { flash('Entre na sua conta para gerar a descrição.'); return; }
  const w = visible().filter(x => x.s >= c.start - 0.05 && x.e <= c.end + 0.05); if (w.length < 3) { flash('Este corte quase não tem fala para descrever.'); return; }
  const old = btn.textContent; btn.disabled = true; btn.textContent = 'Gerando…';
  try { const r = await assist(CFG, await token(), 'describe', w.map(x => x.w).join(' ').slice(0, 8000)); const tags = (Array.isArray(r.hashtags) ? r.hashtags : []).map(t => '#' + String(t).replace(/^#+/, '').replace(/\s+/g, '')).join(' ');
    $('#descTxt').value = [r.title, r.description, tags].filter(Boolean).join('\n\n'); $('#desc').showModal(); }
  catch (e) { flash(e.message); }
  btn.disabled = false; btn.textContent = old;
}
$('#descCopy').onclick = async () => { try { await navigator.clipboard.writeText($('#descTxt').value); $('#descCopy').textContent = 'Copiado'; setTimeout(() => { $('#descCopy').textContent = 'Copiar'; }, 1500); } catch { $('#descTxt').select(); } };

// ---------- títulos e imagens ----------
S.ov = S.ov || [];
// Kit de marca: logo salvo no navegador e aplicado como marca d'água em todos os cortes
S.logoCfg = (() => { try { return { x: 0.14, y: 0.075, s: 0.2, o: 0.9, ...JSON.parse(localStorage.getItem('forjaclip.logoCfg') || '{}') }; } catch { return { x: 0.14, y: 0.075, s: 0.2, o: 0.9 }; } })();
const logoOv = { kind: 'logo', from: 0, to: 1e9 };
const ovAll = () => S.logo ? [...S.ov, Object.assign(logoOv, { img: S.logo, cfg: S.logoCfg })] : S.ov;
const saveLogoCfg = () => { try { localStorage.setItem('forjaclip.logoCfg', JSON.stringify(S.logoCfg)); } catch { /* ok */ } };
$('#logoS').oninput = e => { S.logoCfg.s = +e.target.value / 100; saveLogoCfg(); };
$('#logoO').oninput = e => { S.logoCfg.o = +e.target.value / 100; saveLogoCfg(); };
$('#logoS').value = Math.round(S.logoCfg.s * 100); $('#logoO').value = Math.round(S.logoCfg.o * 100);
async function setLogo(src) { try { S.logo = src ? await createImageBitmap(await (await fetch(src)).blob()) : null; } catch { S.logo = null; } $('#logoOff').hidden = !S.logo; $('#logoCfg').hidden = !S.logo; $('#logoSt').textContent = S.logo ? 'Logo ativo em todos os cortes.' : 'Nenhum logo definido.'; }
try { setLogo((localStorage.getItem('forjaclip.logo') || localStorage.getItem('tacet.logo'))); } catch { setLogo(null); }
$('#logoIn').onchange = async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  try {
    const bm = await createImageBitmap(f), k = Math.min(1, 320 / Math.max(bm.width, bm.height)), c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/png'); try { localStorage.setItem('forjaclip.logo', url); } catch { flash('O logo vale só nesta sessão (armazenamento do navegador indisponível).'); } await setLogo(url);
  } catch { flash('Não consegui abrir esta imagem.'); }
};
$('#logoOff').onclick = () => { try { localStorage.removeItem('forjaclip.logo'); localStorage.removeItem('tacet.logo'); } catch { /* ok */ } setLogo(null); };
function ovUI() {
  const ul = $('#ovList'); ul.replaceChildren();
  S.ov.forEach((o, i) => {
    const li = el('li'); const num = (k) => { const n = el('input', { type: 'number', min: 0, step: 0.5, value: +o[k].toFixed(1), ariaLabel: k === 'from' ? 'Início' : 'Fim' }); n.style.width = '64px'; n.onchange = () => { o[k] = Math.max(0, +n.value || 0); drawTimeline(); }; return n; };
    const th = (o.frames || o.img) ? (() => { const c = el('canvas', { width: 36, height: 64, ariaHidden: 'true' }); c.style.cssText = 'width:36px;height:64px;border-radius:4px;background:#000;flex:none'; const src = o.frames ? o.frames[0] : o.img; try { const r = Math.max(36 / src.width, 64 / src.height); c.getContext('2d').drawImage(src, (36 - src.width * r) / 2, (64 - src.height * r) / 2, src.width * r, src.height * r); } catch { /* sem miniatura */ } return c; })() : null;
    const name = o.kind === 'title' ? el('input', { value: o.text, ariaLabel: 'Texto do título', oninput: e => { o.text = e.target.value; } }) : el('span', { textContent: (o.kind === 'broll' ? 'B-roll: ' : 'Imagem: ') + o.name });
    li.append(...(th ? [th] : []), name, num('from'), el('span', { className: 'mut', textContent: 'a' }), num('to'), ...(o.kind === 'broll' && o.query ? [el('button', { type: 'button', className: 'btn', textContent: 'Trocar', onclick: async e => { const bt = e.target; bt.disabled = true; bt.textContent = '…'; const f = await brollFor(o.query, Math.max(1.5, o.to - o.from)); if (f) { delete o.frames; delete o.img; if (f.vid) { o.frames = f.vid.frames; o.fps = f.vid.fps; } else o.img = f.img; } else flash('Não achei outra opção para esta cena.'); ovUI(); } })] : []), el('button', { type: 'button', className: 'btn', textContent: 'Remover', onclick: () => { S.ov.splice(i, 1); ovUI(); } })); ul.append(li);
  });
  drawTimeline(); const at = $('#ovCredit'); if (at) at.hidden = !S.ov.some(o => o.frames);
}
$('#ovTitle').onclick = async () => {
  const w = visible(); if (!w.length) { flash('Ainda não há transcrição para sugerir um título.'); return; }
  const b = $('#ovTitle'); let text = hookTitle(w);
  if (LIVE && S.user) { b.disabled = true; b.textContent = 'Criando com IA…'; try { const r = await assist(CFG, await token(), 'hook', w.map(x => x.w).join(' ').slice(0, 8000)); const t = (r.titles || []).find(x => typeof x === 'string' && x.trim()); if (t) text = t.trim().toUpperCase(); } catch (e) { flash(e.message + ' Usei uma sugestão simples.'); } b.disabled = false; b.textContent = 'Sugerir título de gancho'; }
  S.ov.push({ kind: 'title', text, from: 0, to: Math.min(4, S.dur || 4) }); ovUI();
};
const brUsed = new Set(), brSeen = new Set();
async function brollFor(qs, secs) {
  qs = [].concat(qs);   // qs: consulta principal + alternativas equivalentes (nunca uma palavra solta: melhor sem B-roll do que B-roll sem relação)
  for (const qq of qs) {
    if (S.plan === 'pro' && !S.noVid) { try { const v = await (await import('./brollvideo.js?v=2')).findBrollVideo(CFG, await token(), qq, secs, 12, 360, brUsed); if (v) return { vid: v, q: qq }; } catch (e) { if (e.status === 503 || e.status === 402) S.noVid = true; } }
    const img = await findBroll(qq).catch(() => null); if (img) return { img, q: qq };
  }
  return null;
}
const BR_GUIDE = 'INSTRUCTIONS (follow strictly, they override any shorter rule): First infer the single main TOPIC of the whole speech. Split the speech by ideas, not sentences. Pick only moments that name a concrete, filmable thing, place, object or action (literal match); skip filler, greetings, opinions and direct address (leave visual-free gaps, ~25-40% of the video covered at most). Every query must stay faithful to the TOPIC and to the exact words spoken at [t] (avoid homonyms and figurative readings: e.g. "running a campaign" is NOT jogging). Make each query specific: 2 to 4 English words with the exact object plus its context (e.g. "barista pouring latte", not "coffee"; "laptop typing code", not "work"). Never generic stock ideas (business meeting, handshake, success, teamwork) unless literally said. t must be the second of the first word that motivates the picture. Return JSON {"topic":"...","items":[{"t":seconds,"query":"specific 2-4 words","alt":"a different phrasing of the same visual, 2-3 words"}]}. SPEECH:\n';
$('#ovBroll').onclick = async () => {
  const w = visible(); if (!w.length) { flash('Ainda não há transcrição para escolher os B-rolls.'); return; }
  if (!(LIVE && S.user)) { flash('Entre na sua conta para usar o B-roll automático.'); return; }
  const qty = +$('#brQty').value || 5, secs = +$('#brDur').value || 3, minGap = qty >= 7 ? 4 : qty >= 5 ? 6 : 9;
  const b = $('#ovBroll'); b.disabled = true; b.textContent = 'Lendo a fala inteira…'; S.noVid = false;
  try {
    let all = toLines(w, 14, 0.8).map(l => '[' + l[0].s.toFixed(1) + '] ' + l.map(x => x.w).join(' ')); while (all.join("\n").length > 10500) all = all.filter((_, i) => i % 2 === 0);   // amostra a fala toda, não só o começo
    const r = await assist(CFG, await token(), 'broll', BR_GUIDE + all.join('\n')); let n = 0; const last = S.ov.filter(o => o.kind === 'broll').map(o => o.from);
    for (const it of (r.items || []).slice(0, 12)) {
      if (n >= qty) break;
      const t = +it.t, q = String(it.query || '').trim().toLowerCase(); if (!(t >= 0) || !q || brSeen.has(q) || last.some(x => Math.abs(x - t) < minGap)) continue;
      b.textContent = 'Buscando: ' + q.slice(0, 20) + '…';
      const alt = String(it.alt || '').trim().toLowerCase(); const f = await brollFor([q, ...(alt && alt !== q ? [alt] : [])], secs); if (!f) continue;
      brSeen.add(q); last.push(t); n++;
      if (f.vid) { const d = f.vid.frames.length / f.vid.fps; S.ov.push({ kind: 'broll', frames: f.vid.frames, fps: f.vid.fps, name: f.q, query: q, from: t, to: Math.min(t + Math.max(d, 1.5), S.dur || t + d) }); S.credit = true; }
      else S.ov.push({ kind: 'broll', img: f.img, name: f.q, query: q, from: t, to: Math.min(t + secs, S.dur || t + secs) });
    }
    S.ov.sort((a, b2) => a.from - b2.from); ovUI(); flash(n ? n + ' B-roll(s) adicionados' + (S.credit ? ' (vídeos: Pixabay/Pexels)' : '') + '. Veja as miniaturas, troque ou remova os que não gostar.' : 'Não encontrei cenas livres para este vídeo.');
  } catch (e) { flash(e.message); }
  b.disabled = false; b.textContent = 'B-roll automático (IA)';
};
$('#ovImg').onchange = async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  try { const img = await createImageBitmap(f); const t0 = Math.max(0, +S.cur.toFixed(1)); S.ov.push({ kind: 'image', img, name: f.name, from: t0, to: t0 + 3 }); ovUI(); } catch { flash('Não consegui abrir esta imagem.'); }
};

// holofote que segue o cursor nos cartões (efeito premium, só ponteiro fino)
if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
  addEventListener('pointermove', e => {
    const t = e.target.closest && e.target.closest('.drop,.plan,.gcard,#about .gridf>div');
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    t.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });
}

// ---------- pré-visualização em tela cheia ----------
{ const st = $('#stage'), bar = $('#fsBar'), mark = document.createComment('stage'); let on = false, real = false;
  const setPP = () => { $('#fsPlay').textContent = $('#pp').textContent; };
  new MutationObserver(setPP).observe($('#pp'), { childList: true, characterData: true, subtree: true });
  const toggle = v => {
    if (v === on) return; on = v;
    if (on) { st.replaceWith(mark); document.body.append(st); } else { mark.replaceWith(st); }
    st.classList.toggle('fs', on); document.body.classList.toggle('fsprev', on); bar.hidden = !on; setPP(); S.prev = null;
    if (on) { real = false; try { document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.then(() => { real = true; }).catch(() => 0); } catch { /* iPhone: fica o modo sobreposto */ } }
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => 0);
  };
  $('#fsPrev').onclick = () => toggle(true); $('#fsX').onclick = () => toggle(false); $('#fsPlay').onclick = () => $('#pp').click();
  document.addEventListener('fullscreenchange', () => { if (on && real && !document.fullscreenElement) toggle(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && on) toggle(false); });
}
// ---------- tela cheia e instalação ----------
{ const fsB = $('#nFs'), root = document.documentElement, standalone = matchMedia('(display-mode:standalone),(display-mode:fullscreen)').matches || navigator.standalone;
  if (!standalone && root.requestFullscreen && document.fullscreenEnabled) {   // iPhone não oferece esta API: lá o caminho é instalar na tela de início
    fsB.hidden = false;
    fsB.onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else root.requestFullscreen({ navigationUI: 'hide' }).catch(() => flash('Seu navegador não liberou a tela cheia.')); };
    document.addEventListener('fullscreenchange', () => { $('#fsL').textContent = document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia'; });
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const mobile = ios || /android/i.test(navigator.userAgent);
  const SH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M8 8l4-4 4 4M6 12v7h12v-7"/></svg>';
  const steps = ios ? ['Toque em <b>Compartilhar</b> ' + SH + ' (na barra do Safari ou do Chrome).', 'Role e toque em <b>Adicionar à Tela de Início</b>.', 'Toque em <b>Adicionar</b>. O ícone do ForjaClip aparece na sua tela.'] : ['Abra o menu <b>⋮</b> do navegador.', 'Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.', 'Confirme. O ícone do ForjaClip aparece na sua tela.'];
  let ev = null; if (!standalone && mobile) { $('#nInst').hidden = false; $('#lgInst').hidden = false; }   // no celular o botão sempre aparece: com o aviso nativo ou com o passo a passo
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); ev = e; if (!standalone) { $('#nInst').hidden = false; $('#lgInst').hidden = false; } });
  $('#nInst').onclick = async () => {
    if (ev) { ev.prompt(); await ev.userChoice.catch(() => 0); ev = null; return; }
    $('#instS').innerHTML = steps.map(t => '<li>' + t + '</li>').join(''); $('#instD').showModal();
  };
  addEventListener('appinstalled', () => { $('#nInst').hidden = true; $('#lgInst').hidden = true; });
  $('#lgInst').onclick = () => $('#nInst').click();
}
// ---------- reportar erro ----------
const errLog = []; const pushErr = m => { errLog.push(String(m).slice(0, 200)); if (errLog.length > 5) errLog.shift(); };
addEventListener('error', e => pushErr((e.message || 'erro') + ' @' + String(e.filename || '').split('/').pop() + ':' + (e.lineno || 0)));
addEventListener('unhandledrejection', e => pushErr('promise: ' + (e.reason?.message || e.reason)));
$('#nBug').onclick = () => { $('#bugM').textContent = ''; $('#bugS').disabled = false; $('#bugD').showModal(); $('#bugT').focus(); };
$('#bugX').onclick = () => $('#bugD').close();
$('#bugF').onsubmit = async e => {
  e.preventDefault(); const text = $('#bugT').value.trim(), m = $('#bugM'); if (text.length < 10) { m.textContent = 'Descreva um pouco mais (mínimo de 10 letras).'; return; }
  const info = $('#bugC').checked ? { ua: navigator.userAgent, tela: innerWidth + 'x' + innerHeight, dpr: devicePixelRatio, tema: document.documentElement.dataset.theme || 'auto', plano: S.plan, tela_atual: ['home', 'login', 'editor'].find(v => $('#' + v) && !$('#' + v).hidden) || '', estilo: S.style?.preset || '', erros: errLog } : {};
  $('#bugS').disabled = true; m.textContent = 'Enviando…';
  try {
    if (!(LIVE && S.user)) throw new Error('offline');
    const r = await fetch(CFG.AI + '/report', { method: 'POST', headers: { authorization: 'Bearer ' + await token(), 'content-type': 'application/json' }, body: JSON.stringify({ text, info, email: S.user.email || '' }) });
    if (!r.ok) throw new Error('http ' + r.status);
    m.textContent = 'Recebemos o seu relato. Obrigado!'; $('#bugT').value = ''; setTimeout(() => $('#bugD').open && $('#bugD').close(), 1600);
  } catch {   // sem login ou Worker sem a rota: abre o e-mail já preenchido
    const body = text + (info.ua ? '\n\n--\n' + JSON.stringify(info) : '');
    location.href = 'mailto:' + (CFG.CONTACT || '') + '?subject=' + encodeURIComponent('Erro no ForjaClip') + '&body=' + encodeURIComponent(body.slice(0, 1500));
    m.textContent = 'Abrimos o seu app de e-mail com o relato pronto para enviar.'; $('#bugS').disabled = false;
  }
};
import('./fx.js?v=15').then(m => m.initFx()).catch(() => {});

// editor em tela estreita: reduzir/ampliar o vídeo flutuante e mostrar opções do vídeo
{
  const ed = document.querySelector('#edit .edit'), sz = document.querySelector('#flSize'), mo = document.querySelector('#flMore');
  sz?.addEventListener('click', () => { const m = ed.classList.toggle('shrunk'); sz.textContent = m ? 'Ampliar vídeo' : 'Reduzir vídeo'; });
  mo?.addEventListener('click', () => { const m = ed.classList.toggle('more'); mo.textContent = m ? 'Ocultar opções' : 'Opções do vídeo'; });
}

// ---------- painel do criador (só aparece para quem está na tabela admins; o servidor confere de novo em cada chamada) ----------
(() => {
  const d = $('#adm'), T = $('#amT'), M = $('#amM'), fmt = v => v ? new Date(v).toLocaleDateString('pt-BR') : '–', brl = n => 'R$ ' + Number(n || 0).toFixed(2).replace('.', ',');
  const err = e => { M.textContent = 'Erro: ' + (e?.message || e); };
  async function overview() {
    const { data, error } = await S.sb.rpc('admin_overview'); if (error) return err(error);
    const c = [['Usuários', data.users], ['Novos (7 dias)', data.new7], ['Assinantes Pro', data.pro], ['Projetos', data.projects], ['Pagamentos', data.payments], ['Receita', brl(data.revenue)], ['Áudio hoje (min)', Math.round(data.audio_today / 60)], ['Análises IA hoje', data.llm_today]];
    $('#amC').replaceChildren(...c.map(([k, v]) => { const x = document.createElement('div'), b = document.createElement('b'), s = document.createElement('span'); b.textContent = v ?? 0; s.textContent = k; x.append(b, s); return x; }));
  }
  async function users() {
    M.textContent = ''; const { data, error } = await S.sb.rpc('admin_users', { q: $('#amQ').value.trim(), lim: 50 }); if (error) return err(error);
    const t = document.createElement('table'), hr = t.insertRow();
    for (const h of ['E-mail', 'Criado', 'Último acesso', 'Pro até', 'Projetos', 'Pago', 'Ações']) { const th = document.createElement('th'); th.textContent = h; hr.append(th); }
    for (const u of data || []) {
      const r = t.insertRow(), on = u.pro_until && new Date(u.pro_until) > new Date();
      [u.email || '(sem e-mail)', fmt(u.created_at), fmt(u.last_sign_in_at), on ? fmt(u.pro_until) : '–', u.projects, brl(u.paid)].forEach((v, i) => { const c = r.insertCell(); c.textContent = v; if (i === 3 && on) c.className = 'ok'; });
      const ac = r.insertCell();
      for (const [lab, days] of [['+31 dias', 31], ['+1 ano', 366], ['Encerrar Pro', 0]]) {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = lab;
        b.onclick = async () => { if (!confirm(`${lab} para ${u.email}?`)) return; const x = await S.sb.rpc('admin_grant', { uid: u.id, days }); if (x.error) return err(x.error); M.textContent = 'Feito para ' + u.email + '.'; users(); overview(); };
        ac.append(b);
      }
    }
    T.replaceChildren(t); if (!data?.length) M.textContent = 'Nenhum usuário encontrado.';
  }
  $('#nAdm').onclick = () => { d.showModal(); overview(); users(); };
  $('#amGo').onclick = users; $('#amQ').onkeydown = e => { if (e.key === 'Enter') users(); }; $('#amX').onclick = () => d.close();
})();

// ---------- tour guiado: abre sozinho na primeira vez e pode ser refeito pelo botão "Tour" ----------
const tourSeen = k => { try { return !!localStorage.getItem('forjaclip.tour.' + k); } catch { return true; } };
const tourMark = k => { try { localStorage.setItem('forjaclip.tour.' + k, '1'); } catch { /* ok */ } };
async function tourRun(k) { const m = await import('./tour.js?v=3'); tourMark(k); return m.startTour(k, k === 'edit' ? m.EDIT : m.HOME); }
function tourAuto(k, view) { if (tourSeen(k)) return; setTimeout(() => { if ($('#' + view).hidden || document.querySelector('dialog[open]')) return; tourRun(k); }, 1600); }
$('#nTour').onclick = () => tourRun($('#edit').hidden ? 'home' : 'edit');
new MutationObserver(() => { if (!$('#home').hidden) tourAuto('home', 'home'); else if (!$('#edit').hidden) tourAuto('edit', 'edit'); }).observe($('#home'), { attributes: true, attributeFilter: ['hidden'] });
new MutationObserver(() => { if (!$('#edit').hidden) tourAuto('edit', 'edit'); }).observe($('#edit'), { attributes: true, attributeFilter: ['hidden'] });

// ---------- mini-players dos cortes: prévia muda no hover, um ativo por vez, carrega só ao aparecer na tela ----------
let miniOn = null;
const miniIO = 'IntersectionObserver' in window ? new IntersectionObserver(es => { for (const x of es) if (x.isIntersecting) { const v = x.target.querySelector('video'); if (v && !v.src) { v.src = x.target._src + '#t=' + x.target._c.start; } miniIO.unobserve(x.target); } }, { rootMargin: '120px' }) : null;
function miniStop(b) { const v = b.querySelector('video'); b.classList.remove('on'); b.setAttribute('aria-label', 'Prévia do corte ' + (b._c.title || '') + ': tocar'); try { v.pause(); v.muted = true; v.currentTime = b._c.start; } catch { /* ok */ } if (miniOn === b) miniOn = null; }
function miniPlay(b, sound) { if (miniOn && miniOn !== b) miniStop(miniOn); const v = b.querySelector('video'); if (!v.src) v.src = b._src; miniOn = b; b.classList.add('on'); b.setAttribute('aria-label', 'Prévia do corte ' + (b._c.title || '') + ': parar'); v.muted = !sound; if (v.currentTime < b._c.start || v.currentTime >= b._c.end) v.currentTime = b._c.start; v.play().catch(() => miniStop(b)); }
function miniClip(c) {
  const src = $('#vid').src; if (!src || !S.file) return null;
  const b = document.createElement('button'), v = document.createElement('video'), pl = document.createElement('span');
  b.type = 'button'; b.className = 'mini'; b._c = c; b._src = src; v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.setAttribute('aria-hidden', 'true'); pl.className = 'mpl'; pl.textContent = '▶'; pl.setAttribute('aria-hidden', 'true'); b.append(v, pl); b.setAttribute('aria-label', 'Prévia do corte ' + (c.title || '') + ': tocar');
  v.ontimeupdate = () => { if (v.currentTime >= c.end) miniStop(b); };
  let ht = 0; const hover = matchMedia('(hover:hover)').matches && !matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (hover) { b.onmouseenter = () => { ht = setTimeout(() => miniPlay(b, false), 300); }; b.onmouseleave = () => { clearTimeout(ht); if (b.classList.contains('on') && v.muted) miniStop(b); }; }
  b.onclick = () => { clearTimeout(ht); if (b.classList.contains('on') && !v.muted) miniStop(b); else miniPlay(b, true); };
  b.onkeydown = e => { if (e.key === 'Escape') miniStop(b); };
  if (miniIO) miniIO.observe(b); else v.src = src + '#t=' + c.start;
  return b;
}

// ---------- buscar momento por palavra (cria cortes a partir da transcrição, tudo no navegador) ----------
const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const STOP = new Set('que para com uma uns umas mais mas como isso essa esse esta este eles elas voce voces porque entao tambem muito pois sobre quando onde ainda aqui assim depois antes cada fazer faz tem tenho tinha foi vai vou ser era sao nao sim nos seu sua dele dela mesmo gente coisa coisas pode ficar bem so ja ate entre desde'.split(' '));
function kwSuggest() {
  const box = $('#kwSug'); if (!box) return; box.replaceChildren();
  const f = new Map(), show = new Map(); for (const w of S.words) { const n = norm(w.w); if (n.length >= 5 && !STOP.has(n)) { f.set(n, (f.get(n) || 0) + 1); if (!show.has(n)) show.set(n, w.w.toLowerCase().replace(/[.,!?;:…"“”()]/g, '')); } }
  [...f].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([n]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = show.get(n); b.onclick = () => { $('#kwQ').value = show.get(n); kwFind(); }; box.append(b); });
}
function kwClip(i) {
  const W = S.words, hit = W[i]; let a = i; const limit = hit.s - 12;
  while (a > 0 && W[a - 1].s >= limit && !/[.!?…]$/.test(W[a - 1].w)) a--;
  const s0 = a === 0 || /[.!?…]$/.test(W[a - 1].w) ? W[a].s : Math.max(0, hit.s - 4);
  let e0 = Math.min(S.dur || s0 + 35, s0 + 35);
  for (let j = i; j < W.length && W[j].e <= s0 + 60; j++) if (W[j].e >= s0 + 22 && /[.!?…]$/.test(W[j].w)) { e0 = W[j].e; break; }
  return { start: +s0.toFixed(2), end: +Math.min(e0, S.dur || e0).toFixed(2) };
}
function kwFind() {
  const q = $('#kwQ').value.trim(), out = $('#kwRes'), msg = $('#kwMsg'); out.replaceChildren(); msg.textContent = '';
  const toks = q.split(/\s+/).map(norm).filter(Boolean);
  if (!S.words.length) { msg.textContent = 'Gere a transcrição primeiro.'; return; }
  if (!toks.length || toks.join('').length < 3) { msg.textContent = 'Digite uma palavra com pelo menos 3 letras.'; return; }
  const N = S.words.map(w => norm(w.w)), hits = [];
  for (let i = 0; i + toks.length <= N.length; i++) { if (toks.every((t, k) => toks.length === 1 ? N[i + k].includes(t) : N[i + k] === t)) { if (!hits.length || S.words[i].s - S.words[hits[hits.length - 1]].s >= 20) hits.push(i); } }
  if (!hits.length) { msg.textContent = 'Não encontrei “' + q + '” na fala.'; return; }
  msg.textContent = hits.length + (hits.length === 1 ? ' momento encontrado.' : ' momentos encontrados.') + (hits.length > 12 ? ' Mostrando os 12 primeiros.' : '');
  for (const i of hits.slice(0, 12)) {
    const c = kwClip(i), li = document.createElement('li'), t = document.createElement('b'), snip = document.createElement('q'), row = document.createElement('div');
    li.className = 'kwr'; t.textContent = mmss(c.start) + ' a ' + mmss(c.end);
    const from = Math.max(0, i - 6), to = Math.min(S.words.length, i + toks.length + 6);
    snip.append('… ', ...S.words.slice(from, to).flatMap((w, k) => { const m = document.createElement('mark'); if (from + k >= i && from + k < i + toks.length) { m.textContent = w.w; return [m, ' ']; } return [w.w + ' ']; }), '…');
    row.className = 'acts';
    const prev = document.createElement('button'), add = document.createElement('button'); prev.type = add.type = 'button'; prev.className = 'btn'; add.className = 'btn pri'; prev.textContent = 'Ouvir'; add.textContent = 'Criar corte';
    prev.onclick = () => previewClip({ start: c.start, end: c.end });
    add.onclick = () => { S.clips.push({ id: 'k' + Date.now() + i, start: c.start, end: c.end, title: 'Sobre “' + q.slice(0, 40) + '”', reason: 'palavra: ' + q.slice(0, 40) }); save({ clips: S.clips.map(({ url, state, p, err, ...x }) => x) }); clipsUI(); flash('Corte criado. Ele aparece na lista de cortes acima.'); };
    row.append(prev, add); li.append(t, snip, row); out.append(li);
  }
}
$('#kwGo').onclick = kwFind; $('#kwQ').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); kwFind(); } };
// ---------- lista de cortes para editores (EDL CMX3600, 30 fps) ----------
// ---------- edição automática: tira pausas e hesitações do vídeo (usa a transcrição, no próprio aparelho) ----------
function autoEdit(fromRec) {
  if (!S.words.length) { flash('Gere a transcrição primeiro.'); return; }
  if (!canPro()) { $('#pay').showModal(); return; }
  const before = { cut: S.fx.cut, acut: S.fx.acut };
  S.fx.cut = 1; S.fx.acut = 1; S.style.fx = S.fx; syncFx(); saveSoon('style', { style: S.style }); rebuild();
  const r = cutRanges(visible(), 0, S.dur, S.fx, S.words), rem = r.reduce((n, [x, y]) => n + y - x, 0), msg = $('#autoEditM');
  const txt = rem >= 1 ? (fromRec ? 'Edição automática aplicada à sua gravação: ' : 'Edição automática aplicada: ') + Math.round(rem) + ' s de pausas e hesitações removidos (' + Math.round(rem / Math.max(1, S.dur) * 100) + '% do vídeo). Toque em Reproduzir para ver o resultado e ajuste em Ferramentas > Som.' : 'Não achei pausas ou hesitações para cortar.';
  if (msg) msg.textContent = txt; status(txt);
  if (rem >= 1) { S.prev = { s: 0, e: S.dur }; S.prevRem = r; seek(0); flash('Edição automática aplicada: ' + Math.round(rem) + ' s removidos.', { label: 'Desfazer', fn: () => { S.fx.cut = before.cut || 0; S.fx.acut = before.acut || 0; S.style.fx = S.fx; syncFx(); saveSoon('style', { style: S.style }); rebuild(); S.prev = null; S.prevRem = null; if (msg) msg.textContent = 'Edição automática desfeita.'; } }); }
}
// a edição automática é uma escolha do usuário e vale só para vídeo vertical
const aeVertical = () => { const v = $('#vid'); return !(v && v.videoWidth && v.videoHeight) || v.videoHeight > v.videoWidth; };
function aeSync() {
  const b = $('#autoEdit'), m = $('#autoEditM'); if (!b) return; const ok = aeVertical(); b.disabled = !ok;
  if (!ok) m.textContent = 'A edição automática é feita para vídeos verticais (como os gravados no teleprompter). Este vídeo é horizontal.'; else if (m.textContent.startsWith('A edição automática é feita')) m.textContent = '';
}
$('#vid').addEventListener('loadedmetadata', aeSync);
$('#aeYes').onclick = () => { $('#aeD').close(); autoEdit(true); };
$('#aeNo').onclick = () => $('#aeD').close();

$('#autoEdit').onclick = () => autoEdit(false);
// timeline sem silêncios em EDL (abre no Premiere e no DaVinci Resolve)
$('#edlCutBtn').onclick = () => {
  if (!S.words.length) { flash('Gere a transcrição primeiro.'); return; }
  if (!S.fx.cut && !S.fx.acut) { flash('Ative a edição automática ou “Remover silêncios” antes de exportar.'); return; }
  const base = S.mode !== 'captions' && S.clips.some(c => c.id !== 'full') ? [...S.clips].filter(c => c.id !== 'full').sort((a, b) => a.start - b.start) : [{ start: 0, end: S.dur, title: 'Vídeo' }];
  const segs = [];
  for (const c of base) { let t = c.start; for (const [x, y] of cutRanges(visible(), c.start, c.end, S.fx, S.words)) { if (x - t > 0.1) segs.push([t, x, c.title]); t = Math.max(t, y); } if (c.end - t > 0.1) segs.push([t, c.end, c.title]); }
  if (!segs.length) { flash('Nada para exportar.'); return; }
  const FPS = 30, tc = t => { const f = Math.round(t * FPS), h = Math.floor(f / (FPS * 3600)), m = Math.floor(f / (FPS * 60)) % 60, sec = Math.floor(f / FPS) % 60; return [h, m, sec, f % FPS].map(n => String(n).padStart(2, '0')).join(':'); };
  const name = (S.title || 'video').replace(/[^\w. -]/g, '_'); let rec = 0, out = 'TITLE: ' + name + ' (sem silêncios)\nFCM: NON-DROP FRAME\n\n';
  segs.forEach(([a, b, t], i) => { out += String(i + 1).padStart(3, '0') + '  AX       AA/V  C        ' + tc(a) + ' ' + tc(b) + ' ' + tc(rec) + ' ' + tc(rec + b - a) + '\n* FROM CLIP NAME: ' + name + '\n\n'; rec += b - a; });
  const el0 = document.createElement('a'); el0.href = URL.createObjectURL(new Blob([out], { type: 'text/plain' })); el0.download = 'forjaclip-sem-silencios.edl'; el0.click(); setTimeout(() => URL.revokeObjectURL(el0.href), 4000);
  flash('Timeline com ' + segs.length + ' trechos baixada. Importe o vídeo original no editor e depois o arquivo EDL.');
};

$('#edlBtn').onclick = () => {
  const cl = [...S.clips].sort((a, b) => a.start - b.start); if (!cl.length) { flash('Crie ou gere cortes primeiro.'); return; }
  const FPS = 30, tc = t => { const f = Math.round(t * FPS), h = Math.floor(f / (FPS * 3600)), m = Math.floor(f / (FPS * 60)) % 60, s = Math.floor(f / FPS) % 60; return [h, m, s, f % FPS].map(n => String(n).padStart(2, '0')).join(':'); };
  const name = (S.title || 'video').replace(/[^\w. -]/g, '_'); let rec = 0, out = 'TITLE: ' + name + '\nFCM: NON-DROP FRAME\n\n';
  cl.forEach((c, i) => { const d = c.end - c.start; out += String(i + 1).padStart(3, '0') + '  AX       AA/V  C        ' + tc(c.start) + ' ' + tc(c.end) + ' ' + tc(rec) + ' ' + tc(rec + d) + '\n* FROM CLIP NAME: ' + name + '\n* COMMENT: ' + String(c.title || 'Corte ' + (i + 1)).replace(/[\r\n]/g, ' ') + '\n\n'; rec += d; });
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'text/plain' })); a.download = 'forjaclip-cortes.edl'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};

// ---------- importar legenda pronta (SRT/VTT): pula a transcrição automática ----------
const cueT = t => { const m = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/.exec(t); return m ? (+m[1] || 0) * 3600 + +m[2] * 60 + +m[3] + +('0.' + m[4].padEnd(3, '0')) : null; };
function parseSub(txt) {
  const words = [];
  for (const blk of txt.replace(/\r/g, '').replace(/^\uFEFF/, '').split(/\n\s*\n/)) {
    const ln = blk.split('\n'), i = ln.findIndex(l => l.includes('-->')); if (i < 0) continue;
    const [a, b] = ln[i].split('-->'), s = cueT(a), e = cueT(b); if (s == null || e == null || e <= s) continue;
    const ws = ln.slice(i + 1).join(' ').replace(/<[^>]*>|\{[^}]*\}/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').split(/\s+/).filter(Boolean); if (!ws.length) continue;
    const tot = ws.reduce((n, w) => n + w.length + 1, 0); let t = s;
    for (const w of ws) { const d = (e - s) * (w.length + 1) / tot; words.push({ w, s: +t.toFixed(2), e: +(t + d).toFixed(2) }); t += d; }
  }
  return words;
}
$('#srtIn').onchange = async ev => {
  const f = ev.target.files[0], m = $('#srtInM'); ev.target.value = ''; if (!f) return;
  if (f.size > 3 * MB) { m.textContent = 'Arquivo grande demais para legenda (máx. 3 MB).'; return; }
  const words = parseSub(await f.text());
  if (words.length < 3) { m.textContent = 'Não consegui ler este arquivo. Use um .srt ou .vtt com tempos (00:00:01,000 --> 00:00:03,000).'; return; }
  if (S.words.length && !confirm('Substituir a transcrição atual pela legenda importada?')) return;
  S.words = words; $('#txt').value = words.map(w => w.w).join(' '); rebuild();
  await save({ transcript: { words }, duration: S.media?.duration || S.dur });
  clipsUI(); m.textContent = words.length + ' palavras importadas. Os tempos de cada palavra foram estimados a partir de cada trecho da legenda.'; flash('Legenda importada.');
};
$('#srtInL').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#srtIn').click(); } };
