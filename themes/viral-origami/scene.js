// Midnight Fold: a night sky full of faceted washi cranes and paper boats (adapted from webgl-viral/origami-name).
// sceneColors: [0] vermilion, [1] cobalt, [2] saffron, [3] jade, [4] sky top, [5] sky low, [6] moonlight, [7] paper-white highlight.
// Pointer: the flock steers around it and flaps faster. Click: a square of paper folds itself into a crane (~1.5 s) and joins the flock.
T3Scene(function (api) {
  var c = api.canvas.getContext('2d'), P = api.palette, S = P.scene;
  var W = 1, H = 1, F = 900, sky = null, fibre = null, fibrePat = null;
  var WASHI = [S[0], S[1], S[2], S[3]].map(api.rgb), MOON = api.rgb(S[6]), HI = api.rgb(S[7]), SKY = api.rgb(S[5]);
  var LX = -0.38, LY = 0.78, LZ = -0.5, ll = Math.sqrt(LX * LX + LY * LY + LZ * LZ); LX /= ll; LY /= ll; LZ /= ll;
  var ptr = { x: -9999, y: -9999, on: false }, flock = [], folders = [];

  // ---- models (local: x forward, y up, z side) ----
  var CV = new Float32Array(18 * 3);
  var CT = [0,4,6, 0,5,6, 1,4,8, 1,5,8, 6,7,15, 6,7,16, 0,2,4, 1,2,4, 0,3,4, 1,3,4, 0,2,5, 1,2,5, 0,3,5, 1,3,5,
    9,10,11, 11,12,10, 9,11,12, 9,10,13, 13,14,10, 9,13,14];
  var BV = new Float32Array([-1,0,.32, 1,0,.32, .62,-.44,0, -.62,-.44,0, -1,0,-.32, 1,0,-.32, 0,.95,0, -.55,0,.06, .55,0,.06, -.55,0,-.06, .55,0,-.06, -1.3,.14,0, 1.3,.14,0]);
  var BT = [0,1,5, 0,5,4, 0,1,2, 0,2,3, 4,5,2, 4,2,3, 11,0,3, 11,4,3, 12,1,2, 12,5,2, 7,8,6, 9,10,6];
  function setV(i, x, y, z) { CV[i * 3] = x; CV[i * 3 + 1] = y; CV[i * 3 + 2] = z; }
  function craneVerts(ph) {
    var s1 = Math.sin(ph), s2 = Math.sin(ph - 0.7), y1 = 0.06 + 0.5 * s1, y2 = 0.06 + 1.15 * s2;
    var z1 = 0.64 * Math.cos(0.7 * s1), z2 = 1.38 * Math.cos(0.75 * s2);
    setV(0, .36, 0, 0); setV(1, -.36, 0, 0); setV(2, 0, .13, 0); setV(3, 0, -.24, 0); setV(4, 0, -.03, .15); setV(5, 0, -.03, -.15);
    setV(6, .98, .64, 0); setV(7, 1.2, .42, 0); setV(8, -1.04, .58, 0); setV(9, .24, .05, 0); setV(10, -.3, .05, 0);
    setV(11, -.02, y1, z1); setV(12, -.24, y2, z2); setV(13, -.02, y1, -z1); setV(14, -.24, y2, -z2);
    setV(15, .99, .52, .06); setV(16, .99, .52, -.06); setV(17, 0, 0, 0);
  }

  // ---- projection + triangle emitter ----
  var PV = new Float32Array(20 * 3), tri = [], triPool = [];
  function project(src, n, e, sc) {
    // rotate: yaw (y), roll (x), pitch (z); then place at e.X,e.Y,e.Z
    var cy = Math.cos(e.yaw), sy = Math.sin(e.yaw), cr = Math.cos(e.roll), sr = Math.sin(e.roll), cp = Math.cos(e.pitch), sp = Math.sin(e.pitch);
    for (var i = 0; i < n; i++) {
      var x = src[i * 3] * sc, y = src[i * 3 + 1] * sc, z = src[i * 3 + 2] * sc, t;
      t = x * cp - y * sp; y = x * sp + y * cp; x = t;          // pitch
      t = y * cr - z * sr; z = y * sr + z * cr; y = t;          // roll
      t = x * cy + z * sy; z = -x * sy + z * cy; x = t;         // yaw
      PV[i * 3] = x + e.X; PV[i * 3 + 1] = y + e.Y; PV[i * 3 + 2] = z + e.Z;
    }
  }
  function emit(idx, from, to, col, fog, alpha, crease, washi, inside) {
    var list = [];
    for (var k = from; k < to; k += 3) {
      var a = idx[k] * 3, b = idx[k + 1] * 3, d = idx[k + 2] * 3;
      var ax = PV[a], ay = PV[a + 1], az = PV[a + 2], bx = PV[b] - ax, by = PV[b + 1] - ay, bz = PV[b + 2] - az, dx = PV[d] - ax, dy = PV[d + 1] - ay, dz = PV[d + 2] - az;
      var nx = by * dz - bz * dy, ny = bz * dx - bx * dz, nz = bx * dy - by * dx, nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      var back = (nx * ax + ny * ay + nz * az) > 0; if (back) { nx = -nx; ny = -ny; nz = -nz; }
      var lam = Math.max(0, nx * LX + ny * LY + nz * LZ), br = 0.46 + 0.8 * lam, sh = 1 - lam;
      var r = col[0] * br, g = col[1] * br, bl = col[2] * br;
      if (back) { r *= .78; g *= .8; bl *= .9; }
      if (inside && k < inside) { r *= .45; g *= .45; bl *= .55; }
      r += (MOON[0] - r) * .1 * sh; g += (MOON[1] - g) * .1 * sh; bl += (MOON[2] - bl) * .1 * sh;
      if (lam > .8) { var hk = (lam - .8) * 1.2; r += (HI[0] - r) * hk; g += (HI[1] - g) * hk; bl += (HI[2] - bl) * hk; }
      r += (SKY[0] - r) * fog; g += (SKY[1] - g) * fog; bl += (SKY[2] - bl) * fog;
      var z0 = PV[a + 2], z1 = PV[b + 2], z2 = PV[d + 2];
      if (z0 < .3 || z1 < .3 || z2 < .3) continue;
      var o = triPool.pop() || { p: new Float32Array(6) };
      o.p[0] = W / 2 + ax * F / z0; o.p[1] = H / 2 - ay * F / z0;
      o.p[2] = W / 2 + PV[b] * F / z1; o.p[3] = H / 2 - PV[b + 1] * F / z1;
      o.p[4] = W / 2 + PV[d] * F / z2; o.p[5] = H / 2 - PV[d + 1] * F / z2;
      o.z = z0 + z1 + z2; o.col = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (bl | 0) + ')';
      o.a = alpha; o.cr = crease; o.w = washi; list.push(o);
    }
    list.sort(function (p, q) { return q.z - p.z; });
    for (var j = 0; j < list.length; j++) tri.push(list[j]);
  }
  function flush(pat) {
    for (var i = 0; i < tri.length; i++) {
      var o = tri[i], p = o.p;
      c.globalAlpha = o.a; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[2], p[3]); c.lineTo(p[4], p[5]); c.closePath();
      c.fillStyle = o.col; c.fill();
      if (o.w && pat) { c.globalAlpha = o.a * .5; c.fillStyle = pat; c.fill(); }
      if (o.cr > 0) { c.globalAlpha = o.a * o.cr; c.stroke(); }
      triPool.push(o);
    }
    tri.length = 0; c.globalAlpha = 1;
  }

  // ---- flock ----
  function mk(kind, z, u, v) {
    return { kind: kind, z: z, u: u, v: v, vu: 0, vv: 0, col: WASHI[(api.random() * 4) | 0], ph: api.random() * 6.28,
      rate: 5 + api.random() * 3, yaw: (api.random() - .5) * .7, roll: 0, pitch: 0, bob: api.random() * 6.28, boost: 0, spin: api.random() * 6.28, born: 0 };
  }
  function populate() {
    flock.length = 0;
    // three giants glide close to the camera along the top and bottom edges
    flock.push(mk('c', 3.1, .12, .1), mk('c', 3.7, .72, .92), mk('c', 4.6, .95, .16));
    for (var n = 0; n < 3; n++) { flock[n].yaw = (api.random() - .5) * .25; flock[n].col = WASHI[n === 1 ? 2 : (n ? 1 : 0)]; }
    for (var i = 0; i < 12; i++) flock.push(mk('c', 7 + api.random() * 14, api.random() * 1.2 - .1, .08 + api.random() * .84));
    for (i = 0; i < 30; i++) flock.push(mk('c', 24 + api.random() * 90, api.random() * 1.2 - .1, .05 + api.random() * .8));
    for (i = 0; i < 6; i++) { var b = mk('b', 8 + api.random() * 26, api.random() * 1.2 - .1, .55 + api.random() * .38); b.yaw = api.random() * 6.28; flock.push(b); }
  }
  function baseSpeed(e) { return (e.kind === 'b' ? -0.35 : 1) * 520 / Math.pow(e.z, .78); }

  // ---- folding square (click) ----
  var SQ = new Float32Array(15);
  function foldSquare(f, t) {
    // square A(top) B(right) C(bottom) D(left) O(center) in the x-y plane, facing the camera; C folds up over A along BD.
    var s = 1.1, th = Math.PI * Math.min(1, Math.max(0, (t - .3) / .35)), q = Math.min(1, Math.max(0, (t - .62) / .2));
    SQ.set([0, s, 0, s, 0, 0, 0, -s * Math.cos(th), -s * Math.sin(th), -s, 0, 0, 0, 0, 0]);
    // second fold: B swings over to D along the A-O axis
    var th2 = Math.PI * q; SQ[3] = s * Math.cos(th2); SQ[5] = -s * Math.sin(th2) - .02;
    return [4, 0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0];
  }
  var FT = foldSquare({}, 0);
  function spawn(x, y) {
    if (folders.length > 3) folders.shift();
    var z = 5;
    folders.push({ t: 0, z: z, X: (x - W / 2) * z / F, Y: -(y - H / 2) * z / F, col: WASHI[(api.random() * 4) | 0], spin: (api.random() - .5) * .6, ph: 1.2 });
  }
  var MV = new Float32Array(18 * 3);
  function drawFolder(f) {
    var e = { X: f.X, Y: f.Y, Z: f.z, yaw: 0, roll: 0, pitch: 0 }, t = f.t;
    if (t < .82) {
      var sIn = Math.min(1, t / .25), es = 1 - Math.pow(1 - sIn, 3);
      e.pitch = f.spin * (1 - es) + Math.sin(t * 3) * .05; e.yaw = (1 - es) * 1.2;
      foldSquare(f, t); project(SQ, 5, e, .2 + .8 * es);
      emit(FT, 0, FT.length, f.col, 0, Math.min(1, t * 6), .55, false);
    } else {
      // morph from the folded triangle into the crane, part by part (body, neck/tail, then wings open)
      var k = Math.min(1, (t - .82) / .68);
      craneVerts(f.ph || 0);
      for (var i = 0; i < 18; i++) {
        var x = CV[i * 3], y = CV[i * 3 + 1], z = CV[i * 3 + 2];
        var sy = Math.min(1, Math.max(0, (y + .3) / 1.6)) * 1.1, sx = Math.max(-1, Math.min(1, x / 1.3)) * 1.1 * (1 - sy / 1.15);
        var stg = i < 9 ? 0 : (i < 15 && i > 10 ? .35 : .15), kk = Math.min(1, Math.max(0, (k - stg) / (1 - stg)));
        kk = kk * kk * (3 - 2 * kk);
        MV[i * 3] = sx + (x - sx) * kk; MV[i * 3 + 1] = sy + (y - sy) * kk; MV[i * 3 + 2] = z * kk;
      }
      e.yaw = -.25 * k; e.pitch = .12 * k;
      project(MV, 18, e, 1); emit(CT, 0, CT.length, f.col, 0, 1, .5, false);
    }
    // crease flash ring
    var cx = W / 2 + f.X * F / f.z, cy = H / 2 - f.Y * F / f.z, rr = 30 + t * 260, aa = Math.max(0, .35 - t * .3);
    if (aa > 0) { c.strokeStyle = api.rgba(S[7], aa); c.lineWidth = 1; c.beginPath(); c.moveTo(cx - rr, cy); c.lineTo(cx, cy - rr); c.lineTo(cx + rr, cy); c.lineTo(cx, cy + rr); c.closePath(); c.stroke(); }
  }

  // ---- static sky: gradient, folded-sheet facets, stars, washi grain ----
  function buildSky() {
    sky = new OffscreenCanvas(Math.max(1, W), Math.max(1, H)); var g = sky.getContext('2d');
    var gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, S[4]); gr.addColorStop(.62, P.bg); gr.addColorStop(1, S[5]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    var fr = api.free(40), mx = fr.x + fr.w * .78, my = fr.y + fr.h * .22;
    var mg = g.createRadialGradient(mx, my, 0, mx, my, Math.max(W, H) * .55); mg.addColorStop(0, api.rgba(S[6], .28)); mg.addColorStop(.35, api.rgba(S[6], .08)); mg.addColorStop(1, api.rgba(S[6], 0));
    g.fillStyle = mg; g.fillRect(0, 0, W, H);
    // the sky itself is a folded sheet: huge faint facets meeting at crease lines
    var pts = [[0, 0], [W * .42, 0], [W, 0], [W, H * .46], [W, H], [W * .56, H], [0, H], [0, H * .58]], hub = [W * .5 + (api.random() - .5) * W * .2, H * .48];
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length]; g.beginPath(); g.moveTo(hub[0], hub[1]); g.lineTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.closePath();
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,8,0.12)'; g.fill();
      g.strokeStyle = 'rgba(190,200,255,0.05)'; g.lineWidth = 1; g.beginPath(); g.moveTo(hub[0], hub[1]); g.lineTo(a[0], a[1]); g.stroke();
    }
    for (i = 0; i < 160; i++) {
      var sx = api.hash(i, 1.7) * W, sy = Math.pow(api.hash(i, 4.1), 1.4) * H * .8, r = .4 + api.hash(i, 8.3) * 1.1;
      g.fillStyle = api.rgba(S[7], .2 + api.hash(i, 2.9) * .5); g.beginPath(); g.arc(sx, sy, r, 0, 6.29); g.fill();
    }
    g.globalAlpha = .55; g.fillStyle = g.createPattern(fibre, 'repeat'); g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  }
  function buildFibre() {
    fibre = new OffscreenCanvas(256, 256); var g = fibre.getContext('2d'); g.lineCap = 'round';
    for (var i = 0; i < 520; i++) {
      var x = api.hash(i, 11) * 256, y = api.hash(i, 13) * 256, l = 3 + api.hash(i, 17) * 14, a = api.hash(i, 19) * 6.28;
      g.strokeStyle = api.hash(i, 23) > .5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,20,0.10)'; g.lineWidth = .5 + api.hash(i, 29) * .7;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 1) * l * .5, y + Math.sin(a + 1) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    fibrePat = c.createPattern(fibre, 'repeat');
  }
  function resize() { W = Math.max(1, api.width); H = Math.max(1, api.height); F = Math.max(W, H) * .62; buildSky(); }

  buildFibre(); resize(); populate();
  var order = [];

  return {
    resize: resize, zones: resize,
    pointer: function (e) {
      if (e.overUI) { ptr.on = false; return; }
      ptr.x = e.x; ptr.y = e.y; ptr.on = true;
      if (e.kind === 'down') spawn(e.x, e.y);
    },
    frame: function (t, dt) {
      dt = Math.min(dt || 0, .1);
      c.drawImage(sky, 0, 0, W, H);
      order.length = 0;
      for (var i = 0; i < flock.length; i++) {
        var e = flock[i];
        var px = e.u * W, py = e.v * H, push = 0;
        if (ptr.on) {
          var dx = px - ptr.x, dy = py - ptr.y, d = Math.sqrt(dx * dx + dy * dy) || 1, R = 260;
          if (d < R) { push = Math.pow(1 - d / R, 2); e.vu += dx / d * push * 1800 * dt; e.vv += dy / d * push * 1800 * dt; }
        }
        e.boost += (push - e.boost) * Math.min(1, dt * 4);
        e.vu *= Math.exp(-dt * 1.6); e.vv *= Math.exp(-dt * 1.6);
        if (e.born > 0) { e.born -= dt; e.vv -= 60 * dt; }
        e.u += (baseSpeed(e) * dt + e.vu * dt) / W; e.v += (e.vv * dt + Math.sin(t * .4 + e.bob) * 6 * dt / Math.sqrt(e.z)) / H;
        e.roll += ((-e.vv * .004) - e.roll) * Math.min(1, dt * 3);
        e.pitch = Math.max(-.5, Math.min(.5, -e.vv * .0025)) + Math.sin(t * .7 + e.bob) * .05;
        e.ph += dt * (e.rate * (1 + e.boost * 2.4));
        var m = .25;
        if (e.u > 1 + m || e.u < -m || e.v < -.3 || e.v > 1.3) {
          if (e.spawned) { flock.splice(i, 1); i--; continue; }
          e.u = e.u > 1 + m ? -m + .02 : (e.u < -m ? 1 + m - .02 : e.u); e.v = Math.max(.04, Math.min(.96, e.v)); e.vu = e.vv = 0;
        }
        order.push(e);
      }
      order.sort(function (a, b) { return b.z - a.z; });
      for (i = 0; i < order.length; i++) {
        e = order[i];
        var sx = e.u * W, sy = e.v * H, cl = api.calm(sx, sy, 80), size = F / e.z;
        var fog = Math.min(.62, Math.max(0, (e.z - 14) / 140)), alpha = (1 - cl * .72) * (e.z < 5 ? .95 : 1);
        var X = (sx - W / 2) * e.z / F, Y = -(sy - H / 2) * e.z / F;
        var en = { X: X, Y: Y, Z: e.z, yaw: e.yaw, roll: e.roll, pitch: e.pitch };
        if (e.kind === 'b') {
          e.spin += dt * .15; en.yaw = e.spin; en.roll = Math.sin(t * 1.1 + e.bob) * .12; en.pitch = Math.sin(t * .8 + e.bob) * .08;
          project(BV, 13, en, 1); emit(BT, 0, BT.length, e.col, fog, alpha, size > 40 ? .35 : 0, size > 160, 6);
        } else {
          craneVerts(e.ph); project(CV, 18, en, 1);
          var full = size > 22;
          emit(CT, 0, full ? CT.length : 12, e.col, fog, alpha, size > 45 ? .4 : 0, size > 160);
          if (!full) emit(CT, 42, CT.length, e.col, fog, alpha, 0, false);
        }
        if (fibrePat && size > 160 && fibrePat.setTransform) { var sc = Math.max(.6, size / 300); fibrePat.setTransform(new DOMMatrix([sc, 0, 0, sc, sx, sy])); }
        c.strokeStyle = api.rgba(S[7], 1); c.lineWidth = Math.max(.5, Math.min(1.4, size / 200)); c.lineJoin = 'round';
        flush(fibrePat);
      }
      for (i = 0; i < folders.length; i++) {
        var f = folders[i]; f.t += dt;
        if (f.t >= 1.5) {
          var nc = mk('c', f.z, (W / 2 + f.X * F / f.z) / W, (H / 2 - f.Y * F / f.z) / H);
          nc.col = f.col; nc.ph = 1.2; nc.yaw = -.25; nc.vu = 120; nc.vv = -140; nc.born = 1.2; nc.spawned = true; nc.boost = 1; flock.push(nc);
          if (flock.length > 70) for (var j = 0; j < flock.length; j++) if (flock[j].spawned) { flock.splice(j, 1); break; }
          folders.splice(i, 1); i--; continue;
        }
        c.strokeStyle = api.rgba(S[7], 1); c.lineWidth = 1; drawFolder(f); flush(fibrePat);
      }
    }
  };
});
