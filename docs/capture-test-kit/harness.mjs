// Claude: direct capture test (bypasses Supabase auth; same worker/renderer code).
import { readFile } from 'node:fs/promises';
import { capture } from '/app/capture-service/worker.mjs';
import { validateScene } from '/app/capture-service/schema.mjs';
const src = await readFile('/app/js/captions.js', 'utf8');
const styles = new Set([...src.matchAll(/^  ([a-zA-Z0-9_]+): \{ \.\.\.B,/gm)].map(m => m[1]));
const [,, file, id] = process.argv;
const scene = validateScene(JSON.parse(await readFile(file, 'utf8')), styles);
const job = { id, scene, controller: new AbortController(), state: 'preparing', percent: 0 };
const t = Date.now();
try { await capture(job, { rootURL: 'http://127.0.0.1:8080', output: '/out' }); console.log('OK', id, ((Date.now() - t) / 1000).toFixed(1) + 's'); }
catch (e) { console.error('FAIL', id, e.message); process.exitCode = 1; }
