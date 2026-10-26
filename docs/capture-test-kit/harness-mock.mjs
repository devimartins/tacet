// Claude: TEST-ONLY. Runs worker capture() with the mock player injected (no change to service code).
import { chromium } from '/app/capture-service/node_modules/playwright/index.mjs';
const launch = chromium.launch.bind(chromium);
chromium.launch = async o => {
  const b = await launch(o), np = b.newPage.bind(b);
  b.newPage = async x => {
    const p = await np(x);
    await p.addInitScript({ path: '/opt/test/mockyt.js' });
    await p.route('https://mock.invalid/test.webm', r => r.fulfill({ path: '/opt/test/test.webm', contentType: 'video/webm' }));
    return p;
  };
  return b;
};
await import('/opt/test/harness.mjs');
