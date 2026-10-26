// Template "waves": layered scrolling silhouettes under a sky with a sun or moon in free space.
// style "ocean" (rolling swells + glints), "dunes" (desert), "hills", "synth" (striped sun + neon grid floor).
// sceneColors: [skyTop, skyBottom, sun, layer1, layer2, layer3]   params: { style, speed: 0.2-2, layers: 2-5 }
T3Scene(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var style = api.params.style || 'ocean', sp = api.params.speed || 1, nl = Math.max(2, Math.min(5, api.params.layers || 3));
  var top = S[0] || P.bg, bot = S[1] || api.mix(P.bg, P.accent, 0.3), sunC = S[2] || P.accent2;
  var lc = [S[3] || api.mix(P.bg, P.accent, 0.35), S[4] || api.mix(P.bg, P.accent, 0.55), S[5] || api.mix(P.bg, P.accent, 0.75)];
  var W = 0, H = 0, sun = { x: 0, y: 0, r: 40 }, sky = null;
  function layout() { W = api.width; H = api.height; sky = null; var f = api.free(30); if (f.w < 100) f = { x: W * 0.6, y: 0, w: W * 0.4, h: H * 0.6 };
    sun.r = Math.max(28, Math.min(style === 'synth' ? 120 : 70, f.w * 0.22)); sun.x = f.x + f.w * 0.55; sun.y = Math.min(f.y + f.h * 0.35, H * 0.55); }
  function bg() { sky = new OffscreenCanvas(Math.max(1, W >> 1), Math.max(1, H >> 1)); var g = sky.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, H / 2); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, W / 2, H / 2); }
  layout();
  function wave(i, t) {
    var k = i / (nl - 1 || 1), base = H * (style === 'synth' ? 0.62 : 0.55 + k * 0.32), amp = style === 'dunes' ? 36 - k * 10 : style === 'hills' ? 40 - k * 12 : 14 + k * 10;
    var freq = (style === 'dunes' ? 0.004 : 0.008) * (1 + k * 0.6), off = t * sp * (10 + k * 30);
    ctx.beginPath(); ctx.moveTo(0, H);
    for (var x = 0; x <= W + 10; x += 10) { var y = base + Math.sin((x + off) * freq + i * 1.7) * amp + Math.sin((x + off * 1.3) * freq * 2.4 + i) * amp * 0.35;
      if (style === 'dunes') y += Math.abs(Math.sin((x + off) * freq * 0.5 + i)) * -amp * 0.8; ctx.lineTo(x, y); }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = lc[i % lc.length]; ctx.fill();
    if (style === 'ocean') { ctx.fillStyle = api.rgba('#ffffff', 0.18); for (var gx = (t * 40 * sp * (1 + k)) % 60; gx < W; gx += 60) { var gy = base + Math.sin((gx + off) * freq + i * 1.7) * amp; if (api.calm(gx, gy, 30) < 0.5) ctx.fillRect(gx, gy + 4, 14 + k * 10, 1.5); } }
  }
  return {
    resize: layout, zones: layout,
    frame: function (t) {
      if (!sky) bg(); ctx.drawImage(sky, 0, 0, W, H);
      var g = ctx.createRadialGradient(sun.x, sun.y, sun.r * 0.5, sun.x, sun.y, sun.r * 3); g.addColorStop(0, api.rgba(sunC, 0.45)); g.addColorStop(1, api.rgba(sunC, 0)); ctx.fillStyle = g; ctx.fillRect(sun.x - sun.r * 3, sun.y - sun.r * 3, sun.r * 6, sun.r * 6);
      ctx.save(); ctx.beginPath(); ctx.arc(sun.x, sun.y, sun.r, 0, 7); ctx.clip();
      var sg = ctx.createLinearGradient(0, sun.y - sun.r, 0, sun.y + sun.r); sg.addColorStop(0, api.mix(sunC, '#ffffff', 0.3)); sg.addColorStop(1, style === 'synth' ? P.accent : sunC); ctx.fillStyle = sg; ctx.fillRect(sun.x - sun.r, sun.y - sun.r, sun.r * 2, sun.r * 2);
      if (style === 'synth') { ctx.fillStyle = bot; for (var s = 0; s < 7; s++) { var yy = sun.y + sun.r * (0.1 + s * 0.13), hh = 2 + s * 1.4 + ((t * 6 * sp) % 4); ctx.fillRect(sun.x - sun.r, yy, sun.r * 2, hh); } }
      ctx.restore();
      if (style === 'synth') {
        var hz = H * 0.62; ctx.fillStyle = lc[0]; ctx.fillRect(0, hz, W, H - hz); ctx.strokeStyle = api.rgba(P.accent, 0.8); ctx.lineWidth = 1.2;
        for (var r = 0; r < 14; r++) { var z = (r + (t * sp * 1.5) % 1) / 14, y = hz + Math.pow(z, 2.2) * (H - hz); ctx.globalAlpha = 0.2 + z * 0.8; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        for (var c = -20; c <= 20; c++) { ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(W / 2 + c * 30, hz); ctx.lineTo(W / 2 + c * 260, H); ctx.stroke(); }
        ctx.globalAlpha = 1;
      } else for (var i = 0; i < nl; i++) wave(i, t);
    }
  };
});
