'use strict';
// Provider API keys, encrypted with Electron safeStorage (DPAPI on Windows, Keychain on macOS,
// libsecret/kwallet on Linux) inside the launcher profile. Keys leave this module only as env vars
// for the Studio child process; the renderer only ever sees a masked hint.
const fs = require('node:fs');
const path = require('node:path');
const { safeStorage } = require('electron');

// One credential per account; several routes can share it (Google key -> Gemini/Imagen + Veo).
const ENV = {
  openai: ['OPENAI_API_KEY'], google: ['GEMINI_API_KEY'], replicate: ['REPLICATE_API_TOKEN'], fal: ['FAL_KEY'],
  magnific: ['MAGNIFIC_API_KEY'], higgsfield: ['HIGGSFIELD_API_KEY'], anthropic: ['ANTHROPIC_API_KEY'],
  comfyui: ['COMFYUI_URL'], a1111: ['A1111_URL'],
};
const PLAIN = new Set(['comfyui', 'a1111']); // local URLs, not secrets

function createKeystore(profileDir) {
  const file = path.join(profileDir, 'provider-keys.json');
  const read = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } };
  const write = o => { fs.mkdirSync(profileDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(o, null, 2), { mode: 0o600 }); };
  const decrypt = rec => { try { return rec.plain != null ? rec.plain : safeStorage.decryptString(Buffer.from(rec.enc, 'base64')); } catch { return null; } };
  const mask = v => !v ? '' : v.length <= 8 ? '••••' : v.slice(0, Math.min(3, v.length - 6)) + '••••••' + v.slice(-4);
  return {
    available: () => safeStorage.isEncryptionAvailable(),
    set(id, value) {
      if (!ENV[id]) throw Error('Unknown provider');
      value = String(value || '').trim();
      const all = read();
      if (!value) { delete all[id]; write(all); return; }
      if (value.length > 4096 || /[\r\n]/.test(value)) throw Error('That does not look like a key');
      if (PLAIN.has(id)) all[id] = { plain: value, at: new Date().toISOString() };
      else {
        if (!safeStorage.isEncryptionAvailable()) throw Error('This system has no secure key storage (on Linux install gnome-keyring or kwallet). Set the env var instead: ' + ENV[id][0]);
        all[id] = { enc: safeStorage.encryptString(value).toString('base64'), at: new Date().toISOString() };
      }
      write(all);
    },
    get(id) { const r = read()[id]; return r ? decrypt(r) : null; },
    // For the renderer: never the key itself.
    summary() {
      const all = read(), out = {};
      for (const id of Object.keys(ENV)) {
        const v = all[id] ? decrypt(all[id]) : null;
        const fromEnv = !v && ENV[id].some(n => process.env[n]);
        out[id] = { saved: !!v, hint: PLAIN.has(id) ? (v || '') : mask(v), fromEnv, env: ENV[id][0] };
      }
      return out;
    },
    // Env for the child: saved keys override inherited env vars of the same name.
    env() {
      const all = read(), env = {};
      for (const [id, names] of Object.entries(ENV)) { const v = all[id] ? decrypt(all[id]) : null; if (v) for (const n of names) env[n] = v; }
      return env;
    },
    // Every secret value, so logs and stderr can be scrubbed.
    secrets() {
      const all = read(), vals = [];
      for (const id of Object.keys(ENV)) if (!PLAIN.has(id)) { const v = all[id] ? decrypt(all[id]) : process.env[ENV[id][0]]; if (v && v.length >= 6) vals.push(v); }
      return vals;
    },
  };
}
function redact(text, secrets) { let t = String(text); for (const s of secrets) t = t.split(s).join('••••'); return t; }

module.exports = { createKeystore, redact, ENV };
