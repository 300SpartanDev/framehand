// A tiny driver for the FRAMEHAND app in headless Chrome, on the repo's own DevTools client (no puppeteer needed).
// Used by test/ui-e2e.test.js and tools/ui-shots.mjs.
import { writeFileSync } from 'node:fs';
import { launch, newPage } from '../cli/lib/cdp.js';

export async function openApp(exe, url, { width = 1440, height = 900 } = {}) {
  const conn = await launch(exe, { args: [`--window-size=${width},${height}`] });
  const page = await newPage(conn);
  await page.send('Page.enable'); await page.send('Runtime.enable'); await page.send('DOM.enable');
  const errors = [];
  page.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text));
  page.on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error') errors.push(p.args.map((a) => a.value ?? a.description).join(' ')); });
  const origin = new URL(url).origin;
  try { await conn.send('Browser.grantPermissions', { origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }); } catch { /* older Chrome */ }
  await page.send('Browser.setDownloadBehavior', { behavior: 'deny' }).catch(() => {});
  const app = {
    conn, page, errors,
    async size(w, h) { await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); },
    async goto(u = url) { await page.send('Page.navigate', { url: u }); await app.waitFor("document.documentElement.dataset.ready === '1'", 20000); },
    eval: (expr, ms) => page.evaluate(expr, { ms }),
    async waitFor(expr, ms = 30000, every = 150) {
      const end = Date.now() + ms; let last;
      while (Date.now() < end) { try { last = await page.evaluate(`(() => { try { return (${expr}); } catch { return false; } })()`); if (last) return last; } catch { /* navigating */ } await new Promise((r) => setTimeout(r, every)); }
      const seen = await page.evaluate("document.getElementById('phaseText')?.textContent + ' | ' + document.getElementById('estimate')?.textContent").catch(() => '');
      throw new Error(`timed out waiting for: ${expr} (page: ${seen})`);
    },
    click: (sel) => page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) throw new Error('no element ${sel.replace(/'/g, '')}'); el.click(); return true; })()`),
    async setFile(sel, file) {
      const { root } = await page.send('DOM.getDocument', { depth: 0 });
      const { nodeId } = await page.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
      await page.send('DOM.setFileInputFiles', { nodeId, files: [file] });
    },
    async shot(path, { full = false } = {}) {
      const { data } = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full }, 30000);
      writeFileSync(path, Buffer.from(data, 'base64'));
    },
    close: () => conn.close({ fast: true }),
  };
  await app.size(width, height);
  return app;
}
