// Phosphor welcome: a field of random characters that block-wipes into an ASCII wordmark, then a typed
// prompt line with a blinking amber cursor. Wipe direction, noise and glitch rows are seeded per mount.
T3Welcome(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var green = S[1] || P.accent, amber = S[2] || P.accent2, bg = S[0] || P.bg;
  var text = (api.text || 'PHOSPHOR').toUpperCase(), NOISE = '01<>/\\|{}[]#$%&*+=?!~;:', FILL = '#@%&$';
  var FONT = 7, CW, CH, cols, rows, target, reveal, W, H, art = 0.78, fromRight = api.random() < 0.5;
  function layout() {
    W = api.width; H = api.height;
    ctx.font = FONT + 'px Consolas, ui-monospace, monospace'; CW = Math.max(3, ctx.measureText('M').width); CH = FONT + 1;
    cols = Math.floor(W / CW); rows = Math.floor(H * art / CH);
    // rasterise the word into the character grid
    var off = new OffscreenCanvas(cols, rows), o = off.getContext('2d');
    var size = rows * 1.3; o.font = '900 ' + size + 'px "Arial Black", Consolas, monospace';
    while (o.measureText(text).width * (CH / CW) > cols * 0.94 && size > 6) { size -= 1; o.font = '900 ' + size + 'px "Arial Black", Consolas, monospace'; }
    o.setTransform(CH / CW, 0, 0, 1, 0, 0); // cells are taller than wide: stretch the raster so letters keep their shape on screen
    o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#fff'; o.fillText(text, cols / 2 * (CW / CH), rows / 2 + size * 0.04);
    var px = o.getImageData(0, 0, cols, rows).data;
    target = new Uint8Array(cols * rows); reveal = new Float32Array(cols * rows);
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
      var k = y * cols + x; target[k] = px[k * 4 + 3] > 110 ? 1 : 0;
      var fx = fromRight ? 1 - x / cols : x / cols;
      reveal[k] = 0.35 + fx * 0.9 + Math.floor(y / 3) * 0.04 + api.random() * 0.18;
    }
  }
  layout();
  var prompt = '> ready. what shall we build?';
  return {
    resize: layout,
    frame: function (t) {
      ctx.clearRect(0, 0, W, H);
      ctx.font = FONT + 'px Consolas, ui-monospace, monospace'; ctx.textBaseline = 'top';
      var glitchRow = api.hash(Math.floor(t * 2), 3) < 0.25 ? Math.floor(api.hash(Math.floor(t * 2), 9) * rows) : -1;
      ctx.shadowColor = api.rgba(green, 0.6); ctx.shadowBlur = 6;
      for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
        var k = y * cols + x, r = reveal[k], ch, col;
        if (t < r) { // still noise: sparse random characters
          if (api.hash(x * 3 + y, Math.floor(t * 12)) > 0.55) continue;
          ch = NOISE[Math.floor(api.hash(x, y + Math.floor(t * 14)) * NOISE.length)]; col = api.rgba(green, 0.35);
        } else if (target[k]) {
          var fresh = t - r < 0.12;
          ch = fresh ? '█' : FILL[(x + y) % FILL.length]; col = fresh ? '#eaffef' : green;
          if (y === glitchRow) { ch = NOISE[(x * 7) % NOISE.length]; col = amber; }
        } else continue;
        ctx.fillStyle = col; ctx.fillText(ch, x * CW + (y === glitchRow ? 2 : 0), y * CH);
      }
      ctx.shadowBlur = 0;
      // typed prompt + cursor
      var typedAt = 1.6, n = Math.max(0, Math.min(prompt.length, Math.floor((t - typedAt) * 22)));
      var py = rows * CH + 8, line = prompt.slice(0, n);
      ctx.font = '12px Consolas, ui-monospace, monospace'; ctx.fillStyle = api.mix(bg, green, 0.85);
      var lw = ctx.measureText(line).width, lx = (W - ctx.measureText(prompt).width) / 2;
      ctx.fillText(line, lx, py);
      if (t > typedAt - 0.4 && Math.floor(t * 2.2) % 2 === 0) { ctx.fillStyle = amber; ctx.fillRect(lx + lw + 2, py, 7, 13); }
    }
  };
});
