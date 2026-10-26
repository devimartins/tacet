import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

test('renderer modules load internally while API origin and auth checks remain enforced', { timeout: 15000 }, async () => {
  const output = await mkdtemp(path.join(tmpdir(), 'capture-http-'));
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('../', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', OUTPUT_DIR: output, PUBLIC_BASE_URL: 'https://capture.example',
      ALLOWED_ORIGINS: 'https://forjaclip.com.br', SUPABASE_URL: 'https://unused.example', SUPABASE_ANON_KEY: 'test-public' }
  });
  const closed = once(child, 'exit');
  let log = '';
  child.stdout.on('data', data => { log += data; });
  try {
    const deadline = Date.now() + 5000;
    while (!/listening \d+/.test(log)) {
      if (child.exitCode !== null || Date.now() > deadline) throw new Error('Server failed to start');
      await delay(20);
    }
    const base = 'http://127.0.0.1:' + /listening (\d+)/.exec(log)[1];
    for (const route of ['/render', '/render.js', '/js/captions.js', '/js/capture-scene.js']) {
      const r = await fetch(base + route, { headers: { Origin: base } });
      assert.equal(r.status, 200, route);
      assert.equal(r.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
      await r.text();
    }
    const blocked = await fetch(base + '/jobs', { method: 'POST', headers: { Origin: base } });
    assert.equal(blocked.status, 403); await blocked.text();
    const unauthenticated = await fetch(base + '/jobs', { method: 'POST', headers: { Origin: 'https://forjaclip.com.br' } });
    assert.equal(unauthenticated.status, 401); await unauthenticated.text();
  } finally {
    child.kill('SIGKILL'); await closed;
    await rm(output, { recursive: true, force: true });
  }
});
