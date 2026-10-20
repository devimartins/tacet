import { FONTS, fontsUrl, loadFont, PRESETS, PLATFORMS, DEFAULT_STYLE, resolve, chunksOf, drawCaption, safeRect, outsideSafe } from './captions.js';
import { openMedia, extractAudio } from './media.js';
import { renderClip } from './render.js';
import { suggestClips } from './clips.js';
import { retime, tokens, fromWhisper } from './transcript.js';
import { ICONS } from './icons.js';

const $ = s => document.querySelector(s), CFG = window.CFG || {};
const LIVE = !!(CFG.AI && CFG.SB_URL && CFG.SB_ANON && window.supabase);
const MAX_BYTES = 1024 ** 3, SAMPLE = 'o segredo não é trabalhar mais horas. é escolher melhor onde colocar a sua energia todos os dias.';
const el = (t, a = {}, ...c) => { const e = document.createElement(t); Object.assign(e, a); c.forEach(x => e.append(x)); return e; };
const mmss = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } } };
const S = { sb: null, user: null, plan: 'free', pid: null, title: '', file: null, media: null, words: [], dur: 8, clips: [], style: structuredClone(DEFAULT_STYLE), chunks: [], safeOn: false, safeP: 'all', prev: null, busy: false, box: null, cur: 0, playing: false, bbox: null };
const canPro = () => !CFG.GATE || S.plan === 'pro';
const flash = m => { const f = $('#flash'); f.textContent = m; f.hidden = false; clearTimeout(flash.t); flash.t = setTimeout(() => { f.hidden = true; }, 6000); };

// ---------- tema ----------
function theme(t) { if (t) { document.documentElement.dataset.theme = t; ls.set('theme', t); } const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches; $('#themeLbl').textContent = dark ? 'Tema claro' : 'Tema escuro'; return dark; }
$('#nTheme').onclick = () => theme(theme() ? 'light' : 'dark');
if (ls.get('theme')) document.documentElement.dataset.theme = ls.get('theme');
theme();

// ---------- navegação ----------
function view(v) { for (const id of ['login', 'home', 'edit']) $('#' + id).hidden = id !== v; $('#rail').hidden = v === 'login'; $('#nHome').setAttribute('aria-current', v === 'home' ? 'page' : 'false'); window.scrollTo(0, 0); }
$('#nHome').onclick = () => home();
$('#nNew').onclick = () => { if (!$('#home').hidden) $('#newfile').click(); else home().then(() => $('#newfile').click()); };
$('#nOut').onclick = async () => { if (S.sb) { await S.sb.auth.signOut(); } else flash('Modo demonstração: não há sessão.'); };

// ---------- login ----------
const PROVIDERS = [['google', 'Google', 'google'], ['apple', 'Apple', 'apple'], ['github', 'GitHub', 'github'], ['azure', 'Microsoft', 'microsoft']];
for (const [id, name, ic] of PROVIDERS) {
  const b = el('button', { type: 'button', className: 'btn', onclick: async () => {
    $('#lmsg').textContent = '';
    const { error } = await S.sb.auth.signInWithOAuth({ provider: id, options: { redirectTo: location.origin + location.pathname } });
    if (error) $('#lmsg').textContent = 'Não foi possível entrar com ' + name + ': ' + error.message;
  } });
  b.innerHTML = ICONS[ic]; b.append(el('span', { textContent: 'Continuar com ' + name })); $('#prov').append(b);
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
    ul.append(el('li', { className: 'item' }, el('div', { className: 'grow' }, el('b', { textContent: p.title || 'Sem título' }), el('div', { className: 'mut', textContent: (p.duration ? mmss(p.duration) + ' · ' : '') + 'expira em ' + days + (days === 1 ? ' dia' : ' dias') })),
      el('button', { className: 'btn', textContent: 'Abrir', onclick: () => openProject(p.id) }),
      el('button', { className: 'btn', textContent: 'Excluir', onclick: async () => { if (!confirm('Excluir este projeto?')) return; const r = await S.sb.from('projects').delete().eq('id', p.id); if (r.error) flash(r.error.message); else home(); } })));
  }
  ads();
}
function ads() {   // anúncios só no plano gratuito e só se houver ID do AdSense configurado
  const box = $('#ad'); if (!CFG.ADS_CLIENT || !CFG.ADS_SLOT || S.plan === 'pro' || box.dataset.on) return;
  box.dataset.on = '1'; box.hidden = false;
  const s = el('script', { async: true, src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(CFG.ADS_CLIENT), crossOrigin: 'anonymous' });
  const ins = el('ins', { className: 'adsbygoogle' }); ins.style.display = 'block'; Object.assign(ins.dataset, { adClient: CFG.ADS_CLIENT, adSlot: CFG.ADS_SLOT, adFormat: 'auto', fullWidthResponsive: 'true' });
  box.append(s, ins); s.onload = () => { try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* bloqueado */ } };
}
const fp = f => `${f.name}|${f.size}|${f.lastModified}`;
async function newVideo(f) {
  if (!f) return;
  if (f.size > MAX_BYTES) { flash('O plano gratuito aceita vídeos de até 1 GB. Este tem ' + (f.size / 1024 ** 3).toFixed(2) + ' GB.'); return; }
  let media; try { media = await openMedia(f); } catch (e) { flash(e.message); return; }
  S.file = f; S.media = media; S.title = f.name; S.words = []; S.clips = []; S.dur = media.duration; S.style = structuredClone(DEFAULT_STYLE);
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
  S.style = { ...structuredClone(DEFAULT_STYLE), ...(p.style || {}) }; S.fp = p.fingerprint;
  enterEdit(); rebuild(); sync(); clipsUI(); $('#txt').value = S.words.map(w => w.w).join(' ');
  $('#phTxt').textContent = 'Para pré-visualizar e gerar cortes, selecione de novo o vídeo "' + S.title + '".';
  status(S.words.length ? 'Projeto carregado. A transcrição e os cortes estão salvos.' : 'Este projeto ainda não tem transcrição. Selecione o vídeo para continuar.');
}
$('#newfile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; newVideo(f); };
$('#drop').ondragover = e => { e.preventDefault(); $('#drop').classList.add('on'); }; $('#drop').ondragleave = () => $('#drop').classList.remove('on');
$('#drop').ondrop = e => { e.preventDefault(); $('#drop').classList.remove('on'); newVideo(e.dataTransfer.files[0]); };
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
    if (!LIVE) { clipsUI(); status('Transcrição pronta. A sugestão de cortes por IA precisa do servidor; crie um corte manual na aba Cortes.'); return; }
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
function enterEdit() { view('edit'); tab('style'); S.cur = 0; S.prev = null; $('#scrub').max = S.dur; prog(null); S.bbox = null; }
function setVideo(f) {
  const v = $('#vid'); v.src = URL.createObjectURL(f); v.style.display = 'block'; $('#ph').hidden = true; v.onloadedmetadata = () => { $('#scrub').max = v.duration; S.dur = v.duration; }; S.playing = false; $('#pp').textContent = 'Reproduzir';
}
function tab(t) { for (const [id, k] of [['pStyle', 'style'], ['pText', 'text'], ['pClips', 'clips']]) $('#' + id).hidden = k !== t; document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.t === t)); }
document.querySelectorAll('.tabs button').forEach(b => { b.onclick = () => tab(b.dataset.t); });
const rs = () => resolve(S.style);
function rebuild() { S.chunks = chunksOf(S.words, Math.max(1, rs().n | 0)); }
function setO(k, v) { if (['x', 'y', 'cropX'].includes(k)) S.style[k] = v; else S.style.o = { ...S.style.o, [k]: v }; rebuild(); applyCrop(); saveSoon('style', { style: S.style }); }
function applyCrop() { $('#vid').style.objectPosition = rs().cropX * 100 + '% 50%'; }
let rows = [];
const sync = () => rows.forEach(f => f());
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
    grp('Posição', mkRange('x', 'Horizontal', 0, 100, 1, '%', 100), mkRange('y', 'Vertical', 0, 100, 1, '%', 100), mkRange('cropX', 'Enquadramento do vídeo', 0, 100, 1, '%', 100), el('div', { className: 'row' }, el('label', { htmlFor: 'c_plat', textContent: 'Área segura' }), platform), el('div', { className: 'row' }, el('label', { htmlFor: 'c_safe', textContent: 'Mostrar área segura' }), safe), el('p', { className: 'mut', textContent: 'Dica: arraste a legenda direto no vídeo. A área segura usa margens publicadas para anúncios; não são regras oficiais para posts orgânicos.' })));
}
function buildPresets() {
  const box = $('#presets'); box.replaceChildren();
  for (const [id, p] of Object.entries(PRESETS)) {
    const locked = !canPro() && !p.free;
    const b = el('button', { type: 'button', textContent: p.name, onclick: async () => { if (locked) { $('#pay').showModal(); return; } await loadFont(p.font, p.wLight, p.wActive); S.style = { ...S.style, preset: id, o: {} }; rebuild(); sync(); box.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); saveSoon('style', { style: S.style }); } });
    b.style.fontFamily = `"${p.font}", sans-serif`; b.style.fontWeight = p.wActive;
    b.setAttribute('aria-pressed', String(S.style.preset === id)); if (locked) b.append(el('span', { className: 'lk', textContent: 'PRO' })); box.append(b);
  }
}

// transcrição editável
$('#txt').oninput = () => { S.words = retime(S.words, tokens($('#txt').value), S.dur); rebuild(); saveSoon('tr', { transcript: { words: S.words } }, 1200); };

// cortes
function clipsUI() {
  const ul = $('#clips'); ul.replaceChildren();
  $('#cmsg').textContent = S.clips.length ? 'Escolha o que gerar. A seleção usa IA e serve de ponto de partida.' : 'Nenhum corte ainda. Crie um manualmente abaixo.';
  S.clips.forEach((c, i) => {
    const acts = el('div', { className: 'acts' }, el('button', { className: 'btn', textContent: 'Pré-visualizar', onclick: () => previewClip(c) }));
    if (c.state === 'rendering') { const p = el('progress', { max: 1, value: c.p || 0 }); p.style.maxWidth = '160px'; acts.append(p, el('span', { className: 'mut', textContent: 'Gerando… mantenha a tela aberta' })); }
    else acts.append(el('button', { className: 'btn pri', textContent: c.url ? 'Gerar de novo' : 'Gerar vídeo', disabled: S.busy, onclick: () => renderOne(c) }));
    if (c.url) acts.append(el('a', { className: 'btn', textContent: 'Baixar', href: c.url, download: `tacet-corte-${i + 1}.mp4` }));
    if (c.state === 'error') acts.append(el('span', { className: 'warn', textContent: c.err }));
    ul.append(el('li', { className: 'clip' }, el('div', {}, el('b', { textContent: c.title || 'Corte ' + (i + 1) }), ' ', el('span', { className: 'score', textContent: c.score != null ? 'nota ' + c.score : 'manual' })), el('div', { className: 'mut', textContent: mmss(c.start) + ' a ' + mmss(c.end) + (c.reason ? ' · ' + c.reason : '') }), acts));
  });
}
$('#addManual').onclick = () => {
  const s = +$('#ms').value, e = +$('#me').value;
  if (!(e - s >= 3)) { flash('O corte precisa ter pelo menos 3 segundos.'); return; }
  S.clips.push({ id: 'm' + Date.now(), start: s, end: e, title: 'Corte manual', reason: '' }); save({ clips: S.clips.map(({ url, state, p, err, ...c }) => c) }); clipsUI();
};
function previewClip(c) { S.prev = { s: c.start, e: c.end }; seek(c.start); play(true); $('#stage').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
async function renderOne(c) {
  if (S.busy) return;
  if (!S.file) { flash('Selecione o vídeo original para gerar o corte.'); $('#ph').hidden = false; return; }
  if (c.end - c.start > 120) { flash('No navegador, cada corte pode ter até 2 minutos.'); return; }
  S.busy = true; c.state = 'rendering'; c.p = 0; clipsUI(); let wl; try { wl = await navigator.wakeLock.request('screen'); } catch { /* sem wake lock */ }
  try { await loadFont(rs().font, rs().wLight, rs().wActive); if (c.url) URL.revokeObjectURL(c.url); const r = await renderClip({ file: S.file, media: S.media, clip: c, words: S.words, style: S.style, onProgress: p => { c.p = p; const pr = $('#clips progress'); if (pr) pr.value = p; } }); c.url = URL.createObjectURL(r.blob); c.state = 'done'; flash('Corte pronto. Toque em Baixar.'); }
  catch (e) { c.state = 'error'; c.err = e.message; }
  finally { S.busy = false; if (wl) wl.release().catch(() => { }); clipsUI(); }
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
    if (S.prev && S.cur >= S.prev.e) seek(S.prev.s); else if (!hasVid() && S.cur >= S.dur) S.cur = 0;
    $('#scrub').value = S.cur; $('#tm').textContent = mmss(S.cur) + ' / ' + mmss(S.dur);
    fit(); const W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
    const r = rs(); S.bbox = drawCaption(ctx, W, H, S.chunks, S.cur, r);
    const out = S.bbox && outsideSafe(S.bbox, S.safeP, W, H);
    if (S.safeOn) { const s = safeRect(S.safeP, W, H); ctx.save(); ctx.setLineDash([8, 6]); ctx.lineWidth = 2; ctx.strokeStyle = out ? '#ff4d4d' : 'rgba(255,255,255,.7)'; ctx.strokeRect(s.x, s.y, s.w, s.h); if (out) { ctx.fillStyle = 'rgba(255,60,60,.14)'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = '#ff4d4d'; ctx.strokeRect(S.bbox.x, S.bbox.y, S.bbox.w, S.bbox.h); } ctx.restore(); }
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
  buildControls(); buildPresets(); requestAnimationFrame(frame);
  await loadFont('Montserrat', 300, 500, 900);
  if (!LIVE) { view('home'); $('#homeSub').textContent = 'Sem conta: a transcrição roda no seu aparelho e nada é salvo. Entre para guardar projetos.'; $('#nOut').hidden = true; return; }
  S.sb = window.supabase.createClient(CFG.SB_URL, CFG.SB_ANON);
  const apply = async s => {
    if (!s) { S.user = null; view('login'); return; }
    if (S.user?.id === s.user.id) return; S.user = s.user; $('#who').textContent = 'Sair'; $('#nOut').title = s.user.email || '';
    const p = await S.sb.from('profiles').select('plan').maybeSingle(); S.plan = p.data?.plan || 'free'; buildPresets(); home();
  };
  const { data } = await S.sb.auth.getSession(); apply(data.session); S.sb.auth.onAuthStateChange((_, s) => apply(s));
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
boot();
window.__tacet = { S };   // útil para testes
