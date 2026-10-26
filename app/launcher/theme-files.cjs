'use strict';
// Shared pack budgets and confined reads. Never decode media just to check existence.
const fs = require('node:fs');
const path = require('node:path');
const MiB = 1024 * 1024;
const LIMITS = Object.freeze({ manifest: MiB, code: 96 * 1024, icon: 8 * 1024, font: 8 * MiB, image: 16 * MiB, video: 32 * MiB, total: 64 * MiB });
function safeRelative(name) {
  return typeof name === 'string' && name.length <= 240 && /^[\w-]+(?:\/[\w.-]+)*\.[a-z0-9]+$/i.test(name) &&
    !name.includes('..') && name.split('/').every(p => !/[. ]$/.test(p) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p));
}
function limitFor(name) {
  if (/\.json$/i.test(name)) return LIMITS.manifest;
  if (/\.js$/i.test(name)) return LIMITS.code;
  if (/\.svg$/i.test(name)) return LIMITS.icon;
  if (/\.(woff2?|ttf|otf)$/i.test(name)) return LIMITS.font;
  if (/\.(png|jpe?g|webp|gif)$/i.test(name)) return LIMITS.image;
  if (/\.(mp4|webm)$/i.test(name)) return LIMITS.video;
  return 0;
}
function checkSize(name, size) {
  const max = limitFor(name);
  if (!max) throw Error(`Unsupported theme file: ${name}`);
  if (size > max) throw Error(`${name}: ${size} bytes exceeds the ${max} byte limit`);
}
function localFile(dir, name) {
  if (!safeRelative(name)) throw Error(`Unsafe theme path: ${name}`);
  let file, base;
  try { base = fs.realpathSync(dir); file = fs.realpathSync(path.join(base, name)); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  const rel = path.relative(base, file);
  if (!rel || rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) throw Error(`Theme file escapes its folder: ${name}`);
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw Error(`Not a theme file: ${name}`);
  checkSize(name, stat.size);
  return file;
}
function readLocal(dir, name, encoding) {
  const file = localFile(dir, name);
  if (!file) return null;
  const data = fs.readFileSync(file);
  checkSize(name, data.length);
  return encoding ? data.toString(encoding) : data;
}
function magicOk(name, data) {
  const ext = path.extname(name).toLowerCase();
  if (!Buffer.isBuffer(data)) return false;
  const at = (offset, value) => data.subarray(offset, offset + value.length).toString('latin1') === value;
  if (ext === '.png') return data.length >= 24 && at(0, '\x89PNG\r\n\x1a\n') && at(12, 'IHDR');
  if (/^\.jpe?g$/.test(ext)) return data.length >= 4 && at(0, '\xff\xd8\xff');
  if (ext === '.webp') return data.length >= 16 && at(0, 'RIFF') && at(8, 'WEBP');
  if (ext === '.gif') return data.length >= 10 && (at(0, 'GIF87a') || at(0, 'GIF89a'));
  if (ext === '.mp4') return data.length >= 16 && at(4, 'ftyp') && data.readUInt32BE(0) >= 16 && data.readUInt32BE(0) <= data.length;
  if (ext === '.webm') return data.length >= 8 && at(0, '\x1a\x45\xdf\xa3');
  if (ext === '.woff2') return data.length >= 48 && at(0, 'wOF2');
  if (ext === '.woff') return data.length >= 44 && at(0, 'wOFF');
  if (ext === '.ttf') return data.length >= 12 && (at(0, '\x00\x01\x00\x00') || at(0, 'true'));
  if (ext === '.otf') return data.length >= 12 && at(0, 'OTTO');
  return false;
}
// mkdir is the reservation: concurrent import/generation can never share an id.
function reserveDir(root, base) {
  fs.mkdirSync(root, { recursive: true });
  base = String(base || 'theme').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'theme';
  for (let n = 1; ; n++) {
    const id = n === 1 ? base : `${base}-${n}`, dir = path.join(root, id);
    try { fs.mkdirSync(dir); return { id, dir }; } catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
}
module.exports = { LIMITS, safeRelative, limitFor, checkSize, localFile, readLocal, magicOk, reserveDir };
