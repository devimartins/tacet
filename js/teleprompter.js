// Teleprompter do ForjaClip (plano pago). Módulo leve, carregado só quando o usuário abre.
// Tudo roda no aparelho: câmera (getUserMedia) + MediaRecorder. Nada é enviado a servidor.
const KEY = 'fc_tp';
// só os ajustes (velocidade, tamanho, espelho) ficam salvos; o texto sempre começa vazio
const load = () => { try { const o = JSON.parse(localStorage.getItem(KEY)) || {}; delete o.text; return o; } catch { return {}; } };
const save = o => { try { const { text, ...rest } = o; localStorage.setItem(KEY, JSON.stringify(rest)); } catch { /* sem armazenamento */ } };

const CSS = `
#tp{position:fixed;inset:0;z-index:90;background:#0b0b0f;color:#fff;display:flex;flex-direction:column;font:16px/1.4 system-ui,sans-serif}
#tp *{box-sizing:border-box}
#tp .bar{display:flex;gap:8px;align-items:center;padding:10px 12px;flex-wrap:wrap}
#tp .bar b{flex:1;font-size:16px}
#tp button,#tp label.b{background:#24242c;color:#fff;border:1px solid #3a3a46;border-radius:10px;padding:10px 14px;font:inherit;cursor:pointer;min-height:44px}
#tp button.pri{background:#ff5a1f;border-color:#ff5a1f;font-weight:700}
#tp textarea{flex:1;margin:0 12px;background:#14141a;color:#fff;border:1px solid #3a3a46;border-radius:10px;padding:12px;font:inherit;resize:none;min-height:140px}
#tp .opts{display:grid;grid-template-columns:auto 1fr auto;gap:8px 10px;align-items:center;padding:12px}
#tp input[type=range]{width:100%}
#tp .cam{position:relative;flex:1;min-height:0;background:#000;overflow:hidden}
#tp video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
#tp .win{position:absolute;left:8%;right:8%;top:0;height:46%;overflow:hidden;background:linear-gradient(#000b,#0008 80%,#0000);-webkit-mask-image:linear-gradient(#000 70%,#0000);mask-image:linear-gradient(#000 70%,#0000)}
#tp .txt{position:absolute;left:0;right:0;top:0;padding:0 8px;font-weight:700;text-align:center;text-shadow:0 1px 3px #000;white-space:pre-wrap;will-change:transform}
#tp .line{position:absolute;left:4%;right:4%;top:16%;height:3px;background:#ff5a1f99;border-radius:2px;pointer-events:none}
#tp .cnt{position:absolute;inset:0;display:none;align-items:center;justify-content:center;font-size:30vmin;font-weight:800;text-shadow:0 2px 12px #000}
#tp .rec{position:absolute;top:10px;right:12px;display:none;gap:6px;align-items:center;font-weight:700}
#tp .rec i{width:10px;height:10px;border-radius:50%;background:#f33;animation:tpb 1s infinite}
@keyframes tpb{50%{opacity:.2}}
#tp .ctl{display:flex;gap:8px;align-items:center;justify-content:center;padding:10px 12px;flex-wrap:wrap}
#tp .recb{width:68px;height:68px;border-radius:50%;background:#fff;border:5px solid #888;padding:0}
#tp .recb.on{background:#f33;border-color:#fff}
#tp .tip{padding:0 12px 10px;color:#aab;font-size:13px}
#tp .res{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;gap:10px;padding:10px 12px}
#tp .res video{position:static;transform:none;max-height:100%;width:auto;max-width:100%;flex:1;min-height:0;border-radius:10px;background:#000}
`;

export function openTeleprompter({ onUse, flash, ai }) {
  if (document.getElementById('tp')) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { flash('Seu navegador não permite gravar com a câmera. Grave pelo app de câmera do celular e envie o vídeo.'); return; }
  const cfg = Object.assign({ wpm: 130, size: 34, mirror: false, text: '' }, load());
  const st = document.createElement('style'); st.textContent = CSS;
  const root = document.createElement('div'); root.id = 'tp'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Teleprompter');
  document.body.append(st, root);
  let stream = null, rec = null, chunks = [], raf = 0, y = 0, last = 0, playing = false, wake = null, url = '', mime = '';

  const close = () => {
    cancelAnimationFrame(raf); try { rec && rec.state !== 'inactive' && rec.stop(); } catch { /* já parou */ }
    stream?.getTracks().forEach(t => t.stop()); try { wake?.release(); } catch { /* sem wake lock */ }
    if (url) URL.revokeObjectURL(url); root.remove(); st.remove();
  };
  const h = (html) => { root.innerHTML = html; return root; };
  const $ = s => root.querySelector(s);

  // ---------- 1. texto e ajustes ----------
  function editor() {
    h(`<div class="bar"><b>Teleprompter</b>${ai ? '<button id="sug" type="button">✨ Sugerir roteiro</button>' : ''}<button id="x" type="button">Fechar</button></div>
    <textarea id="t" placeholder="Cole aqui o seu texto" aria-label="Texto do teleprompter"></textarea>
    <div class="opts">
      <label for="w">Velocidade</label><input id="w" type="range" min="60" max="220" step="5"><span id="wv"></span>
      <label for="s">Tamanho do texto</label><input id="s" type="range" min="22" max="64" step="2"><span id="sv"></span>
      <label for="m">Espelhar texto</label><input id="m" type="checkbox"><span></span>
    </div>
    <p class="tip">Dica: o texto aparece perto da lente para você olhar quase direto para a câmera. Fale com naturalidade e deixe a luz de frente para o rosto.</p>
    <div class="ctl"><button class="pri" id="go" type="button">Iniciar TP</button></div>`);
    const t = $('#t'), w = $('#w'), s = $('#s'), m = $('#m');
    t.value = cfg.text; w.value = cfg.wpm; s.value = cfg.size; m.checked = cfg.mirror;
    const upd = () => { $('#wv').textContent = w.value + ' pal/min'; $('#sv').textContent = s.value + ' px'; };
    upd(); w.oninput = s.oninput = upd;
    $('#x').onclick = close;
    if (ai) $('#sug').onclick = async () => {
      const m = await import('./roteiro.js?v=1');
      m.openScriptHelper({ host: root, api: ai, flash, onUse: text => { t.value = text; cfg.text = text; save(cfg); flash('Roteiro colocado no teleprompter. Revise e toque em Iniciar TP.'); } });
    };
    $('#go').onclick = () => {
      if (!t.value.trim()) { flash('Escreva o texto primeiro.'); return; }
      Object.assign(cfg, { text: t.value, wpm: +w.value, size: +s.value, mirror: m.checked }); save(cfg); camera();
    };
  }

  // ---------- 2. câmera + texto + gravação ----------
  async function camera() {
    h(`<div class="cam"><video id="v" playsinline muted autoplay></video>
      <div class="win"><div class="txt" id="tx"></div></div><div class="line"></div>
      <div class="cnt" id="c"></div><div class="rec" id="r"><i></i><span id="rt">0:00</span></div></div>
    <div class="ctl">
      <button id="sm" type="button" aria-label="Diminuir velocidade">Mais lento</button>
      <button class="recb" id="rb" type="button" aria-label="Gravar"></button>
      <button id="sf" type="button" aria-label="Aumentar velocidade">Mais rápido</button>
    </div>
    <div class="ctl"><button id="zm" type="button">A−</button><button id="zp" type="button">A+</button><button id="pz" type="button">Pausar texto</button><button id="x" type="button">Cancelar</button></div>`);
    $('#x').onclick = () => { close(); };
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 }, frameRate: { ideal: 30 } } });
    } catch { flash('Não consegui abrir a câmera. Permita o acesso à câmera e ao microfone.'); editor(); return; }
    const v = $('#v'); v.srcObject = stream;
    const tx = $('#tx'); tx.textContent = cfg.text; tx.style.fontSize = cfg.size + 'px'; tx.style.lineHeight = '1.35'; tx.style.transform = cfg.mirror ? 'scaleX(-1)' : '';
    const words = Math.max(1, cfg.text.trim().split(/\s+/).length);
    const win = $('.win');
    const resetY = () => { y = win.clientHeight * 0.16; tx.style.top = '0'; tx.dataset.y = y; draw(); };
    const draw = () => { tx.style.transform = `translateY(${y}px)` + (cfg.mirror ? ' scaleX(-1)' : ''); };
    // velocidade em px/s: altura total do texto ÷ nº de palavras × palavras por segundo
    const pxs = () => (tx.scrollHeight / words) * (cfg.wpm / 60);
    const tick = t => {
      if (!playing) return;
      const dt = Math.min(0.1, (t - last) / 1000); last = t; y -= pxs() * dt; draw();
      if (-y > tx.scrollHeight + 20) { playing = false; return; }
      raf = requestAnimationFrame(tick);
    };
    const play = () => { if (playing) return; playing = true; last = performance.now(); raf = requestAnimationFrame(tick); $('#pz').textContent = 'Pausar texto'; };
    const pause = () => { playing = false; cancelAnimationFrame(raf); $('#pz').textContent = 'Continuar texto'; };
    resetY();
    $('#pz').onclick = () => playing ? pause() : play();
    $('.win').onclick = () => playing ? pause() : play();
    $('#sm').onclick = () => { cfg.wpm = Math.max(40, cfg.wpm - 10); save(cfg); flash(cfg.wpm + ' palavras/min'); };
    $('#sf').onclick = () => { cfg.wpm = Math.min(260, cfg.wpm + 10); save(cfg); flash(cfg.wpm + ' palavras/min'); };
    const sz = d => { cfg.size = Math.max(20, Math.min(72, cfg.size + d)); tx.style.fontSize = cfg.size + 'px'; save(cfg); };
    $('#zm').onclick = () => sz(-4); $('#zp').onclick = () => sz(4);
    try { wake = await navigator.wakeLock?.request('screen'); } catch { /* opcional */ }

    const rb = $('#rb');
    rb.onclick = async () => {
      if (rec && rec.state === 'recording') { rec.stop(); return; }
      // contagem regressiva 3-2-1
      rb.disabled = true; const c = $('#c'); c.style.display = 'flex';
      for (let n = 3; n > 0; n--) { c.textContent = n; await new Promise(r => setTimeout(r, 1000)); }
      c.style.display = 'none'; rb.disabled = false;
      mime = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t)) || '';
      chunks = [];
      try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined); } catch { flash('Não foi possível iniciar a gravação.'); return; }
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => { clearInterval(tm); playing = false; cancelAnimationFrame(raf); result(); };
      rec.start(1000); resetY(); play();
      rb.classList.add('on'); rb.setAttribute('aria-label', 'Parar gravação'); $('#r').style.display = 'flex';
      const t0 = Date.now(); const tm = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); $('#rt').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }, 500);
    };
  }

  // ---------- 3. resultado ----------
  function result() {
    stream?.getTracks().forEach(t => t.stop()); try { wake?.release(); } catch { /* ok */ }
    const type = (rec.mimeType || mime || 'video/mp4').split(';')[0];
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(chunks, { type }); url = URL.createObjectURL(blob);
    const file = new File([blob], 'teleprompter-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.' + ext, { type });
    if (!file.size) { flash('A gravação saiu vazia. Tente de novo.'); camera(); return; }
    close(); flash('Gravação aberta no editor. Escolha o estilo e gere as legendas.'); onUse(file); return;
    h(`<div class="bar"><b>Gravação pronta</b></div>
    <div class="res"><video id="pv" src="${url}" controls playsinline></video>
    <p class="tip" id="wm" style="font-size:14px;color:#fff">Atenção: a gravação ainda não está no editor. Toque em <b>Usar no ForjaClip</b> para legendar agora, ou toque em <b>Salvar no aparelho</b> e depois envie esse arquivo ao ForjaClip em <b>Só legendas</b>.</p>
    <div class="ctl"><button id="sv" type="button">Salvar no aparelho</button><button class="pri" id="us" type="button">Usar no ForjaClip</button><button id="again" type="button">Gravar de novo</button><button id="x" type="button">Fechar</button></div></div>`);
    if (ext === 'webm') $('#wm').append(document.createElement('br'), 'Este navegador gravou em WebM. Se o editor não aceitar, grave em um navegador que salve MP4 (Safari ou Chrome recente).');
    $('#sv').onclick = async () => {
      try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e.name === 'AbortError') return; }
      const a = document.createElement('a'); a.href = url; a.download = file.name; a.click();
    };
    $('#us').onclick = () => { const f = file; close(); onUse(f); };
    $('#again').onclick = () => { URL.revokeObjectURL(url); url = ''; camera(); };
    $('#x').onclick = close;
  }

  editor();
}
