// Atmos welcome: a restrained title card for hybrid themes. params.style picks the reveal:
// rise (letters rise from a blur, a hairline grows, a light sweep idles), neon (tubes ignite one by one),
// stars (particles gather into the words) or ink (a feathered wipe and a brush stroke). Timing is seeded per mount.
T3Welcome(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, prm = api.params || {}, R = api.random;
  var style = prm.style || 'rise', family = prm.font || '"Segoe UI", system-ui, sans-serif', weight = prm.weight || 300;
  var text = String(api.text || '').slice(0, 256); if (prm.upper) text = text.toUpperCase();
  var W = 0, H = 0, size = 0, sp = 0, cy = 0, x0 = 0, tw = 0, glyphs = [], pts = [], layer = null, lg = null;
  var bend = (R() - 0.5) * 8, ink = prm.color === 'accent' ? P.accent : P.text, acc = P.accent, acc2 = P.accent2;
  function seg(t, a, b) { return Math.max(0, Math.min(1, (t - a) / (b - a))); }
  function ease(x) { return 1 - Math.pow(1 - x, 3); }
  function font() { return weight + ' ' + size + 'px ' + family; }
  function layout() {
    W = api.width; H = api.height; size = typeof prm.size === 'number' && Number.isFinite(prm.size) ? Math.max(8, Math.min(128, prm.size)) : 40;
    for (var tries = 0; tries < 12; tries++) {
      ctx.font = font(); sp = (typeof prm.spacing === 'number' && Number.isFinite(prm.spacing) ? Math.max(0, Math.min(1, prm.spacing)) : 0.08) * size; tw = 0; glyphs = [];
      for (var i = 0; i < text.length; i++) { var w = ctx.measureText(text[i]).width; glyphs.push({ ch: text[i], x: tw, w: w, d: 0, on: 0.3 + R() * 1.3 }); tw += w + (i < text.length - 1 ? sp : 0); }
      if (tw <= W * 0.9) break; size *= 0.9;
    }
    x0 = (W - tw) / 2; cy = H * 0.56;
    glyphs.forEach(function (g, i) { g.d = 0.25 + i * (1.1 / Math.max(6, glyphs.length)) + R() * 0.05; });
    if (style === 'stars' || (style !== 'rise' && style !== 'neon')) {
      var scale = style === 'stars' ? 1 : api.dpr;
      if (!layer) layer = new OffscreenCanvas(2, 2);
      layer.width = Math.max(2, Math.ceil(W * scale)); layer.height = Math.max(2, Math.ceil(H * scale));
      lg = layer.getContext('2d'); lg.setTransform(scale, 0, 0, scale, 0, 0);
      if (style === 'stars') sample();
    }
  }
  function drawText(g2, col) {
    g2.font = font(); g2.textBaseline = 'middle'; g2.fillStyle = col;
    for (var i = 0; i < glyphs.length; i++) g2.fillText(glyphs[i].ch, x0 + glyphs[i].x, cy);
  }
  // stars: sample the rendered words into target points
  function sample() {
    lg.clearRect(0, 0, W, H); drawText(lg, '#fff');
    var sw = layer.width, sh = layer.height, data = lg.getImageData(0, 0, sw, sh).data, step = Math.max(2, Math.round(size / 16)); pts = [];
    for (var y = 0; y < sh; y += step) for (var x = 0; x < sw; x += step) if (data[(y * sw + x) * 4 + 3] > 140) pts.push({ tx: x, ty: y, sx: W * 0.5 + (R() - 0.5) * W * 1.1, sy: H * 0.5 + (R() - 0.5) * H * 1.6, d: R() * 0.7, tw: R() * 6.3 });
    if (pts.length > 900) pts = pts.filter(function (_, i) { return i % Math.ceil(pts.length / 900) === 0; });
    lg.clearRect(0, 0, W, H);
  }
  function halo() { ctx.shadowColor = api.rgba(P.bg, api.light ? 0.5 : 0.75); ctx.shadowBlur = 14; }
  function hairline(t, start) {
    var k = ease(seg(t, start, start + 0.9)); if (!k) return;
    var w = tw * 0.36 * k, y = cy + size * 0.72, g = ctx.createLinearGradient(W / 2 - w, 0, W / 2 + w, 0);
    g.addColorStop(0, api.rgba(acc, 0)); g.addColorStop(0.5, api.rgba(acc, 0.95)); g.addColorStop(1, api.rgba(acc, 0));
    ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(W / 2 - w, y, w * 2, 1.5);
  }
  function sweep(t, start) {
    if (t < start) return;
    var per = 7.5, k = ((t - start) % per) / 1.6; if (k > 1) return;
    var x = x0 - 80 + (tw + 160) * ease(k), g = ctx.createLinearGradient(x - 70, 0, x + 70, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, api.light ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = g; ctx.fillRect(x - 70, 0, 140, H); ctx.restore();
  }
  layout();
  return {
    resize: layout,
    frame: function (t) {
      ctx.clearRect(0, 0, W, H); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.textBaseline = 'middle';
      if (style === 'rise') {
        ctx.font = font(); halo();
        for (var i = 0; i < glyphs.length; i++) {
          var g = glyphs[i], k = ease(seg(t, g.d, g.d + 0.9)); if (!k) continue;
          ctx.globalAlpha = k; ctx.filter = k < 1 ? 'blur(' + ((1 - k) * 6).toFixed(1) + 'px)' : 'none';
          ctx.fillStyle = ink; ctx.fillText(g.ch, x0 + g.x, cy + (1 - k) * 14);
        }
        ctx.filter = 'none'; ctx.globalAlpha = 1;
        var end = glyphs.length ? glyphs[glyphs.length - 1].d + 0.6 : 0.6;
        sweep(t, end + 1.2); hairline(t, end);
      } else if (style === 'neon') {
        ctx.font = font();
        var fill = ctx.createLinearGradient(0, cy - size * 0.5, 0, cy + size * 0.5); fill.addColorStop(0, acc2); fill.addColorStop(1, acc);
        var blink = Math.floor(t * 0.2 + 0.5), who = glyphs.length ? (blink * 7919) % glyphs.length : -1, off = t > 4 && (t * 0.2 + 0.5) % 1 < 0.03;
        for (i = 0; i < glyphs.length; i++) {
          g = glyphs[i];
          var lit = t > g.on + 0.4 ? 1 : t > g.on ? (Math.sin(t * 90 + i * 13) > 0.1 ? 0.9 : 0.15) : 0;
          if (off && i === who) lit = 0.25;
          if (!lit) { ctx.globalAlpha = 0.12; ctx.shadowBlur = 0; ctx.fillStyle = api.rgba(P.text, 0.6); ctx.fillText(g.ch, x0 + g.x, cy); continue; }
          ctx.globalAlpha = lit; ctx.shadowColor = acc; ctx.shadowBlur = 22; ctx.fillStyle = fill; ctx.fillText(g.ch, x0 + g.x, cy);
          ctx.shadowBlur = 6; ctx.fillText(g.ch, x0 + g.x, cy);
        }
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        var on2 = ease(seg(t, 1.9, 2.8));
        if (on2) { var lw = tw * 0.5 * on2, ly = cy + size * 0.75; ctx.shadowColor = acc; ctx.shadowBlur = 12; ctx.fillStyle = acc; ctx.fillRect(W / 2 - lw, ly, lw * 2, 1.5); ctx.shadowBlur = 0; }
      } else if (style === 'stars') {
        var solid = ease(seg(t, 2.1, 3.0));
        for (i = 0; i < pts.length; i++) {
          var p = pts[i], k2 = ease(seg(t, 0.15 + p.d, 1.5 + p.d)), x = p.sx + (p.tx - p.sx) * k2, y = p.sy + (p.ty - p.sy) * k2;
          var a = (0.25 + 0.75 * k2) * (1 - solid * 0.75) * (0.7 + 0.3 * Math.sin(t * 3 + p.tw));
          ctx.globalAlpha = a; ctx.fillStyle = i % 9 ? '#ffffff' : acc; ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
        }
        if (solid) { ctx.globalAlpha = solid; halo(); drawText(ctx, ink); ctx.shadowBlur = 0; }
        ctx.globalAlpha = 1; sweep(t, 4.2); hairline(t, 2.6);
      } else { // ink
        lg.clearRect(0, 0, W, H); lg.globalCompositeOperation = 'source-over'; drawText(lg, ink);
        var k3 = ease(seg(t, 0.3, 2.2)), edge = x0 - 60 + (tw + 120) * k3, mg = lg.createLinearGradient(edge - 60, 0, edge, 0);
        mg.addColorStop(0, 'rgba(0,0,0,1)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
        lg.globalCompositeOperation = 'destination-in'; lg.fillStyle = mg; lg.fillRect(0, 0, W, H); lg.globalCompositeOperation = 'source-over';
        halo(); ctx.drawImage(layer, 0, 0, W, H); ctx.shadowBlur = 0;
        var b = ease(seg(t, 1.8, 2.9));
        if (b) {
          var bx = W / 2 - tw * 0.3, bw = tw * 0.6, by = cy + size * 0.74;
          ctx.fillStyle = acc; ctx.globalAlpha = 0.9; ctx.beginPath();
          for (var s = 0; s <= 24; s++) { var u = s / 24 * b; ctx.lineTo(bx + bw * u, by + Math.sin(u * Math.PI) * bend - Math.sin(u * Math.PI) * 2.2); }
          for (s = 24; s >= 0; s--) { u = s / 24 * b; ctx.lineTo(bx + bw * u, by + Math.sin(u * Math.PI) * bend + Math.sin(u * Math.PI) * 1.2); }
          ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
        }
      }
    }
  };
});
