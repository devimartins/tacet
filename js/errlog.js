// Registro automático de erros: manda para o Supabase (tabela app_errors, só inserção) os erros que o usuário encontra.
// Nunca envia vídeo, áudio, legenda ou transcrição; só a mensagem, a versão do app e dados técnicos do navegador.
const CFG = window.CFG || {};
const URL_ = CFG.SB_URL && CFG.SB_ANON ? CFG.SB_URL + '/rest/v1/app_errors' : '';
const VER = (((document.querySelector('script[src*="app.js"]') || {}).src || '').split('v=')[1] || '?').slice(0, 40);
const seen = new Map(); let sent = 0, getToken = null;
const MAX = 15;   // por sessão (aba), para não inundar o banco se algo entrar em laço
const cut = (v, n) => (v == null ? null : String(v).slice(0, n));

// ruído que não é do ForjaClip: extensões, anúncios, scripts de outros domínios, avisos inofensivos do navegador
const NOISE = /ResizeObserver loop|^Script error\.?$|adsbygoogle|googlesyndication|doubleclick|chrome-extension:|moz-extension:|safari-extension:|Non-Error promise rejection captured|AbortError: The play\(\) request|The play\(\) request was interrupted|NotAllowedError: play\(\)/i;

export function setTokenGetter(fn) { getToken = fn; }

export async function logError(kind, err, extra) {
  try {
    if (!URL_ || sent >= MAX) return;
    const message = cut(err && err.message || err || 'erro', 1000), stack = cut(err && err.stack, 4000);
    if (!message || NOISE.test(message) || (stack && NOISE.test(stack))) return;
    const key = kind + '|' + message; if (seen.has(key)) return; seen.set(key, 1); sent++;
    let auth = CFG.SB_ANON; try { const t = getToken && await getToken(); if (t) auth = t; } catch { /* sem sessão */ }
    let ex = null; try { ex = extra ? JSON.parse(JSON.stringify(extra).slice(0, 6000)) : null; } catch { ex = null; }
    const ua = navigator.userAgent + ' | ' + innerWidth + 'x' + innerHeight + '@' + (devicePixelRatio || 1) + ((navigator.deviceMemory && ' | mem ' + navigator.deviceMemory + 'GB') || '') + ((navigator.hardwareConcurrency && ' | cpu ' + navigator.hardwareConcurrency) || '');
    const body = { kind: cut(kind, 40), message, stack, page: cut(location.pathname + location.hash, 200), version: VER, ua: cut(ua, 400), extra: ex };
    await fetch(URL_, { method: 'POST', keepalive: true, headers: { apikey: CFG.SB_ANON, authorization: 'Bearer ' + auth, 'content-type': 'application/json', prefer: 'return=minimal' }, body: JSON.stringify(body) });
  } catch { /* o registro nunca pode atrapalhar o app */ }
}

// erros não tratados em qualquer parte do app (só os que vêm dos nossos arquivos)
addEventListener('error', e => {
  const f = String(e.filename || '');
  if (f && !f.startsWith(location.origin)) return;
  logError('js', e.error || e.message, { at: f.split('/').pop() + ':' + (e.lineno || 0) + ':' + (e.colno || 0) });
});
addEventListener('unhandledrejection', e => { const r = e.reason; logError('promise', r instanceof Error ? r : String(r && r.message || r)); });
