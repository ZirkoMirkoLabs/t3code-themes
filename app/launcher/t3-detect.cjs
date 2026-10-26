'use strict';
// Finds the installed T3 Code app (stable or nightly) and the running T3 server origin.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const exists = p => { try { return fs.existsSync(p); } catch { return false; } };
const isUninstaller = n => /^uninstall/i.test(n);

// -> [{ command, entrypoint|null, channel }] best first (stable before nightly).
function findT3Installs() {
  const found = [];
  const push = (command, resources) => {
    const entry = path.join(resources, 'server.asar', 'apps', 'server', 'dist', 'bin.mjs');
    found.push({ command, entrypoint: entry, channel: /nightly/i.test(command) ? 'nightly' : 'stable' });
  };
  if (process.platform === 'win32') {
    const bases = [process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs'), process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);
    for (const base of bases) {
      let dirs = []; try { dirs = fs.readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory() && /t3/i.test(d.name)); } catch {}
      for (const d of dirs) {
        const dir = path.join(base, d.name);
        let exes = []; try { exes = fs.readdirSync(dir).filter(n => /^t3.*\.exe$/i.test(n) && !isUninstaller(n)); } catch {}
        for (const exe of exes) if (exists(path.join(dir, 'resources', 'server.asar'))) push(path.join(dir, exe), path.join(dir, 'resources'));
      }
    }
  } else if (process.platform === 'darwin') {
    for (const base of ['/Applications', path.join(os.homedir(), 'Applications')]) {
      let apps = []; try { apps = fs.readdirSync(base).filter(n => /^t3.*\.app$/i.test(n)); } catch {}
      for (const a of apps) {
        const macos = path.join(base, a, 'Contents', 'MacOS');
        let bins = []; try { bins = fs.readdirSync(macos); } catch {}
        if (bins[0] && exists(path.join(base, a, 'Contents', 'Resources', 'server.asar'))) push(path.join(macos, bins[0]), path.join(base, a, 'Contents', 'Resources'));
      }
    }
  } else {
    for (const dir of ['/opt/T3 Code', '/opt/t3code', '/usr/lib/t3code', path.join(os.homedir(), '.local', 'share', 't3code')]) {
      let bins = []; try { bins = fs.readdirSync(dir).filter(n => /^t3/i.test(n)); } catch {}
      if (bins[0] && exists(path.join(dir, 'resources', 'server.asar'))) push(path.join(dir, bins[0]), path.join(dir, 'resources'));
    }
  }
  return found.sort((a, b) => (a.channel === 'stable' ? 0 : 1) - (b.channel === 'stable' ? 0 : 1));
}

// Candidate T3 data homes, most likely first.
function t3Homes(explicit) {
  const h = os.homedir();
  return [...new Set([explicit, process.env.T3CODE_HOME, path.join(h, '.t3'), path.join(h, '.t3-nightly'), path.join(h, '.t3code')].filter(Boolean))];
}

// Reads every home's nonsecret server-runtime.json; returns those whose server answers, newest first.
async function findServers(explicitHome, validateOrigin) {
  const hits = [];
  for (const home of t3Homes(explicitHome)) {
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(home, 'userdata', 'server-runtime.json'), 'utf8'));
      hits.push({ home, origin: validateOrigin(meta.origin), startedAt: Date.parse(meta.startedAt) || 0, version: meta.serverVersion || '' });
    } catch {}
  }
  // Fallback: T3's default port, in case the metadata file is somewhere unexpected.
  if (!hits.length) hits.push({ home: explicitHome || path.join(os.homedir(), '.t3'), origin: 'http://127.0.0.1:3773', startedAt: 0, version: '' });
  hits.sort((a, b) => b.startedAt - a.startedAt);
  const live = [];
  for (const hit of hits) {
    try {
      const r = await fetch(hit.origin + '/.well-known/t3/environment', { credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(2500) });
      const d = await r.json();
      if (r.ok && typeof d.environmentId === 'string') live.push({ ...hit, version: d.serverVersion || hit.version });
    } catch {}
  }
  return live;
}

module.exports = { findT3Installs, findServers, t3Homes };
