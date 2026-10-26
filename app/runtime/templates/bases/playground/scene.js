// Playground: a small 2D physics sandbox. Blobs fall under gravity, collide, and treat every measured UI zone
// (sidebar, top bar, composer, message lane, welcome text) as a solid box, so they rest on top of the
// composer and never sit behind text. Drag a blob to fling it; click empty space to drop a new one.
T3Scene(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var cols = S.slice(0, 6).length ? S.slice(0, 6) : [P.accent, P.accent2, '#ffd166', '#06d6a0', '#ef476f', '#8a5cf6'];
  var ink = S[6] || P.text, paper = S[7] || '#efe4d2';
  var G = api.params.gravity || 1100, E = api.params.bounce == null ? 0.45 : api.params.bounce, N = api.params.count || 34;
  var W = api.width, H = api.height, balls = [], boxes = [], grid = null;
  var ptr = { x: -999, y: -999, down: false, over: true, vx: 0, vy: 0, lx: 0, ly: 0 }, held = null, downAt = 0, downPos = null;
  function makeBall(x, y) {
    var r = 13 + Math.pow(api.random(), 1.6) * 24, shape = api.random() < 0.3 ? 'square' : 'round';
    return { x: x, y: y, px: x, py: y, r: r, c: cols[Math.floor(api.random() * cols.length)], shape: shape, rot: api.random() * 6, blink: api.random() * 5 };
  }
  function setBoxes() { boxes = api.zones.map(function (z) { return { x: z.x, y: z.y, w: z.w, h: z.h }; }); grid = null; }
  function spawnAll() {
    balls = [];
    // Drop toys only in clear vertical columns (beside the sidebar / message lane), never above text.
    var clear = [];
    for (var x = 30; x < W - 30; x += 12) { var ok = true; for (var y = 70; y < H - 40 && ok; y += 36) if (api.calm(x, y, 34) > 0) ok = false; if (ok) clear.push(x); }
    var f = api.free(10);
    for (var i = 0; i < N; i++) {
      var bx = clear.length ? clear[Math.floor(api.random() * clear.length)] : f.x + api.random() * f.w;
      var b = makeBall(bx, 90 + api.random() * H * 0.55); b.px = b.x; b.py = b.y; balls.push(b);
    }
    for (var s = 0; s < 240; s++) step(1 / 60); // pre-settle so the first (and the still) frame looks natural
  }
  function pushOut(b, x, y, w, h) {
    var cx = Math.max(x, Math.min(b.x, x + w)), cy = Math.max(y, Math.min(b.y, y + h));
    var dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy;
    if (d2 >= b.r * b.r) return;
    if (d2 > 1e-6) { var d = Math.sqrt(d2), k = (b.r - d) / d; b.x += dx * k; b.y += dy * k; }
    else { // centre is inside the box: leave by the nearest edge
      var l = b.x - x, r = x + w - b.x, t = b.y - y, bt = y + h - b.y, m = Math.min(l, r, t, bt);
      if (m === t) b.y = y - b.r; else if (m === bt) b.y = y + h + b.r; else if (m === l) b.x = x - b.r; else b.x = x + w + b.r;
    }
  }
  function step(dt) {
    var i, j, b;
    for (i = 0; i < balls.length; i++) { // verlet integration
      b = balls[i]; if (b === held) continue;
      var vx = (b.x - b.px) * 0.995, vy = (b.y - b.py) * 0.995;
      b.px = b.x; b.py = b.y; b.x += vx; b.y += vy + G * dt * dt; b.rot += vx * 0.02;
    }
    if (held) { held.px = held.x; held.py = held.y; held.x += (ptr.x - held.x) * 0.5; held.y += (ptr.y - held.y) * 0.5; }
    for (var it = 0; it < 3; it++) {
      for (i = 0; i < balls.length; i++) for (j = i + 1; j < balls.length; j++) {
        var a = balls[i], c = balls[j], dx = c.x - a.x, dy = c.y - a.y, rr = a.r + c.r, d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 1e-6) { var d = Math.sqrt(d2), o = (rr - d) / d * 0.5; a.x -= dx * o; a.y -= dy * o; c.x += dx * o; c.y += dy * o; }
      }
      for (i = 0; i < balls.length; i++) {
        b = balls[i];
        for (j = 0; j < boxes.length; j++) pushOut(b, boxes[j].x, boxes[j].y, boxes[j].w, boxes[j].h);
        if (b.x < b.r) { b.x = b.r; b.px = b.x + (b.x - b.px) * E; }
        if (b.x > W - b.r) { b.x = W - b.r; b.px = b.x + (b.x - b.px) * E; }
        if (b.y > H - b.r) { b.y = H - b.r; b.py = b.y + (b.y - b.py) * E; b.px += (b.x - b.px) * 0.08; }
      }
    }
  }
  function paperGrid() {
    grid = new OffscreenCanvas(Math.max(1, Math.round(W)), Math.max(1, Math.round(H)));
    var g = grid.getContext('2d'); g.fillStyle = P.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = api.rgba(paper, 1);
    for (var y = 16; y < H; y += 28) for (var x = 16; x < W; x += 28) if (api.calm(x, y, 30) < 0.5) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
  }
  function drawBall(b, t) {
    ctx.save(); ctx.translate(b.x, b.y);
    var vx = b.x - b.px, vy = b.y - b.py, sp = Math.min(0.18, Math.sqrt(vx * vx + vy * vy) * 0.02);
    ctx.rotate(Math.atan2(vy, vx)); ctx.scale(1 + sp, 1 - sp); ctx.rotate(-Math.atan2(vy, vx));
    ctx.fillStyle = 'rgba(27,27,47,.12)'; ctx.beginPath(); ctx.ellipse(3, b.r * 0.9, b.r * 0.8, b.r * 0.25, 0, 0, 7); ctx.fill();
    ctx.rotate(b.shape === 'square' ? b.rot : 0);
    ctx.beginPath(); if (b.shape === 'square') ctx.roundRect(-b.r * 0.9, -b.r * 0.9, b.r * 1.8, b.r * 1.8, b.r * 0.35); else ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.fillStyle = b.c; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = ink; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-b.r * 0.35, -b.r * 0.42, b.r * 0.32, b.r * 0.18, -0.5, 0, 7); ctx.fill();
    ctx.rotate(b.shape === 'square' ? -b.rot : 0);
    // googly eyes that look at the pointer
    var lx = ptr.x - b.x, ly = ptr.y - b.y, ll = Math.sqrt(lx * lx + ly * ly) || 1, ex = lx / ll * b.r * 0.08, ey = ly / ll * b.r * 0.08;
    var blink = ((t + b.blink) % 5) < 0.12;
    [-1, 1].forEach(function (s) {
      var x = s * b.r * 0.32, y = -b.r * 0.1;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y, b.r * 0.22, blink ? b.r * 0.04 : b.r * 0.26, 0, 0, 7); ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
      if (!blink) { ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x + ex * 1.4, y + ey * 1.4, b.r * 0.11, 0, 7); ctx.fill(); }
    });
    ctx.restore();
  }
  setBoxes(); spawnAll();
  return {
    resize: function () { W = api.width; H = api.height; grid = null; },
    zones: function () { setBoxes(); },
    pointer: function (e) {
      ptr.vx = e.x - ptr.lx; ptr.vy = e.y - ptr.ly; ptr.lx = e.x; ptr.ly = e.y; ptr.x = e.x; ptr.y = e.y; ptr.over = e.overUI;
      if (e.kind === 'down' && !e.overUI) {
        downAt = api.t; downPos = { x: e.x, y: e.y };
        var best = null, bd = 1e9;
        balls.forEach(function (b) { var dx = b.x - e.x, dy = b.y - e.y, d = dx * dx + dy * dy; if (d < (b.r + 10) * (b.r + 10) && d < bd) { bd = d; best = b; } });
        held = best;
      } else if (e.kind === 'up') {
        if (held) { held.px = held.x - ptr.vx * 0.9; held.py = held.y - ptr.vy * 0.9; held = null; }
        else if (downPos && !e.overUI && api.t - downAt < 0.4 && Math.abs(e.x - downPos.x) + Math.abs(e.y - downPos.y) < 8) {
          var nb = makeBall(e.x, e.y); nb.py = nb.y + 4; balls.push(nb); if (balls.length > 70) balls.shift();
        }
        downPos = null;
      } else if (e.kind === 'move' && !held && !e.overUI) { // a gentle nudge when the pointer passes through
        balls.forEach(function (b) { var dx = b.x - e.x, dy = b.y - e.y, d2 = dx * dx + dy * dy; if (d2 < 3600 && d2 > 1) { var k = (60 - Math.sqrt(d2)) * 0.015; b.x += dx * k / Math.sqrt(d2) * 2; b.y += dy * k / Math.sqrt(d2) * 2; } });
      }
    },
    frame: function (t, dt) {
      if (dt > 0) { var n = Math.max(1, Math.round(dt * 60)); for (var k = 0; k < Math.min(n, 4); k++) step(1 / 60); }
      if (!grid) paperGrid();
      ctx.drawImage(grid, 0, 0, W, H);
      for (var i = 0; i < balls.length; i++) drawBall(balls[i], t);
    }
  };
});
