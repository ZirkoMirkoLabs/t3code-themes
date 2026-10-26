'use strict';
// .t3skin = a zip of skin.json plus the media it references. Export leaves out plan/receipts/report
// (they hold local paths, prompts and job ids). Import rebuilds skin.json from a whitelist so a shared
// pack cannot inject CSS, scripts or remote URLs into the T3 page.
const fs = require('node:fs');
const path = require('node:path');
const { writeZip, readZip } = require('./zip.cjs');
const Files = require('./theme-files.cjs');

const MEDIA = /\.(png|jpe?g|webp|gif|mp4|webm)$/i;
const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const ID = /^[a-z0-9][a-z0-9-]{0,47}$/;
const str = (v, max = 80) => typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').slice(0, max) : undefined;
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined;
const color = v => typeof v === 'string' && COLOR.test(v) ? v : undefined;
const file = v => typeof v === 'string' && /^[\w.-]+(\/[\w.-]+)?$/.test(v) && !v.includes('..') && MEDIA.test(v) ? v : undefined;
const clean = o => JSON.parse(JSON.stringify(o)); // drops undefined

function sanitize(skin) {
  if (!skin || typeof skin !== 'object') throw Error('skin.json is not an object');
  const p = skin.palette || {};
  const palette = {};
  for (const k of ['bg', 'surface', 'text', 'muted', 'accent', 'accent2', 'border', 'selection', 'codeBg', 'codeText']) palette[k] = color(p[k]);
  if (!palette.bg || !palette.accent) throw Error('skin.json needs palette.bg and palette.accent colours');
  const sc = skin.scene || {};
  const out = {
    name: str(skin.name, 40) || 'Imported skin', tagline: str(skin.tagline, 60), version: 1, palette,
    scene: { kind: ['none', 'nebula', 'aurora', 'dusk', 'synth', 'abyss'].includes(sc.kind) ? sc.kind : 'none',
      colors: Array.isArray(sc.colors) ? sc.colors.map(color).filter(Boolean).slice(0, 6) : undefined,
      body: Array.isArray(sc.body) ? sc.body.map(v => num(v, -10, 10)).filter(v => v != null).slice(0, 4) : undefined,
      stars: num(sc.stars, 0, 5) },
    particles: skin.particles ? { type: ['stars', 'petals', 'fireflies', 'embers', 'bubbles', 'snow', 'dust', 'none'].includes(skin.particles.type) ? skin.particles.type : 'dust',
      density: num(skin.particles.density, 0, 1), color: color(skin.particles.color), color2: color(skin.particles.color2),
      shooting: typeof skin.particles.shooting === 'boolean' ? skin.particles.shooting : undefined } : undefined,
    shade: num(skin.shade, 0, 1),
    thumb: file(skin.thumb),
  };
  if (skin.plate) {
    const pl = skin.plate;
    out.plate = { image: file(pl.image), video: file(pl.video), position: typeof pl.position === 'string' && /^\d{1,3}% \d{1,3}%$/.test(pl.position) ? pl.position : undefined,
      parallax: num(pl.parallax, 0, 3), opacity: num(pl.opacity, 0, 1), drift: typeof pl.drift === 'boolean' ? pl.drift : undefined,
      blend: ['normal', 'screen', 'lighten', 'overlay', 'soft-light'].includes(pl.blend) ? pl.blend : undefined };
    if (!out.plate.image && !out.plate.video) delete out.plate;
  }
  return require('./skin-ui.cjs').adaptSkin(clean(out));
}

function exportSkin(skinDir) {
  const skin = sanitize(JSON.parse(Files.readLocal(skinDir, 'skin.json', 'utf8')));
  const entries = [];
  for (const f of new Set([skin.thumb, skin.plate?.image, skin.plate?.video].filter(Boolean))) {
    const data = Files.readLocal(skinDir, f);
    if (!data || !Files.magicOk(f, data)) { dropBinary(skin, f, 'plate'); continue; }
    entries.push({ name: f, data });
  }
  entries.unshift({ name: 'skin.json', data: Buffer.from(JSON.stringify({ ...skin, format: 't3skin/1' }, null, 2)) });
  checkTotal(entries);
  return writeZip(entries);
}

// Returns the new skin id. Never overwrites an existing skin.
function importSkin(buf, skinsRoot) {
  const entries = readZip(buf);
  const manifest = entries.find(e => e.name === 'skin.json' || /^[^/]+\/skin\.json$/.test(e.name));
  if (!manifest) throw Error('This .t3skin has no skin.json');
  const prefix = manifest.name.slice(0, -'skin.json'.length);
  Files.checkSize('skin.json', manifest.data.length);
  const raw = JSON.parse(manifest.data.toString('utf8'));
  const skin = sanitize(raw);
  const { id, dir } = Files.reserveDir(skinsRoot, str(raw.id, 48) || skin.name);
  const wanted = new Set([skin.thumb, skin.plate?.image, skin.plate?.video].filter(Boolean));
  try {
    for (const e of entries) {
      const rel = e.name.slice(prefix.length);
      if (!e.name.startsWith(prefix) || !wanted.has(rel)) continue; // only files skin.json references
      Files.checkSize(rel, e.data.length);
      if (!Files.magicOk(rel, e.data)) continue;
      const dest = path.resolve(dir, rel);
      if (path.relative(dir, dest).startsWith('..')) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, e.data);
    }
    for (const f of wanted) if (!fs.existsSync(path.join(dir, f))) {
      if (f === skin.thumb) delete skin.thumb; else if (skin.plate) { if (skin.plate.image === f) delete skin.plate.image; if (skin.plate.video === f) delete skin.plate.video; }
    }
    if (skin.plate && !skin.plate.image && !skin.plate.video) delete skin.plate;
    skin.id = id;
    fs.writeFileSync(path.join(dir, 'skin.json'), JSON.stringify(skin, null, 2));
  } catch (err) { fs.rmSync(dir, { recursive: true, force: true }); throw err; }
  return { id, name: skin.name };
}

/* ---------- code themes (t3theme/1) ---------- */
// A theme .t3skin holds theme.json + the files it references: scene/welcome code, SVG icons, fonts, thumbnail.
// Import re-validates everything with theme-validate.cjs (code syntax, banned APIs, SVG whitelist, contrast) and
// writes only referenced files; the code then runs only inside the sandbox, never in the T3 page.
function checkTotal(entries) {
  let total = 0;
  for (const entry of entries) { Files.checkSize(entry.name, entry.data.length); total += entry.data.length; }
  if (total > Files.LIMITS.total) throw Error('Theme assets exceed the 64 MiB pack budget');
}
function dropBinary(theme, file, field = 'backdrop') {
  if (theme.thumb === file) delete theme.thumb;
  if (theme[field]) { for (const key of ['image', 'video']) if (theme[field][key] === file) delete theme[field][key]; if (!theme[field].image && !theme[field].video) delete theme[field]; }
  if (theme.fonts) theme.fonts.files = theme.fonts.files.filter(f => f.file !== file);
}
function packManifest(entries, file) {
  const matches = entries.filter(e => e.name === file || (e.name.endsWith('/' + file) && e.name.split('/').length === 2));
  if (matches.length !== 1) throw Error(`This .t3skin needs exactly one ${file}`);
  Files.checkSize(file, matches[0].data.length);
  return matches[0];
}
function packContents(result, readBinary) {
  const V = require('./theme-validate.cjs'), theme = V.manifestOf(result), entries = [];
  // Materialize code and icons from the validator, never from the raw manifest.
  for (const kind of ['scene', 'welcome']) if (result.code[kind]) {
    theme[kind] = { ...theme[kind], file: `${kind}.js`, template: undefined };
    entries.push({ name: `${kind}.js`, data: Buffer.from(result.code[kind]) });
  }
  for (const [name, svg] of Object.entries(result.icons)) entries.push({ name: `icons/${name}.svg`, data: Buffer.from(svg) });
  const binary = new Set([theme.thumb, theme.backdrop?.image, theme.backdrop?.video, ...theme.fonts.files.map(f => f.file)].filter(Boolean));
  for (const name of binary) {
    const data = readBinary(name);
    if (data) Files.checkSize(name, data.length);
    if (!data || !Files.magicOk(name, data)) { dropBinary(theme, name); continue; }
    entries.push({ name, data });
  }
  delete theme.prompt;
  entries.unshift({ name: 'theme.json', data: Buffer.from(JSON.stringify(theme, null, 2)) });
  checkTotal(entries);
  return { theme, entries };
}
function isThemePack(buf) { return readZip(buf, { metadataOnly: true }).some(e => e.name === 'theme.json' || /^[^/]+\/theme\.json$/.test(e.name)); }
function exportTheme(dir) {
  const V = require('./theme-validate.cjs'), Lib = require('./theme-library.cjs');
  const r = V.loadTheme(dir, { templates: Lib.templates });
  if (!r.ok) throw Error('Cannot export invalid theme: ' + r.report.errors.join('; '));
  if (!r.theme.thumb) for (const f of ['thumb.png', 'thumb.jpg']) if (Files.localFile(dir, f)) { r.theme.thumb = f; break; }
  return writeZip(packContents(r, name => Files.readLocal(dir, name)).entries);
}
function importTheme(buf, themesRoot) {
  const V = require('./theme-validate.cjs'), Lib = require('./theme-library.cjs');
  const entries = readZip(buf), manifest = packManifest(entries, 'theme.json');
  const prefix = manifest.name.slice(0, -'theme.json'.length);
  const byName = new Map(entries.filter(e => e.name.startsWith(prefix)).map(e => [e.name.slice(prefix.length), e.data]));
  const raw = JSON.parse(manifest.data.toString('utf8'));
  const read = name => { const data = byName.get(name); if (data) Files.checkSize(name, data.length); return data?.toString('utf8') ?? null; };
  const r = V.validateTheme(raw, read, { templates: Lib.templates, checkFiles: false });
  if (!r.ok) throw Error('This theme did not pass the safety and legibility checks: ' + r.report.errors.slice(0, 3).join('; '));
  const pack = packContents(r, name => byName.get(name));
  const { id, dir } = Files.reserveDir(themesRoot, r.theme.id);
  try {
    for (const { name, data } of pack.entries) {
      if (name === 'theme.json') continue;
      const dest = path.join(dir, name); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, data);
    }
    // Publish last. No partial theme is visible to the library.
    fs.writeFileSync(path.join(dir, 'theme.json'), JSON.stringify({ ...pack.theme, id }, null, 2), { flag: 'wx' });
  } catch (err) { fs.rmSync(dir, { recursive: true, force: true }); throw err; }
  return { id, name: r.theme.name };
}

module.exports = { exportSkin, importSkin, sanitize, exportTheme, importTheme, isThemePack };
