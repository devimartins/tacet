// Teleprompter do ForjaClip (plano pago). Módulo leve, carregado só quando o usuário abre.
// Tudo roda no aparelho: câmera (getUserMedia) + MediaRecorder. Nada é enviado a servidor.
const KEY = 'fc_tp';
// só os ajustes (velocidade, tamanho, espelho) ficam salvos; o texto sempre começa vazio
const load = () => { try { const o = JSON.parse(localStorage.getItem(KEY)) || {}; delete o.text; return o; } catch { return {}; } };
const save = o => { try { const { text, ...rest } = o; localStorage.setItem(KEY, JSON.stringify(rest)); } catch { /* sem armazenamento */ } };

import { startShotCheck, MSG } from './shotcheck.js?v=3';
import { canRecordWC, primeAudio, startWcRecording } from './recorder.js?v=2';
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
#tp video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;transform:scaleX(-1)}
#tp .win{position:absolute;left:8%;right:8%;top:0;height:46%;overflow:hidden;background:linear-gradient(#000b,#0008 80%,#0000);-webkit-mask-image:linear-gradient(#000 70%,#0000);mask-image:linear-gradient(#000 70%,#0000)}
#tp .txt{position:absolute;left:0;right:0;top:0;padding:0 8px;font-weight:700;text-align:center;text-shadow:0 1px 3px #000;white-space:pre-wrap;will-change:transform}
#tp .line{position:absolute;left:4%;right:4%;top:16%;height:3px;background:#ff5a1f99;border-radius:2px;pointer-events:none}
#tp .chk{position:absolute;left:10px;top:10px;z-index:3;max-width:min(72%,420px);padding:7px 11px;border-radius:10px;font-size:13px;line-height:1.35;font-weight:600;background:#000a;border:1px solid #fff3}#tp .chk.ok{color:#5be08f}#tp .chk.bad{color:#ffb454}#tp .chk:empty{display:none}
#tp .gd{position:absolute;z-index:2;pointer-events:none;display:none;background:linear-gradient(#ffffff40,#ffffff40) 0 33.33%/100% 1px no-repeat,linear-gradient(#ffffff40,#ffffff40) 0 66.66%/100% 1px no-repeat,linear-gradient(#ffffff40,#ffffff40) 33.33% 0/1px 100% no-repeat,linear-gradient(#ffffff40,#ffffff40) 66.66% 0/1px 100% no-repeat}#tp .gd.on{display:block}#tp .gd::after{content:"";position:absolute;inset:10%;border:1px dashed #ffffff55;border-radius:6px}
#tp .gd i{position:absolute;left:6px;top:calc(33.33% - 18px);font:600 11px system-ui;font-style:normal;color:#fff;opacity:.8;text-shadow:0 1px 2px #000}
#tp .cnt{position:absolute;inset:0;display:none;align-items:center;justify-content:center;font-size:30vmin;font-weight:800;text-shadow:0 2px 12px #000}
#tp .zr{display:flex;align-items:center;gap:10px;padding:8px 16px 0;font-size:13px}#tp .zr input{flex:1}#tp .zr[hidden]{display:none}
#tp.camv .ctls{display:flex;flex-direction:column}
@media (orientation:landscape) and (max-height:560px){
#tp.camv{flex-direction:row}#tp.camv .cam{flex:1 1 auto;min-width:0}
#tp.camv .ctls{flex:0 0 min(46vw,340px);justify-content:center;overflow-y:auto;padding-bottom:env(safe-area-inset-bottom)}
#tp.camv .ctl{padding:6px 10px}#tp.camv .zr{padding:4px 12px 0}
}
#tp .fm{display:flex;gap:8px;justify-content:center;padding:8px 12px 0}#tp .fm button{flex:1;max-width:190px;min-height:40px;padding:6px 10px;font-size:14px}#tp .fm button[aria-pressed=true]{background:#ff5a1f;border-color:#ff5a1f;color:#fff;font-weight:600}
#tp .rec{position:absolute;top:10px;right:12px;display:none;gap:6px;align-items:center;font-weight:700}
#tp .rec i{width:10px;height:10px;border-radius:50%;background:#f33;animation:tpb 1s infinite}
@keyframes tpb{50%{opacity:.2}}
#tp .ctl{display:flex;gap:8px;align-items:center;justify-content:center;padding:10px 12px;flex-wrap:wrap}
#tp .recb{width:68px;height:68px;border-radius:50%;background:#fff;border:5px solid #888;padding:0}
#tp .recb.on{background:#f33;border-color:#fff}
#tp .tip{padding:0 12px 10px;color:#aab;font-size:13px}
#tp .perm{display:flex;gap:12px;align-items:center;margin:0 12px 10px;padding:10px;border:1px solid #3a3a46;border-radius:14px;background:#14141a}#tp .perm.okc{border-color:#2f8f5b}
#tp .perm video{position:static;transform:scaleX(-1);width:54px;height:72px;border-radius:8px;background:#000;object-fit:cover;display:none;flex:none}
#tp .pi{flex:1;min-width:0;display:grid;gap:4px;font-size:13px}#tp .pi b{font-size:14px}#tp .pi span{color:#aab}#tp .pi .ok{color:#5be08f}#tp .pi .bad{color:#ffb454}
#tp .lvl{height:6px;border-radius:3px;background:#2a2a33;overflow:hidden}#tp .lvl i{display:block;height:100%;width:0;background:#5be08f;transition:width .08s}
#tp .perm button{flex:none;max-width:44%}
#tp .res{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;gap:10px;padding:10px 12px}
#tp .res video{position:static;transform:none;max-height:100%;width:auto;max-width:100%;flex:1;min-height:0;border-radius:10px;background:#000}
`;

export function openTeleprompter({ onUse, flash, ai, onStart }) {
  if (document.getElementById('tp')) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { flash('Seu navegador não permite gravar com a câmera. Grave pelo app de câmera do celular e envie o vídeo.'); return; }
  const cfg = Object.assign({ wpm: 130, size: 34, mirror: false, text: '' }, load());
  const st = document.createElement('style'); st.textContent = CSS;
  const root = document.createElement('div'); root.id = 'tp'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Teleprompter');
  document.body.append(st, root);
  const dbg = [];
  let fmt = window.innerHeight > window.innerWidth ? 'v' : 'h', turnOff = () => { }, sc = null, stream = null, view = null, compCv = null, wcRec = null, wcBlob = null, compRaf = 0, zk = Math.min(1, Math.max(0, Number(cfg.zoomK ?? 0.5))), rec = null, chunks = [], raf = 0, y = 0, last = 0, playing = false, wake = null, url = '', mime = '';

  const close = () => {
    turnOff(); cancelAnimationFrame(raf); cancelAnimationFrame(compRaf); stopMeter(); sc && sc.stop(); try { rec && rec.state !== 'inactive' && rec.stop(); } catch { /* já parou */ }
    stream?.getTracks().forEach(t => t.stop()); try { wake?.release(); } catch { /* sem wake lock */ }
    if (url) URL.revokeObjectURL(url); root.remove(); st.remove();
  };
  const h = (html) => { root.className = ''; root.innerHTML = html; return root; };
  const $ = s => root.querySelector(s);


  // ---------- permissão: pede antes de gravar, mostra prévia e nível do microfone ----------
  // Segue a posição atual do aparelho: em pé pede imagem vertical, deitado pede horizontal. Sem zoom nem recorte forçados.
  const portrait = () => window.innerHeight > window.innerWidth;
  // Pede sempre a imagem larga (16:9), que é o campo de visão completo da câmera. O formato da gravação (vertical ou horizontal) é escolhido na tela.
  const TRIES = () => [
    { audio: { echoCancellation: true, noiseSuppression: true }, video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 }, aspectRatio: { ideal: 16 / 9 }, frameRate: { ideal: 30 } } },
    { audio: true, video: { facingMode: 'user' } },
    { audio: true, video: true }];
  const live = () => !!stream && stream.getTracks().length > 0 && stream.getTracks().every(t => t.readyState === 'live');
  // A prévia e o vídeo gravado saem de um canvas com o formato escolhido (vertical 9:16 ou horizontal 16:9), não importa como o aparelho entrega a câmera.
  const dropView = () => { cancelAnimationFrame(compRaf); compRaf = 0; view = null; compCv = null; };
  let onMis = () => { };
  async function buildView() {
    dropView();
    try {
      const vt = stream.getVideoTracks()[0];
      const src = document.createElement('video'); src.muted = true; src.playsInline = true; src.srcObject = new MediaStream([vt]); await src.play().catch(() => { });
      for (let i = 0; i < 60 && !src.videoWidth; i++) await new Promise(r => setTimeout(r, 50));
      if (!src.videoWidth) return;
      const L = Math.min(1920, Math.max(src.videoWidth, src.videoHeight)), ev = n => Math.round(n / 2) * 2;
      const W = fmt === 'v' ? ev(L * 9 / 16) : L, H = fmt === 'v' ? L : ev(L * 9 / 16);
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d');
      const bg = document.createElement('canvas'); bg.width = 32; bg.height = 18; const bx = bg.getContext('2d');   // fundo desfocado barato para as faixas
      let was = null;
      const draw = () => { const vw = src.videoWidth, vh = src.videoHeight; if (vw && vh) {
        const same = Math.abs(vw / vh - W / H) < 0.04, cover = Math.max(W / vw, H / vh), fit = Math.min(W / vw, H / vh), k = Math.max(0, Math.min(1, zk)), sc = same ? cover : fit + (cover - fit) * k, dw = vw * sc, dh = vh * sc;
        if (was !== !same) { was = !same; onMis(!same); }
        if (!same && k < 0.999) { bx.drawImage(src, 0, 0, 32, 18); cx.imageSmoothingEnabled = true; cx.drawImage(bg, 0, 0, W, H); cx.fillStyle = 'rgba(0,0,0,.45)'; cx.fillRect(0, 0, W, H); }
        cx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh); }
        compRaf = requestAnimationFrame(draw); };
      draw(); const out = cv.captureStream(30); stream.getAudioTracks().forEach(a => out.addTrack(a)); view = out; compCv = cv;
    } catch { dropView(); }
  }
  async function acquire() {
    if (live()) return null; let err = null; stream = null;
    for (const c of TRIES()) { try { stream = await navigator.mediaDevices.getUserMedia(c); await buildView(); return null; } catch (e) { err = e; if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError' || e.name === 'NotFoundError')) break; } }
    return err;
  }
  let actx = null, mraf = 0;
  const stopMeter = () => { cancelAnimationFrame(mraf); try { actx && actx.close(); } catch { /* ok */ } actx = null; };
  function meter() {
    stopMeter(); const bar = $('#pl'); if (!bar || !stream || !stream.getAudioTracks().length) return;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)(); actx.resume?.().catch(() => { });
      const an = actx.createAnalyser(); an.fftSize = 256; actx.createMediaStreamSource(stream).connect(an); const buf = new Uint8Array(an.fftSize);
      const loop = () => { an.getByteTimeDomainData(buf); let m = 0; for (const x of buf) m = Math.max(m, Math.abs(x - 128)); const el0 = $('#pl'); if (!el0) return; el0.style.width = Math.min(100, m * 1.6) + '%'; mraf = requestAnimationFrame(loop); };
      loop();
    } catch { /* sem medidor */ }
  }
  async function permState() {
    try { const r = await Promise.all(['camera', 'microphone'].map(n => navigator.permissions.query({ name: n }))); return r.some(x => x.state === 'denied') ? 'denied' : r.every(x => x.state === 'granted') ? 'granted' : 'prompt'; } catch { return 'unknown'; }
  }
  async function lobby() {
    const pb = $('#pb'), ps = $('#ps'), pv = $('#pv'); if (!pb) return;
    const ready = () => { pv.srcObject = stream; pv.play().catch(() => { }); pv.style.display = 'block'; ps.textContent = 'Pronto: câmera e microfone liberados. Fale para testar o nível.'; ps.className = 'ok'; pb.hidden = true; $('#perm').classList.add('okc'); meter(); };
    const ask = async () => { pb.disabled = true; ps.className = ''; ps.textContent = 'Aguardando você tocar em “Permitir” na janela do navegador…'; const err = await acquire(); pb.disabled = false; if (live()) ready(); else { setBlocked(); permDialog(err && err.name, ask); } };
    const setBlocked = () => { ps.className = 'bad'; ps.textContent = 'Câmera ou microfone bloqueado neste navegador.'; pb.textContent = 'Como liberar'; pb.onclick = () => permDialog('NotAllowedError', ask); };
    if (live()) { ready(); return; }
    pb.onclick = ask; ps.textContent = 'Toque no botão e escolha “Permitir” quando o navegador perguntar.';
    const st = await permState();
    if (st === 'granted') { ps.textContent = 'Ativando…'; await acquire(); if (live()) ready(); }
    else if (st === 'denied') setBlocked();
  }

  // ---------- 1. texto e ajustes ----------
  function editor() {
    h(`<div class="bar"><b>Teleprompter</b>${ai ? '<button id="sug" type="button">✨ Sugerir roteiro</button>' : ''}<button id="x" type="button">Fechar</button></div>
    <div class="perm" id="perm"><video id="pv" playsinline muted></video><div class="pi"><b>Câmera e microfone</b><span id="ps">Verificando…</span><div class="lvl" aria-hidden="true"><i id="pl"></i></div></div><button class="pri" id="pb" type="button">Ativar câmera e microfone</button></div>
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
    $('#x').onclick = close; lobby();
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
  function permDialog(n, retry) {
    const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua), android = /Android/.test(ua), chromeIos = /CriOS/.test(ua);
    const blocked = n === 'NotAllowedError' || n === 'SecurityError';
    let title = 'Não consegui abrir a câmera', lead = 'Feche outros apps que usam a câmera e tente de novo.', steps = [];
    if (blocked) {
      title = 'Libere a câmera e o microfone'; lead = 'O navegador bloqueou o acesso para este site. É só liberar uma vez:';
      if (ios) steps = chromeIos ? ['Abra os <b>Ajustes</b> do iPhone.', 'Role até <b>Chrome</b> e toque nele.', 'Ative <b>Câmera</b> e <b>Microfone</b>.'] : ['Toque em <b>aA</b> ao lado do endereço.', 'Abra <b>Ajustes do Site</b>.', 'Em <b>Câmera</b> e <b>Microfone</b>, escolha <b>Permitir</b>.', 'Se ainda falhar: Ajustes do iPhone > Safari > Câmera e Microfone.'];
      else if (android) steps = ['Toque no ícone ao lado do endereço (cadeado).', 'Abra <b>Permissões</b>.', 'Ative <b>Câmera</b> e <b>Microfone</b>.'];
      else steps = ['Clique no ícone de cadeado ou câmera ao lado do endereço.', 'Ative <b>Câmera</b> e <b>Microfone</b> para este site.', 'Se a página pedir, recarregue.'];
    } else if (n === 'NotFoundError') { title = 'Câmera não encontrada'; lead = 'Não achei câmera ou microfone neste aparelho.'; }
    else if (n === 'NotReadableError' || n === 'AbortError') { title = 'Câmera em uso'; lead = 'Outro app ou aba está usando a câmera. Feche-o e tente de novo.'; }
    else lead += n ? ' (' + n + ')' : '';
    const d = document.createElement('dialog'); d.className = 'tpperm'; d.setAttribute('aria-labelledby', 'tppT');
    d.innerHTML = `<h2 id="tppT" style="margin:0 0 6px">${title}</h2><p class="mut" style="margin:0 0 10px">${lead}</p>${steps.length ? '<ol style="margin:0 0 14px;padding-left:20px;line-height:1.6">' + steps.map(x => '<li>' + x + '</li>').join('') + '</ol>' : ''}<p class="mut" style="font-size:12px;margin:0 0 14px">O vídeo é gravado no seu aparelho e não é enviado a nenhum servidor.</p><div class="row btns"><button class="btn pri" id="tppRetry" type="button">Já liberei, tentar de novo</button><button class="btn" id="tppX" type="button">Fechar</button></div>`;
    document.body.append(d); d.addEventListener('close', () => d.remove());
    d.querySelector('#tppX').onclick = () => d.close(); d.querySelector('#tppRetry').onclick = () => { d.close(); retry(); };
    d.showModal();
  }
  function shotDialog(iss) {
    return new Promise(res => {
      const d = document.createElement('dialog'); d.className = 'tpperm'; d.setAttribute('aria-labelledby', 'shT');
      d.innerHTML = `<h2 id="shT" style="margin:0 0 6px">Antes de gravar</h2><p class="mut" style="margin:0 0 10px">Estes ajustes deixam o vídeo melhor:</p><ul style="margin:0 0 14px;padding-left:20px;line-height:1.6">${iss.slice(0, 3).map(k => '<li>' + MSG[k] + '</li>').join('')}</ul><div class="row btns"><button class="btn pri" id="shFix" type="button">Ajustar</button><button class="btn" id="shGo" type="button">Gravar assim mesmo</button></div>`;
      let out = 'fix'; document.body.append(d); d.addEventListener('close', () => { d.remove(); res(out); });
      d.querySelector('#shFix').onclick = () => d.close(); d.querySelector('#shGo').onclick = () => { out = 'go'; d.close(); }; d.showModal();
    });
  }
  async function camera() {
    h(`<div class="cam"><video id="v" playsinline muted autoplay></video>
      <div class="win"><div class="txt" id="tx"></div></div><div class="line"></div>
      <div class="gd" id="gd" aria-hidden="true"><i>olhos aqui</i></div><div class="chk" id="chk" role="status"></div><div class="cnt" id="c"></div><div class="rec" id="r"><i></i><span id="rt">0:00</span></div></div>
    <div class="ctls"><div class="fm" id="fm" role="group" aria-label="Formato da gravação"><button id="fv" type="button" aria-pressed="true">Vertical 9:16</button><button id="fh" type="button" aria-pressed="false">Horizontal 16:9</button></div><div class="zr" id="zr" hidden><label for="zk">Zoom da câmera</label><input id="zk" type="range" min="0" max="100" step="1"><span class="mut" id="zkv"></span></div>
    <div class="ctl">
      <button id="sm" type="button" aria-label="Diminuir velocidade">Mais lento</button>
      <button class="recb" id="rb" type="button" aria-label="Gravar"></button>
      <button id="sf" type="button" aria-label="Aumentar velocidade">Mais rápido</button>
    </div>
    <div class="ctl"><button id="zm" type="button">A−</button><button id="zp" type="button">A+</button><button id="gb" type="button" aria-pressed="true">Guia</button><button id="pz" type="button">Pausar texto</button><button id="x" type="button">Cancelar</button></div></div>`);
    root.classList.add('camv'); $('#x').onclick = () => { close(); };
    stopMeter(); const err = await acquire();
    if (!live()) { editor(); permDialog(err && err.name, camera); flash('Não consegui abrir a câmera.'); return; }
    const v = $('#v'); const zi = $('#zk'), zr = $('#zr'), zu = () => { $('#zkv').textContent = zi.value < 15 ? 'Amplo' : zi.value > 85 ? 'Fechado' : zi.value + '%'; };
    zi.oninput = () => { zk = zi.value / 100; cfg.zoomK = zk; save(cfg); zu(); };
    const applyView = () => { v.srcObject = view || stream; v.play().catch(() => { /* autoplay */ }); zi.value = Math.round(zk * 100); zu(); };
    onMis = m => { zr.hidden = !m; };
    const fb = { v: $('#fv'), h: $('#fh') };
    const mark = () => { for (const k in fb) fb[k].setAttribute('aria-pressed', String(fmt === k)); };
    for (const k in fb) fb[k].onclick = async () => { if (rec && rec.state === 'recording') { flash('Pare a gravação para mudar o formato.'); return; } if (fmt === k) return; fmt = k; mark(); await buildView(); applyView(); };
    mark(); applyView();
    // guia de enquadramento: terços e margem de 10%, só na prévia (nunca entra no vídeo gravado), alinhada à área real do vídeo
    const gd = $('#gd'), gb = $('#gb'), cam = $('.cam');
    const place = () => { if (!gd || !v.videoWidth) return; const W = cam.clientWidth, H = cam.clientHeight, k = Math.min(W / v.videoWidth, H / v.videoHeight), w = v.videoWidth * k, h = v.videoHeight * k;
      Object.assign(gd.style, { left: ((W - w) / 2) + 'px', top: ((H - h) / 2) + 'px', width: w + 'px', height: h + 'px' }); };
    const showG = () => { gd.classList.toggle('on', cfg.guide !== false); gb.setAttribute('aria-pressed', String(cfg.guide !== false)); place(); };
    gb.onclick = () => { cfg.guide = cfg.guide === false; save(cfg); showG(); };
    v.addEventListener('loadedmetadata', place); v.addEventListener('resize', place); window.addEventListener('resize', place); showG();
    const pi = setInterval(place, 250); turnOff = () => { clearInterval(pi); window.removeEventListener('resize', place); };   // reposiciona a guia sempre que o formato ou a rotação mudar
    let lastChk = '';
    startShotCheck(v, iss => { const c = $('#chk'); if (!c || !iss) return; const t = iss.length ? MSG[iss[0]] : 'Enquadramento e luz ok'; if (t !== lastChk) { lastChk = t; c.textContent = t; c.className = 'chk ' + (iss.length ? 'bad' : 'ok'); } }).then(x => { if ($('#v')) sc = x; else x && x.stop(); }).catch(() => { });
    const tx = $('#tx'); tx.textContent = cfg.text; tx.style.fontSize = cfg.size + 'px'; tx.style.lineHeight = '1.35'; tx.style.transform = cfg.mirror ? 'scaleX(-1)' : '';
    const words = Math.max(1, cfg.text.trim().split(/\s+/).length);
    const win = $('.win');
    const resetY = () => { y = win.clientHeight * 0.3; tx.style.top = '0'; tx.dataset.y = y; draw(); };
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
      if (sc) { const iss = sc.issues(); if (iss && iss.length) { rb.disabled = true; const r = await shotDialog(iss); rb.disabled = false; if (r === 'fix') return; } }
      let actx = null; if (canRecordWC()) { try { actx = primeAudio(); } catch { actx = null; } }   // iOS: criado dentro do toque
      // contagem regressiva 3-2-1
      rb.disabled = true; const c = $('#c'); c.style.display = 'flex';
      for (let n = 3; n > 0; n--) { c.textContent = n; await new Promise(r => setTimeout(r, 1000)); }
      c.style.display = 'none'; rb.disabled = false;
      let tm = 0, t0 = 0;
      const finish = () => { sc && sc.stop(); sc = null; clearInterval(tm); playing = false; cancelAnimationFrame(raf); result(); };
      wcBlob = null; wcRec = null; chunks = [];
      mime = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t)) || '';
      // reserva: o gravador do navegador roda junto; se o gravador próprio falhar, usamos o arquivo dele
      let mr = null, mrDone = Promise.resolve();
      try {
        mr = new MediaRecorder(view || stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined);
        mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        mrDone = new Promise(r => { mr.onstop = r; }); mr.start(1000);
      } catch { mr = null; }
      if (actx && compCv && stream.getAudioTracks()[0]) {
        try {
          wcRec = await Promise.race([startWcRecording({ ctx: actx, source: compCv, audioTrack: stream.getAudioTracks()[0], fps: 30, onError: e => (dbg.push(String(e && e.message || e)), console.warn('gravador', e)) }), new Promise((_, no) => setTimeout(() => no(new Error('início demorou')), 3000))]);
        } catch (e) { dbg.push('início: ' + String(e && e.message || e)); console.warn('Gravador próprio indisponível', e); wcRec = null; try { actx.close(); } catch { /* ok */ } }
      } else if (actx) { try { actx.close(); } catch { /* ok */ } }
      actx = null;
      if (!wcRec && !mr) { flash('Não foi possível iniciar a gravação.'); return; }
      rec = { state: 'recording', mimeType: mime, stop() {
        if (this.state !== 'recording') return; this.state = 'inactive';
        try { mr && mr.state !== 'inactive' && mr.stop(); } catch { /* ok */ }
        const w = wcRec ? Promise.race([wcRec.stop(), new Promise((_, no) => setTimeout(() => no(new Error('tempo esgotado')), 8000))]).then(bl => { wcBlob = bl; }, e => { (dbg.push(String(e && e.message || e)), console.warn('gravador', e)); wcBlob = null; }) : Promise.resolve();
        Promise.all([w, Promise.race([mrDone, new Promise(r => setTimeout(r, 4000))])]).finally(finish);
      } };
      onStart && onStart(); resetY(); play();
      rb.classList.add('on'); rb.setAttribute('aria-label', 'Parar gravação'); $('#r').style.display = 'flex';
      t0 = Date.now(); tm = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); $('#rt').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }, 500);
    };
  }

  function rawDialog(file, go) {
    const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua), mobile = ios || /Android/.test(ua);
    const d = document.createElement('dialog'); d.className = 'tpperm'; d.setAttribute('aria-labelledby', 'rwT');
    d.innerHTML = `<h2 id="rwT" style="margin:0 0 6px">Gravação pronta</h2><p class="mut" style="margin:0 0 10px">Guarde uma cópia do vídeo bruto no seu aparelho para comparar depois com a versão editada no ForjaClip.</p>${ios ? '<p class="mut" style="font-size:13px;margin:0 0 10px">No iPhone, na janela que abrir, toque em <b>Salvar Vídeo</b> para ir à galeria.</p>' : ''}<p class="mut" id="rwM" role="status" style="font-size:13px;margin:0 0 10px"></p><div class="row btns"><button class="btn pri" id="rwSave" type="button">Salvar cópia no aparelho</button><button class="btn" id="rwGo" type="button">Editar no ForjaClip</button></div>`;
    document.body.append(d); let went = false;
    const proceed = () => { if (went) return; went = true; d.remove(); go(); };
    d.addEventListener('close', proceed);
    d.querySelector('#rwGo').onclick = () => d.close();
    d.querySelector('#rwSave').onclick = async () => {
      const m = d.querySelector('#rwM');
      try { if (mobile && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); m.textContent = 'Pronto. Se você salvou, a cópia está no aparelho.'; return; } } catch (e) { if (e.name === 'AbortError') { m.textContent = 'Cópia não salva. Toque de novo para salvar.'; return; } }
      const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.append(a); a.click(); a.remove();
      m.textContent = 'Cópia baixada: veja a pasta Downloads do aparelho.';
    };
    d.showModal();
  }
  // ---------- 3. resultado ----------
  function result() {
    turnOff(); dropView(); stream?.getTracks().forEach(t => t.stop()); try { wake?.release(); } catch { /* ok */ }
    const type = wcBlob ? 'video/mp4' : (rec.mimeType || mime || 'video/mp4').split(';')[0];
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    const blob = wcBlob || new Blob(chunks, { type }); url = URL.createObjectURL(blob);
    const file = new File([blob], 'teleprompter-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.' + ext, { type });
    if (!file.size) { flash('A gravação saiu vazia. Tente de novo. (' + (dbg.join(' | ') || 'sem detalhe') + '; partes: ' + chunks.length + ')'); camera(); return; }
    h(`<div class="bar"><b>Gravação pronta</b></div>
    <div class="res"><video id="pv" src="${url}" controls playsinline></video>
    <p class="tip" id="wm" style="font-size:14px;color:#fff">Assista à prévia. Se gostou, toque em <b>Usar no ForjaClip</b> para legendar. Se não, toque em <b>Gravar de novo</b>: o texto e os ajustes continuam aqui.</p>
    <div class="ctl"><button class="pri" id="us" type="button">Usar no ForjaClip</button><button id="again" type="button">Gravar de novo</button><button id="sv" type="button">Salvar no aparelho</button><button id="x" type="button">Descartar e fechar</button></div></div>`);
    if (ext === 'webm') $('#wm').append(document.createElement('br'), 'Este navegador gravou em WebM. Se o editor não aceitar, grave em um navegador que salve MP4 (Safari ou Chrome recente).');
    $('#sv').onclick = async () => {
      try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e.name === 'AbortError') return; }
      const a = document.createElement('a'); a.href = url; a.download = file.name; a.click();
    };
    $('#us').onclick = () => { const f = file; $('#pv').pause(); rawDialog(f, () => { close(); flash('Gravação aberta no editor. Preparando a transcrição…'); onUse(f); }); };
    $('#again').onclick = () => { URL.revokeObjectURL(url); url = ''; camera(); };
    $('#x').onclick = close;
  }

  editor();
}
