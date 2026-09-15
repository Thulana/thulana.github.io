#!/usr/bin/env node
// Drives a headless Chrome over the DevTools Protocol to check a page of the
// blog. Node 22+ ships global fetch and WebSocket, so this has no dependencies.
//
// Launch Chrome yourself first (see SKILL.md), then:
//   node verify.mjs --url http://localhost:4000/ --scheme dark --reduce \
//                   --screenshot /tmp/out.png [--port 9333]

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const has = name => args.includes(`--${name}`);

const url = flag('url', 'http://localhost:4000/');
const scheme = flag('scheme', 'light');
const port = Number(flag('port', '9333'));
const screenshot = flag('screenshot');
const reduce = has('reduce');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function findPageTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find(t => t.type === 'page');
      if (page) return page;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error(`no page target on port ${port} — is Chrome running with --remote-debugging-port=${port}?`);
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = []; }

  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const client = new CDP(ws);
    ws.onmessage = ({ data }) => {
      const msg = JSON.parse(data);
      if (msg.id && client.pending.has(msg.id)) {
        const { res, rej } = client.pending.get(msg.id);
        client.pending.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      } else if (msg.method) {
        client.events.push(msg);
      }
    };
    return client;
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async waitFor(method, timeout = 15000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const i = this.events.findIndex(e => e.method === method);
      if (i !== -1) return this.events.splice(i, 1)[0];
      await sleep(50);
    }
    throw new Error(`timed out waiting for ${method}`);
  }
}

// Everything worth asserting about a rendered page of this site.
const PROBE = `(() => {
  const style = (sel, prop) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el)[prop] : null;
  };
  return JSON.stringify({
    title:           document.title,
    matchesReduce:   matchMedia('(prefers-reduced-motion: reduce)').matches,
    matchesDark:     matchMedia('(prefers-color-scheme: dark)').matches,
    mastheadAnim:    style('.masthead', 'animationName'),
    mastheadAnimDur: style('.masthead', 'animationDuration'),
    contentAnimDur:  style('.page__content, .archive', 'animationDuration'),
    linkTransition:  style('a', 'transitionDuration'),
    images: [...document.querySelectorAll('img')]
      .map(i => ({ src: i.getAttribute('src'), w: i.naturalWidth, h: i.naturalHeight }))
      .filter(i => i.w === 0 || (i.src || '').includes('feature-')),
    giscusScript:    !!document.querySelector('script[src*="giscus"]'),
    giscusIframe:    !!document.querySelector('iframe.giscus-frame'),
  }, null, 2);
})()`;

const target = await findPageTarget();
const cdp = await CDP.connect(target.webSocketDebuggerUrl);

await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Log.enable');

const features = [{ name: 'prefers-color-scheme', value: scheme }];
if (reduce) features.push({ name: 'prefers-reduced-motion', value: 'reduce' });
await cdp.send('Emulation.setEmulatedMedia', { features });
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
});

await cdp.send('Page.navigate', { url });
await cdp.waitFor('Page.loadEventFired');
await sleep(1200); // let giscus and lazy assets settle

const { result } = await cdp.send('Runtime.evaluate', { expression: PROBE, returnByValue: true });
console.log(result.value);

const problems = cdp.events
  .filter(e => e.method === 'Log.entryAdded')
  .map(e => e.params.entry)
  .filter(entry => entry.level === 'error' || entry.level === 'warning')
  .map(entry => `${entry.level}: ${entry.text}`);

console.log('\n--- console ---');
console.log(problems.length ? problems.slice(0, 15).join('\n') : '(clean)');

if (screenshot) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(screenshot, Buffer.from(data, 'base64'));
  console.log(`\nscreenshot: ${screenshot}`);
}

cdp.ws.close();
