// "Sugerir roteiro" do teleprompter: briefing (texto ou áudio) -> roteiro em 4 etapas (gancho, promessa, tese, CTA).
// A IA roda no Worker (Groq, plano gratuito). O áudio é transcrito pelo mesmo serviço da legenda, após confirmação do usuário.
const KEY = 'fc_rt';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* sem armazenamento */ } };

const LABEL = { gancho: 'Gancho', promessa: 'Promessa', tese: 'Tese', cta: 'CTA' };
const COLOR = { gancho: '#ff5a1f', promessa: '#f5b301', tese: '#3aa0ff', cta: '#2ecc71' };
const WPS = 2.3;   // palavras por segundo na fala dinâmica
const words = t => (t.trim().match(/\S+/g) || []).length;

const CSS = `
#tp .rt{position:absolute;inset:0;z-index:5;background:#0b0b0f;display:flex;flex-direction:column;overflow:auto;padding:12px}
#tp .rt h2{margin:0 0 4px;font-size:18px}#tp .rt p{margin:0 0 10px;color:#aab;font-size:14px}
#tp .rt label{display:block;font-size:13px;color:#cfd;margin:10px 0 4px}
#tp .rt input,#tp .rt select,#tp .rt textarea{width:100%;background:#14141a;color:#fff;border:1px solid #3a3a46;border-radius:10px;padding:10px;font:inherit;min-height:44px}
#tp .rt textarea{min-height:96px;resize:vertical}
#tp .rt .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#tp .rt .chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
#tp .rt .chips button{min-height:36px;padding:6px 10px;font-size:13px;border-radius:99px}
#tp .rt .acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;position:sticky;bottom:0;background:linear-gradient(#0b0b0f00,#0b0b0f 30%);padding:10px 0 4px}
#tp .rt .blk{border-left:4px solid var(--c);background:#14141a;border-radius:10px;padding:8px 10px;margin:10px 0}
#tp .rt .blk b{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--c)}
#tp .rt .blk small{float:right;color:#aab}#tp .rt .blk small.w{color:#f5b301}
#tp .rt .blk textarea{border:0;background:transparent;padding:6px 0 0;min-height:70px}
#tp .rt .mic.on{background:#f33;border-color:#f33}
#tp .rt .conf{background:#14141a;border:1px solid #3a3a46;border-radius:10px;padding:10px;margin-top:10px}
#tp .rt .err{color:#ff9b8a;font-size:14px;margin-top:8px}
`;

// WAV mono 16 kHz 16 bits (formato aceito pelo /transcribe)
async function toWav(blob) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer()); ctx.close?.();
  const n = Math.max(1, Math.ceil(buf.duration * 16000));
  const off = new OfflineAudioContext(1, n, 16000), src = off.createBufferSource();
  src.buffer = buf; src.connect(off.destination); src.start();
  const pcm = (await off.startRendering()).getChannelData(0);
  const out = new DataView(new ArrayBuffer(44 + pcm.length * 2)), w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, 16000, true); out.setUint32(28, 32000, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 32767, true);
  return new Blob([out], { type: 'audio/wav' });
}

// api = { script(payload) -> {questions}|{blocks}, transcribe(wavBlob) -> texto }
export function openScriptHelper({ host, api, flash, onUse }) {
  if (host.querySelector('.rt')) return;
  const st = document.createElement('style'); st.textContent = CSS; host.append(st);
  const root = document.createElement('div'); root.className = 'rt'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Sugerir roteiro'); host.append(root);
  const $ = s => root.querySelector(s);
  const saved = load();
  const f = Object.assign({ niche: '', topic: '', tone: 'direto', secs: 45, ctaKeyword: '', ctaResource: '' }, saved);
  let rec = null, stream = null, recTimer = 0, blocks = [], answers = '', busy = false;
  const done = () => { try { rec && rec.state !== 'inactive' && rec.stop(); } catch { /* ok */ } stream?.getTracks().forEach(t => t.stop()); clearInterval(recTimer); root.remove(); st.remove(); };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- 1. briefing ----------
  function form(msg = '') {
    root.innerHTML = `<h2>Sugerir roteiro</h2>
    <p>Conte o assunto e a IA monta o roteiro em 4 partes: <b>gancho</b>, <b>promessa</b>, <b>tese</b> e <b>CTA</b>. Prefere falar em vez de escrever? Toque em <b>Falar</b>.</p>
    <label for="rn">Segmento do vídeo (seu nicho)</label>
    <input id="rn" maxlength="120" placeholder="Ex.: nutrição, marketing para dentistas, finanças pessoais" value="${esc(f.niche)}">
    <label for="rt">Sobre o que você quer falar?</label>
    <textarea id="rt" maxlength="2500" placeholder="Ex.: 3 erros que fazem o cliente desistir da compra no WhatsApp e como evitar">${esc(f.topic)}</textarea>
    <div class="chips"><button type="button" id="mic" class="mic">🎙 Falar em vez de escrever</button></div>
    <div class="chips" aria-label="Ideias de formato"><button type="button" data-i="3 erros que ... e como evitar">3 erros</button><button type="button" data-i="Como fazer ... em 3 passos simples">Passo a passo</button><button type="button" data-i="Mito x verdade sobre ...">Mito x verdade</button><button type="button" data-i="O que eu faria se estivesse começando em ...">Se eu começasse hoje</button></div>
    <div class="row"><div><label for="rd">Duração</label><select id="rd"><option value="30">30 s</option><option value="45">45 s</option><option value="60">60 s</option><option value="90">90 s</option></select></div>
    <div><label for="rg">Tom</label><select id="rg"><option value="direto">Direto</option><option value="descontraído">Descontraído</option><option value="autoridade">Autoridade</option><option value="inspirador">Inspirador</option><option value="provocativo">Provocativo</option></select></div></div>
    <div class="row"><div><label for="rk">Palavra-chave do CTA (opcional)</label><input id="rk" maxlength="40" placeholder="Ex.: GUIA" value="${esc(f.ctaKeyword)}"></div>
    <div><label for="rr">O que a pessoa recebe (opcional)</label><input id="rr" maxlength="160" placeholder="Ex.: checklist grátis" value="${esc(f.ctaResource)}"></div></div>
    <p style="margin-top:6px">Se deixar o CTA em branco, a IA sugere um.</p>
    <div class="err" id="re">${esc(msg)}</div>
    <div class="acts"><button type="button" class="pri" id="rg2">Gerar roteiro</button><button type="button" id="rx">Voltar</button></div>`;
    $('#rd').value = String(f.secs); $('#rg').value = f.tone;
    $('#rx').onclick = done;
    root.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const t = $('#rt'); if (!t.value.trim()) { t.value = b.dataset.i; t.focus(); } });
    $('#mic').onclick = () => recordFlow();
    $('#rg2').onclick = () => { grab(); go(); };
  }
  const grab = () => { f.niche = $('#rn').value.trim(); f.topic = $('#rt').value.trim(); f.secs = +$('#rd').value; f.tone = $('#rg').value; f.ctaKeyword = $('#rk').value.trim(); f.ctaResource = $('#rr').value.trim(); save(f); };
  const payload = extra => ({ niche: f.niche, topic: f.topic, secs: f.secs, tone: f.tone, ctaKeyword: f.ctaKeyword, ctaResource: f.ctaResource, ...extra });

  // ---------- áudio: gravar -> transcrever -> confirmar ----------
  async function recordFlow() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { flash('Este navegador não permite gravar áudio. Escreva o assunto.'); return; }
    grab();
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch { flash('Permita o acesso ao microfone para falar o assunto.'); return; }
    const chunks = []; rec = new MediaRecorder(stream);
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    root.innerHTML = `<h2>Fale o assunto</h2><p>Conte em 20 a 60 segundos: qual é o seu segmento, sobre o que quer falar e o que a pessoa vai ganhar com o vídeo. Pode falar solto, depois você confere o texto.</p>
    <div class="conf" style="text-align:center"><p style="font-size:28px;margin:6px 0" id="rtm">0:00</p><button type="button" class="pri mic on" id="rs">Parar e transcrever</button></div>
    <div class="acts"><button type="button" id="rc">Cancelar</button></div>`;
    const t0 = Date.now(); recTimer = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); const el = $('#rtm'); if (el) el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); if (s >= 120) rec.stop(); }, 500);
    rec.onstop = async () => {
      clearInterval(recTimer); stream?.getTracks().forEach(t => t.stop()); stream = null;
      if (!root.isConnected || rec._cancel) return;
      root.innerHTML = '<h2>Transcrevendo…</h2><p>Só um instante.</p>';
      try {
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        const text = (await api.transcribe(await toWav(blob))).trim();
        if (text.length < 5) throw new Error('Não entendi o áudio. Tente falar mais perto do microfone.');
        confirmText(text);
      } catch (e) { form(e.message || 'Não consegui transcrever o áudio.'); }
    };
    rec.start();
    $('#rs').onclick = () => rec.stop();
    $('#rc').onclick = () => { rec._cancel = true; rec.state !== 'inactive' && rec.stop(); form(); };
  }
  function confirmText(text) {
    root.innerHTML = `<h2>Confere se é isso mesmo</h2><p>Foi isto que entendi do seu áudio. Corrija o que precisar.</p>
    <textarea id="ct" style="min-height:160px" maxlength="2500">${esc(text)}</textarea>
    <div class="acts"><button type="button" class="pri" id="cy">É isso, continuar</button><button type="button" id="cr">Gravar de novo</button><button type="button" id="cb">Voltar</button></div>`;
    $('#cy').onclick = () => { const t = $('#ct').value.trim(); if (t.length < 8) return; f.topic = t; save(f); form(); };
    $('#cr').onclick = recordFlow; $('#cb').onclick = () => form();
  }

  // ---------- 2. geração ----------
  async function go(extra) {
    if (busy) return;
    if (f.topic.length < 8) { $('#re') ? $('#re').textContent = 'Conte um pouco mais sobre o assunto (ou toque em Falar).' : form('Conte um pouco mais sobre o assunto.'); return; }
    busy = true; root.innerHTML = '<h2>Escrevendo seu roteiro…</h2><p>Gancho, promessa, tese e CTA. Leva alguns segundos.</p>';
    try {
      const r = await api.script(payload(extra || { mode: 'auto' }));
      if (r.questions?.length) { busy = false; ask(r.questions); return; }
      blocks = r.blocks; busy = false; show();
    } catch (e) { busy = false; form(e.message || 'Não foi possível gerar agora.'); }
  }
  function ask(qs) {
    root.innerHTML = `<h2>Mais um detalhe</h2><p>Para o roteiro ficar específico, responda rapidinho (ou deixe em branco para eu decidir):</p>
    ${qs.map((q, i) => `<label for="q${i}">${esc(q)}</label><input id="q${i}" maxlength="300">`).join('')}
    <div class="acts"><button type="button" class="pri" id="qa">Gerar roteiro</button><button type="button" id="qb">Voltar</button></div>`;
    $('#qb').onclick = () => form();
    $('#qa').onclick = () => { answers = qs.map((q, i) => { const v = $('#q' + i).value.trim(); return v ? q + ' ' + v : ''; }).filter(Boolean).join('\n'); go({ mode: 'write', answers }); };
  }

  // ---------- 3. resultado ----------
  function show() {
    const tot = blocks.reduce((n, b) => n + words(b.text), 0);
    root.innerHTML = `<h2>Seu roteiro</h2><p id="rsum"></p>
    ${blocks.map((b, i) => `<div class="blk" style="--c:${COLOR[b.type] || '#888'}"><b>${LABEL[b.type] || b.type}</b><small data-w="${i}"></small><textarea data-i="${i}" aria-label="${LABEL[b.type] || b.type}">${esc(b.text)}</textarea></div>`).join('')}
    <label for="ra">Quer ajustar? Escolha ou escreva</label>
    <div class="chips">${['Gancho mais forte', 'Mais curto', 'Mais informal', 'Mais profissional', 'Trocar o CTA'].map(x => `<button type="button" data-a="${x}">${x}</button>`).join('')}</div>
    <input id="ra" maxlength="200" placeholder="Ex.: dê um exemplo da área de saúde" style="margin-top:8px">
    <div class="err" id="re"></div>
    <div class="acts"><button type="button" class="pri" id="ru">Usar no teleprompter</button><button type="button" id="rj">Aplicar ajuste</button><button type="button" id="rn2">Gerar outro</button><button type="button" id="rb">Voltar</button></div>`;
    const sync = () => {
      root.querySelectorAll('textarea[data-i]').forEach(t => { blocks[+t.dataset.i].text = t.value; const w = words(t.value), s = Math.round(w / WPS), el = root.querySelector(`[data-w="${t.dataset.i}"]`); el.textContent = w + ' palavras · ~' + s + ' s'; el.className = s > 45 ? 'w' : ''; if (s > 45) el.textContent += ' (passa de 45 s)'; });
      const total = blocks.reduce((n, b) => n + words(b.text), 0); $('#rsum').textContent = '~' + Math.round(total / WPS) + ' segundos de fala (' + total + ' palavras). Você pode editar qualquer parte.';
    };
    sync(); root.querySelectorAll('textarea[data-i]').forEach(t => t.oninput = sync);
    root.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { $('#ra').value = b.dataset.a; });
    const adjust = () => { const a = $('#ra').value.trim(); if (!a) { $('#re').textContent = 'Escolha um ajuste ou escreva o que mudar.'; return; } go({ mode: 'write', answers, previous: blocks, adjust: a }); };
    $('#rj').onclick = adjust;
    $('#rn2').onclick = () => go({ mode: 'write', answers });
    $('#rb').onclick = () => form();
    $('#ru').onclick = () => { const text = blocks.map(b => b.text.trim()).filter(Boolean).join('\n\n'); done(); onUse(text); };
  }

  form();
}
