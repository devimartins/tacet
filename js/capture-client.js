// Loaded ONLY by cortes-youtube.html. Nothing starts before a user requests a cut.
export function attachCapture(card, { endpoint, getToken, snapshot }) {
  if (!endpoint || card.querySelector('.capture-actions')) return;
  const base = new URL(endpoint);
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) return;
  const root = document.createElement('div'); root.className = 'capture-actions';
  const button = document.createElement('button'); button.type = 'button'; button.className = 'btn pri'; button.textContent = 'Baixar corte';
  const status = document.createElement('p'); status.className = 'mut'; status.setAttribute('role', 'status');
  const progress = document.createElement('progress'); progress.max = 100; progress.hidden = true; progress.setAttribute('aria-label', 'Progresso da gravação');
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn'; cancel.textContent = 'Cancelar'; cancel.hidden = true;
  const save = document.createElement('a'); save.className = 'btn pri'; save.textContent = 'Salvar vídeo 9:16'; save.hidden = true; save.rel = 'noopener';
  root.append(button, progress, status, cancel, save); card.append(root);
  let job = null, stopped = false, completedSnapshot = '';
  const request = async (path, options = {}) => {
    const token = await getToken();
    if (!token) throw new Error('Entre na sua conta para preparar o download.');
    const response = await fetch(base.href.replace(/\/$/, '') + path, {
      ...options, signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Não foi possível conectar ao serviço de captura.');
    return data;
  };
  cancel.onclick = async () => {
    if (!job) return;
    cancel.disabled = true;
    try { await request('/jobs/' + job.id, { method: 'DELETE' }); stopped = true; status.textContent = 'Captura cancelada.'; }
    catch (error) { status.textContent = error.message; }
    finally { cancel.disabled = false; }
  };
  // Do not let edits silently download an older visual configuration.
  save.onclick = event => {
    if (JSON.stringify(snapshot()) !== completedSnapshot) {
      event.preventDefault(); save.hidden = true; status.textContent = 'O corte foi alterado. Prepare um novo download.';
    }
  };
  button.onclick = async () => {
    stopped = false; button.disabled = true; save.hidden = true; progress.hidden = false; progress.removeAttribute('value');
    status.textContent = 'Solicitando captura…';
    try {
      const scene = snapshot(); completedSnapshot = JSON.stringify(scene);
      job = await request('/jobs', { method: 'POST', body: JSON.stringify(scene) }); cancel.hidden = false;
      while (!stopped && card.isConnected) {
        const data = await request('/jobs/' + job.id);
        if (data.state === 'failed') throw new Error(data.error || 'Falha ao gravar o trecho.');
        if (data.state === 'cancelled') { status.textContent = 'Captura cancelada.'; break; }
        if (data.state === 'ready') {
          const url = new URL(data.downloadUrl, base);
          if (url.origin !== base.origin) throw new Error('Endereço de download inválido.');
          progress.value = 100; save.href = url.href; save.hidden = false;
          status.textContent = 'Pronto. O arquivo fica disponível por 1 hora.'; break;
        }
        if (data.state === 'recording') { progress.value = data.percent; status.textContent = 'Gravando — ' + data.percent + '%'; }
        else { progress.removeAttribute('value'); status.textContent = ({ queued: 'Na fila…', preparing: 'Preparando vídeo e legendas…', finalizing: 'Finalizando arquivo…' })[data.state] || 'Preparando…'; }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (!card.isConnected && job) await request('/jobs/' + job.id, { method: 'DELETE' }).catch(() => {});
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; cancel.hidden = true; progress.hidden = true; job = null; }
  };
}
