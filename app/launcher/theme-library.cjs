'use strict';
// Loads every theme pack under themes/ into page-ready items (validated, code inlined, icons sanitised).
// Shared by the launcher, the playground server and the generator.
const fs = require('node:fs');
const path = require('node:path');
const { loadTheme } = require('./theme-validate.cjs');

const root = path.resolve(__dirname, '..');
const themesRoot = path.join(root, 'themes');
const templatesRoot = path.join(root, 'runtime', 'templates');
// Legacy: early code-only themes kept for compatibility, listed only under Themes > Library > Legacy.
const LEGACY = [];
const basesRoot = path.join(templatesRoot, 'bases');
const BASES = ['toon-town', 'event-horizon', 'phosphor', 'rainy-cafe', 'playground'];
const BUILT_IN = ['cozy-room', 'rooftop-dusk', 'koi-pond', 'lantern-sky', 'great-wave', 'cozy-cabin', 'ridgeline', 'meadow-breeze', 'frutiger-aero', 'blue-tide', 'silk-flow'];

// Templates: runtime/templates/<name>.<kind>.js, or the scene/welcome of a built-in theme by id.
function templates(name, kind) {
  const file = path.join(templatesRoot, `${name}.${kind}.js`);
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  if (BUILT_IN.includes(name)) { const f = path.join(themesRoot, name, `${kind}.js`); if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8'); }
  if (BASES.includes(name)) { const f = path.join(basesRoot, name, `${kind}.js`); if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8'); }
  return null;
}
function listTemplates() {
  const out = { scene: [...BUILT_IN, ...BASES], welcome: [...BUILT_IN, ...BASES] };
  try { for (const f of fs.readdirSync(templatesRoot)) { const m = /^([a-z0-9-]+)\.(scene|welcome)\.js$/.exec(f); if (m) out[m[2]].push(m[1]); } } catch {}
  return out;
}
function toItem(dir) {
  const r = loadTheme(dir, { templates, binaryExists: f => fs.existsSync(path.join(dir, f)) });
  if (!r.ok) return { error: r.report.errors.join('; ') };
  const id = path.basename(dir);
  const thumb = r.theme.thumb || (fs.existsSync(path.join(dir, 'thumb.png')) ? 'thumb.png' : fs.existsSync(path.join(dir, 'thumb.jpg')) ? 'thumb.jpg' : undefined);
  r.theme.id = id;
  const builtIn = !r.theme.generated && (BUILT_IN.includes(id) || LEGACY.includes(id));
  return { item: { kind: 'theme', id, thumb, builtIn, legacy: LEGACY.includes(id), theme: r.theme, code: r.code, icons: r.icons, report: { selfCheck: r.report.selfCheck, fixes: r.report.fixes, warnings: r.report.warnings } }, report: r.report };
}
function loadAllThemes(dir = themesRoot) {
  const items = [], problems = [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return { items, problems }; }
  for (const d of entries) {
    if (!d.isDirectory() || !fs.existsSync(path.join(dir, d.name, 'theme.json'))) continue;
    try { const r = toItem(path.join(dir, d.name)); if (r.item) items.push(r.item); else problems.push({ id: d.name, error: r.error }); }
    catch (e) { problems.push({ id: d.name, error: String(e.message || e) }); }
  }
  const order = id => { const i = BUILT_IN.indexOf(id); return i < 0 ? 99 : i; };
  items.sort((a, b) => (b.theme.generated ? 1 : 0) - (a.theme.generated ? 1 : 0) || order(a.id) - order(b.id) || a.id.localeCompare(b.id));
  return { items, problems };
}

module.exports = { root, themesRoot, templatesRoot, basesRoot, BASES, BUILT_IN, LEGACY, templates, listTemplates, toItem, loadAllThemes };
