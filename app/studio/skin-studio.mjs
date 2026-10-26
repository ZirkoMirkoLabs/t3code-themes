#!/usr/bin/env node
// Skin Studio: turns a description, image or video into a T3 skin pack, inside a hard time and spend cap.
//   node studio/skin-studio.mjs --name "Koi Pond" --describe "moonlit koi pond, lanterns" --provider auto --time 6m --max-credits 6 [--video --video-provider higgsfield]
//   node studio/skin-studio.mjs --name "Mine" --image C:/pic.png --provider none          (your picture as-is)
//   node studio/skin-studio.mjs --name "Mine" --video-file C:/clip.mp4                     (your video/GIF as-is)
//   node studio/skin-studio.mjs --resume skins/koi-pond --time 5m                          (collect pending jobs; never resubmits)
//   node studio/skin-studio.mjs --estimate --provider openai --video --video-provider fal  (cost/time preview, submits nothing)
// Providers: see studio/providers.mjs. Output: skins/<id>/ with skin.json, REPORT.md, receipts.json.
import fs from 'node:fs'; import fsp from 'node:fs/promises'; import path from 'node:path';
import { execFile, spawn } from 'node:child_process'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
import { IMAGE, VIDEO, pickAuto, hfReconcile } from './providers.mjs';
const { adaptSkin } = createRequire(import.meta.url)('../launcher/skin-ui.cjs');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const multi = k => argv.flatMap((a, i) => a === '--' + k ? [argv[i + 1]] : []);
const flag = k => argv.includes('--' + k);
const EVENTS = flag('events');
const T0 = Date.now();
const parseTime = v => { const m = /^(\d+(?:\.\d+)?)(s|m|h)?$/.exec(String(v || '5m').trim()); if (!m) throw Error('Bad --time, use e.g. 90s, 5m'); return Number(m[1]) * ({ s: 1e3, m: 6e4, h: 36e5 }[m[2] || 'm']); };
const BUDGET = parseTime(opt('time', '5m'));
const DEADLINE = T0 + BUDGET;
let stopNow = false; // "Finish now" from the Studio window: wrap up and report immediately
const left = () => stopNow ? 0 : Math.max(0, DEADLINE - Date.now());
const secs = ms => Math.round(ms / 1000);
// Two independent caps: provider credits (Higgsfield) and money (USD-billed APIs).
const CAPS = { credits: Number(opt('max-credits', '6')), usd: Number(opt('max-usd', '1')) };
const spentBy = { credits: 0, usd: 0 };
const fmtSpend = () => [spentBy.credits ? `${round(spentBy.credits)} credits` : '', spentBy.usd ? `$${round(spentBy.usd)}` : ''].filter(Boolean).join(' + ') || 'nothing';
const round = n => Math.round(n * 1000) / 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Never let a key reach stdout, REPORT.md or receipts.
const SECRET_ENV = ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'REPLICATE_API_TOKEN', 'FAL_KEY', 'MAGNIFIC_API_KEY', 'HIGGSFIELD_API_KEY', 'HIGGSFIELD_API_SECRET'];
const SECRETS = SECRET_ENV.map(n => process.env[n]).filter(v => v && v.length >= 6);
const redact = s => { let t = String(s ?? ''); for (const k of SECRETS) t = t.split(k).join('••••'); return t; };

function emit(type, data = {}) {
  const ev = JSON.parse(redact(JSON.stringify({ type, t: secs(Date.now() - T0), left: secs(left()), budget: secs(BUDGET), spent: spentBy.credits, spentText: fmtSpend(), ...data })));
  if (EVENTS) process.stdout.write(JSON.stringify(ev) + '\n');
  else if (type !== 'analyze') console.log(`[${String(ev.t).padStart(4)}s | ${String(ev.left).padStart(4)}s left] ${type}${ev.msg ? ': ' + ev.msg : ''}`);
}

// stdin protocol from the launcher (events mode): "stop" and "analysis <id> <json>" lines.
const waiting = new Map(); let reqSeq = 0;
if (EVENTS) {
  let buf = '';
  process.stdin.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (l === 'stop') { stopNow = true; emit('progress', { msg: 'finish-now requested: wrapping up' }); }
    const m = /^analysis (\d+) (.*)$/.exec(l); if (m && waiting.has(+m[1])) { try { waiting.get(+m[1])(JSON.parse(m[2])); } catch {} waiting.delete(+m[1]); } } });
  process.stdin.on('error', () => {});
}

/* ---------------- art director (no model call; deterministic) ---------------- */
const MOODS = [
  { k: /space|galax|cosmic|nebula|planet|star|orbit|astro/, scene: 'nebula', particles: { type: 'stars', density: 0.5, shooting: true }, pal: ['#05040d', '#8f7bff', '#4fd8ff'], motion: 'slow drifting nebula clouds and twinkling stars, planet rotating very slowly' },
  { k: /sakura|cherry|blossom|pink|petal|romanc|pastel|kawaii|spring/, scene: 'dusk', particles: { type: 'petals', density: 0.55 }, pal: ['#1a0b1f', '#ff7eb6', '#ffc6a8'], motion: 'petals drifting gently in a light breeze, soft clouds moving slowly' },
  { k: /forest|fantasy|elf|emerald|magic|enchant|druid|mystic|fairy|aurora|northern/, scene: 'aurora', particles: { type: 'fireflies', density: 0.35 }, pal: ['#03100d', '#3dffb0', '#9b7bff'], motion: 'aurora rippling slowly, fireflies drifting, faint mist moving' },
  { k: /neon|cyber|synth|retro|vapor|outrun|80s|arcade|city/, scene: 'synth', particles: { type: 'embers', density: 0.25 }, pal: ['#0b0414', '#ff3fa4', '#3ef0ff'], motion: 'neon lights flickering softly, slow rain or haze drifting' },
  { k: /ocean|sea|underwater|abyss|deep|water|koi|reef|whale/, scene: 'abyss', particles: { type: 'bubbles', density: 0.3 }, pal: ['#020a14', '#2fb8ff', '#7dffe3'], motion: 'slow light rays shimmering through water, particles floating' },
  { k: /fire|lava|ember|volcan|dragon|inferno|forge/, scene: 'dusk', particles: { type: 'embers', density: 0.5 }, pal: ['#140504', '#ff6a2b', '#ffc35a'], motion: 'embers rising, heat haze shimmering, smoke drifting slowly' },
  { k: /snow|winter|ice|frost|arctic|glacier/, scene: 'aurora', particles: { type: 'snow', density: 0.5 }, pal: ['#06101a', '#8fd3ff', '#e8f6ff'], motion: 'snow falling gently, aurora shifting slowly' },
];
function direct(text) {
  const t = (text || '').toLowerCase();
  return MOODS.find(x => x.k.test(t)) || { scene: 'nebula', particles: { type: 'dust', density: 0.4 }, pal: ['#07080d', '#8b9dff', '#ffb38a'], motion: 'very subtle ambient light drifting, particles floating slowly' };
}
function platePrompt(describe) {
  return `Create an original 16:9 background artwork for this specific brief: ${describe}. ` +
    `Preserve the requested subject, era, materials, colour palette and visual medium. Choose a coherent composition with a clear focal subject, believable depth and deliberate lighting. ` +
    `Match a bright, pastel, illustrated, photographic or dark treatment when the brief calls for it; do not automatically turn every idea into a dark cinematic space scene. ` +
    `The app provides its own readable panels: compose the focal subject toward the right third or outer edges, with quieter detail across the central working area. ` +
    `Avoid unrelated planets, neon glow, generic decorative particles and visual clutter unless the subject actually calls for them. ` +
    `Finish the image with consistent shapes and materials, clean edges and intentional detail. No text, letters, UI mockups, logos, watermark, frame or border.`;
}
const motionPrompt = mood => `Seamless ambient loop of this exact image: ${mood.motion}. Locked-off static camera, no cuts, no zoom, no pan, no new objects, no text. Slow, calm, subtle motion only.`;

/* ---------------- shell + media helpers ---------------- */
function run(cmd, args, timeoutMs, extra = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: Math.max(1000, timeoutMs), maxBuffer: 32 << 20, windowsHide: true, ...extra }, (err, stdout, stderr) => {
      if (err) reject(Object.assign(Error(String(stderr || stdout || err.message).slice(0, 800)), { killed: err.killed })); else resolve(stdout);
    });
  });
}
async function download(url, dest, headers) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(Math.max(5000, Math.min(left() + 30000, 180000))) });
  if (!r.ok) throw Error('download ' + r.status);
  await fsp.writeFile(dest, Buffer.from(await r.arrayBuffer())); return dest;
}
// ffmpeg: bundled ffmpeg-static (launcher npm install) -> system ffmpeg -> none (raw clip, no ping-pong).
let ffmpegPath;
async function ffmpeg() {
  if (ffmpegPath !== undefined) return ffmpegPath;
  const cands = [process.env.SKIN_STUDIO_FFMPEG];
  try { cands.push(createRequire(path.join(ROOT, 'launcher', 'package.json'))('ffmpeg-static')); } catch {}
  cands.push('ffmpeg');
  for (const c of cands.filter(Boolean)) { try { await run(c, ['-version'], 8000); return (ffmpegPath = c); } catch {} }
  return (ffmpegPath = null);
}
async function pingPong(src, dest) {
  const ff = await ffmpeg(); if (!ff) return false;
  await run(ff, ['-y', '-loglevel', 'error', '-i', src, '-filter_complex', '[0:v]scale=1280:-2,fps=24,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[v]', '-map', '[v]', '-an', '-c:v', 'libx264', '-crf', '27', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dest], 180000);
  return true;
}
async function toMp4(src, dest) {
  const ff = await ffmpeg(); if (!ff) return false;
  await run(ff, ['-y', '-loglevel', 'error', '-i', src, '-vf', "scale='min(1920,iw)':-2,fps=30", '-an', '-c:v', 'libx264', '-crf', '24', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dest], 300000);
  return true;
}

// Palette + thumbnail (+ poster frame for videos). In the Studio window this runs in an Electron
// canvas renderer (no Python, no native deps). The plain CLI falls back to Python+Pillow if present,
// else to the mood palette.
async function analyze(file, { poster = false, posterName, posterWidth, noThumb } = {}) {
  if (EVENTS) {
    const id = ++reqSeq;
    const res = new Promise((ok, no) => { const t = setTimeout(() => { waiting.delete(id); no(Error('analyzer did not answer')); }, 45000); waiting.set(id, r => { clearTimeout(t); r.error ? no(Error(r.error)) : ok(r); }); });
    emit('analyze', { req: id, file, poster, posterName, posterWidth, noThumb });
    return res; // { palette, thumb: 'thumb.jpg', poster: 'poster.jpg'|null, width, height, duration }
  }
  if (poster || /\.(gif|mp4|webm|mov|mkv|m4v)$/i.test(file)) throw Error('video analysis needs the Studio window');
  const out = await run(process.env.SKIN_STUDIO_PYTHON || 'python', ['-I', '-c', PY, file, path.join(dir, 'thumb.jpg')], 30000);
  const palette = JSON.parse(out); return { palette, thumb: 'thumb.jpg' };
}
// Small JPEG copy of a reference/start image for APIs that take inline base64 (keeps requests ~0.3 MB).
async function smallRef(file, name) {
  if (!EVENTS) return file;
  try { const r = await analyze(file, { poster: true, posterName: name, posterWidth: 1280, noThumb: true }); return r.poster ? path.join(dir, r.poster) : file; } catch { return file; }
}
const PY = `
import sys,json,colorsys
from PIL import Image
src,thumb=sys.argv[1],sys.argv[2]
im=Image.open(src).convert('RGB')
t=im.copy();t.thumbnail((480,270));t.save(thumb,quality=86)
px=list(im.resize((160,90)).getdata())
def hsv(c):return colorsys.rgb_to_hsv(*[v/255 for v in c])
def hx(c):return '#%02x%02x%02x'%tuple(max(0,min(255,int(round(v)))) for v in c)
def rgb(h,s,v):return [x*255 for x in colorsys.hsv_to_rgb(h%1,s,v)]
avg=sum(sum(p) for p in px)/len(px)/765
dark=sorted(px,key=sum)[:len(px)//4];dh,ds,_=hsv([sum(p[i] for p in dark)/len(dark) for i in range(3)])
bg=rgb(dh,min(ds,0.55),0.045)
hi=[hsv(p) for p in px if hsv(p)[2]>0.45 and hsv(p)[1]>0.25]
bins=[0.0]*24
for h,s_,v in hi:bins[int(h*24)%24]+=s_*v
order=sorted(range(24),key=lambda i:-bins[i])
if not hi or bins[order[0]]==0:a1=dh+0.5;a2=a1+0.12
else:
  a1=(order[0]+0.5)/24
  far=[i for i in order[1:] if min(abs(i-order[0]),24-abs(i-order[0]))>=3 and bins[i]>bins[order[0]]*0.12]
  a2=(far[0]+0.5)/24 if far else a1+0.08
acc=rgb(a1,0.62,0.95);acc2=rgb(a2,0.45,0.98)
surf=rgb(dh,min(ds,0.35),0.11);surf=[surf[i]*0.85+acc[i]*0.05 for i in range(3)]
border=[surf[i]*0.7+acc[i]*0.18 for i in range(3)]
print(json.dumps({'bg':hx(bg),'surface':hx(surf),'text':hx(rgb(a1,0.07,0.96)),'muted':hx(rgb(a1,0.18,0.72)),'accent':hx(acc),'accent2':hx(acc2),'border':hx(border),'brightness':round(avg,3)}))
`;
function fallbackPalette(m) {
  const [bg, a, b] = m.pal;
  return { bg, surface: mixHex(bg, a, 0.08), text: '#eef0ff', muted: mixHex('#eef0ff', bg, 0.4), accent: a, accent2: b, border: mixHex(bg, a, 0.22) };
}
function mixHex(x, y, t) { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(x), B = p(y); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }

/* ---------------- receipts (never resubmit an uncertain job) ---------------- */
let dir, receipts = [];
const saveReceipts = () => fs.writeFileSync(path.join(dir, 'receipts.json'), redact(JSON.stringify(receipts, null, 2)));
const ctx = () => ({ env: process.env, left, dir, opt, run, node: process.env.SKIN_STUDIO_NODE || 'node' });

// Cost of one job: live quote when the provider has one, else the static table. -> {amount, unit, source}
async function costOf(route, job) {
  let q = null; try { q = route.quote ? await route.quote(job, ctx()) : null; } catch {}
  if (q && q.amount != null) return { ...q, source: 'live quote' };
  const s = route.estimate(job);
  return { ...s, source: s.amount ? 'static table' : 'free' };
}

async function generate(stage, route, job, estimateMs) {
  let rec = receipts.find(r => r.stage === stage && r.status !== 'failed');
  if (rec?.status === 'done' && rec.file && fs.existsSync(rec.file)) { emit('stage', { stage, msg: 'already delivered earlier, reusing' }); return { file: rec.file, rec }; }
  if (!rec) {
    if (left() < estimateMs * 0.6) return { skipped: `needs about ${secs(estimateMs)}s; only ${secs(left())}s left` };
    const cost = await costOf(route, job);
    const unit = cost.unit || 'usd';
    if (cost.amount && spentBy[unit] + cost.amount > CAPS[unit]) return { skipped: `costs ${unit === 'usd' ? '$' + cost.amount : cost.amount + ' credits'} (${cost.source}); cap is ${unit === 'usd' ? '$' + CAPS.usd : CAPS.credits + ' credits'}, ${round(spentBy[unit])} already used` };
    rec = { stage, provider: route.id, model: job.model || null, prompt: job.prompt, status: 'submitting', quote: cost.amount ?? null, unit, costSource: cost.source, submittedAt: new Date().toISOString() };
    receipts.push(rec); saveReceipts();
    emit('stage', { stage, msg: `submitting to ${route.label}${job.model ? ' / ' + job.model : ''}${cost.amount ? ` (${unit === 'usd' ? '$' + cost.amount : cost.amount + ' credits'}, ${cost.source})` : ''}` });
    try { Object.assign(rec, await route.submit({ ...job, dir }, ctx())); rec.status = 'running'; spentBy[unit] += cost.amount || 0; }
    catch (e) { rec.status = 'unknown-or-failed'; rec.error = redact(e.message).slice(0, 400); saveReceipts(); return { failed: rec.error, rec }; }
    saveReceipts();
  } else {
    if (!rec.jobId && rec.provider === 'higgsfield') { // older/uncertain receipt: find the job that was already paid for
      const id = await hfReconcile(rec, ctx()).catch(() => null);
      if (!id) { rec.status = 'unknown-or-failed'; saveReceipts(); return { failed: 'earlier submission could not be matched; check the provider dashboard', rec }; }
      rec.jobId = id; saveReceipts();
    }
    if (!rec.jobId) return { failed: `an earlier ${rec.provider} submission has no job id, so its outcome is unknown. It is not resubmitted automatically: check the provider dashboard, then start a new run`, rec };
    emit('stage', { stage, msg: `resuming existing job (no new charge)` });
  }
  // poll until done, failed, or the time cap
  while (true) {
    let p; try { p = await route.poll(rec.jobId, ctx()); } catch (e) { p = { status: 'running', raw: 'poll error: ' + redact(e.message).slice(0, 80) }; }
    if (p.status === 'done') {
      let ext = path.extname(p.file || '') || (p.url && !p.url.startsWith('data:') && path.extname(new URL(p.url).pathname)) || (job.kind === 'video' ? '.mp4' : '.png');
      if (!/^\.(png|jpe?g|webp|mp4|webm)$/i.test(ext)) ext = job.kind === 'video' ? '.mp4' : '.png';
      const file = path.join(dir, `${stage}${ext.toLowerCase()}`);
      if (p.file) fs.copyFileSync(p.file, file); else if (p.bytes) fs.writeFileSync(file, p.bytes); else await download(p.url, file, p.headers);
      Object.assign(rec, { status: 'done', file, url: p.url && !p.url.startsWith('data:') ? p.url : null, finishedAt: new Date().toISOString() }); saveReceipts();
      return { file, rec };
    }
    if (p.status === 'failed') { Object.assign(rec, { status: 'failed', error: redact(p.raw) }); saveReceipts(); return { failed: 'provider reported ' + redact(p.raw), rec }; }
    if (left() <= 0) { rec.status = 'pending'; saveReceipts(); return { pending: true, rec }; }
    emit('progress', { stage, msg: `still rendering (${p.raw || 'running'})` });
    await sleep(Math.min(p.wait || 5000, Math.max(500, left())));
  }
}

/* ---------------- estimate mode: cost + time preview, submits nothing ---------------- */
async function estimateOnly() {
  let provider = opt('provider', 'auto'); if (provider === 'auto') provider = await pickAuto(process.env);
  const lines = [];
  const add = async (stage, route, job) => {
    const c = await costOf(route, job);
    lines.push({ stage, provider: route.id, label: route.label, model: job.model || route.defaultModel || null, amount: c.amount || 0, unit: c.unit || 'usd', source: c.source, time: route.time, status: route.status, ready: await route.available(process.env) });
  };
  const source = opt('source', 'ai');
  if (source === 'ai' && provider !== 'none') { const r = IMAGE[provider]; if (r) await add('image', r, { kind: 'image', prompt: platePrompt(opt('describe', 'scene')), model: opt('model') || r.defaultModel, images: [] }); }
  if (flag('video') && source !== 'video') { const r = VIDEO[opt('video-provider', 'higgsfield')]; if (r) await add('video', r, { kind: 'video', prompt: 'ambient loop', model: opt('video-model') || r.defaultModel, images: [] }); }
  emit('estimate', { provider, lines });
}

/* ---------------- main ---------------- */
async function main() {
  if (flag('estimate')) return estimateOnly();
  const resume = opt('resume');
  let plan;
  if (resume) {
    dir = path.resolve(resume);
    plan = JSON.parse(fs.readFileSync(path.join(dir, 'plan.json'), 'utf8'));
    receipts = JSON.parse(fs.readFileSync(path.join(dir, 'receipts.json'), 'utf8'));
    for (const r of receipts) if (r.status !== 'unknown-or-failed' && r.quote) spentBy[r.unit || 'credits'] += r.quote;
    plan.video = plan.video || flag('video');
    plan.videoProvider = plan.videoProvider || opt('video-provider') || (receipts.find(r => r.stage === 'video-src')?.provider) || 'higgsfield';
  } else {
    const name = opt('name') || 'My Skin';
    const describe = opt('describe', '');
    const images = multi('image').map(p => path.resolve(p));
    const videoFile = opt('video-file') ? path.resolve(opt('video-file')) : null;
    for (const i of [...images, videoFile].filter(Boolean)) if (!fs.existsSync(i)) throw Error('File not found: ' + i);
    if (!describe && !images.length && !videoFile) throw Error('Give --describe "...", --image <file> and/or --video-file <file>');
    let provider = videoFile ? 'none' : opt('provider', 'auto');
    if (provider === 'auto') provider = await pickAuto(process.env);
    if (provider !== 'none' && !IMAGE[provider]) throw Error(`Unknown provider ${provider}`);
    if (provider !== 'none' && !(await IMAGE[provider].available(process.env))) throw Error(`${IMAGE[provider].label} is not set up: ${IMAGE[provider].setup}`);
    const video = flag('video') && !videoFile;
    const videoProvider = video ? opt('video-provider', 'higgsfield') : null;
    if (video && !VIDEO[videoProvider]) throw Error(`Unknown video provider ${videoProvider}`);
    if (video && !(await VIDEO[videoProvider].available(process.env))) throw Error(`${VIDEO[videoProvider].label} is not set up: ${VIDEO[videoProvider].setup}`);
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'skin';
    dir = path.join(ROOT, 'skins', id);
    if (fs.existsSync(path.join(dir, 'receipts.json')) && !flag('overwrite')) throw Error(`skins/${id} already exists. Use --resume skins/${id}, a new --name, or --overwrite.`);
    if (fs.existsSync(path.join(dir, 'receipts.json'))) { // --overwrite: keep unfinished paid jobs recoverable
      const old = JSON.parse(fs.readFileSync(path.join(dir, 'receipts.json'), 'utf8'));
      if (old.some(r => ['running', 'pending', 'submitting'].includes(r.status))) throw Error(`skins/${id} has a paid job that has not been collected yet. Resume it first, or choose another name.`);
    }
    fs.mkdirSync(dir, { recursive: true }); receipts = []; saveReceipts();
    const mood = direct(describe + ' ' + name);
    plan = { id, name, describe, images, videoFile, provider, asIs: provider === 'none' && (images.length > 0 || !!videoFile), mood, video, videoProvider,
      model: opt('model') || IMAGE[provider]?.defaultModel || null, videoModel: video ? (opt('video-model') || VIDEO[videoProvider].defaultModel) : null,
      quality: opt('quality', 'high'), motionText: String(opt('motion-prompt', '') || '').slice(0, 300) || null, createdAt: new Date().toISOString() };
    fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify(plan, null, 2));
  }
  emit('start', { msg: `${plan.name} -> skins/${plan.id} · ${plan.videoFile ? 'your video' : 'provider ' + plan.provider}${plan.video ? ' + video ' + plan.videoProvider : ''} · cap ${secs(BUDGET)}s / ${CAPS.credits} credits / $${CAPS.usd}`, dir });
  const steps = []; const need = [];
  const step = (name, status, note = '') => { note = redact(note); steps.push({ name, status, note, at: secs(Date.now() - T0) }); emit('step', { stage: name, status, msg: note }); };
  step('plan', 'done', `scene "${plan.mood.scene}", particles "${plan.mood.particles.type}"`);

  // 1. background plate (image, or the user's own video/GIF)
  let plate = null, video = null, analysis = null;
  if (plan.videoFile) {
    const ext = path.extname(plan.videoFile).toLowerCase();
    const mb = fs.statSync(plan.videoFile).size / 1048576;
    if (ext === '.gif') {
      video = path.join(dir, 'loop.mp4');
      if (await toMp4(plan.videoFile, video).catch(() => false)) step('video', 'done', `GIF converted to MP4 (${mb.toFixed(1)} MB in)`);
      else { video = null; plate = path.join(dir, 'plate.gif'); fs.copyFileSync(plan.videoFile, plate); step('video', 'done', 'GIF used directly (no ffmpeg: it cannot pause in Still mode)'); }
    } else if (['.mp4', '.webm'].includes(ext) && mb <= 120) { video = path.join(dir, 'loop' + ext); fs.copyFileSync(plan.videoFile, video); step('video', 'done', `your video is used directly (${mb.toFixed(1)} MB)`); }
    else {
      video = path.join(dir, 'loop.mp4');
      if (await toMp4(plan.videoFile, video).catch(() => false)) step('video', 'done', `converted to a web MP4 (${mb.toFixed(1)} MB in)`);
      else { video = path.join(dir, 'loop' + ext); fs.copyFileSync(plan.videoFile, video); step('video', 'fallback', `copied as-is (no ffmpeg to convert ${ext}); it may not play`); }
    }
    try {
      analysis = await analyze(video || plate, { poster: !!video });
      if (video && analysis.poster) plate = path.join(dir, analysis.poster);
      step('poster', analysis.poster || plate ? 'done' : 'skipped', video ? 'still frame taken from your video (used in Still mode)' : '');
    } catch (e) { step('poster', 'failed', e.message.slice(0, 160)); }
  } else if (plan.asIs) { plate = path.join(dir, 'plate' + path.extname(plan.images[0]).toLowerCase()); fs.copyFileSync(plan.images[0], plate); step('plate', 'done', 'your image is used directly'); }
  else if (plan.provider !== 'none') {
    const route = IMAGE[plan.provider];
    const job = { kind: 'image', prompt: platePrompt(plan.describe || 'atmospheric scene inspired by the reference image'), images: plan.images, model: plan.model, quality: plan.quality };
    if (plan.images.length && !['higgsfield', 'command', 'none'].includes(plan.provider) && !receipts.some(r => r.stage === 'plate')) job.refs = await Promise.all(plan.images.map((f, i) => smallRef(f, `ref-${i + 1}.jpg`)));
    const r = await generate('plate', route, job, route.etaMs || 90000);
    if (r.file) { plate = r.file; step('plate', 'done', `generated with ${route.label}`); }
    else if (r.pending) { step('plate', 'pending', `job still rendering at the time cap`); need.push({ what: 'Background artwork is still rendering', more: '1–2 min', how: 'resume' }); }
    else if (r.skipped) { step('plate', 'skipped', r.skipped); need.push({ what: 'Background artwork', more: r.skipped, how: 'raise the time limit or the spend cap' }); }
    else { step('plate', 'failed', r.failed); need.push({ what: 'Background artwork failed: ' + r.failed, more: 'retry after checking the provider', how: 'new run' }); }
  } else step('plate', 'skipped', 'procedural mode: no provider, no image');

  // 2. palette from the plate (or mood fallback)
  let palette = fallbackPalette(plan.mood), brightness = null, thumb = null;
  if (plate || analysis) {
    try {
      const a = analysis || await analyze(plate);
      brightness = a.palette.brightness; delete a.palette.brightness; palette = a.palette; thumb = a.thumb || null;
      step('palette', 'done', `extracted from ${plan.videoFile ? 'your video' : 'artwork'} (accent ${palette.accent})`);
    } catch (e) { step('palette', 'fallback', 'image analysis unavailable, used mood palette: ' + e.message.slice(0, 120)); }
  } else step('palette', 'done', 'mood palette');

  // 3. optional animated loop (image-to-video) from the plate
  if (plan.video && !plan.videoFile) {
    const route = VIDEO[plan.videoProvider];
    if (!plate) step('video', 'skipped', 'needs a background image first');
    else if (!route) step('video', 'skipped', `unknown video provider ${plan.videoProvider}`);
    else {
      const job = { kind: 'video', model: plan.videoModel || route.defaultModel, prompt: plan.motionText ? plan.motionText + ' Locked-off camera, no camera movement, no cuts.' : motionPrompt(plan.mood), images: [plate], duration: 5, aspect: '16:9' };
      if (route.id !== 'higgsfield' && !receipts.some(r => r.stage === 'video-src')) job.refs = [await smallRef(plate, 'ref-start.jpg')];
      const r = await generate('video-src', route, job, route.etaMs || 240000);
      if (r.file) {
        video = path.join(dir, 'loop.mp4');
        try { if (await pingPong(r.file, video)) step('video', 'done', 'animated loop ready (ping-pong)'); else { video = path.join(dir, 'loop' + path.extname(r.file)); fs.copyFileSync(r.file, video); step('video', 'done', 'animated loop ready (no ffmpeg: plays forward and restarts)'); } }
        catch (e) { video = path.join(dir, 'loop' + path.extname(r.file)); fs.copyFileSync(r.file, video); step('video', 'fallback', 'ping-pong failed, raw clip used: ' + e.message.slice(0, 100)); }
      }
      else if (r.pending) { step('video', 'pending', `job still rendering`); need.push({ what: 'Animated video loop is still rendering', more: '2–5 min', how: 'resume' }); }
      else if (r.skipped) { step('video', 'skipped', r.skipped); need.push({ what: 'Animated video loop', more: r.skipped, how: 'raise the time limit or the spend cap' }); }
      else { step('video', 'failed', r.failed); }
    }
  }

  // 4. write the skin (always: a usable skin is delivered whatever finished)
  const rel = f => f && path.relative(dir, f).replace(/\\/g, '/');
  const visual = plate || video;
  const skin = { id: plan.id, name: plan.name, tagline: visual ? 'skin studio' : 'skin studio · procedural', version: 1, palette,
    scene: visual ? { kind: 'none' } : { kind: plan.mood.scene, colors: [palette.bg, mixHex(palette.bg, palette.accent, 0.3), palette.accent, palette.accent2], body: [0.62, 0.2, 0.3, 1] },
    particles: visual ? { type: 'none', density: 0 } : { ...plan.mood.particles },
    shade: brightness != null ? Math.min(0.6, Math.max(0.15, (brightness - 0.12) * 2.2)) : 0.3 };
  if (visual) {
    skin.plate = { position: '60% 45%', parallax: 0, drift: false };
    if (plate) skin.plate.image = rel(plate);
    if (video) skin.plate.video = rel(video);
    if (thumb && fs.existsSync(path.join(dir, thumb))) skin.thumb = thumb;
  }
  fs.writeFileSync(path.join(dir, 'skin.json'), JSON.stringify(adaptSkin(skin), null, 2));
  step('skin', 'done', `skins/${plan.id}/skin.json`);

  // 5. report
  const used = secs(Date.now() - T0);
  const complete = !need.length;
  const src = plan.videoFile ? 'your video/GIF' : plan.provider + (plan.model ? ' / ' + plan.model : '') + (plan.video ? ` + video ${plan.videoProvider}${plan.videoModel ? ' / ' + plan.videoModel : ''}` : '');
  const lines = [
    `# Skin Studio report: ${plan.name}`, '',
    `**Result:** ${complete ? 'complete' : 'delivered partially. A usable skin is installed now; see "Needs more time" below'}.`,
    `**Time:** ${used}s used of a ${secs(BUDGET)}s cap. **Spend:** ${fmtSpend()} (caps: ${CAPS.credits} credits, $${CAPS.usd}). Costs marked "static table" are estimates, not provider quotes.`,
    `**Source:** ${src}. **Brief:** ${plan.describe || '(no description)'}`, '',
    '| Step | Status | Note |', '|---|---|---|', ...steps.map(s => `| ${s.name} | ${s.status} | ${s.note.replace(/\|/g, '/')} |`), '',
  ];
  if (!complete) {
    lines.push('## Needs more time', '', ...need.map(n => `- **${n.what}**: ${n.more}. Next: ${n.how}.`), '',
      `Resume collects pending jobs without paying for them again:`, '', '```', `node studio/skin-studio.mjs --resume skins/${plan.id} --time 6m${plan.video ? ' --video' : ''} --max-credits ${CAPS.credits} --max-usd ${CAPS.usd}`, '```', '');
  }
  lines.push('Receipts for every provider job are in `receipts.json`. Jobs marked `unknown-or-failed` must be checked in the provider dashboard before any retry.');
  const report = redact(lines.join('\n'));
  fs.writeFileSync(path.join(dir, 'REPORT.md'), report);
  emit('done', { complete, dir, id: plan.id, need, msg: complete ? 'skin ready' : 'partial skin ready; more time needed', report });
}
main().catch(e => { emit('error', { msg: redact(e.message) }); process.exitCode = 1; }).finally(() => { process.stdin.pause?.(); process.stdin.unref?.(); });
