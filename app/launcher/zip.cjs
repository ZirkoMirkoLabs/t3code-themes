'use strict';
// Minimal zip writer/reader for .t3skin packs (deflate + store, no zip64). No dependencies.
const zlib = require('node:zlib');
const { LIMITS } = require('./theme-files.cjs');

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }

// entries: [{ name, data: Buffer }] -> Buffer
function writeZip(entries) {
  const locals = [], centrals = []; let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    // Already compressed assets gain little and otherwise stall the main process.
    const deflated = /\.(png|jpe?g|webp|gif|mp4|webm|woff2?)$/i.test(name) ? data : zlib.deflateRawSync(data, { level: 6 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(useDeflate ? 8 : 0, 10);
    central.writeUInt32LE(0, 12); central.writeUInt32LE(crc, 16); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, body); centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

// Buffer -> [{ name, data }]. Uses the central directory, so data descriptors are fine.
function readZip(buf, { maxTotal = LIMITS.total, maxEntries = 64, metadataOnly = false } = {}) {
  const corrupt = detail => { throw Error('Corrupt zip: ' + detail); };
  if (!Buffer.isBuffer(buf) || buf.length < 22) throw Error('Not a zip file');
  const range = (start, size, end = buf.length) => Number.isSafeInteger(start) && Number.isSafeInteger(size) && start >= 0 && size >= 0 && start + size <= end;
  let e = buf.length - 22;
  const earliest = Math.max(0, e - 65535);
  for (; e >= earliest; e--) if (buf.readUInt32LE(e) === 0x06054b50 && range(e, 22) && e + 22 + buf.readUInt16LE(e + 20) === buf.length) break;
  if (e < earliest) throw Error('Not a zip file (end record missing)');
  if (buf.readUInt16LE(e + 4) || buf.readUInt16LE(e + 6)) throw Error('Multi-disk zip packs are unsupported');
  const count = buf.readUInt16LE(e + 10), cdSize = buf.readUInt32LE(e + 12), cdStart = buf.readUInt32LE(e + 16);
  if (count === 65535 || cdSize === 0xffffffff || cdStart === 0xffffffff) throw Error('ZIP64 packs are unsupported');
  if (count !== buf.readUInt16LE(e + 8)) corrupt('entry counts differ');
  if (count > maxEntries) throw Error('Too many files in the pack');
  if (!range(cdStart, cdSize, e) || cdStart + cdSize !== e) corrupt('directory bounds');
  const out = [], seen = new Set(), spans = []; let total = 0, p = cdStart;
  for (let i = 0; i < count; i++) {
    if (!range(p, 46, e) || buf.readUInt32LE(p) !== 0x02014b50) corrupt('directory entry');
    const flags = buf.readUInt16LE(p + 8), method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24), nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    if (flags & ~0x080e || flags & 1) throw Error('Encrypted or unsupported zip flags');
    if (![0, 8].includes(method)) throw Error('Unsupported zip compression');
    if ([csize, usize, lo].includes(0xffffffff) || buf.readUInt16LE(p + 34)) throw Error('ZIP64 or multi-disk entries are unsupported');
    if (!nlen || !range(p + 46, nlen + xlen + clen, e)) corrupt('entry name/extra bounds');
    const nameBytes = buf.subarray(p + 46, p + 46 + nlen), name = nameBytes.toString('utf8');
    p += 46 + nlen + xlen + clen;
    const parts = name.replace(/\/$/, '').split('/');
    if (name.length > 240 || /[\\:\x00-\x1f\ufffd]/.test(name) || parts.some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw Error('Unsafe zip path: ' + name);
    const folded = name.toLowerCase();
    if (seen.has(folded)) throw Error('Duplicate zip entry: ' + name);
    seen.add(folded);
    total += usize;
    if (total > maxTotal || csize > maxTotal || (method === 0 && csize !== usize)) throw Error('Pack is too large or has inconsistent sizes');
    if (!range(lo, 30, cdStart) || buf.readUInt32LE(lo) !== 0x04034b50) corrupt('local header for ' + name);
    const ln = buf.readUInt16LE(lo + 26), lx = buf.readUInt16LE(lo + 28), start = lo + 30 + ln + lx;
    if (!range(lo + 30, ln + lx, cdStart) || !range(start, csize, cdStart)) corrupt('file bounds for ' + name);
    if (buf.readUInt16LE(lo + 6) !== flags || buf.readUInt16LE(lo + 8) !== method || !buf.subarray(lo + 30, lo + 30 + ln).equals(nameBytes)) corrupt('local/central header mismatch for ' + name);
    if (!(flags & 8) && (buf.readUInt32LE(lo + 14) !== crc || buf.readUInt32LE(lo + 18) !== csize || buf.readUInt32LE(lo + 22) !== usize)) corrupt('local/central sizes or checksum mismatch for ' + name);
    if (spans.some(([a, b]) => lo < b && start + csize > a)) corrupt('overlapping file entries');
    spans.push([lo, start + csize]);
    if (name.endsWith('/')) { if (usize || csize) corrupt('nonempty directory'); continue; }
    let data;
    if (!metadataOnly) {
      const body = buf.subarray(start, start + csize);
      try { data = method === 0 ? Buffer.from(body) : zlib.inflateRawSync(body, { maxOutputLength: Math.max(1, usize) }); }
      catch { corrupt('invalid or oversized compressed data for ' + name); }
      if (data.length !== usize) corrupt('uncompressed size mismatch for ' + name);
      if (crc32(data) !== crc) corrupt('checksum mismatch for ' + name);
    }
    out.push({ name, data });
  }
  if (p !== cdStart + cdSize) corrupt('directory size mismatch');
  return out;
}

module.exports = { writeZip, readZip };
