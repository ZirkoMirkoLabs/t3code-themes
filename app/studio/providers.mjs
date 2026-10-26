// Skin Studio providers. Shared by the CLI (generation) and the launcher (key tests, setup state, estimates).
// Endpoints, model ids and prices were checked against official docs on 2026-10-24: see PROVIDER-SOURCES.md.
// Route status: "verified" = ran end to end with a real key; "keycheck" = only the free key test ran with a real key;
// "untested" = built from the docs, never run with a real key. Keys arrive only through env vars.
import fs from 'node:fs'; import path from 'node:path'; import { execFile, spawn } from 'node:child_process';

const CHECKED = '2026-10-24';
const T = ms => AbortSignal.timeout(ms);
const short = (j, n = 300) => (typeof j === 'string' ? j : JSON.stringify(j)).slice(0, n);
async function jfetch(url, init = {}, ms = 60000) {
  const r = await fetch(url, { ...init, signal: init.signal || T(ms) });
  const text = await r.text(); let body; try { body = JSON.parse(text); } catch { body = text; }
  return { ok: r.ok, status: r.status, body };
}
const mimeOf = f => ({ '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' }[path.extname(f).toLowerCase()] || 'image/jpeg');
const b64 = f => fs.readFileSync(f).toString('base64');
const dataUri = f => `data:${mimeOf(f)};base64,${b64(f)}`;
const refsOf = job => job.refs?.length ? job.refs : (job.images || []);
// Recursively find the first media item: {type:'image'|'video', data|uri|url}.
function findMedia(o, kind) {
  if (!o || typeof o !== 'object') return null;
  if (Array.isArray(o)) { for (const v of o) { const m = findMedia(v, kind); if (m) return m; } return null; }
  if (o.type === kind && (o.data || o.uri || o.url)) return o;
  for (const v of Object.values(o)) { const m = findMedia(v, kind); if (m) return m; }
  return null;
}
function firstUrl(o) {
  if (!o) return null; if (typeof o === 'string') return /^https?:\/\//.test(o) ? o : null;
  if (Array.isArray(o)) { for (const v of o) { const u = firstUrl(v); if (u) return u; } return null; }
  for (const k of ['url', 'result_url', 'video', 'images', 'image', 'output', 'generated', 'data', 'result', 'results']) if (o[k]) { const u = firstUrl(o[k]); if (u) return u; }
  return null;
}
const fileJob = (dir, name, bytes) => { const f = path.join(dir, name); fs.writeFileSync(f, bytes); return { jobId: 'file:' + f }; };
const filePoll = id => ({ status: 'done', file: id.slice(5) });

/* ---------------- accounts (one credential each) shown on the Providers screen ---------------- */
export const ACCOUNTS = [
  { id: 'higgsfield', label: 'Higgsfield', kind: 'cli', env: 'HIGGSFIELD_API_KEY', placeholder: 'optional API key pair  KEY_ID:KEY_SECRET',
    signup: 'https://higgsfield.ai', pricing: 'https://higgsfield.ai/pricing', docs: 'https://docs.higgsfield.ai',
    costHint: 'Credits from your Higgsfield plan. Live quotes before every job: GPT Image 2.5 still ≈ 2.75 credits, Kling 3.0 Turbo 5 s loop ≈ 7.5 credits.',
    note: 'Easiest: install the CLI (npm i -g @higgsfield/cli) and press "Log in". Or paste an API key pair from console.higgsfield.ai (uses the HTTP API instead).' },
  { id: 'openai', label: 'OpenAI Images', env: 'OPENAI_API_KEY', placeholder: 'sk-…',
    signup: 'https://platform.openai.com/api-keys', pricing: 'https://developers.openai.com/api/docs/pricing', docs: 'https://developers.openai.com/api/docs/guides/image-generation',
    costHint: 'Pay per image. gpt-image-2 landscape: $0.005 low / $0.041 medium / $0.165 high. 2.5 models are billed by tokens (similar range). Image only, no video.' },
  { id: 'google', label: 'Google Gemini API', env: 'GEMINI_API_KEY', placeholder: 'AIza…',
    signup: 'https://aistudio.google.com/apikey', pricing: 'https://ai.google.dev/gemini-api/docs/pricing', docs: 'https://ai.google.dev/gemini-api/docs/image-generation',
    costHint: 'Paid tier needed. Nano Banana 2.1 image ≈ $0.034. Video (Gemini Omni Flash, replaces Veo) ≈ $0.10 per second at 720p.' },
  { id: 'replicate', label: 'Replicate', env: 'REPLICATE_API_TOKEN', placeholder: 'r8_…',
    signup: 'https://replicate.com/account/api-tokens', pricing: 'https://replicate.com/pricing', docs: 'https://replicate.com/docs/reference/http',
    costHint: 'FLUX schnell ≈ $0.003 per image. Video: Wan 2.7 i2v ≈ $0.50, Kling v3 ≈ $0.84 per 5 s.' },
  { id: 'fal', label: 'fal.ai', env: 'FAL_KEY', placeholder: 'key id:secret',
    signup: 'https://fal.ai/dashboard/keys', pricing: 'https://fal.ai/pricing', docs: 'https://fal.ai/docs/model-apis/model-endpoints/queue',
    costHint: 'Live prices from fal before each job. FLUX schnell ≈ $0.003 per MP. Video: Kling v3 standard ≈ $0.42 per 5 s (no audio).' },
  { id: 'magnific', label: 'Magnific (Freepik API)', env: 'MAGNIFIC_API_KEY', placeholder: 'Magnific API key',
    signup: 'https://docs.magnific.com/authentication', pricing: 'https://docs.magnific.com/pricing', docs: 'https://docs.magnific.com',
    costHint: 'Credits from your Magnific API plan. Per-call prices are not published through the API, so Studio cannot quote or cap them: check your plan.' },
  { id: 'anthropic', label: 'Anthropic (Claude) · theme generator', env: 'ANTHROPIC_API_KEY', placeholder: 'sk-ant-…',
    signup: 'https://console.anthropic.com/settings/keys', pricing: 'https://claude.com/pricing#api', docs: 'https://docs.claude.com/en/api/messages',
    costHint: 'Only used by Themes ▸ Generate from a prompt. About $0.15 (Sonnet 5.5) or $0.30 (Opus 5.5) per theme; each run has a hard $ cap and keeps receipts.' },
  { id: 'comfyui', label: 'ComfyUI (local, free)', kind: 'local', env: 'COMFYUI_URL', placeholder: 'http://127.0.0.1:8188',
    docs: 'https://docs.comfy.org/development/comfyui-server/comms_routes',
    costHint: 'Free: runs on your own GPU. Auto-detected on ports 8188 and 8000 (ComfyUI Desktop).',
    note: 'Default graph uses your first checkpoint. For other models (Flux, Qwen…) put the path of a workflow exported with "Save (API)" in the Model box; use "{prompt}", "{seed}", "{width}", "{height}" as placeholders.' },
  { id: 'a1111', label: 'Automatic1111 / Forge (local, free)', kind: 'local', env: 'A1111_URL', placeholder: 'http://127.0.0.1:7860',
    docs: 'https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/API',
    costHint: 'Free: runs on your own GPU. Start the web UI with --api. Auto-detected on port 7860.' },
];

/* ---------------- Higgsfield CLI ---------------- */
export function findHiggsfieldCli(env = process.env) {
  const rel = ['node_modules', '@higgsfield', 'cli', 'bin', 'higgsfield.js'];
  const cands = [env.SKIN_STUDIO_HIGGSFIELD];
  if (env.APPDATA) cands.push(path.join(env.APPDATA, 'npm', ...rel));
  for (const d of String(env.PATH || env.Path || '').split(path.delimiter).filter(Boolean)) {
    cands.push(path.join(d, ...rel), path.join(d, '..', 'lib', ...rel));
    const shim = path.join(d, 'higgsfield');
    try { const real = fs.realpathSync(shim); if (/higgsfield\.js$/.test(real)) cands.push(real); } catch {}
  }
  for (const h of [env.HOME, env.USERPROFILE].filter(Boolean)) cands.push(path.join(h, '.npm-global', 'lib', ...rel));
  cands.push(path.join('/usr/local/lib', ...rel), path.join('/opt/homebrew/lib', ...rel));
  return cands.find(c => c && fs.existsSync(c)) || null;
}
// The npm wrapper's run.js spawns vendor/hf.exe without windowsHide. Invoke
// that binary directly so *every* quote, test, submit and poll stays hidden.
export function higgsfieldCommand(env = process.env, node = env.SKIN_STUDIO_NODE || process.execPath) {
  const js = findHiggsfieldCli(env);
  if (!js) throw Error('Higgsfield CLI not found');
  const vendor = path.resolve(path.dirname(js), '..', 'vendor');
  const native = path.join(vendor, process.platform === 'win32' ? 'hf.exe' : 'hf');
  if (fs.existsSync(native)) {
    let metadata = {};
    try { metadata = JSON.parse(fs.readFileSync(path.join(vendor, 'install.json'), 'utf8')); } catch {}
    const manager = /^(pnpm|yarn|bun)\//.exec(env.npm_config_user_agent || '')?.[1] || 'npm';
    return { command: native, args: [], env: { ...env, HIGGSFIELD_INSTALL_METHOD: 'npm', HIGGSFIELD_PACKAGE_MANAGER: metadata.package_manager || manager } };
  }
  if (/\.exe$/i.test(js) || path.basename(js) === 'hf') return { command: js, args: [], env };
  // An installed native wrapper without its binary is broken. Do not launch
  // the wrapper (or an installer) as a discovery/repair fallback.
  if (fs.existsSync(path.join(path.dirname(js), 'run.js'))) throw Error('Higgsfield native binary is missing; reinstall the CLI');
  return { command: node, args: [js], env: { ...env, ELECTRON_RUN_AS_NODE: '1' } };
}
async function hfRun(args, ctx, timeout = 60000) {
  if (ctx.allowSubprocess === false) return Promise.reject(Error('CLI calls are disabled for previews'));
  const invocation = higgsfieldCommand(ctx.env, ctx.node);
  return new Promise((ok, no) => execFile(invocation.command, [...invocation.args, ...args, '--json', '--no-color'],
    { timeout, maxBuffer: 32 << 20, windowsHide: true, shell: false, env: invocation.env },
    (err, out, se) => err ? no(Error(String(se || out || err.message).slice(0, 600))) : (() => { try { ok(JSON.parse(out)); } catch { no(Error('unexpected CLI output')); } })()));
}
function hfArgs(job) {
  const video = job.kind === 'video';
  const params = video ? { aspect_ratio: '16:9', duration: job.duration || 5, resolution: '720p' } : { aspect_ratio: '16:9', quality: job.quality || 'high', resolution: '2k' };
  const a = [job.model, '--prompt', job.prompt];
  for (const [k, v] of Object.entries(params)) a.push('--' + k.replace(/_/g, '-'), String(v));
  for (const img of job.images || []) a.push(video ? '--start-image' : '--image-references', img);
  return a;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function findJobId(o, key = '') {
  if (typeof o === 'string') return UUID.test(o) && /id/i.test(key) ? o : null;
  if (Array.isArray(o)) { for (const v of o) { const x = findJobId(v, key); if (x) return x; } return null; }
  if (o && typeof o === 'object') { for (const [k, v] of Object.entries(o)) { if (/upload|user|owner|workspace/i.test(k)) continue; const x = findJobId(v, k); if (x) return x; } }
  return null;
}
// Older/uncertain receipt: find the job that was already paid for instead of resubmitting.
export async function hfReconcile(rec, ctx) {
  const list = await hfRun(['generate', 'list'], ctx, 30000).catch(() => []);
  const hit = (Array.isArray(list) ? list : []).find(j => j.job_type === rec.model && Math.abs(Date.parse(j.created_at) - Date.parse(rec.submittedAt)) < 120000);
  return hit ? hit.id : null;
}
const higgsCli = kind => ({
  id: 'higgsfield', account: 'higgsfield', kind, label: 'Higgsfield (CLI login)', status: 'verified',
  defaultModel: kind === 'image' ? 'gpt_image_2_5' : 'kling3_0_turbo',
  models: kind === 'image' ? ['gpt_image_2_5', 'nano_banana_2', 'seedream_v5_pro'] : ['kling3_0_turbo'],
  time: kind === 'image' ? '30–90 s' : '2–6 min', etaMs: kind === 'image' ? 90000 : 240000,
  costHint: kind === 'image' ? 'live quote, ≈ 2.75 credits' : 'live quote, ≈ 7.5 credits',
  setup: 'install the CLI (npm i -g @higgsfield/cli) and log in',
  available: env => !!findHiggsfieldCli(env),
  estimate: job => ({ amount: /kling/.test(job.model) ? 7.5 : /gpt_image/.test(job.model) ? 2.75 : null, unit: 'credits' }),
  async quote(job, ctx) {
    if (ctx.allowSubprocess === false) return null; // Form previews must never launch the CLI or upload files.
    if (job.kind === 'video' && !(job.images || []).length) return null; // the CLI uploads local files even for a quote
    const r = await hfRun(['generate', 'cost', ...hfArgs(job)], ctx); return r.credits != null ? { amount: r.credits, unit: 'credits' } : null;
  },
  async submit(job, ctx) {
    const since = Date.now() - 10000;
    const r = await hfRun(['generate', 'create', ...hfArgs(job)], ctx, 120000);
    let jobId = findJobId(r);
    if (!jobId) { // output shape unknown: reconcile against the account's job list instead of resubmitting
      const list = await hfRun(['generate', 'list'], ctx, 30000).catch(() => []);
      const hit = (Array.isArray(list) ? list : []).find(j => j.job_type === job.model && Date.parse(j.created_at) >= since);
      jobId = hit && hit.id;
    }
    if (!jobId) throw Error('submitted, but no job id was returned; check `higgsfield generate list` before retrying');
    return { jobId };
  },
  async poll(id, ctx) {
    const r = await hfRun(['generate', 'get', id], ctx, 30000); const j = Array.isArray(r) ? r[0] : r; const st = String(j.status || '').toLowerCase();
    return { status: st === 'completed' ? 'done' : /fail|error|cancel|nsfw|reject/.test(st) ? 'failed' : 'running', url: j.result_url || firstUrl(j), raw: st };
  },
});

/* ---------------- Higgsfield HTTP API (key pair) ---------------- */
const HF_API = 'https://api.higgsfield.ai';
const hfAuth = env => ({ Authorization: 'Key ' + env.HIGGSFIELD_API_KEY, 'Content-Type': 'application/json' });
async function hfUpload(file, env) {
  const r = await jfetch(HF_API + '/files/generate-upload-url', { method: 'POST', headers: hfAuth(env), body: JSON.stringify({ content_type: mimeOf(file) }) });
  if (!r.ok || !r.body.upload_url) throw Error('higgsfield upload ' + r.status + ' ' + short(r.body));
  const put = await fetch(r.body.upload_url, { method: 'PUT', headers: { 'Content-Type': mimeOf(file) }, body: fs.readFileSync(file), signal: T(120000) });
  if (!put.ok) throw Error('higgsfield upload PUT ' + put.status);
  return r.body.public_url;
}
const hfApiBody = async (job, env, upload) => job.kind === 'video'
  ? { prompt: job.prompt, duration: 5, image_url: upload ? await hfUpload(refsOf(job)[0], env) : 'https://example.com/start.jpg' }
  : { prompt: job.prompt, aspect_ratio: '16:9', resolution: '2K' };
const higgsApi = kind => ({
  id: 'higgsfield-api', account: 'higgsfield', kind, label: 'Higgsfield (API key)', status: 'untested',
  defaultModel: kind === 'image' ? 'higgsfield-ai/soul/standard' : 'kling-video/v2.5-turbo/pro/image-to-video',
  models: kind === 'image' ? ['higgsfield-ai/soul/standard', 'higgsfield-ai/soul/v2/standard'] : ['kling-video/v2.5-turbo/pro/image-to-video'],
  time: kind === 'image' ? '30–90 s' : '2–6 min', etaMs: kind === 'image' ? 90000 : 240000,
  costHint: 'live USD quote from Higgsfield /estimate', setup: 'paste an API key pair (KEY_ID:KEY_SECRET) from console.higgsfield.ai',
  available: env => !!env.HIGGSFIELD_API_KEY,
  estimate: () => ({ amount: null, unit: 'usd' }),
  async quote(job, ctx) {
    const r = await jfetch(`${HF_API}/estimate/${job.model}`, { method: 'POST', headers: hfAuth(ctx.env), body: JSON.stringify(await hfApiBody(job, ctx.env, false)) }, 20000);
    return r.ok && r.body.usd != null ? { amount: Number(r.body.usd), unit: 'usd' } : null;
  },
  async submit(job, ctx) {
    const r = await jfetch(`${HF_API}/${job.model}`, { method: 'POST', headers: hfAuth(ctx.env), body: JSON.stringify(await hfApiBody(job, ctx.env, true)) });
    if (!r.ok || !r.body.request_id) throw Error('higgsfield ' + r.status + ' ' + short(r.body));
    return { jobId: r.body.status_url || `${HF_API}/requests/${r.body.request_id}/status` };
  },
  async poll(id, ctx) {
    const r = await jfetch(id, { headers: hfAuth(ctx.env) }, 30000); const st = String(r.body.status || '').toLowerCase();
    return { status: st === 'completed' ? 'done' : /fail|nsfw|cancel/.test(st) ? 'failed' : 'running', url: firstUrl(kind === 'video' ? r.body.video : r.body.images) || firstUrl(r.body), raw: st };
  },
});

/* ---------------- OpenAI Images (sync) ---------------- */
const openai = {
  id: 'openai', account: 'openai', kind: 'image', label: 'OpenAI Images', status: 'untested',
  defaultModel: 'gpt-image-2.5-flare', models: ['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst', 'gpt-image-2', 'gpt-image-1.5', 'gpt-image-1-mini'],
  time: '20–60 s', etaMs: 60000, costHint: '≈ $0.04–0.05 per image at medium quality (static table)', setup: 'add an OpenAI API key',
  available: env => !!env.OPENAI_API_KEY,
  estimate: job => ({ amount: /mini/.test(job.model || '') ? 0.011 : 0.05, unit: 'usd' }),
  async submit(job, ctx) {
    const auth = { Authorization: 'Bearer ' + ctx.env.OPENAI_API_KEY };
    const q = { model: job.model || this.defaultModel, prompt: job.prompt, size: '1536x1024', quality: 'medium' };
    let r;
    const refs = refsOf(job);
    if (refs.length) { // reference images: multipart /images/edits
      const fd = new FormData(); for (const [k, v] of Object.entries(q)) fd.append(k, v);
      for (const f of refs) fd.append('image[]', new Blob([fs.readFileSync(f)], { type: mimeOf(f) }), path.basename(f));
      r = await jfetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: auth, body: fd }, Math.max(30000, ctx.left()));
    } else r = await jfetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(q) }, Math.max(30000, ctx.left()));
    if (!r.ok || !r.body.data?.[0]?.b64_json) throw Error('openai ' + r.status + ' ' + short(r.body.error || r.body));
    return fileJob(job.dir, 'openai-result.png', Buffer.from(r.body.data[0].b64_json, 'base64'));
  },
  poll: filePoll,
};

/* ---------------- Google Gemini API: Interactions (images sync, video background) ---------------- */
const GEM = 'https://generativelanguage.googleapis.com/v1beta';
const gHead = env => ({ 'x-goog-api-key': env.GEMINI_API_KEY || env.GOOGLE_API_KEY, 'Content-Type': 'application/json' });
async function gMedia(m, env) {
  if (m.data) return Buffer.from(m.data, 'base64');
  let u = m.uri || m.url; if (/\/files\/[^/:?]+$/.test(u)) u += ':download?alt=media';
  const r = await fetch(u, { headers: { 'x-goog-api-key': env.GEMINI_API_KEY || env.GOOGLE_API_KEY }, signal: T(180000) });
  if (!r.ok) throw Error('google download ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}
const googleImage = {
  id: 'google', account: 'google', kind: 'image', label: 'Google Gemini (Nano Banana)', status: 'untested',
  defaultModel: 'gemini-nano-banana-2.1', models: ['gemini-nano-banana-2.1', 'gemini-3.1-flash-image', 'gemini-3-pro-image', 'gemini-3.1-flash-lite-image'],
  time: '15–45 s', etaMs: 60000, costHint: '≈ $0.034 per image (static table)', setup: 'add a Gemini API key (paid tier)',
  available: env => !!(env.GEMINI_API_KEY || env.GOOGLE_API_KEY),
  estimate: job => ({ amount: /pro/.test(job.model || '') ? 0.134 : 0.034, unit: 'usd' }),
  async submit(job, ctx) {
    const refs = refsOf(job);
    const input = refs.length ? [{ type: 'text', text: job.prompt }, ...refs.map(f => ({ type: 'image', mime_type: mimeOf(f), data: b64(f) }))] : job.prompt;
    const r = await jfetch(GEM + '/interactions', { method: 'POST', headers: gHead(ctx.env), body: JSON.stringify({ model: job.model || this.defaultModel, input, response_format: { type: 'image', mime_type: 'image/png', aspect_ratio: '16:9' } }) }, Math.max(30000, ctx.left()));
    const m = r.ok && findMedia(r.body, 'image');
    if (!m) throw Error('google ' + r.status + ' ' + short(r.body.error || r.body));
    return fileJob(job.dir, 'google-result.png', await gMedia(m, ctx.env));
  },
  poll: filePoll,
};
const googleVideo = {
  id: 'google', account: 'google', kind: 'video', label: 'Google Gemini Omni (replaces Veo)', status: 'untested',
  defaultModel: 'gemini-omni-1.1-flash', models: ['gemini-omni-1.1-flash'],
  time: '1–4 min', etaMs: 180000, costHint: '≈ $0.10 per second at 720p; clip length is chosen by the model (static estimate $0.80)', setup: 'add a Gemini API key (paid tier)',
  available: env => !!(env.GEMINI_API_KEY || env.GOOGLE_API_KEY),
  estimate: () => ({ amount: 0.8, unit: 'usd' }),
  async submit(job, ctx) {
    const f = refsOf(job)[0];
    const body = { model: job.model || this.defaultModel, input: [{ type: 'image', mime_type: mimeOf(f), data: b64(f) }, { type: 'text', text: job.prompt }],
      generation_config: { video_config: { task: 'image_to_video' } }, response_format: { type: 'video', aspect_ratio: '16:9', resolution: '720p' }, background: true, store: true };
    const r = await jfetch(GEM + '/interactions', { method: 'POST', headers: gHead(ctx.env), body: JSON.stringify(body) });
    if (!r.ok || !r.body.id) throw Error('google ' + r.status + ' ' + short(r.body.error || r.body));
    return { jobId: r.body.id };
  },
  async poll(id, ctx) {
    const r = await jfetch(`${GEM}/interactions/${encodeURIComponent(id)}`, { headers: gHead(ctx.env) }, 60000);
    const st = String(r.body.status || '').toLowerCase();
    if (st === 'completed') { const m = findMedia(r.body, 'video'); if (!m) return { status: 'failed', raw: 'completed without a video' }; return { status: 'done', bytes: await gMedia(m, ctx.env), raw: st }; }
    return { status: /fail|cancel|incomplete/.test(st) ? 'failed' : 'running', raw: st || ('http ' + r.status), wait: 10000 };
  },
};

/* ---------------- Replicate (async predictions) ---------------- */
const REP = 'https://api.replicate.com/v1';
const repHead = env => ({ Authorization: 'Bearer ' + env.REPLICATE_API_TOKEN, 'Content-Type': 'application/json' });
const replicateRoute = kind => ({
  id: 'replicate', account: 'replicate', kind, label: 'Replicate', status: 'untested',
  defaultModel: kind === 'image' ? 'black-forest-labs/flux-schnell' : 'wan-video/wan-2.7-i2v',
  models: kind === 'image' ? ['black-forest-labs/flux-schnell', 'black-forest-labs/flux-2-klein-4b', 'black-forest-labs/flux-2-pro'] : ['wan-video/wan-2.7-i2v', 'kwaivgi/kling-v3-video'],
  time: kind === 'image' ? '5–30 s' : '1–5 min', etaMs: kind === 'image' ? 45000 : 240000,
  costHint: kind === 'image' ? '≈ $0.003 per image (static table)' : '≈ $0.50 (Wan) – $0.84 (Kling) per 5 s (static table)',
  setup: 'add a Replicate API token', available: env => !!env.REPLICATE_API_TOKEN,
  estimate: job => ({ amount: kind === 'image' ? (/flux-2-pro/.test(job.model) ? 0.03 : 0.003) : (/kling/.test(job.model) ? 0.84 : 0.5), unit: 'usd' }),
  async submit(job, ctx) {
    const refs = refsOf(job); let model = job.model || this.defaultModel;
    let input;
    if (kind === 'image') {
      if (refs.length && /flux-schnell/.test(model)) model = 'black-forest-labs/flux-2-klein-4b'; // schnell takes no reference
      input = { prompt: job.prompt, aspect_ratio: '16:9', output_format: 'png' };
      if (refs.length) input[/flux-2-pro/.test(model) ? 'input_images' : 'images'] = refs.map(dataUri);
    } else input = /kling/.test(model) ? { prompt: job.prompt, start_image: dataUri(refs[0]), duration: 5, mode: 'standard', generate_audio: false }
      : { prompt: job.prompt, first_frame: dataUri(refs[0]), duration: 5, resolution: '720p' };
    const r = await jfetch(`${REP}/models/${model}/predictions`, { method: 'POST', headers: repHead(ctx.env), body: JSON.stringify({ input }) });
    if (!r.ok || !r.body.id) throw Error('replicate ' + r.status + ' ' + short(r.body.detail || r.body));
    return { jobId: r.body.id, model };
  },
  async poll(id, ctx) {
    const r = await jfetch(`${REP}/predictions/${encodeURIComponent(id)}`, { headers: repHead(ctx.env) }, 30000);
    const st = String(r.body.status || '');
    return { status: st === 'succeeded' ? 'done' : /failed|canceled/.test(st) ? 'failed' : 'running', url: firstUrl(r.body.output), raw: st === 'failed' ? short(r.body.error || st, 160) : st,
      headers: { Authorization: 'Bearer ' + ctx.env.REPLICATE_API_TOKEN } };
  },
});

/* ---------------- fal.ai (queue API) ---------------- */
const falHead = env => ({ Authorization: 'Key ' + env.FAL_KEY, 'Content-Type': 'application/json' });
async function falPrice(id, env) {
  const r = await jfetch('https://api.fal.ai/v1/models/pricing?endpoint_id=' + encodeURIComponent(id), { headers: falHead(env) }, 15000);
  return r.ok ? (r.body.prices || [])[0] : null;
}
const falRoute = kind => ({
  id: 'fal', account: 'fal', kind, label: 'fal.ai', status: 'untested',
  defaultModel: kind === 'image' ? 'fal-ai/flux/schnell' : 'fal-ai/kling-video/v3/standard/image-to-video',
  models: kind === 'image' ? ['fal-ai/flux/schnell', 'fal-ai/flux-2/klein/4b', 'fal-ai/flux-2/klein/4b/edit'] : ['fal-ai/kling-video/v3/standard/image-to-video', 'alibaba/wan-3.0/image-to-video'],
  time: kind === 'image' ? '5–30 s' : '1–5 min', etaMs: kind === 'image' ? 45000 : 240000,
  costHint: kind === 'image' ? 'live price from fal, ≈ $0.003' : 'live price from fal, ≈ $0.42 per 5 s', setup: 'add a fal.ai API key',
  available: env => !!env.FAL_KEY,
  estimate: job => ({ amount: kind === 'image' ? 0.003 : (/wan/.test(job.model) ? 0.5 : 0.42), unit: 'usd' }),
  async quote(job, ctx) {
    const p = await falPrice(this.endpoint(job), ctx.env); if (!p || p.unit_price == null || (p.currency && p.currency !== 'USD')) return null;
    const u = String(p.unit || '').toLowerCase();
    const n = /second/.test(u) ? 5 : /megapixel|mp/.test(u) ? 1 : /image|video|request|unit/.test(u) || !u ? 1 : null;
    return n == null ? null : { amount: Math.round(p.unit_price * n * 10000) / 10000, unit: 'usd' };
  },
  endpoint(job) { let m = job.model || this.defaultModel; if (kind === 'image' && refsOf(job).length && !/edit/.test(m)) m = 'fal-ai/flux-2/klein/4b/edit'; return m; },
  async submit(job, ctx) {
    const m = this.endpoint(job), refs = refsOf(job);
    const input = kind === 'image'
      ? { prompt: job.prompt, image_size: 'landscape_16_9', num_images: 1, ...(refs.length ? { image_urls: refs.map(dataUri) } : {}) }
      : /wan/.test(m) ? { prompt: job.prompt, start_image_url: dataUri(refs[0]), duration: 5, resolution: '720p', aspect_ratio: '16:9' }
        : { prompt: job.prompt, start_image_url: dataUri(refs[0]), duration: '5', generate_audio: false };
    const r = await jfetch('https://queue.fal.run/' + m, { method: 'POST', headers: falHead(ctx.env), body: JSON.stringify(input) });
    if (!r.ok || !r.body.status_url) throw Error('fal ' + r.status + ' ' + short(r.body.detail || r.body));
    return { jobId: JSON.stringify({ s: r.body.status_url, r: r.body.response_url }) };
  },
  async poll(id, ctx) {
    const { s, r: resp } = JSON.parse(id);
    const st = await jfetch(s, { headers: falHead(ctx.env) }, 30000); const status = String(st.body.status || '');
    if (status !== 'COMPLETED') return { status: st.status >= 400 && st.status !== 202 ? 'failed' : 'running', raw: status || ('http ' + st.status) };
    if (st.body.error) return { status: 'failed', raw: short(st.body.error, 160) };
    const out = await jfetch(resp, { headers: falHead(ctx.env) }, 30000);
    const url = firstUrl(kind === 'video' ? out.body.video : out.body.images) || firstUrl(out.body);
    return url ? { status: 'done', url, raw: status } : { status: 'failed', raw: 'completed without output: ' + short(out.body, 120) };
  },
});

/* ---------------- Magnific (Freepik API) ---------------- */
const MAG = 'https://api.magnific.com/v1/ai';
const magHead = env => ({ 'x-magnific-api-key': env.MAGNIFIC_API_KEY, 'Content-Type': 'application/json' });
const magnificRoute = kind => ({
  id: 'magnific', account: 'magnific', kind, label: 'Magnific', status: kind === 'image' ? 'keycheck' : 'untested',
  defaultModel: kind === 'image' ? 'seedream-v5-pro' : 'kling-v3-turbo-720p',
  models: kind === 'image' ? ['seedream-v5-pro', 'seedream-v5-lite', 'seedream-v4-5', 'flux-2-pro'] : ['kling-v3-turbo-720p', 'kling-v3-turbo-1080p'],
  time: kind === 'image' ? '20–90 s' : '2–6 min', etaMs: kind === 'image' ? 90000 : 240000,
  costHint: 'Magnific credits from your plan (price not available to Studio)', setup: 'add a Magnific API key',
  available: env => !!env.MAGNIFIC_API_KEY,
  estimate: () => ({ amount: null, unit: 'usd' }),
  async submit(job, ctx) {
    const refs = refsOf(job); let base, body;
    if (kind === 'image') {
      const m = job.model || this.defaultModel;
      base = `${MAG}/text-to-image/${m}${refs.length && /seedream/.test(m) ? '-edit' : ''}`;
      body = { prompt: job.prompt, aspect_ratio: 'widescreen_16_9', ...(/v5/.test(m) ? { resolution: '2k' } : {}) };
      if (refs.length) body.reference_images = refs.map(dataUri);
    } else { base = `${MAG}/image-to-video/${job.model || this.defaultModel}`; body = { image: dataUri(refs[0]), prompt: job.prompt, duration: '5' }; }
    const r = await jfetch(base, { method: 'POST', headers: magHead(ctx.env), body: JSON.stringify(body) });
    const tid = r.body?.data?.task_id || r.body?.task_id;
    if (!r.ok || !tid) throw Error('magnific ' + r.status + ' ' + short(r.body));
    return { jobId: base + '|' + tid };
  },
  async poll(id, ctx) {
    const [base, tid] = id.split('|');
    const r = await jfetch(base + '/' + tid, { headers: magHead(ctx.env) }, 30000); const d = r.body.data || r.body; const st = String(d.status || '').toLowerCase();
    return { status: /complet|succe/.test(st) && d.generated?.length ? 'done' : /fail|error|cancel/.test(st) ? 'failed' : 'running', url: firstUrl(d.generated), raw: st };
  },
});

/* ---------------- local: ComfyUI and Automatic1111 (free) ---------------- */
async function probe(url, pathname) { try { const r = await fetch(url.replace(/\/$/, '') + pathname, { signal: T(1200) }); return r.ok; } catch { return false; } }
const localDetections = new Map();
export function detectLocal(env = process.env) {
  const key = JSON.stringify([env.COMFYUI_URL || '', env.A1111_URL || '']);
  const cached = localDetections.get(key);
  if (cached && cached.until > Date.now()) return cached.promise;
  const find = async (saved, defaults, p) => { for (const u of new Set([saved, ...defaults].filter(Boolean))) if (await probe(u, p)) return u.replace(/\/$/, ''); return null; };
  const promise = Promise.all([
    find(env.COMFYUI_URL, ['http://127.0.0.1:8188', 'http://127.0.0.1:8000'], '/system_stats'),
    find(env.A1111_URL, ['http://127.0.0.1:7860'], '/sdapi/v1/sd-models')])
    .then(([comfyui, a1111]) => ({ comfyui, a1111 }));
  if (localDetections.size >= 8) localDetections.delete(localDetections.keys().next().value);
  localDetections.set(key, { promise, until: Date.now() + 30000 });
  return promise;
}
const W = 1344, H = 768;
async function comfyGraph(job, url) {
  const seed = Math.floor(Math.random() * 2 ** 31);
  if (/\.json$/i.test(job.model || '')) { // user workflow exported with "Save (API)"
    const wf = JSON.parse(fs.readFileSync(job.model, 'utf8'));
    if (wf.nodes) throw Error('that workflow is in UI format; export it with "Save (API)" instead');
    const fill = v => typeof v === 'string' ? (v === '{seed}' ? seed : v === '{width}' ? W : v === '{height}' ? H : v.replaceAll('{prompt}', job.prompt))
      : Array.isArray(v) ? v.map(fill) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)])) : v;
    return fill(wf);
  }
  let ckpt = job.model;
  if (!ckpt) { const r = await jfetch(url + '/object_info/CheckpointLoaderSimple', {}, 10000); ckpt = r.body?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0]?.[0]; }
  if (!ckpt) throw Error('ComfyUI has no checkpoint in models/checkpoints; add one or give a workflow .json as the model');
  return {
    1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
    2: { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1], text: job.prompt } },
    3: { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1], text: 'text, letters, watermark, logo, frame, blurry, lowres' } },
    4: { class_type: 'EmptyLatentImage', inputs: { width: W, height: H, batch_size: 1 } },
    5: { class_type: 'KSampler', inputs: { model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0], seed, steps: 28, cfg: 6, sampler_name: 'euler', scheduler: 'normal', denoise: 1 } },
    6: { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    7: { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: 'skin-studio' } },
  };
}
const comfyui = {
  id: 'comfyui', account: 'comfyui', kind: 'image', label: 'ComfyUI (local, free)', status: 'verified',
  defaultModel: '', models: [], time: '10 s – 3 min (your GPU)', etaMs: 120000, costHint: 'free, runs on your GPU', setup: 'start ComfyUI (or set its URL in Providers)',
  available: async env => !!(await detectLocal(env)).comfyui,
  estimate: () => ({ amount: 0, unit: 'usd' }),
  async submit(job, ctx) {
    const url = (await detectLocal(ctx.env)).comfyui; if (!url) throw Error('ComfyUI is not running');
    const r = await jfetch(url + '/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: await comfyGraph(job, url), client_id: 'skin-studio' }) }, 30000);
    if (!r.ok || !r.body.prompt_id) throw Error('comfyui ' + r.status + ' ' + short(r.body.error || r.body.node_errors || r.body, 400));
    return { jobId: url + '|' + r.body.prompt_id };
  },
  async poll(id) {
    const [url, pid] = id.split('|');
    const r = await jfetch(`${url}/history/${pid}`, {}, 15000); const h = r.body?.[pid];
    if (!h) return { status: 'running', raw: 'queued', wait: 2000 };
    if (h.status?.status_str === 'error') return { status: 'failed', raw: short(h.status.messages?.find(m => m[0] === 'execution_error')?.[1]?.exception_message || 'error', 200) };
    for (const out of Object.values(h.outputs || {})) for (const im of out.images || []) if (im.type === 'output' || !im.type)
      return { status: 'done', url: `${url}/view?filename=${encodeURIComponent(im.filename)}&subfolder=${encodeURIComponent(im.subfolder || '')}&type=${im.type || 'output'}`, raw: 'done' };
    return { status: h.status?.completed ? 'failed' : 'running', raw: h.status?.completed ? 'finished without an output image' : 'rendering', wait: 2000 };
  },
};
const a1111 = {
  id: 'a1111', account: 'a1111', kind: 'image', label: 'Automatic1111 / Forge (local, free)', status: 'untested',
  defaultModel: '', models: [], time: '10 s – 2 min (your GPU)', etaMs: 120000, costHint: 'free, runs on your GPU', setup: 'start the web UI with --api (or set its URL in Providers)',
  available: async env => !!(await detectLocal(env)).a1111,
  estimate: () => ({ amount: 0, unit: 'usd' }),
  async submit(job, ctx) {
    const url = (await detectLocal(ctx.env)).a1111; if (!url) throw Error('Automatic1111 is not running with --api');
    const refs = refsOf(job);
    const body = { prompt: job.prompt, negative_prompt: 'text, letters, watermark, logo, frame, blurry, lowres', width: W, height: H, steps: 28, cfg_scale: 6,
      ...(job.model ? { override_settings: { sd_model_checkpoint: job.model } } : {}), ...(refs.length ? { init_images: [b64(refs[0])], denoising_strength: 0.6 } : {}) };
    const r = await jfetch(`${url}/sdapi/v1/${refs.length ? 'img2img' : 'txt2img'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, Math.max(30000, ctx.left()));
    if (!r.ok || !r.body.images?.[0]) throw Error('a1111 ' + r.status + ' ' + short(r.body));
    return fileJob(job.dir, 'a1111-result.png', Buffer.from(r.body.images[0], 'base64'));
  },
  poll: filePoll,
};

/* ---------------- command template (any local tool) ---------------- */
const command = {
  id: 'command', account: null, kind: 'image', label: 'Any tool (command template)', status: 'verified',
  defaultModel: '', models: [], time: 'depends on your tool', etaMs: 60000, costHint: 'whatever your tool costs', setup: 'enter a command template',
  available: () => true,
  estimate: () => ({ amount: 0, unit: 'usd' }),
  async submit(job, ctx) {
    const tpl = ctx.opt('cmd'); if (!tpl) throw Error('no command template given');
    const out = path.join(job.dir, 'command-result.png');
    const q = s => '"' + String(s).replace(/"/g, '\\"') + '"';
    const line = tpl.replaceAll('{prompt}', q(job.prompt)).replaceAll('{out}', q(out)).replaceAll('{image}', q(job.images?.[0] || ''));
    await new Promise((res, rej) => { const p = spawn(line, { shell: true, windowsHide: true, stdio: 'ignore' }); const k = setTimeout(() => { p.kill(); rej(Error('command hit the time limit')); }, Math.max(1000, ctx.left())); p.on('exit', c => { clearTimeout(k); c === 0 ? res() : rej(Error('command exit ' + c)); }); });
    if (!fs.existsSync(out)) throw Error('command did not write {out}');
    return { jobId: 'file:' + out };
  },
  poll: filePoll,
};

/* ---------------- registries ---------------- */
export const IMAGE = Object.fromEntries([higgsCli('image'), higgsApi('image'), openai, googleImage, replicateRoute('image'), falRoute('image'), magnificRoute('image'), comfyui, a1111, command].map(r => [r.id, r]));
export const VIDEO = Object.fromEntries([higgsCli('video'), higgsApi('video'), replicateRoute('video'), falRoute('video'), googleVideo, magnificRoute('video')].map(r => [r.id, r]));
export async function pickAuto(env) {
  for (const id of ['higgsfield', 'higgsfield-api', 'openai', 'google', 'fal', 'replicate', 'magnific', 'comfyui', 'a1111']) if (await IMAGE[id].available(env)) return id;
  return 'none';
}

// Runs in the Electron main process. A form edit must not create a Studio/CLI
// process, upload references, or submit a generation. Keep concurrent requests
// together and cache by price-relevant fields, not prompt text or spend caps.
export function createStudioEstimator({ image = IMAGE, video = VIDEO, pick = pickAuto, now = Date.now, ttlMs = 30000 } = {}) {
  const cache = new Map();
  const text = v => String(v ?? '').slice(0, 2000);
  return {
    invalidate() { cache.clear(); },
    estimate(options = {}, env = {}) {
      const source = ['ai', 'image', 'video', 'procedural'].includes(options.source) ? options.source : 'ai';
      const o = { source, provider: source === 'ai' ? text(options.provider) || 'auto' : 'none', model: text(options.model),
        video: source === 'ai' && !!options.video, videoProvider: text(options.videoProvider) || 'higgsfield', videoModel: text(options.videoModel) };
      const key = JSON.stringify(o);
      const old = cache.get(key);
      if (old && (old.pending || old.until > now())) return old.promise;
      const entry = { pending: true, until: Infinity };
      entry.promise = (async () => {
        const provider = o.provider === 'auto' ? await pick(env) : o.provider;
        const lines = [];
        const add = async (stage, route, model) => {
          if (!route) throw Error('Unknown ' + stage + ' provider');
          const job = { kind: stage, prompt: stage === 'image' ? 'desktop wallpaper' : 'ambient loop', model: model || route.defaultModel, images: [] };
          const ready = await Promise.resolve(route.available(env)).catch(() => false);
          let quote = null;
          if (ready && route.quote) {
            try { quote = await route.quote(job, { env, node: env.SKIN_STUDIO_NODE, allowSubprocess: false }); } catch {}
          }
          const cost = quote?.amount != null ? { ...quote, source: 'live quote' } : route.estimate(job);
          const amount = cost.amount == null ? null : Number(cost.amount);
          lines.push({ stage, provider: route.id, label: route.label, model: job.model || null,
            amount: Number.isFinite(amount) && amount >= 0 ? amount : null, unit: cost.unit || 'usd',
            source: cost.source || (amount == null ? 'unknown' : amount === 0 ? 'free' : 'static table'), time: route.time, status: route.status, ready });
        };
        if (source === 'ai' && provider !== 'none') await add('image', image[provider], o.model);
        if (o.video) await add('video', video[o.videoProvider], o.videoModel);
        return { type: 'estimate', provider, lines };
      })().then(result => { entry.pending = false; entry.until = now() + ttlMs; return result; }, error => {
        if (cache.get(key) === entry) cache.delete(key);
        throw error;
      });
      if (cache.size >= 64) cache.delete(cache.keys().next().value);
      cache.set(key, entry);
      return entry.promise;
    },
  };
}

/* ---------------- free key tests (never spend) ---------------- */
export async function testAccount(id, env) {
  const fail = (r, what) => ({ ok: false, msg: `${what} rejected (HTTP ${r.status}): ${short(r.body?.error?.message || r.body?.detail || r.body?.message || r.body?.title || r.body, 160)}` });
  switch (id) {
    case 'higgsfield': {
      const out = [];
      if (findHiggsfieldCli(env)) {
        try { const a = await hfRun(['account', 'status'], { env, node: env.SKIN_STUDIO_NODE }); out.push({ ok: true, msg: `CLI logged in · ${a.credits} credits · ${a.subscription_plan_type || 'plan'}` }); }
        catch { out.push({ ok: false, msg: 'CLI found but not logged in: press "Log in"' }); }
      } else out.push({ ok: false, msg: 'CLI not installed' });
      if (env.HIGGSFIELD_API_KEY) {
        const r = await jfetch(HF_API + '/requests/00000000-0000-4000-8000-000000000000/status', { headers: hfAuth(env) }, 15000);
        out.push(r.status === 404 ? { ok: true, msg: 'API key accepted' } : r.status === 401 || r.status === 403 ? { ok: false, msg: 'API key rejected' } : { ok: false, msg: 'API check returned HTTP ' + r.status });
      }
      return { ok: out.some(o => o.ok), msg: out.map(o => o.msg).join(' · ') };
    }
    case 'openai': { const r = await jfetch('https://api.openai.com/v1/models', { headers: { Authorization: 'Bearer ' + env.OPENAI_API_KEY } }, 15000);
      return r.ok ? { ok: true, msg: `key works · image models: ${(r.body.data || []).map(m => m.id).filter(i => /image/.test(i)).slice(0, 4).join(', ') || 'none listed'}` } : fail(r, 'OpenAI'); }
    case 'google': { const r = await jfetch(GEM + '/models?pageSize=100', { headers: { 'x-goog-api-key': env.GEMINI_API_KEY || env.GOOGLE_API_KEY } }, 15000);
      return r.ok ? { ok: true, msg: `key works · ${(r.body.models || []).filter(m => /image|omni/.test(m.name)).length} image/video models visible` } : fail(r, 'Google'); }
    case 'replicate': { const r = await jfetch(REP + '/account', { headers: repHead(env) }, 15000);
      return r.ok ? { ok: true, msg: 'key works · account ' + (r.body.username || '') } : fail(r, 'Replicate'); }
    case 'fal': { const r = await jfetch('https://api.fal.ai/v1/models/pricing?endpoint_id=fal-ai/flux/schnell', { headers: falHead(env) }, 15000);
      const p = r.ok && (r.body.prices || [])[0];
      return r.ok ? { ok: true, msg: 'key works' + (p ? ` · FLUX schnell $${p.unit_price}/${p.unit}` : '') } : fail(r, 'fal.ai'); }
    case 'magnific': { // no documented key-check route: bad keys get 401 everywhere, a valid key reaches the route (200 or 404)
      const r = await jfetch(MAG + '/text-to-image/seedream-v5-pro', { headers: magHead(env) }, 15000);
      return r.status === 401 || r.status === 403 ? fail(r, 'Magnific') : r.status < 500 ? { ok: true, msg: 'key accepted (authenticated request, nothing generated)' } : fail(r, 'Magnific'); }
    case 'anthropic': { const r = await jfetch('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } }, 15000);
      return r.ok ? { ok: true, msg: 'key works · ' + ((r.body.data || []).map(m => m.id).filter(i => /opus|sonnet/.test(i)).slice(0, 4).join(', ') || 'models listed') } : fail(r, 'Anthropic'); }
    case 'comfyui': case 'a1111': {
      const url = (await detectLocal(env))[id];
      if (!url) return { ok: false, msg: id === 'comfyui' ? 'ComfyUI not found on 8188/8000 or the saved URL' : 'Automatic1111 not found on 7860 or the saved URL (start it with --api)' };
      let n = '';
      try { if (id === 'comfyui') { const r = await jfetch(url + '/object_info/CheckpointLoaderSimple', {}, 8000); n = (r.body?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || []).length + ' checkpoints'; }
        else { const r = await jfetch(url + '/sdapi/v1/sd-models', {}, 8000); n = (r.body || []).length + ' models'; } } catch {}
      return { ok: true, msg: `running at ${url}${n ? ' · ' + n : ''}` };
    }
  }
  return { ok: false, msg: 'no test for this provider' };
}
export const PRICES_CHECKED = CHECKED;
