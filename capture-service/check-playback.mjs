// Run inside the capture container. This checks playback only; no recording or job.
import { chromium } from 'playwright';
import { setTimeout as delay } from 'node:timers/promises';
const scene = { videoId: '5pB5cYziN6U', start: 30, end: 40, style: 'classico',
  captions: false, crop: true, mode: 'center', x: .5, y: .66, sync: 0,
  words: [], segments: [], names: {}, positions: { solo: 50 }, pair: ['solo'] };
let browser;
try {
  browser = await chromium.launch({ headless: false, env: { ...process.env, DISPLAY: ':99', PULSE_SINK: 'capture' } });
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.setDefaultTimeout(30000);
  await page.goto(`http://127.0.0.1:${process.env.PORT || 8080}/render`);
  await page.waitForFunction(() => !!window.captureRenderer);
  // Bound font/API/player initialization as well as the subsequent playback loop.
  await Promise.race([
    page.evaluate(s => window.captureRenderer.prepare(s), scene),
    delay(45000, null, { ref: false }).then(() => { throw new Error('Preparation timeout'); })
  ]);
  const readyBy = Date.now() + 20000;
  for (;;) {
    const state = await page.evaluate(() => window.captureRenderer.warmStatus());
    if (state.error) throw new Error(state.error);
    if (state.ready) break;
    if (Date.now() > readyBy) throw new Error('Playback did not become ready');
    await delay(100);
  }
  await page.evaluate(() => window.captureRenderer.cue());
  await delay(500);
  await page.evaluate(() => window.captureRenderer.begin());
  const endsBy = Date.now() + 25000;
  for (;;) {
    const state = await page.evaluate(() => window.captureRenderer.status());
    if (state.error) throw new Error(state.error);
    if (state.finished && state.startAt) {
      console.log(JSON.stringify({ result: 'playback-completed', videoId: scene.videoId,
        requestedStart: scene.start, requestedEnd: scene.end, firstTime: state.firstTime, lastTime: state.time,
        note: 'Playback only; MP4 quality and audio synchronization are not validated.' }));
      break;
    }
    if (Date.now() > endsBy) throw new Error('Playback did not complete');
    await delay(100);
  }
} catch (error) {
  console.error('Playback check failed:', error.message);
  process.exitCode = 1;
} finally { await browser?.close(); }
