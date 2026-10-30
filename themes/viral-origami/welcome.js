// Midnight Fold welcome: every letter rises out of a flat washi strip, one crease at a time
// (four accordion panels per glyph, faceted like the source's pyramid tiles), then a small crane drifts over the line.
T3Welcome(function (api) {
  var c = api.canvas.getContext('2d'), P = api.palette, S = P.scene;
  var COLS = [S[0], '#4f7dff', S[2], '#22c08f'], W = 1, H = 1, glyphs = [], size = 40, base = 0, total = 0;
  var delay = .15 + api.random() * .2, shift = (api.random() * 4) | 0, jit = [], BANDS = 4;
  function build() {
    var text = api.text || 'fold your idea into shape', rows = [text];
    if (text.length > 16) { var mid = text.length / 2, best = -1; for (var q = 0; q < text.length; q++) if (text[q] === ' ' && (best < 0 || Math.abs(q - mid) < Math.abs(best - mid))) best = q; if (best > 0) rows = [text.slice(0, best), text.slice(best + 1)]; }
    var longest = Math.max.apply(null, rows.map(function (r) { return r.length; }));
    size = Math.max(20, Math.min(64, W / (longest * .56), H / (rows.length * 1.25)));
    c.font = '600 ' + size + 'px Bahnschrift, "Segoe UI", sans-serif';
    glyphs = []; jit = []; var gh = Math.ceil(size * 1.05), idx = 0;
    total = c.measureText(rows[0]).width; base = H / 2 - (rows.length - 1) * size * .62 + size * .36;
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r], rw = c.measureText(row).width, x = (W - rw) / 2, rb = base + r * size * 1.24;
      for (var i = 0; i < row.length; i++, idx++) {
        var ch = row[i], w = c.measureText(ch).width; jit.push(api.random() * .12);
        if (ch === ' ') { glyphs.push(null); x += w; continue; }
        var gw = Math.ceil(w + 4), cv = new OffscreenCanvas(gw, gh), g = cv.getContext('2d'), col = COLS[(idx + shift) % 4];
        g.font = c.font; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff'; g.fillText(ch, 2, gh - size * .2);
        g.globalCompositeOperation = 'source-atop';
        var gr = g.createLinearGradient(0, 0, gw, gh); gr.addColorStop(0, api.mix(col, '#ffffff', .22)); gr.addColorStop(1, api.mix(col, '#0a0e2a', .18));
        g.fillStyle = gr; g.fillRect(0, 0, gw, gh);
        // faceted tiles: each cell splits into four shaded triangles
        var cs = Math.max(6, size / 5);
        for (var yy = 0; yy < gh; yy += cs) for (var xx = 0; xx < gw; xx += cs) {
          var mx = xx + cs / 2, my = yy + cs / 2, tri = [[xx, yy, xx + cs, yy, 'rgba(255,255,255,.16)'], [xx + cs, yy, xx + cs, yy + cs, 'rgba(0,0,30,.12)'], [xx + cs, yy + cs, xx, yy + cs, 'rgba(0,0,30,.22)'], [xx, yy + cs, xx, yy, 'rgba(255,255,255,.05)']];
          for (var k = 0; k < 4; k++) { g.beginPath(); g.moveTo(mx, my); g.lineTo(tri[k][0], tri[k][1]); g.lineTo(tri[k][2], tri[k][3]); g.closePath(); g.fillStyle = tri[k][4]; g.fill(); }
        }
        glyphs.push({ cv: cv, x: x, w: gw, h: gh, col: col, b: rb }); x += w;
      }
    }
  }
  function resize() { W = api.width; H = api.height; build(); }
  resize();
  function crane(x, y, s, ph) {
    var f = Math.sin(ph) * .8;
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = api.mix(S[0], '#ffffff', .1); c.beginPath(); c.moveTo(-14, -6); c.lineTo(-3, 3); c.lineTo(6, 3); c.lineTo(15, -9); c.lineTo(17, -6); c.lineTo(8, 6); c.lineTo(-4, 6); c.closePath(); c.fill();
    c.fillStyle = api.mix(S[0], '#ffffff', .45); c.beginPath(); c.moveTo(-3, 3); c.lineTo(-2 - f * 4, -14 * f - 2); c.lineTo(6, 3); c.closePath(); c.fill();
    c.restore();
  }
  return {
    resize: resize,
    frame: function (t) {
      c.clearRect(0, 0, W, H);
      for (var i = 0; i < glyphs.length; i++) {
        var gl = glyphs[i]; if (!gl) continue;
        var t0 = delay + i * .07 + jit[i], hb = gl.h / BANDS, y = gl.b, sway = t > 3.5 ? Math.sin(t * 1.2 + i * .5) * .5 : 0;
        // the flat strip lying on the table before it folds up
        var lay = Math.min(1, Math.max(0, (t - t0 + .25) / .25));
        if (lay > 0) {
          c.globalAlpha = lay; c.fillStyle = api.mix(gl.col, '#05071a', .35);
          c.beginPath(); c.moveTo(gl.x - 3, y + 2); c.lineTo(gl.x + gl.w * lay - 3, y + 2); c.lineTo(gl.x + gl.w * lay + 4, y + 7); c.lineTo(gl.x + 4, y + 7); c.closePath(); c.fill();
        }
        for (var k = 0; k < BANDS; k++) {
          var p = Math.min(1, Math.max(0, (t - t0 - k * .13) / .34)); if (p <= 0) break;
          var e = 1 - Math.pow(1 - p, 3), ang = (1 - e) * Math.PI / 2, ph = hb * Math.cos(ang) + sway * (k % 2 ? -1 : 1) * .6;
          var sy = gl.h - (k + 1) * hb;
          c.globalAlpha = 1;
          c.drawImage(gl.cv, 0, sy, gl.w, hb, gl.x + (1 - e) * (k % 2 ? 3 : -3), y - ph, gl.w, ph + .5);
          // crease shading: valley folds dark, mountain folds catch moonlight
          var sh = Math.sin(ang) * .55 + .06;
          c.globalAlpha = sh; c.globalCompositeOperation = 'source-atop';
          c.fillStyle = k % 2 ? 'rgba(4,6,26,1)' : 'rgba(200,215,255,.5)'; c.fillRect(gl.x, y - ph, gl.w, ph + .5);
          c.globalCompositeOperation = 'source-over';
          if (k > 0) { c.globalAlpha = .35 * e; c.fillStyle = '#e8ecff'; c.fillRect(gl.x + 1, y - .5, gl.w - 3, .8); }
          y -= ph;
        }
      }
      c.globalAlpha = 1;
      // idle: a small crane glides along the top of the line, wings beating
      var ti = t - (delay + glyphs.length * .07 + .9);
      if (ti > 0) {
        var u = (ti * .09) % 1.2 - .1, cx = (W - total) / 2 + u * total, cy = Math.max(16, base - size * .92 - Math.sin(u * 6) * 5);
        c.globalAlpha = Math.min(1, ti) * Math.max(0, Math.min(1, (1.1 - u) * 5, (u + .1) * 5));
        crane(cx, cy, Math.max(.9, size / 34), t * 7); c.globalAlpha = 1;
      }
    }
  };
});
