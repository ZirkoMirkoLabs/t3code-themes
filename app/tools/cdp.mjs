// Drive a running launcher over the Chrome DevTools Protocol (launch electron with --remote-debugging-port=9333).
//   node tools/cdp.mjs list
//   node tools/cdp.mjs eval  "<title substring>" "<js expression>"
//   node tools/cdp.mjs shot  "<title substring>" out.png
//   node tools/cdp.mjs file  "<title substring>" script.js   (evaluates a file's contents)
const [, , cmd, title, arg] = process.argv;
const PORT = process.env.CDP_PORT || 9333;
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
if (cmd === 'list') { for (const t of targets) console.log(t.type, '|', t.title, '|', t.url.slice(0, 80)); process.exit(0); }
const t = targets.find(x => x.type === 'page' && (x.title.includes(title) || x.url.includes(title)));
if (!t) { console.error('no target matching', title); process.exit(2); }
const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const wait = new Map();
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } };
await new Promise(r => ws.onopen = r);
const send = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
if (cmd === 'eval' || cmd === 'file') {
  const expression = cmd === 'file' ? (await import('node:fs')).readFileSync(arg, 'utf8') : arg;
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  console.log(JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description ?? r, null, 1));
} else if (cmd === 'front') { await send('Page.bringToFront'); console.log('front');
} else if (cmd === 'shot') {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  (await import('node:fs')).writeFileSync(arg, Buffer.from(r.result.data, 'base64')); console.log('saved', arg);
}
ws.close(); process.exit(0);
