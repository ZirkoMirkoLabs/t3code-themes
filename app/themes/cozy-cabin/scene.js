// Cozy Cabin: blue-hour snowy pine forest (2D canvas). Cached sky, dim stars, three mist-faded pine ridges,
// snow ground and a log cabin; animated twinkling stars, flickering amber window glow spilling on the snow,
// curling chimney smoke and snowfall at three depths (faded over text zones).
// sceneColors: [0 sky top, 1 sky horizon, 2 mist, 3 far pines, 4 near pines, 5 snow, 6 window amber, 7 log wood]
T3Scene(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var C = {
    top: S[0] || '#0a1230', hor: S[1] || '#3b5182', mist: S[2] || '#9db2d6', far: S[3] || '#2a3d66',
    near: S[4] || '#0d1729', snow: S[5] || '#e8f0fc', amber: S[6] || '#ffb357', wood: S[7] || '#4b2f23'
  };
  var R = api.random, TAU = Math.PI * 2, PR = api.params || {};
  var W = 1, H = 1, K = 1, base = null, vig = null, stars = [], flakes = [], cab = {};

  function mk(w, h) { return new OffscreenCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))); }

  for (var i = 0; i < (PR.stars || 40); i++) stars.push({ x: R(), y: R() * 0.45, r: 0.6 + R() * 1.2, ph: R() * TAU, f: 0.6 + R() * 1.6 });
  for (var j = 0; j < (PR.snow || 150); j++) { var z = j % 3; flakes.push({ x: R(), y: R(), z: z, r: [0.9, 1.6, 2.8][z], v: [0.018, 0.035, 0.07][z] * (0.8 + R() * 0.4), ph: R() * TAU }); }

  function pine(c, x, y, h, col, sa) {
    var w = h * 0.36;
    c.fillStyle = col; c.fillRect(x - h * 0.025, y - h * 0.1, h * 0.05, h * 0.1);
    for (var i = 0; i < 4; i++) {
      var by = y - h * 0.08 - i * h * 0.2, tw = w * (1 - i * 0.2), th = h * 0.36;
      c.fillStyle = col; c.beginPath(); c.moveTo(x - tw, by); c.quadraticCurveTo(x, by - th * 0.15, x + tw, by); c.lineTo(x, by - th); c.closePath(); c.fill();
      if (sa > 0) {
        c.fillStyle = api.rgba(C.snow, sa); c.beginPath(); c.moveTo(x - tw * 0.72, by - th * 0.26);
        c.quadraticCurveTo(x - tw * 0.3, by - th * 0.16, x, by - th * 0.3); c.quadraticCurveTo(x + tw * 0.3, by - th * 0.18, x + tw * 0.62, by - th * 0.3);
        c.lineTo(x, by - th); c.closePath(); c.fill();
      }
    }
  }

  function buildBase() {
    base = mk(W, H); var b = base.getContext('2d'), hz = H * 0.6;
    var g = b.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, C.top); g.addColorStop(0.65, api.mix(C.top, C.hor, 0.6)); g.addColorStop(1, api.mix(C.hor, C.mist, 0.35));
    b.fillStyle = g; b.fillRect(0, 0, W, H);
    for (var s = 0; s < 120; s++) { b.fillStyle = api.rgba(C.snow, 0.15 + R() * 0.3); b.fillRect(R() * W, R() * hz * 0.7, 1, 1); }
    // three pine ridges, far ones fading into mist
    var ridges = [[hz - 4 * K, 60, 0.55, 0.15], [hz + 22 * K, 95, 0.3, 0.3], [hz + 56 * K, 140, 0.1, 0.5]];
    for (var L = 0; L < 3; L++) {
      var rg = ridges[L], col = api.mix(api.mix(C.far, C.near, L / 2), C.mist, rg[2]);
      b.fillStyle = col; b.fillRect(0, rg[0] - 2, W, H - rg[0]);
      for (var x = -20; x < W + 40; x += (14 + R() * 18) * K * (1 + L * 0.5)) pine(b, x, rg[0] + R() * 8 * K, (rg[1] * (0.6 + R() * 0.6)) * K, col, rg[3]);
      var mg = b.createLinearGradient(0, rg[0] - 60 * K, 0, rg[0] + 10 * K);
      mg.addColorStop(0, api.rgba(C.mist, 0)); mg.addColorStop(1, api.rgba(C.mist, 0.22 - L * 0.06));
      b.fillStyle = mg; b.fillRect(0, rg[0] - 60 * K, W, 70 * K);
    }
    // snow ground: soft rolling drift
    var gy = H * 0.74, sg = b.createLinearGradient(0, gy, 0, H);
    sg.addColorStop(0, api.mix(C.snow, C.hor, 0.45)); sg.addColorStop(1, api.mix(C.snow, C.near, 0.6));
    b.beginPath(); b.moveTo(0, H); b.lineTo(0, gy + 20 * K);
    for (var u = 0; u <= 24; u++) b.lineTo(u / 24 * W, gy + Math.sin(u * 0.7) * 10 * K + Math.sin(u * 0.23) * 14 * K);
    b.lineTo(W, H); b.closePath(); b.fillStyle = sg; b.fill();
    // cabin, placed where text is quietest
    var best = 0.7, bc = 9;
    [0.7, 0.28, 0.5, 0.84].forEach(function (fx) { var c = api.calm(fx * W, H * 0.78, 80); if (c < bc - 0.05) { bc = c; best = fx; } });
    var cw = 170 * K, ch = 80 * K, cx = best * W - cw / 2, cy = H * 0.8 - ch;
    cab = { x: cx, y: cy, w: cw, h: ch, chx: cx + cw * 0.74, chy: cy - ch * 0.78, win: [[cx + cw * 0.2, cy + ch * 0.3], [cx + cw * 0.64, cy + ch * 0.3]] };
    b.fillStyle = api.mix(C.wood, '#000', 0.2); b.fillRect(cx, cy, cw, ch);
    for (var lg = 0; lg < 7; lg++) { b.fillStyle = api.mix(C.wood, lg % 2 ? '#000' : '#a0704a', 0.15); b.fillRect(cx, cy + lg * ch / 7, cw, ch / 7 - 1.5 * K); }
    b.fillStyle = api.mix(C.wood, '#000', 0.45); b.fillRect(cab.chx, cab.chy, 16 * K, ch * 0.75);
    b.fillStyle = api.mix(C.wood, '#000', 0.55); b.beginPath(); b.moveTo(cx - 16 * K, cy + 4 * K); b.lineTo(cx + cw / 2, cy - ch * 0.62); b.lineTo(cx + cw + 16 * K, cy + 4 * K); b.closePath(); b.fill();
    b.fillStyle = C.snow; b.beginPath(); b.moveTo(cx - 20 * K, cy + 2 * K); b.lineTo(cx + cw / 2, cy - ch * 0.7);
    b.lineTo(cx + cw + 20 * K, cy + 2 * K); b.quadraticCurveTo(cx + cw * 0.7, cy - 10 * K, cx + cw / 2, cy - ch * 0.42); b.quadraticCurveTo(cx + cw * 0.3, cy - 10 * K, cx - 20 * K, cy + 2 * K); b.fill();
    b.fillRect(cab.chx - 2 * K, cab.chy - 4 * K, 20 * K, 5 * K);
    b.fillStyle = api.mix(C.wood, '#000', 0.6); b.fillRect(cx + cw * 0.43, cy + ch * 0.42, cw * 0.14, ch * 0.58);
    cab.win.forEach(function (p) {
      b.fillStyle = C.amber; b.fillRect(p[0], p[1], cw * 0.16, ch * 0.34);
      b.fillStyle = api.mix(C.wood, '#000', 0.5); b.fillRect(p[0] + cw * 0.075, p[1], 2 * K, ch * 0.34); b.fillRect(p[0], p[1] + ch * 0.16, cw * 0.16, 2 * K);
      b.fillStyle = C.snow; b.fillRect(p[0] - 3 * K, p[1] + ch * 0.34, cw * 0.16 + 6 * K, 3 * K);
    });
    // foreground pines framing the sides
    pine(b, W * 0.04, H * 1.02, 300 * K, C.near, 0.55); pine(b, W * 0.96, H * 1.04, 340 * K, C.near, 0.55); pine(b, W * 0.12, H * 1.06, 220 * K, C.near, 0.45);
    vig = mk(W, H); var v = vig.getContext('2d');
    var vg = v.createRadialGradient(W * 0.5, H * 0.45, Math.min(W, H) * 0.35, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    v.fillStyle = vg; v.fillRect(0, 0, W, H);
  }
  function layout() { W = api.width; H = api.height; K = Math.max(0.55, Math.min(1.3, Math.min(W, H) / 800)); buildBase(); }
  layout();

  function glow(t) {
    var fl = 0.82 + 0.1 * Math.sin(t * 6.3) * Math.sin(t * 2.7) + 0.08 * Math.sin(t * 11.1);
    ctx.globalCompositeOperation = 'lighter';
    cab.win.forEach(function (p) {
      var x = p[0] + cab.w * 0.08, y = p[1] + cab.h * 0.17, r = 70 * K;
      var g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, api.rgba(C.amber, 0.35 * fl)); g.addColorStop(1, api.rgba(C.amber, 0));
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
    var px = cab.x + cab.w / 2, py = cab.y + cab.h + 18 * K, pr = cab.w * 0.9;
    ctx.save(); ctx.translate(px, py); ctx.scale(1, 0.28);
    var pg = ctx.createRadialGradient(0, 0, 0, 0, 0, pr); pg.addColorStop(0, api.rgba(C.amber, 0.3 * fl)); pg.addColorStop(1, api.rgba(C.amber, 0));
    ctx.fillStyle = pg; ctx.fillRect(-pr, -pr, pr * 2, pr * 2); ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }
  function smoke(t) {
    for (var i = 0; i < 16; i++) {
      var a = (t * 0.07 + i / 16) % 1, x = cab.chx + 8 * K + Math.sin(a * 6 + t * 0.4) * 16 * K * a + a * 60 * K, y = cab.chy - a * 230 * K;
      var r = (5 + a * 30) * K, al = 0.28 * (1 - a) * Math.min(1, a * 10) * (1 - 0.6 * api.calm(x, y, 20));
      var g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, api.rgba(C.mist, al)); g.addColorStop(1, api.rgba(C.mist, 0));
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  function snowfall(t, dt) {
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i]; f.y += f.v * dt; if (f.y > 1.02) { f.y = -0.02; f.x = R(); }
      var x = (f.x + Math.sin(t * 0.5 + f.ph) * 0.012 * (f.z + 1) + 1) % 1 * W, y = f.y * H, r = f.r * K;
      var al = [0.35, 0.55, 0.8][f.z] * (1 - 0.65 * api.calm(x, y, 16));
      ctx.fillStyle = api.rgba(C.snow, al); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
  }

  return {
    resize: layout,
    zones: buildBase,
    frame: function (t, dt) {
      ctx.drawImage(base, 0, 0, W, H);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i], tw = 0.5 + 0.5 * Math.sin(t * s.f + s.ph);
        ctx.fillStyle = api.rgba(C.snow, 0.25 + 0.6 * tw); ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r * K * (0.7 + 0.3 * tw), 0, TAU); ctx.fill();
      }
      smoke(t);
      glow(t);
      snowfall(t, dt || 0);
      ctx.drawImage(vig, 0, 0, W, H);
    }
  };
});
