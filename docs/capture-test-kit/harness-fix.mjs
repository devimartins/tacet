// Claude: TEST-ONLY. Mock player + candidate fix for browser UI in the capture:
// disable Translate bubble and put the window in real fullscreen via CDP.
import { chromium } from '/app/capture-service/node_modules/playwright/index.mjs';
const launch = chromium.launch.bind(chromium);
chromium.launch = async o => {
  const b = await launch({ ...o, args: [...(o.args || []), '--disable-features=Translate,TranslateUI', '--lang=pt-BR'] }), np = b.newPage.bind(b);
  b.newPage = async x => {
    const p = await np({ ...x, locale: 'pt-BR' });
    const s = await p.context().newCDPSession(p);
    const { windowId } = await s.send('Browser.getWindowForTarget');
    await s.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'fullscreen' } });
    await p.addInitScript({ path: '/opt/test/mockyt.js' });
    await p.route('https://mock.invalid/test.webm', r => r.fulfill({ path: '/opt/test/test.webm', contentType: 'video/webm' }));
    return p;
  };
  return b;
};
await import('/opt/test/harness.mjs');
