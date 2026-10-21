import { CATS, FONTS, fontsUrl, loadFont, PRESETS, PLATFORMS, DEFAULT_STYLE, resolve, chunksOf, drawCaption, safeRect, outsideSafe } from './captions.js';
import { openMedia, extractAudio } from './media.js';
import { renderClip } from './render.js';
import { silences, zoomAt } from './edit.js';
import { suggestClips } from './clips.js';
import { retime, tokens, fromWhisper } from './transcript.js';
import { ICONS } from './icons.js';
import { drawOverlays, drawBroll, hookTitle } from './overlays.js';
import { findBroll } from './broll.js';
import { ytId, ytSupported, mountPlayer, record, flatten } from './yt.js';
import { initGuide } from './guide.js';
import { assist, translateWords, toLines } from './ai.js';
import { addEmojis } from './extras.js';

const $ = s => document.querySelector(s), CFG = window.CFG || {};
const LIVE = !!(CFG.AI && CFG.SB_URL && CFG.SB_ANON && window.supabase);
const MB = 1024 ** 2, LIMIT = { free: 350 * MB, pro: 1024 * MB }, SAMPLE = 'o segredo não é trabalhar mais horas. é escolher melhor onde colocar a sua energia todos os dias.';
const el = (t, a = {}, ...c) => { const e = document.createElement(t); Object.assign(e, a); c.forEach(x => e.append(x)); return e; };
const mmss = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } } };
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
  f.innerHTML = '<div class="or"><span>ou</span></div><label class="sr" for="lemail">E-mail</label><input id="lemail" type="email" inputmode="email" autocomplete="email" placeholder="seu@email.com" required><button type="submit" class="btn pri">Entrar com e-mail</button>';
  f.onsubmit = async e => {
    e.preventDefault(); const em = f.querySelector('input').value.trim(), msg = $('#lmsg'); msg.className = 'warn';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { msg.textContent = 'Digite um e-mail válido.'; return; }
    if (!S.sb) { msg.textContent = 'Login indisponível no modo demonstração.'; return; }
    const btn = f.querySelector('button'); btn.disabled = true; msg.textContent = 'Enviando…';
    const { error } = await S.sb.auth.signInWithOtp({ email: em, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true } });
    btn.disabled = false;
    if (error) { msg.textContent = /rate|limit/i.test(error.message) ? 'Muitos pedidos agora. Tente de novo em alguns minutos.' : 'Não foi possível enviar o link: ' + error.message; return; }
    msg.className = 'ok'; msg.textContent = 'Enviamos um link de acesso para ' + em + '. Abra o e-mail neste aparelho (veja também o spam).';
  };
  $('#prov').after(f);
}

// ---------- projetos ----------
async function home() {
  view('home'); S.pid = null; stopPlay();
  if (!LIVE) { $('#plist').replaceChildren(); $('#pempty').hidden = false; $('#pempty').textContent = 'Modo demonstração: os projetos não são salvos.'; return; }
  const { data, error } = await S.sb.from('projects').select('id,title,duration,expires_at,created_at').order('created_at', { ascending: false });
  if (error) { flash('Não foi possível listar os projetos: ' + error.message); return; }
  const ul = $('#plist'); ul.replaceChildren(); $('#pempty').hidden = data.length > 0; $('#pempty').textContent = 'Nenhum projeto ainda.';
  for (const p of data) {
    const days = Math.max(0, Math.ceil((new Date(p.expires_at) - Date.now()) / 864e5));
    const th = ls.get('th_' + p.id);
    ul.append(el('li', { className: 'item' }, ...(th ? [el('img', { className: 'th', src: th, alt: '' })] : []), el('div', { className: 'grow' }, el('b', { textContent: p.title || 'Sem título' }), el('div', { className: 'mut', textContent: (p.duration ? mmss(p.duration) + ' · ' : '') + 'expira em ' + days + (days === 1 ? ' dia' : ' dias') })),
      el('button', { className: 'btn', textContent: 'Abrir', onclick: () => openProject(p.id) }),
      el('button', { className: 'btn', textContent: 'Excluir', onclick: async () => { if (!confirm('Excluir este projeto?')) return; const r = await S.sb.from('projects').delete().eq('id', p.id); if (r.error) flash(r.error.message); else home(); } })));
  }
  ads();
}
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
  const pro = S.plan === 'pro', max = pro ? LIMIT.pro : LIMIT.free, mb = Math.round(f.size / MB);
  if (f.size > max) { flash(pro ? `Este vídeo tem ${mb} MB e o limite do Pro é 1 GB. Tente comprimir o vídeo antes de enviar.` : `Este vídeo tem ${mb} MB. O plano gratuito aceita até 350 MB. Com o Pro você envia até 1 GB, ou pode comprimir o vídeo antes.`, { label: 'Ver Pro', fn: () => $('#nPro').onclick && $('#nPro').onclick() }); return; }
  if (/iPhone|iPad/.test(navigator.userAgent) && f.size > 500 * MB) flash('Vídeo grande para o iPhone (' + mb + ' MB). Se travar, tente no computador ou use um trecho menor.');
  let media; try { media = await openMedia(f); } catch (e) { flash(e.message); return; }
  S.file = f; S.media = media; S.title = f.name; S.words = []; S.clips = []; S.dur = media.duration; S.style = { ...structuredClone(DEFAULT_STYLE), preset: S.homePreset || 'iman' }; S.fx = { cut: 0, zoom: 0 }; S.hid = new Set(); S.ratio = '9:16'; S.ov = [];
  if (LIVE) {
    const { data, error } = await S.sb.from('projects').insert({ title: f.name, fingerprint: fp(f), duration: media.duration, style: S.style }).select('id').single();
    if (error) { flash('Não foi possível criar o projeto: ' + error.message); return; }
    S.pid = data.id;
  } else S.pid = null;
  enterEdit(); setVideo(f); rebuild(); sync();
  pipeline();
}
async function openProject(id) {
  const { data: p, error } = await S.sb.from('projects').select('*').eq('id', id).single();
  if (error) { flash('Não foi possível abrir: ' + error.message); return; }
  S.pid = id; S.file = null; S.media = null; S.title = p.title || ''; S.dur = p.duration || 8; S.words = p.transcript?.words || []; S.clips = (p.clips || []).map(c => ({ ...c }));
  S.style = { ...structuredClone(DEFAULT_STYLE), ...(p.style || {}) }; S.fp = p.fingerprint; S.fx = { cut: 0, zoom: 0, ...(p.style?.fx || {}) }; S.ratio = p.style?.ratio || '9:16'; S.hid = new Set(p.style?.hid || []);
  enterEdit(); rebuild(); sync(); clipsUI(); $('#txt').value = S.words.map(w => w.w).join(' ');
  $('#phTxt').textContent = 'Para pré-visualizar e gerar cortes, selecione de novo o vídeo "' + S.title + '".';
  status(S.words.length ? 'Projeto carregado. A transcrição e os cortes estão salvos.' : 'Este projeto ainda não tem transcrição. Selecione o vídeo para continuar.');
}
$('#newfile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; newVideo(f, 'clips'); };
$('#newfile2').onchange = e => { const f = e.target.files[0]; e.target.value = ''; newVideo(f, 'captions'); };
$('#ytForm').onsubmit = async e => {
  e.preventDefault(); const id = ytId($('#ytUrl').value.trim()), m = $('#ytMsg');
  if (!id) { m.textContent = 'Cole um link do YouTube válido (youtube.com ou youtu.be).'; return; }
  if (!ytSupported()) { m.textContent = 'Gravar do YouTube funciona no Chrome ou Edge no computador. No celular, envie o arquivo do vídeo.'; return; }
  m.textContent = 'Carregando player…';
  try {
    const box = $('#ytbox'), player = await mountPlayer(box, id); m.textContent = ''; $('#ytd').showModal(); $('#ytSt').textContent = '';
    $('#ytX').onclick = () => { try { player.destroy(); } catch {} $('#ytd').close(); };
    $('#ytStop').onclick = () => box._stop?.();
    $('#ytRec').onclick = async () => {
      if (!$('#ytOk').checked) { $('#ytSt').textContent = 'Confirme os direitos sobre o vídeo para continuar.'; return; }
      $('#ytRec').disabled = true; $('#ytStop').hidden = false;
      try {
        const f = await record(player, box, { start: +$('#ytS').value || 0, end: +$('#ytE').value || 0, onStatus: (a, b) => $('#ytSt').textContent = `Gravando… ${mmss(a)} / ${mmss(b)}` });
        $('#ytd').close(); try { player.destroy(); } catch {} await newVideo(await flatten(f), 'clips');
      } catch (err) { $('#ytSt').textContent = err.message || 'Falha na gravação.'; }
      $('#ytRec').disabled = false; $('#ytStop').hidden = true;
    };
  } catch (err) { m.textContent = err.message || 'Não foi possível abrir o vídeo.'; }
};

$('#drop').ondragover = e => { e.preventDefault(); $('#drop').classList.add('on'); }; $('#drop').ondragleave = () => $('#drop').classList.remove('on');
$('#drop').ondrop = e => { e.preventDefault(); $('#drop').classList.remove('on'); newVideo(e.dataTransfer.files[0], 'clips'); };
$('#drop2').ondragover = e => { e.preventDefault(); $('#drop2').classList.add('on'); }; $('#drop2').ondragleave = () => $('#drop2').classList.remove('on');
$('#drop2').ondrop = e => { e.preventDefault(); $('#drop2').classList.remove('on'); newVideo(e.dataTransfer.files[0], 'captions'); };
$('#attach').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  let media; try { media = await openMedia(f); } catch (er) { flash(er.message); return; }
  if (S.pid && Math.abs(media.duration - S.dur) > 1.5) { flash('Este arquivo tem duração diferente do projeto. Escolha o mesmo vídeo.'); return; }
  S.file = f; S.media = media; if (!S.words.length) { S.dur = media.duration; pipeline(); } setVideo(f);
};

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
    S.words = words; $('#txt').value = words.map(w => w.w).join(' '); rebuild();
    await save({ transcript: { words }, duration: S.media.duration });
    if (S.mode === 'captions') { S.clips = [{ id: 'full', start: 0, end: S.media.duration, title: 'Vídeo completo', reason: '' }]; await save({ clips: S.clips }); clipsUI(); status(S.media.duration > 120 ? 'Transcrição pronta. A exportação no navegador vai até 2 minutos: crie cortes de até 2 min na aba Ferramentas.' : 'Transcrição pronta. Escolha o estilo e exporte na aba Ferramentas.'); return; }
    if (!LIVE) { clipsUI(); status('Transcrição pronta. A sugestão de cortes por IA precisa do servidor; crie um corte manual na aba Ferramentas.'); return; }
    status('Transcrição pronta. Procurando os melhores cortes…'); prog(0);
    try { const cl = await suggestClips(words, S.media.duration, async lines => (await ai('/clips', JSON.stringify({ lines }), 'application/json')).clips, p => prog(p)); S.clips = cl; await save({ clips: cl }); clipsUI(); status(cl.length ? 'Pronto: transcrição e ' + cl.length + (cl.length === 1 ? ' corte sugerido.' : ' cortes sugeridos.') : 'Transcrição pronta. Nenhum corte forte encontrado; você pode criar um manualmente.'); }
    catch (e) { clipsUI(); status(e.code === 'paid' ? 'Transcrição pronta. Cortes por IA fazem parte do plano pago.' : 'Transcrição pronta. Os cortes sugeridos falharam: ' + e.message); }
  } catch (e) { status('Não foi possível transcrever: ' + (/fetch|network|import/i.test(e.message) && !LIVE ? 'o download do modelo de voz foi bloqueado neste ambiente (a prévia do Claude não permite). Publique o app (GitHub Pages) ou conecte o Worker.' : e.message)); }
  finally { prog(null); S.busy = false; $('#txt').readOnly = false; }
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
function enterEdit() { view('edit'); tab('style'); setRatio(S.ratio); S.cur = 0; S.prev = null; $('#scrub').max = S.dur; prog(null); S.bbox = null; }
function setVideo(f) {
  const v = $('#vid'); v.src = URL.createObjectURL(f); v.style.display = 'block'; $('#ph').hidden = true; v.onloadedmetadata = () => { if (v.currentTime === 0) v.currentTime = 0.05; $('#scrub').max = v.duration; S.dur = v.duration; drawTimeline(); }; v.onloadeddata = () => thumb(S.pid); S.playing = false; $('#pp').textContent = 'Reproduzir';
}
function tab(t) { for (const [id, k] of [['pStyle', 'style'], ['pText', 'text'], ['pClips', 'clips']]) $('#' + id).hidden = k !== t; document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.t === t)); }
document.querySelectorAll('.tabs button').forEach(b => { b.onclick = () => tab(b.dataset.t); });
const rs = () => resolve(S.tmp ? { ...S.style, preset: S.tmp, o: {} } : S.style);
const hkey = w => +w.s.toFixed(2), visible = () => S.words.filter(w => !S.hid.has(hkey(w)));
function rebuild() { S.chunks = chunksOf(S.fx.emoji ? addEmojis(visible()) : visible(), Math.max(1, rs().n | 0)); drawTimeline(); phrasesUI(); }
function setO(k, v) { if (['x', 'y', 'cropX'].includes(k)) S.style[k] = v; else S.style.o = { ...S.style.o, [k]: v }; rebuild(); applyCrop(); saveSoon('style', { style: S.style }); }
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
  const safe = el('input', { type: 'checkbox', id: 'c_safe', onchange: () => { S.safeOn = safe.checked; } });
  ctl.append(
    grp('Texto', el('div', { className: 'row' }, el('label', { htmlFor: 'c_font', textContent: 'Fonte' }), font), mkRange('fs', 'Tamanho da fonte', 0, 100), mkSeg('case', 'Caixa', [['none', 'Aa'], ['upper', 'AA'], ['lower', 'aa']]), mkWeight('wLight', 'Peso das palavras'), mkWeight('wActive', 'Peso da palavra falada'), mkRange('n', 'Palavras por linha', 1, 5, 1, ''), mkSeg('letter', 'Destaque por', [[false, 'Palavra'], [true, 'Letra']])),
    grp('Cores', mkColor('color', 'Texto'), mkColor('activeColor', 'Palavra falada'), mkColor('strokeColor', 'Contorno'), mkRange('stroke', 'Espessura do contorno', 0, 100), mkColor('bg', 'Fundo'), mkRange('bgOpacity', 'Opacidade do fundo', 0, 100)),
    grp('Efeitos', mkSeg('pop', 'Entrada com pulo', [[0, 'Não'], [1, 'Sim']]), mkSeg('shadow', 'Sombra', [[0, 'Não'], [1, 'Sim']])),
    grp('Posição', mkAlign('Alinhar na horizontal', 'x', [[0.2, 'Esq.'], [0.5, 'Centro'], [0.8, 'Dir.']]), mkAlign('Alinhar na vertical', 'y', [[0.2, 'Topo'], [0.5, 'Meio'], [0.72, 'Base']]), mkRange('x', 'Horizontal', 0, 100, 1, '%', 100), mkRange('y', 'Vertical', 0, 100, 1, '%', 100), mkRange('cropX', 'Enquadramento do vídeo', 0, 100, 1, '%', 100), el('div', { className: 'row' }, el('label', { htmlFor: 'c_plat', textContent: 'Área segura' }), platform), el('div', { className: 'row' }, el('label', { htmlFor: 'c_safe', textContent: 'Mostrar área segura' }), safe), el('p', { className: 'mut', textContent: 'Dica: arraste a legenda direto no vídeo. A área segura usa margens publicadas para anúncios; não são regras oficiais para posts orgânicos.' })));
}
// galeria de estilos: prévia animada de cada estilo, filtro por categoria e busca
const PREV = [{ w: 'Palavras', s: 0, e: .6 }, { w: 'que', s: .6, e: 1.1 }, { w: 'prendem', s: 1.1, e: 1.8 }, { w: 'a', s: 1.8, e: 2.1 }, { w: 'tela', s: 2.1, e: 2.9 }], PCH = chunksOf(PREV, 3);
function mountGallery(box, getCur, onPick, hover) {
  box.replaceChildren(); let cat = 'Todos', q = '';
  const chips = el('div', { className: 'chips', role: 'group', ariaLabel: 'Categorias' }), search = el('input', { type: 'search', placeholder: 'Buscar estilo', ariaLabel: 'Buscar estilo', id: 'gs_' + (box.id || 'x') }), grid = el('div', { className: 'gal' });
  const mark = () => grid.querySelectorAll('.gcard').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === getCur())));
  const paint = () => {
    grid.replaceChildren();
    for (const [id, p] of Object.entries(PRESETS)) {
      if ((cat !== 'Todos' && p.cat !== cat) || (q && !p.name.toLowerCase().includes(q))) continue;
      const locked = !canPro() && !p.free, cv = el('canvas', { width: 300, height: 170 }); cv.dataset.p = id;
      const b = el('button', { type: 'button', className: 'gcard', onclick: async () => { if (locked) { $('#pay').showModal(); return; } await onPick(id); mark(); } }, cv, el('span', { className: 'gn', textContent: p.name }), ...(locked ? [el('span', { className: 'lk', textContent: 'PRO' })] : []));
      b.dataset.id = id; if (hover && !locked) { const on = async () => { await loadFont(p.font, p.wLight, p.wActive); S.tmp = id; rebuild(); }, off = () => { if (S.tmp) { S.tmp = null; rebuild(); } }; b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && S.file) on(); }); b.addEventListener('pointerleave', off); b.addEventListener('focus', () => { if (S.file) on(); }); b.addEventListener('blur', off); b.addEventListener('click', () => { S.tmp = null; }); } grid.append(b);
    }
    if (!grid.children.length) grid.append(el('p', { className: 'mut', textContent: 'Nenhum estilo encontrado.' }));
    mark();
  };
  CATS.forEach(c => { const b = el('button', { type: 'button', textContent: c, onclick: () => { cat = c; [...chips.children].forEach(x => x.setAttribute('aria-pressed', String(x === b))); paint(); } }); b.setAttribute('aria-pressed', String(c === 'Todos')); chips.append(b); });
  search.oninput = () => { q = search.value.trim().toLowerCase(); paint(); };
  box.append(el('div', { className: 'gbar' }, chips, search), grid); paint(); return { mark };
}
let lastG = 0;
const snap = document.createElement('canvas'); snap.width = 300; snap.height = 170; let snapOk = false, pvKey = '', pvCh = PCH;
function previewChunks() {   // usa as palavras reais do vídeo perto do ponto atual; senão, a frase de exemplo
  if (!S.words || S.words.length < 3) return PCH;
  let i = S.words.findIndex(w => w.s >= S.cur); if (i < 0 || i > S.words.length - 5) i = Math.max(0, S.words.length - 5);
  const key = i + '|' + S.words.length; if (key === pvKey) return pvCh;
  pvKey = key; pvCh = chunksOf(S.words.slice(i, i + 5).map((w, j) => ({ w: w.w, s: j * 0.6, e: j * 0.6 + 0.55 })), 3); return pvCh;
}
function animGal(now) {
  if (now - lastG > 45) {
    lastG = now; const t = (now / 1000) % 3.2, pc = previewChunks();
    snapOk = false; if (S.file && vid.readyState >= 2 && vid.videoWidth) { try { const c = snap.getContext('2d'), r = Math.max(300 / vid.videoWidth, 170 / vid.videoHeight); c.drawImage(vid, (300 - vid.videoWidth * r) / 2, (170 - vid.videoHeight * r) / 2, vid.videoWidth * r, vid.videoHeight * r); snapOk = true; } catch { /* sem quadro */ } }
    document.querySelectorAll('.gcard canvas').forEach(cv => {
      if (!cv.offsetParent) return; const c = cv.getContext('2d'), r = resolve({ preset: cv.dataset.p });
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
function drawTimeline() {
  const c = $('#trkC'), k = $('#trkK'); if (!c) return; c.replaceChildren(); k.replaceChildren(); const D = Math.max(S.dur, 1);
  S.chunks.forEach(ch => { const s0 = ch[0].s, e0 = ch[ch.length - 1].e; c.append(el('i', { style: `left:${s0 / D * 100}%;width:${Math.max(.35, (e0 - s0) / D * 100)}%`, title: ch.map(w => w.w).join(' ') })); });
  S.clips.forEach((cl, i) => k.append(el('i', { style: `left:${cl.start / D * 100}%;width:${Math.max(.8, (cl.end - cl.start) / D * 100)}%`, textContent: cl.title || 'Corte ' + (i + 1), title: mmss(cl.start) + ' a ' + mmss(cl.end) })));
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
  $('#stage').style.aspectRatio = w + '/' + h; $('#stage').style.width = `min(100%,${(74 * ar).toFixed(2)}dvh)`; document.querySelector('.transport').style.width = `min(100%,${(74 * ar).toFixed(2)}dvh)`;
  saveSoon('style', { style: S.style });
}
$('#ratio').onchange = e => setRatio(e.target.value);

// transcrição editável
$('#txt').oninput = () => { S.words = retime(S.words, tokens($('#txt').value), S.dur); rebuild(); saveSoon('tr', { transcript: { words: S.words } }, 1200); };

// cortes
const fxBtns = [];
function mkFx(k, label, hint) {
  const wrap = el('div', { className: 'seg', role: 'group', ariaLabel: label });
  [[0, 'Não'], [1, 'Sim']].forEach(([v, t]) => { const b = el('button', { type: 'button', textContent: t, onclick: () => { if (v && !canPro()) { $('#pay').showModal(); return; } S.fx[k] = v; S.style.fx = S.fx; syncFx(); if (k === 'emoji') rebuild(); saveSoon('style', { style: S.style }); } }); b.dataset.k = k; b.dataset.v = v; fxBtns.push(b); wrap.append(b); });
  return el('div', { className: 'row' }, el('span', {}, label, el('br'), el('small', { className: 'mut', textContent: hint })), wrap);
}
const syncFx = () => { fxBtns.forEach(b => b.setAttribute('aria-pressed', String(!!S.fx[b.dataset.k] === !!+b.dataset.v))); if (colorUI) colorUI.sync(); };
let colorUI = null;   // painel de cor: módulo carregado sob demanda, só quando o usuário abre a seção
const ensureColor = async () => { if (!colorUI) { const m = await import('./colorui.js?v=1'); colorUI = m.initColor({ S, $, el, canPro, saveSoon, flash }); } return colorUI; };
$('#fxColorD').addEventListener('toggle', e => { if (e.target.open) ensureColor(); });
const FILLERS = new Set(['hum', 'ahn', 'ãh', 'ah', 'éh', 'hm', 'hmm', 'uh', 'um', 'né', 'tipo', 'então', 'ééé', 'eh']);
function fillerBtn() {
  const b = el('button', { type: 'button', className: 'ghost', textContent: 'Esconder vícios de fala nas legendas', onclick: () => {
    const norm = s => s.toLowerCase().replace(/[.,!?;:…]/g, '');
    let n = 0; S.words.forEach(w => { if (FILLERS.has(norm(w.w)) && !S.hid.has(hkey(w))) { S.hid.add(hkey(w)); n++; } });
    S.style.hid = [...S.hid]; rebuild(); saveSoon('style', { style: S.style }); b.textContent = n ? `${n} palavras escondidas` : 'Nenhum vício encontrado';
  } });
  return b;
}
function buildFx() { $('#fxCut').append(fillerBtn()); $('#fxCut').append(mkFx('cut', 'Remover silêncios', 'Corta pausas longas entre as falas.')); $('#fxZoom').append(mkFx('zoom', 'Zoom automático', 'Aproxima o vídeo a cada frase.')); $('#fxZoom').append(mkFx('emoji', 'Emojis nas legendas', 'Adiciona emojis nas palavras-chave, sem exagero.')); $('#fxCut').append(mkFx('denoise', 'Reduzir ruído', 'Corta graves e chiado entre as falas (aplicado ao exportar).')); $('#fxCut').append(mkFx('sfx', 'Efeitos sonoros', 'Whoosh nas trocas de zoom e pop nos títulos (ouvidos ao exportar).')); syncFx(); }
function clipsUI() {
  drawTimeline(); syncFx(); const ul = $('#clips'); ul.replaceChildren();
  $('#cmsg').textContent = S.clips.length ? 'Escolha o que gerar. A seleção usa IA e serve de ponto de partida.' : 'Nenhum corte ainda. Crie um manualmente abaixo.';
  S.clips.forEach((c, i) => {
    const acts = el('div', { className: 'acts' }, el('button', { className: 'btn', textContent: 'Pré-visualizar', onclick: () => previewClip(c) }));
    if (c.state === 'rendering') { const p = el('progress', { max: 1, value: c.p || 0 }); p.style.maxWidth = '160px'; const eta = el('span', { className: 'mut eta', role: 'status', textContent: 'Preparando…' }); acts.append(p, eta, el('button', { className: 'btn', textContent: 'Cancelar', onclick: () => S.abort && S.abort.abort() })); }
    else acts.append(el('button', { className: 'btn pri', textContent: c.url ? 'Gerar de novo' : 'Gerar vídeo', disabled: S.busy, onclick: () => renderOne(c) }));
    if (c.url) acts.append(el('a', { className: 'btn', textContent: 'Baixar', href: c.url, download: `forjaclip-corte-${i + 1}.mp4` }));
    { const d = el('button', { className: 'btn', textContent: 'Descrição e hashtags', onclick: () => describeClip(c, d) }); acts.append(d); }
    if (c.state === 'error') acts.append(el('span', { className: 'warn', textContent: c.err }));
    ul.append(el('li', { className: 'clip' }, el('div', {}, el('b', { textContent: c.title || 'Corte ' + (i + 1) }), ' ', el('span', { className: 'score', textContent: c.score != null ? 'nota ' + c.score : 'manual' })), el('div', { className: 'mut', textContent: mmss(c.start) + ' a ' + mmss(c.end) + (c.reason ? ' · ' + c.reason : '') }), acts));
  });
}
$('#addManual').onclick = () => {
  const s = +$('#ms').value, e = +$('#me').value;
  if (!(e - s >= 3)) { flash('O corte precisa ter pelo menos 3 segundos.'); return; }
  S.clips.push({ id: 'm' + Date.now(), start: s, end: e, title: 'Corte manual', reason: '' }); save({ clips: S.clips.map(({ url, state, p, err, ...c }) => c) }); clipsUI();
};
function previewClip(c) { S.prev = { s: c.start, e: c.end }; S.prevRem = S.fx.cut ? silences(S.words, c.start, c.end) : []; seek(c.start); play(true); $('#stage').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
async function renderOne(c) {
  if (S.busy) return;
  if (!S.file) { flash('Selecione o vídeo original para gerar o corte.'); $('#ph').hidden = false; return; }
  if (c.end - c.start > 120) { flash('No navegador, cada corte pode ter até 2 minutos.'); return; }
  S.busy = true; c.state = 'rendering'; c.p = 0; c.t0 = performance.now(); S.abort = new AbortController(); clipsUI(); let wl; try { wl = await navigator.wakeLock.request('screen'); } catch { /* sem wake lock */ }
  try { await loadFont(rs().font, rs().wLight, rs().wActive); if (c.url) URL.revokeObjectURL(c.url); const r = await renderClip({ file: S.file, media: S.media, clip: c, words: visible(), style: S.style, W: DIMS[S.ratio][0], H: DIMS[S.ratio][1], opts: { signal: S.abort.signal, cutSilence: !!S.fx.cut, zoom: !!S.fx.zoom, emoji: !!S.fx.emoji, sfx: !!S.fx.sfx, denoise: !!S.fx.denoise, tracks: S.aud, music: S.music ? { buffer: S.music.buf, volume: S.music.vol } : null, overlays: ovAll(), grade: (await ensureColor())?.forExport() ?? null }, onProgress: p => { c.p = p; const pr = $('#clips progress'); if (pr) pr.value = p; const eta = $('#clips .eta'); if (eta) { const el0 = (performance.now() - c.t0) / 1000, left = p > 0.03 ? Math.ceil(el0 * (1 - p) / p) : null; eta.textContent = 'Gerando ' + Math.round(p * 100) + '%' + (left != null ? ', faltam cerca de ' + (left > 60 ? Math.ceil(left / 60) + ' min' : left + ' s') : '') + '. Mantenha a tela aberta.'; } } }); c.url = URL.createObjectURL(r.blob); c.state = 'done'; flash('Corte pronto. Toque em Baixar.'); }
  catch (e) { c.state = e.message === 'Geração cancelada.' ? 'idle' : 'error'; c.err = e.message; if (c.state === 'idle') flash('Geração cancelada.'); }
  finally { S.busy = false; S.abort = null; if (wl) wl.release().catch(() => { }); clipsUI(); }
}

// ---------- reprodução e prévia ----------
const vid = $('#vid');
const hasVid = () => !!S.file;
function play(on) { S.playing = on; if (hasVid()) { on ? vid.play() : vid.pause(); } $('#pp').textContent = on ? 'Pausar' : 'Reproduzir'; }
const stopPlay = () => { if (!$('#edit').hidden || S.playing) { S.playing = false; try { vid.pause(); } catch { /* sem vídeo */ } } };
function seek(t) { S.cur = t; if (hasVid()) vid.currentTime = t; }
$('#pp').onclick = () => { if (S.playing) play(false); else { if (!S.prev) S.prev = null; play(true); } };
$('#scrub').oninput = e => { S.prev = null; seek(+e.target.value); };
let last = performance.now();
const cv = $('#cv'), ctx = cv.getContext('2d');
function fit() { const r = $('#stage').getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); if (cv.width !== Math.round(r.width * d) || cv.height !== Math.round(r.height * d)) { cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); } }
function frame(now) {
  const dt = (now - last) / 1000; last = now;
  if (!$('#edit').hidden) {
    if (hasVid()) S.cur = vid.currentTime; else if (S.playing) S.cur += dt;
    if (S.prev && S.cur >= S.prev.e) seek(S.prev.s); else if (S.prev && S.prevRem && S.prevRem.length && S.prevRem.some(([a, b]) => S.cur >= a && S.cur < b)) seek(S.prevRem.find(([a, b]) => S.cur >= a && S.cur < b)[1]); else if (!hasVid() && S.cur >= S.dur) S.cur = 0;
    vid.style.transform = S.fx.zoom ? 'scale(' + zoomAt(S.chunks, S.cur).toFixed(3) + ')' : '';
    if (colorUI) colorUI.preview();
    $('#scrub').value = S.cur; $('#ph2').style.left = Math.min(100, S.cur / Math.max(S.dur, 1) * 100) + '%'; $('#tm').textContent = mmss(S.cur) + ' / ' + mmss(S.dur);
    fit(); const W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
    const r = rs(); if (S.ov.length) drawBroll(ctx, W, H, S.ov, S.cur); S.bbox = drawCaption(ctx, W, H, S.chunks, S.cur, r); if (S.ov.length || S.logo) drawOverlays(ctx, W, H, ovAll(), S.cur, r.font);
    const out = S.bbox && outsideSafe(S.bbox, S.safeP, W, H);
    if (S.safeOn && S.ratio === '9:16') { const s = safeRect(S.safeP, W, H); ctx.save(); ctx.setLineDash([8, 6]); ctx.lineWidth = 2; ctx.strokeStyle = out ? '#ff4d4d' : 'rgba(255,255,255,.7)'; ctx.strokeRect(s.x, s.y, s.w, s.h); if (out) { ctx.fillStyle = 'rgba(255,60,60,.14)'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = '#ff4d4d'; ctx.strokeRect(S.bbox.x, S.bbox.y, S.bbox.w, S.bbox.h); } ctx.restore(); }
    const boxOut = S.bbox ? outsideSafe(S.bbox, S.safeP, W, H) : (r.y * H < safeRect(S.safeP, W, H).y || r.y * H > safeRect(S.safeP, W, H).y + safeRect(S.safeP, W, H).h);
    $('#warn').textContent = boxOut ? 'A legenda está fora da área segura e pode ficar coberta pelos botões do app (' + PLATFORMS[S.safeP].name + ').' : '';
  }
  requestAnimationFrame(frame);
}
// arrastar a legenda
let drag = null;
$('#stage').addEventListener('pointerdown', e => { if (e.target.closest('label,button')) return; const r = $('#stage').getBoundingClientRect(); drag = { x: e.clientX, y: e.clientY, sx: rs().x, sy: rs().y, w: r.width, h: r.height }; $('#stage').classList.add('drag'); $('#stage').setPointerCapture(e.pointerId); });
$('#stage').addEventListener('pointermove', e => { if (!drag) return; const nx = Math.min(0.92, Math.max(0.08, drag.sx + (e.clientX - drag.x) / drag.w)), ny = Math.min(0.97, Math.max(0.03, drag.sy + (e.clientY - drag.y) / drag.h)); S.style.x = nx; S.style.y = ny; sync(); saveSoon('style', { style: S.style }); });
const endDrag = () => { drag = null; $('#stage').classList.remove('drag'); }; $('#stage').addEventListener('pointerup', endDrag); $('#stage').addEventListener('pointercancel', endDrag);

// ---------- início ----------
async function boot() {
  const l = el('link', { rel: 'stylesheet', href: fontsUrl() }); document.head.append(l);
  buildControls(); buildFx(); buildPresets(); requestAnimationFrame(frame); requestAnimationFrame(animGal); Object.values(PRESETS).forEach(p => loadFont(p.font, p.wLight, p.wActive));
  $('#tl').onpointerdown = e => { const r = $('#tl .tw').getBoundingClientRect(); S.prev = null; seek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * S.dur); };
  await loadFont('Montserrat', 300, 500, 900);
  if (!LIVE) { view('home'); $('#homeSub').textContent = 'Sem conta: a transcrição roda no seu aparelho e nada é salvo. Entre para guardar projetos.'; $('#nOut').hidden = true; return; }
  S.sb = window.supabase.createClient(CFG.SB_URL, CFG.SB_ANON);
  const apply = async s => {
    if (!s) { S.user = null; view('login'); return; }
    if (S.user?.id === s.user.id) return; S.user = s.user; $('#who').textContent = 'Sair'; $('#nOut').title = s.user.email || '';
    const p = await S.sb.from('profiles').select('plan,pro_until').maybeSingle(); S.plan = (p.data?.plan === 'pro' || (p.data?.pro_until && new Date(p.data.pro_until) > new Date())) ? 'pro' : 'free'; S.proUntil = p.data?.pro_until || null; buildPresets(); planUI(); home();
  };
  const { data } = await S.sb.auth.getSession(); apply(data.session); S.sb.auth.onAuthStateChange((_, s) => apply(s));
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
boot();
window.__forjaclip = { S };
initGuide({ home: () => home() });   // útil para testes

// ---------- música de fundo ----------
S.aud = [];
function audUI() {
  const ul = $('#audList'); ul.replaceChildren();
  S.aud.forEach((o, i) => {
    const at = el('input', { type: 'number', min: 0, step: 0.5, value: +o.at.toFixed(1), ariaLabel: 'Início do áudio (s)' }); at.style.width = '64px'; at.onchange = () => { o.at = Math.max(0, +at.value || 0); };
    const vol = el('input', { type: 'range', min: 0, max: 150, value: Math.round(o.vol * 100), ariaLabel: 'Volume do áudio' }); vol.oninput = () => { o.vol = +vol.value / 100; };
    ul.append(el('li', {}, el('span', { textContent: o.name + ' (' + o.buf.duration.toFixed(1) + ' s)' }), el('span', { className: 'mut', textContent: 'em' }), at, el('span', { className: 'mut', textContent: 's' }), vol, el('button', { type: 'button', className: 'btn', textContent: 'Remover', onclick: () => { S.aud.splice(i, 1); audUI(); } })));
  });
}
$('#audIn').onchange = async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  try { const ac = new AudioContext({ sampleRate: S.media?.audio?.sampleRate || 48000 }), buf = await ac.decodeAudioData(await f.arrayBuffer()); ac.close(); S.aud.push({ buf, name: f.name, at: Math.max(0, +S.cur.toFixed(1)), vol: 1 }); audUI(); flash('Áudio adicionado em ' + S.cur.toFixed(1) + ' s. Ajuste o ponto se precisar.'); }
  catch { flash('Não consegui ler este áudio. Tente MP3, M4A ou WAV.'); }
};
S.music = null; let musEl = null;
function musSync() { if (!musEl) return; musEl.volume = S.music.vol; if (S.playing) { if (musEl.paused) musEl.play().catch(() => { }); } else musEl.pause(); }
$('#musFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return; const m = $('#musMsg'); m.textContent = 'Lendo o áudio…';
  try {
    const sr = S.media?.audio?.sampleRate || 48000, ac = new AudioContext({ sampleRate: sr });
    const buf = await ac.decodeAudioData(await f.arrayBuffer()); ac.close();
    if (musEl) { musEl.pause(); URL.revokeObjectURL(musEl.src); }
    musEl = new Audio(URL.createObjectURL(f)); musEl.loop = true;
    S.music = { buf, vol: +$('#musVol').value / 100, name: f.name }; $('#musRow').hidden = false; $('#musName').textContent = f.name; m.textContent = 'Música pronta. Será misturada ao gerar o corte.'; musSync();
  } catch (err) { m.textContent = 'Não consegui ler este áudio (' + (err.message || 'formato') + '). Tente MP3, M4A ou WAV.'; }
};
$('#musVol').oninput = e => { if (S.music) { S.music.vol = +e.target.value / 100; musSync(); } };
$('#musOff').onclick = () => { if (musEl) { musEl.pause(); URL.revokeObjectURL(musEl.src); musEl = null; } S.music = null; $('#musRow').hidden = true; $('#musFile').value = ''; $('#musMsg').textContent = 'Adicione uma trilha. Ela é misturada ao áudio ao gerar o corte.'; };
setInterval(() => { if (musEl) { if (S.playing && musEl.paused) musEl.play().catch(() => { }); if (!S.playing && !musEl.paused) musEl.pause(); } }, 300);

// ---------- assinatura (Mercado Pago: PIX, débito e crédito) ----------
async function checkout(btn, msg, plan) {
  btn.disabled = true; msg.textContent = 'Abrindo o Mercado Pago…';
  try { const { data } = await S.sb.auth.getSession(); const r = await fetch(CFG.AI + '/checkout', { method: 'POST', headers: { authorization: 'Bearer ' + data.session.access_token, 'content-type': 'application/json' }, body: JSON.stringify({ plan: plan || 'month' }) }); const j = await r.json(); if (!r.ok || !j.url) throw new Error(j.error || 'Falha ao iniciar o pagamento.'); location.href = j.url; }
  catch (e) { msg.textContent = e.message; btn.disabled = false; }
}
function planUI() {   // pontos de entrada visíveis para o plano Pro: menu lateral e cartão na tela inicial
  if (!(CFG.PAY && LIVE)) return;
  $('#nPro').hidden = false; const pro = S.plan === 'pro', card = $('#plan'); card.hidden = false; card.classList.toggle('on', pro);
  const until = S.proUntil ? new Date(S.proUntil).toLocaleDateString('pt-BR') : '';
  $('#planT').textContent = pro ? 'ForjaClip Pro ativo' : 'ForjaClip Pro'; $('#nProL').textContent = pro ? 'Pro ativo' : 'Plano Pro';
  $('#planS').textContent = pro ? (until ? 'Seu acesso vai até ' + until + '. Renove quando quiser: cada pagamento soma 31 dias (ou 1 ano no plano anual).' : 'Obrigado por apoiar o ForjaClip.') : 'Estilos exclusivos, cortes por IA sem limite e sem anúncios.';
  $('#planPrice').hidden = pro; $('#planBtn').textContent = pro ? 'Renovar por mais 31 dias' : 'Assinar o Pro'; $('#planBtnY').textContent = pro ? 'Renovar por 1 ano · R$ 199' : 'Plano anual · R$ 199/ano'; $('#yrS').innerHTML = 'Só <b>R$ 16,58 por mês</b>. Economize mais de R$ 100 por ano.';
}
if (CFG.PAY && LIVE) {
  const d = $('#pay'); d.querySelector('p').textContent = 'Este recurso faz parte do plano Pro. R$ 19,90 por mês nos 3 primeiros meses, depois R$ 29,90, ou R$ 199 por ano (economize mais de R$ 100). Pague por PIX, cartão de débito ou crédito (Mercado Pago).';
  const m = el('p', { className: 'mut pm', role: 'status' }), b = el('button', { type: 'button', className: 'btn pri', textContent: 'Assinar o Pro', onclick: () => checkout(b, m) });
  d.querySelector('form').before(b, m);
  const pm = $('#planMsg'); $('#planBtn').onclick = () => checkout($('#planBtn'), pm); $('#planBtnY').onclick = () => checkout($('#planBtnY'), pm, 'year'); $('#nPro').onclick = async () => { await home(); $('#plan').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
}

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
const ovAll = () => S.logo ? [...S.ov, { kind: 'logo', img: S.logo, from: 0, to: 1e9 }] : S.ov;
async function setLogo(src) { try { S.logo = src ? await createImageBitmap(await (await fetch(src)).blob()) : null; } catch { S.logo = null; } $('#logoOff').hidden = !S.logo; $('#logoSt').textContent = S.logo ? 'Logo ativo em todos os cortes.' : 'Nenhum logo definido.'; }
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
    const li = el('li'); const num = (k) => { const n = el('input', { type: 'number', min: 0, step: 0.5, value: +o[k].toFixed(1), ariaLabel: k === 'from' ? 'Início' : 'Fim' }); n.style.width = '64px'; n.onchange = () => { o[k] = Math.max(0, +n.value || 0); }; return n; };
    const name = o.kind === 'title' ? el('input', { value: o.text, ariaLabel: 'Texto do título', oninput: e => { o.text = e.target.value; } }) : el('span', { textContent: (o.kind === 'broll' ? 'B-roll: ' : 'Imagem: ') + o.name });
    li.append(name, num('from'), el('span', { className: 'mut', textContent: 'a' }), num('to'), el('button', { type: 'button', className: 'btn', textContent: 'Remover', onclick: () => { S.ov.splice(i, 1); ovUI(); } })); ul.append(li);
  });
}
$('#ovTitle').onclick = async () => {
  const w = visible(); if (!w.length) { flash('Ainda não há transcrição para sugerir um título.'); return; }
  const b = $('#ovTitle'); let text = hookTitle(w);
  if (LIVE && S.user) { b.disabled = true; b.textContent = 'Criando com IA…'; try { const r = await assist(CFG, await token(), 'hook', w.map(x => x.w).join(' ').slice(0, 8000)); const t = (r.titles || []).find(x => typeof x === 'string' && x.trim()); if (t) text = t.trim().toUpperCase(); } catch (e) { flash(e.message + ' Usei uma sugestão simples.'); } b.disabled = false; b.textContent = 'Sugerir título de gancho'; }
  S.ov.push({ kind: 'title', text, from: 0, to: Math.min(4, S.dur || 4) }); ovUI();
};
$('#ovBroll').onclick = async () => {
  const w = visible(); if (!w.length) { flash('Ainda não há transcrição para escolher os B-rolls.'); return; }
  if (!(LIVE && S.user)) { flash('Entre na sua conta para usar o B-roll automático.'); return; }
  const b = $('#ovBroll'); b.disabled = true; b.textContent = 'Escolhendo cenas…';
  try {
    const lines = toLines(w, 14, 0.8).map(l => '[' + l[0].s.toFixed(1) + '] ' + l.map(x => x.w).join(' ')).join('\n').slice(0, 12000);
    const r = await assist(CFG, await token(), 'broll', lines); let n = 0, last = -99;
    for (const it of (r.items || []).slice(0, 8)) {
      const t = +it.t, q = String(it.query || '').trim(); if (!(t >= 0) || !q || t - last < 5) continue;
      b.textContent = 'Buscando: ' + q.slice(0, 20) + '…'; const img = await findBroll(q).catch(() => null); if (!img) continue;
      S.ov.push({ kind: 'broll', img, name: q, from: t, to: Math.min(t + 2.5, S.dur || t + 2.5) }); last = t; n++;
    }
    ovUI(); flash(n ? n + ' B-roll(s) adicionados. Ajuste os tempos ou remova os que não gostar.' : 'Não encontrei imagens livres para este vídeo.');
  } catch (e) { flash(e.message); }
  b.disabled = false; b.textContent = 'B-roll automático (IA)';
};
$('#ovImg').onchange = async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  try { const img = await createImageBitmap(f); const t0 = Math.max(0, +S.cur.toFixed(1)); S.ov.push({ kind: 'image', img, name: f.name, from: t0, to: t0 + 3 }); ovUI(); } catch { flash('Não consegui abrir esta imagem.'); }
};
