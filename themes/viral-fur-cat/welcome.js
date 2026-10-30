// Fluffy fur letters pop up one by one; a tiny plush paw then pats a letter every few seconds (seeded).
T3Welcome(function (api) {
  var c = api.canvas.getContext('2d'), P = api.palette, S = P.scene, rnd = api.random;
  var text = api.text || 'pat the cat, then build', W, H, fs, glyphs = [], pawC, seed = rnd() * 100, delay = .1 + rnd() * .2;
  var FONT = '900 {s}px "Arial Rounded MT Bold", ui-rounded, "Segoe UI Black", "Segoe UI", sans-serif';
  function off(w, h) { return new OffscreenCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))); }
  function furGlyph(ch) {
    var pad = 9, fnt = FONT.replace('{s}', fs), m = off(1, 1).getContext('2d'); m.font = fnt;
    var cw = m.measureText(ch).width, w = cw + pad * 2, h = fs * 1.35 + pad * 2;
    var mk = off(w, h), mc = mk.getContext('2d'); mc.font = fnt; mc.textBaseline = 'middle'; mc.fillStyle = '#fff'; mc.fillText(ch, pad, h / 2);
    var A = mc.getImageData(0, 0, mk.width, mk.height).data, mw = mk.width;
    function al(x, y) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= mw || y >= mk.height) return 0; return A[(y * mw + x) * 4 + 3]; }
    var g = off(w, h), gc = g.getContext('2d'), grd = gc.createLinearGradient(0, pad, 0, h - pad);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(.6, S[2]); grd.addColorStop(1, api.mix(S[2], S[4], .45));
    gc.font = fnt; gc.textBaseline = 'middle'; gc.fillStyle = grd; gc.shadowColor = api.rgba(S[4], .55); gc.shadowBlur = 9; gc.fillText(ch, pad, h / 2); gc.shadowBlur = 0;
    gc.lineCap = 'round';
    for (var y = 1; y < h - 1; y += 1.7) for (var x = 1; x < w - 1; x += 1.7) {
      var jx = x + (api.hash(x, y) - .5) * 1.6, jy = y + (api.hash(y, x + 3) - .5) * 1.6;
      if (al(jx, jy) < 120) continue;
      var gx = al(jx + 2.5, jy) - al(jx - 2.5, jy), gy = al(jx, jy + 2.5) - al(jx, jy - 2.5), gl = Math.sqrt(gx * gx + gy * gy);
      var r = api.hash(jx * 1.3, jy * .7), nx, ny, len;
      if (gl > 40) { nx = -gx / gl; ny = -gy / gl; len = 3 + r * 4.5; }
      else { var a = 1.25 + (r - .5) * 1.4; nx = Math.cos(a); ny = Math.sin(a); len = 1.6 + r * 1.8; }
      var ja = (api.hash(jy, jx) - .5) * .8, cs = Math.cos(ja), sn = Math.sin(ja), dx = nx * cs - ny * sn, dy = nx * sn + ny * cs;
      gc.strokeStyle = gl > 40 ? api.mix(S[2], '#ffffff', r) : api.mix(S[2], S[3], .25 + r * .35);
      gc.globalAlpha = gl > 40 ? .85 : .35; gc.lineWidth = gl > 40 ? .9 : 1.1;
      gc.beginPath(); gc.moveTo(jx, jy); gc.lineTo(jx + dx * len, jy + dy * len); gc.stroke();
    }
    gc.globalAlpha = 1; gc.globalCompositeOperation = 'source-atop';
    var sh = gc.createLinearGradient(0, h * .35, 0, h - pad); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, api.rgba(S[4], .22));
    gc.fillStyle = sh; gc.fillRect(0, 0, w, h);
    return { c: g, w: w, h: h, cw: cw, pad: pad };
  }
  function makePaw() {
    var s = 30, g = off(s * 2.2, s * 2.4), pc = g.getContext('2d'), cx = s * 1.1, cy = s * 1.25;
    pc.fillStyle = S[2]; pc.beginPath(); pc.ellipse(cx, cy, s * .78, s * .9, 0, 0, 7); pc.fill();
    pc.lineCap = 'round';
    for (var i = 0; i < 160; i++) {
      var a = i / 160 * 6.283, r = api.hash(i, 5), x = cx + Math.cos(a) * s * .74, y = cy + Math.sin(a) * s * .86;
      pc.strokeStyle = api.mix(S[3], S[2], .4 + r * .6); pc.lineWidth = .9;
      pc.beginPath(); pc.moveTo(x, y); pc.lineTo(x + Math.cos(a + (r - .5) * .6) * (3 + r * 4), y + Math.sin(a + (r - .5) * .6) * (3 + r * 4)); pc.stroke();
    }
    pc.fillStyle = S[4];
    pc.beginPath(); pc.ellipse(cx, cy + s * .25, s * .32, s * .25, 0, 0, 7); pc.fill();
    [[-.42, -.18], [-.15, -.46], [.15, -.46], [.42, -.18]].forEach(function (b) { pc.beginPath(); pc.ellipse(cx + b[0] * s, cy + b[1] * s, s * .13, s * .15, 0, 0, 7); pc.fill(); });
    pc.fillStyle = 'rgba(255,255,255,.45)';
    pc.beginPath(); pc.ellipse(cx - s * .1, cy + s * .17, s * .1, s * .06, -.4, 0, 7); pc.fill();
    return g;
  }
  function build() {
    W = api.width; H = api.height;
    var m = off(1, 1).getContext('2d'); fs = 56; m.font = FONT.replace('{s}', fs);
    var tw = m.measureText(text).width; fs = Math.max(24, Math.min(58, Math.floor(fs * W * .86 / tw), H * .4)); m.font = FONT.replace('{s}', fs);
    tw = m.measureText(text).width;
    var x0 = (W - tw) / 2; glyphs = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text[i], x = x0 + m.measureText(text.slice(0, i)).width;
      if (ch === ' ') continue;
      var g = furGlyph(ch); g.x = x; g.i = glyphs.length; glyphs.push(g);
    }
    pawC = makePaw();
  }
  build();
  var cy;
  function easeBack(u) { var k = 1.9; u -= 1; return 1 + u * u * ((k + 1) * u + k); }
  return {
    resize: build,
    frame: function (t) {
      c.clearRect(0, 0, W, H); cy = H * .6;
      var n = glyphs.length, cycle = 3.4, start = delay + n * .06 + .7;
      var ct = t - start, ci = Math.floor(ct / cycle), cp = ct - ci * cycle;
      var target = ct < 0 ? -1 : Math.floor(api.hash(ci + seed, 4.2) * n);
      if (ci === 0) for (var q = 0; q < text.length; q++) if (text.slice(q, q + 3) === 'cat') { target = Math.min(n - 1, text.slice(0, q + 1).replace(/ /g, '').length - 1); break; }
      var impact = .55, squish = (ct >= 0 && cp > impact) ? Math.exp(-(cp - impact) * 6) * Math.sin((cp - impact) * 18 + 1.57) : 0;
      // soft blush glow under the word
      var gl = c.createRadialGradient(W / 2, cy + fs * .3, 4, W / 2, cy + fs * .3, W * .45);
      gl.addColorStop(0, api.rgba(S[4], .16)); gl.addColorStop(1, api.rgba(S[4], 0));
      c.fillStyle = gl; c.fillRect(0, 0, W, H);
      for (var i = 0; i < n; i++) {
        var g = glyphs[i], u = Math.max(0, Math.min(1, (t - delay - i * .06) / .55));
        if (u <= 0) continue;
        var s = easeBack(u), bob = Math.sin(t * 1.6 + i * .55 + seed) * 1.2 * u;
        var sy = 1, sx = 1;
        if (i === target) { sy = 1 - .2 * squish; sx = 1 + .12 * squish; }
        c.save(); c.globalAlpha = Math.min(1, u * 1.6);
        c.translate(g.x + g.cw / 2, cy + fs * .42 + bob + (1 - u) * 16);
        c.scale(s * sx, s * sy);
        c.drawImage(g.c, -g.cw / 2 - g.pad, -g.h / 2 - fs * .42);
        c.restore();
      }
      if (target >= 0) {
        var tg = glyphs[target], top = cy - fs * .55, px = tg.x + tg.cw / 2 + 6, py, rot;
        if (cp < impact) { var e = cp / impact; py = -60 + (top + 6) * e * e + 60 * e * e; rot = -.4 + .3 * e; }
        else if (cp < impact + .5) { var e2 = (cp - impact) / .5; py = top + 6 - e2 * e2 * (top + 90); rot = -.1 - .3 * e2; }
        else py = null;
        if (py !== null) { c.save(); c.translate(px, py); c.rotate(rot + Math.PI); c.drawImage(pawC, -pawC.width / 2, -pawC.height * .55); c.restore(); }
        if (cp > impact && cp < impact + 1.2) {
          var hp = (cp - impact) / 1.2;
          for (var k = 0; k < 2; k++) {
            var hx = px + (k ? 16 : -14) + Math.sin(hp * 6 + k) * 4, hy = top - 6 - hp * 34 - k * 8, hs = (5 + k * 2) * Math.min(1, hp * 5);
            c.globalAlpha = 1 - hp; c.fillStyle = S[4]; c.beginPath();
            c.moveTo(hx, hy + hs * .9); c.bezierCurveTo(hx - hs * 1.6, hy - hs * .2, hx - hs * .6, hy - hs * 1.3, hx, hy - hs * .4);
            c.bezierCurveTo(hx + hs * .6, hy - hs * 1.3, hx + hs * 1.6, hy - hs * .2, hx, hy + hs * .9); c.fill();
          }
          c.globalAlpha = 1;
        }
      }
    }
  };
});
