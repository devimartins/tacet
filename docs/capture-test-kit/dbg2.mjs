// Claude: show what the YouTube embed displays inside the capture browser.
import { readFile } from 'node:fs/promises';
import { chromium } from '/app/capture-service/node_modules/playwright/index.mjs';
const scene = JSON.parse(await readFile(process.argv[2], 'utf8'));
const b = await chromium.launch({ headless: false, ignoreDefaultArgs: ['--mute-audio'], args: ['--kiosk', '--window-position=0,0', '--window-size=720,1280'] });
const p = await b.newPage({ viewport: { width: 720, height: 1280 } });
await p.goto('http://127.0.0.1:8080/render', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.captureRenderer);
p.evaluate(s => window.captureRenderer.prepare(s), scene).catch(e => console.log('prepare', e.message.slice(0, 200)));
await p.waitForTimeout(10000);
for (const f of p.frames()) { if (f === p.mainFrame()) continue; const t = await f.evaluate(() => document.body?.innerText || '').catch(e => 'ERR ' + e.message); console.log('FRAME', f.url().slice(0, 90), '|', t.replace(/\s+/g, ' ').slice(0, 300)); }
console.log('status', JSON.stringify(await p.evaluate(() => window.captureRenderer.warmStatus())));
await b.close();
