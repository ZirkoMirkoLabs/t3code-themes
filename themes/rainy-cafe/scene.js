// Rainy Café: a pastel dusk seen through a café window. Out-of-focus lights drift and breathe, raindrops
// cling to the glass and some slide down leaving trails. Move the pointer near a drop to set it sliding.
// Light and low-contrast by design; drops and lights fade inside text zones.
T3Scene(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var top = S[0] || '#cdb9e6', mid = S[1] || '#f6c9b9', low = S[2] || '#fbeee6';
  var lightCols = [S[3] || '#ffd9a8', S[4] || '#f7a8c0', S[5] || '#b8dccd', S[6] || '#c7c6f4', P.accent2];
  var W = 0, H = 0, bokeh = [], drops = [], sliders = [], sprites = {}, sky = null;
  var nB = api.params.bokeh || 26, nD = api.params.drops || 90, nS = api.params.sliders || 12;
  function sprite(col) { // soft disc rendered once per colour
    if (sprites[col]) return sprites[col];
    var c = new OffscreenCanvas(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, api.rgba(col, 0.9)); gr.addColorStop(0.55, api.rgba(col, 0.55)); gr.addColorStop(0.8, api.rgba(col, 0.25)); gr.addColorStop(1, api.rgba(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return (sprites[col] = c);
  }
  function layout() {
    W = api.width; H = api.height; sky = null;
    bokeh = []; for (var i = 0; i < nB; i++) bokeh.push({ x: api.random() * W, y: H * (0.35 + api.random() * 0.6), r: 24 + api.random() * 70, c: lightCols[i % lightCols.length], ph: api.random() * 6, v: 2 + api.random() * 5 });
    drops = []; for (var j = 0; j < nD; j++) drops.push(newDrop(api.random() * H));
    sliders = []; for (var k = 0; k < nS; k++) sliders.push(newSlider(true));
  }
  function newDrop(y) { return { x: api.random() * W, y: y, r: 1.2 + Math.pow(api.random(), 3) * 4.5 }; }
  function newSlider(initial) { return { x: api.random() * W, y: initial ? api.random() * H : -10, r: 2.5 + api.random() * 3, v: 0, wait: api.random() * 3, trail: [] }; }
  function bg() {
    sky = new OffscreenCanvas(Math.max(1, Math.round(W / 2)), Math.max(1, Math.round(H / 2)));
    var g = sky.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, H / 2);
    gr.addColorStop(0, top); gr.addColorStop(0.55, mid); gr.addColorStop(1, low); g.fillStyle = gr; g.fillRect(0, 0, W / 2, H / 2);
    // distant rooftops, very soft
    g.fillStyle = api.rgba(api.mix(top, '#7a6a8a', 0.4), 0.25);
    var x = 0; g.beginPath(); g.moveTo(0, H / 2);
    while (x < W / 2) { var bw = 20 + api.random() * 50, bh = 30 + api.random() * 90; g.lineTo(x, H / 2 - bh); g.lineTo(x + bw, H / 2 - bh); x += bw; }
    g.lineTo(W / 2, H / 2); g.closePath(); g.filter = 'blur(3px)'; g.fill(); g.filter = 'none';
  }
  function drawDrop(x, y, r, a) {
    if (a < 0.04) return;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.15, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(90,60,80,.18)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.35, r * 0.85, r * 0.7, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.4, Math.max(0.6, r * 0.28), 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  layout();
  var px = -999, py = -999;
  return {
    resize: layout,
    pointer: function (e) {
      if (e.kind !== 'move' || e.overUI) return; px = e.x; py = e.y;
      drops.forEach(function (d) { var dx = d.x - px, dy = d.y - py; if (dx * dx + dy * dy < 900 && d.r > 2) { sliders.push({ x: d.x, y: d.y, r: d.r, v: 30, wait: 0, trail: [] }); d.y = -50; } });
      if (sliders.length > 40) sliders.splice(0, sliders.length - 40);
    },
    frame: function (t, dt) {
      if (!sky) bg();
      ctx.drawImage(sky, 0, 0, W, H);
      // bokeh city lights (behind the glass, out of focus)
      ctx.globalCompositeOperation = 'lighter';
      bokeh.forEach(function (b) {
        b.x += b.v * dt; if (b.x - b.r > W) b.x = -b.r;
        var a = (0.35 + 0.25 * Math.sin(t * 0.6 + b.ph)) * (1 - 0.75 * api.calm(b.x, b.y, 80));
        ctx.globalAlpha = a; ctx.drawImage(sprite(b.c), b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
      });
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      // misted lower glass
      var fog = ctx.createLinearGradient(0, H * 0.55, 0, H); fog.addColorStop(0, 'rgba(255,250,246,0)'); fog.addColorStop(1, 'rgba(255,250,246,.45)');
      ctx.fillStyle = fog; ctx.fillRect(0, H * 0.55, W, H * 0.45);
      // window mullions
      ctx.fillStyle = api.rgba(low, 0.55); ctx.fillRect(W * 0.62, 0, 6, H); ctx.fillRect(0, H * 0.38, W, 5);
      // static drops on the glass
      drops.forEach(function (d) { drawDrop(d.x, d.y, d.r, 0.9 * (1 - 0.85 * api.calm(d.x, d.y, 50))); });
      // sliding drops: stick, then run down in a wobbly line, leaving a fading trail
      for (var i = sliders.length - 1; i >= 0; i--) {
        var s = sliders[i];
        if (s.wait > 0) s.wait -= dt; else { s.v = Math.min(140, s.v + 60 * dt); s.y += s.v * dt; s.x += Math.sin(s.y * 0.05 + i) * 0.3; if (api.random() < dt * 0.6) { s.wait = 0.2 + api.random() * 0.8; s.v = 0; } }
        s.trail.push(s.x, s.y); if (s.trail.length > 60) s.trail.splice(0, 2);
        var a = 1 - 0.85 * api.calm(s.x, s.y, 50);
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 * a) + ')'; ctx.lineWidth = s.r * 0.7; ctx.lineCap = 'round'; ctx.beginPath();
        for (var k = 0; k < s.trail.length; k += 2) { if (k) ctx.lineTo(s.trail[k], s.trail[k + 1]); else ctx.moveTo(s.trail[k], s.trail[k + 1]); }
        ctx.stroke();
        drawDrop(s.x, s.y, s.r, a);
        if (s.y > H + 20) { if (sliders.length > nS) sliders.splice(i, 1); else sliders[i] = newSlider(false); }
      }
      drops.forEach(function (d) { if (d.y < -20 && api.random() < dt * 0.3) { var n = newDrop(api.random() * H); d.x = n.x; d.y = n.y; d.r = n.r; } });
    }
  };
});
