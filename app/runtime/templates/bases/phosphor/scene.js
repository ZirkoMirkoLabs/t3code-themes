// Phosphor: an ASCII terminal backdrop. A slow noise field of characters, sparse "rain" columns, and the
// classic spinning ASCII donut placed in the largest free area. Characters near the pointer scramble.
// Everything fades out inside text zones (api.calm), so only empty space carries detail.
T3Scene(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var bg = S[0] || P.bg, green = S[1] || P.accent, amber = S[2] || P.accent2;
  var FONT = 13, CW = 8, CH = 14, cols = 0, rows = 0, calm = null, W = 0, H = 0;
  var RAMP = ' .:-=+*#%@', NOISE = '01<>/\\|{}[]#$%&*+=?!~;:', DON = '.,-~:;=!*#$@';
  var shades = [0.18, 0.32, 0.5, 0.75].map(function (k) { return api.mix(bg, green, k); });
  var rain = [], donut = null, px = -999, py = -999, nRain = api.params.rain == null ? 14 : api.params.rain;
  function layout() {
    W = api.width; H = api.height;
    ctx.font = FONT + 'px Consolas, "Cascadia Mono", ui-monospace, monospace';
    CW = Math.max(6, ctx.measureText('M').width); CH = FONT + 2;
    cols = Math.ceil(W / CW); rows = Math.ceil(H / CH);
    calm = new Float32Array(cols * rows);
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) calm[y * cols + x] = api.calm(x * CW + CW / 2, y * CH + CH / 2, 70);
    var f = api.free(16), dw = Math.min(64, Math.floor(f.w / CW) - 2);
    donut = api.params.donut !== false && dw >= 22 ? { w: dw, h: Math.floor(dw * 0.46), x: Math.floor((f.x + f.w / 2) / CW - dw / 2), y: Math.floor((f.y + Math.min(f.h * 0.45, f.h - dw * 0.3 * CH / 1)) / CH - dw * 0.23) } : null;
    if (donut) donut.y = Math.max(Math.floor(f.y / CH) + 1, donut.y);
    rain = [];
    for (var i = 0; i < nRain; i++) rain.push(newDrop(true));
  }
  function newDrop(initial) {
    for (var tries = 0; tries < 20; tries++) {
      var c = Math.floor(api.random() * cols);
      if (calm[Math.min(rows - 1, 4) * cols + c] < 0.2 && calm[Math.floor(rows / 2) * cols + c] < 0.2) return { c: c, y: initial ? api.random() * rows : -2, v: 6 + api.random() * 10, len: 6 + Math.floor(api.random() * 12), seed: api.random() * 99 };
    }
    return { c: Math.floor(api.random() * cols), y: -2, v: 8, len: 8, seed: 1 };
  }
  layout();
  function renderDonut(t) {
    var dw = donut.w, dh = donut.h, n = dw * dh, z = new Float32Array(n), b = new Uint8Array(n);
    var A = t * 0.9, B = t * 0.45, cA = Math.cos(A), sA = Math.sin(A), cB = Math.cos(B), sB = Math.sin(B);
    for (var j = 0; j < 6.283; j += 0.07) {
      var ct = Math.cos(j), st = Math.sin(j);
      for (var i = 0; i < 6.283; i += 0.02) {
        var sp = Math.sin(i), cp = Math.cos(i), h = ct + 2, D = 1 / (sp * h * sA + st * cA + 5), tt = sp * h * cA - st * sA;
        var x = Math.floor(dw / 2 + dw * 0.375 * D * (cp * h * cB - tt * sB)), y = Math.floor(dh / 2 + dh * 0.68 * D * (cp * h * sB + tt * cB));
        var o = x + dw * y, N = Math.floor(8 * ((st * sA - sp * ct * cA) * cB - sp * ct * sA - st * cA - cp * ct * sB));
        if (y >= 0 && y < dh && x >= 0 && x < dw && D > z[o]) { z[o] = D; b[o] = (N > 0 ? N : 0) + 1; }
      }
    }
    return b;
  }
  function frame(t, dt) {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.font = FONT + 'px Consolas, "Cascadia Mono", ui-monospace, monospace'; ctx.textBaseline = 'top';
    var buckets = [[], [], [], []], hot = [];
    // noise field
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
      var k = y * cols + x, c = calm[k]; if (c > 0.97) continue;
      var v = api.noise(x * 0.055 + t * 0.12, y * 0.11 - t * 0.07) * api.noise(x * 0.021 - t * 0.03, y * 0.04 + 7);
      v = Math.pow(v * 1.9, 2.2) * (1 - c);
      var idx = Math.min(RAMP.length - 1, Math.floor(v * (RAMP.length - 1))); if (idx <= 0) continue;
      var dx = x * CW - px, dy = y * CH - py;
      if (dx * dx + dy * dy < 5000 && c < 0.3) { hot.push(x, y); continue; }
      buckets[Math.min(3, Math.floor(v * 3.2))].push(x, y, idx);
    }
    for (var bI = 0; bI < 4; bI++) { ctx.fillStyle = shades[bI]; var L = buckets[bI]; for (var q = 0; q < L.length; q += 3) ctx.fillText(RAMP[L[q + 2]], L[q] * CW, L[q + 1] * CH); }
    // rain columns
    rain.forEach(function (d, i) {
      d.y += d.v * (dt || 0);
      for (var s = 0; s < d.len; s++) {
        var ry = Math.floor(d.y) - s; if (ry < 0 || ry >= rows) continue;
        var cc = calm[ry * cols + d.c]; if (cc > 0.5) continue;
        var ch = NOISE[Math.floor(api.hash(d.c + s, Math.floor(t * 8 + d.seed)) * NOISE.length)];
        ctx.fillStyle = s === 0 ? '#d9ffe2' : api.rgba(green, (1 - s / d.len) * 0.75 * (1 - cc));
        ctx.fillText(ch, d.c * CW, ry * CH);
      }
      if (d.y - d.len > rows) rain[i] = newDrop(false);
    });
    // pointer scramble (amber)
    ctx.fillStyle = amber;
    for (var hI = 0; hI < hot.length; hI += 2) ctx.fillText(NOISE[Math.floor(api.random() * NOISE.length)], hot[hI] * CW, hot[hI + 1] * CH);
    // the donut
    if (donut) {
      var buf = renderDonut(t);
      ctx.fillStyle = bg; ctx.fillRect(donut.x * CW, donut.y * CH, donut.w * CW, donut.h * CH);
      for (var dy2 = 0; dy2 < donut.h; dy2++) for (var dx2 = 0; dx2 < donut.w; dx2++) {
        var g = buf[dy2 * donut.w + dx2]; if (!g) continue;
        var gx = donut.x + dx2, gy = donut.y + dy2; if (gx < 0 || gy < 0 || gx >= cols || gy >= rows || calm[gy * cols + gx] > 0.6) continue;
        ctx.fillStyle = g > 8 ? '#ffe4a3' : api.mix(bg, amber, 0.35 + g / 12 * 0.65);
        ctx.fillText(DON[g - 1], gx * CW, gy * CH);
      }
    }
    // CRT falloff at the edges
    var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }
  return {
    frame: frame, resize: layout, zones: layout,
    pointer: function (e) { if (e.kind === 'move') { px = e.overUI ? -999 : e.x; py = e.overUI ? -999 : e.y; } }
  };
});
