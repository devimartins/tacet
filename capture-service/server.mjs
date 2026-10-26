import http from 'node:http';
import { readFile, mkdir, rm, stat, readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { validateScene } from './schema.mjs';
import { Jobs } from './jobs.mjs';
import { capture } from './worker.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const env = process.env;
const port = Number(env.PORT || 8080), output = path.resolve(env.OUTPUT_DIR || '/tmp/forjaclip-captures');
const origins = new Set((env.ALLOWED_ORIGINS || 'https://forjaclip.com.br,https://www.forjaclip.com.br').split(','));
const publicBase = (env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !publicBase.startsWith('https://')) throw new Error('Configure SUPABASE_URL, SUPABASE_ANON_KEY e PUBLIC_BASE_URL (HTTPS).');
await mkdir(output, { recursive: true });
// This MVP has an in-memory queue. Remove obsolete files after a restart.
for (const name of await readdir(output)) if (/^[a-f0-9-]{36}$/.test(name)) await rm(path.join(output, name), { recursive: true, force: true });
const capSource = await readFile(path.join(root, 'js/captions.js'), 'utf8');
const styles = new Set([...capSource.matchAll(/^  ([a-zA-Z0-9_]+): \{ \.\.\.B,/gm)].map(m => m[1]));
const jobs = new Jobs({ run: j => capture(j, { rootURL: `http://127.0.0.1:${port}`, output }), remove: j => rm(path.join(output, j.id), { recursive: true, force: true }), perDay: Number(env.MAX_DAILY_JOBS || 20) });
setInterval(() => jobs.clean().catch(console.error), 60000).unref();
const assets = new Map([
  ['/render', ['capture-service/public/render.html', 'text/html']],
  ['/render.js', ['capture-service/public/render.js', 'text/javascript']],
  ['/js/captions.js', ['js/captions.js', 'text/javascript']],
  ['/js/capture-scene.js', ['js/capture-scene.js', 'text/javascript']],
]);
function reply(res, status, body) { res.writeHead(status, {'Content-Type':'application/json'}); res.end(JSON.stringify(body)); }
async function user(req) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ') || authorization.length > 8192) throw Object.assign(new Error('Entre na sua conta.'), {status:401});
  const r = await fetch(env.SUPABASE_URL.replace(/\/$/, '') + '/auth/v1/user', { headers: { authorization, apikey: env.SUPABASE_ANON_KEY }, signal: AbortSignal.timeout(8000) });
  const u = await r.json();
  if (!r.ok || !u.id) throw Object.assign(new Error('Sessão expirada. Entre novamente.'), {status:401});
  return u.id;
}
async function body(req) {
  let n = 0, parts = [];
  for await (const part of req) { n += part.length; if (n > 262144) throw Object.assign(new Error('Solicitação muito grande.'), {status:413}); parts.push(part); }
  try { return JSON.parse(Buffer.concat(parts)); } catch { throw Object.assign(new Error('JSON inválido.'), {status:400}); }
}
const safeEqual = (a, b) => typeof a === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  try {
    const url = new URL(req.url, 'http://localhost'), origin = req.headers.origin;
    // Static renderer modules are public; keep API origin checks unchanged.
    if (assets.has(url.pathname) && req.method === 'GET') {
      const [file, type] = assets.get(url.pathname); res.writeHead(200,{'Content-Type':type}); return res.end(await readFile(path.join(root,file)));
    }
    if (origin && !origins.has(origin)) return reply(res,403,{error:'Origem não autorizada.'});
    if (origin) { res.setHeader('Access-Control-Allow-Origin',origin); res.setHeader('Vary','Origin'); }
    if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type'); res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE'); res.writeHead(204); return res.end(); }
    if (url.pathname === '/health' && req.method === 'GET') return reply(res,200,{status:'ok',version:'0.1.0'});
    const download = /^\/downloads\/([a-f0-9-]{36})$/.exec(url.pathname);
    if (download && req.method === 'GET') {
      const job = jobs.items.get(download[1]);
      if (!job || job.state !== 'ready' || job.expires <= Date.now() || !safeEqual(url.searchParams.get('token'), job.secret)) return reply(res,404,{error:'Arquivo indisponível ou expirado.'});
      const file = path.join(output, job.id, 'clip.mp4'), info = await stat(file);
      res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':info.size,'Content-Disposition':'attachment; filename="forjaclip-' + job.id + '.mp4"'});
      const stream = createReadStream(file); stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); return stream.pipe(res);
    }
    if (url.pathname === '/jobs' && req.method === 'POST') {
      const owner = await user(req), scene = validateScene(await body(req), styles), job = jobs.create(owner, scene);
      return reply(res,202,{id:job.id,state:job.state});
    }
    const match = /^\/jobs\/([a-f0-9-]{36})$/.exec(url.pathname);
    if (match && ['GET','DELETE'].includes(req.method)) {
      const job = jobs.owned(match[1], await user(req));
      if (!job || job.expires <= Date.now()) return reply(res,404,{error:'Captura indisponível ou expirada.'});
      if (req.method === 'DELETE') { await jobs.cancel(job); return reply(res,200,{state:'cancelled'}); }
      return reply(res,200,{ id:job.id,state:job.state,percent:job.percent,error:job.error,
        ...(job.state === 'ready' ? {downloadUrl:publicBase+'/downloads/'+job.id+'?token='+job.secret,expires:job.expires} : {}) });
    }
    reply(res,404,{error:'Rota não encontrada.'});
  } catch(e) { if (!res.headersSent) reply(res,e.status || 500,{error:e.status ? e.message : 'Serviço de captura indisponível.'}); else res.destroy(); }
});
server.requestTimeout = 20000; server.headersTimeout = 10000;
server.listen(port,'0.0.0.0',()=>console.log('Capture service listening',server.address().port));
async function shutdown() { for (const j of jobs.items.values()) j.controller.abort(); server.close(); setTimeout(()=>process.exit(0),10000).unref(); }
process.on('SIGTERM',shutdown); process.on('SIGINT',shutdown);
