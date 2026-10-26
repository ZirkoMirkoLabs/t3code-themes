/* Lantern Night — paper sky lanterns rising over a mirror lake.
   sceneColors: [0] sky top, [1] sky at horizon, [2] lantern amber, [3] flame core,
                [4] hills / pavilion silhouette, [5] deep water */
T3Scene(function (api) {
  var ctx = api.canvas.getContext('2d');
  var S = api.palette.scene || [];
  var C = {
    top: S[0] || '#060820', hor: S[1] || '#2c2253', warm: S[2] || '#ffad4f',
    core: S[3] || '#fff0c8', hill: S[4] || '#0b0a20', water: S[5] || '#05061a'
  };
  var P = api.params || {};
  var N = Math.min(320, Math.max(60, (P.count || 240) * (api.preview ? 0.55 : 1))) | 0;
  var RISE = P.rise || 1;
  var W = 1, H = 1, hz = 1, f = 1, CAM = 1, DMIN = 2.6, DMAX = 40;
  var bg = null, glow = null, lsp = null, lan = [], twk = [];

  function mkGlow() {
    glow = new OffscreenCanvas(64, 64);
    var g = glow.getContext('2d'), c = api.rgb(C.warm).join(','), k = api.rgb(C.core).join(',');
    var rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(' + k + ',1)');
    rg.addColorStop(0.14, 'rgba(' + c + ',0.85)');
    rg.addColorStop(0.42, 'rgba(' + c + ',0.2)');
    rg.addColorStop(1, 'rgba(' + c + ',0)');
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  }

  function mkLantern() {
    lsp = new OffscreenCanvas(48, 64);
    var g = lsp.getContext('2d');
    g.beginPath();
    g.moveTo(6, 9); g.quadraticCurveTo(24, 0, 42, 9);
    g.lineTo(37, 57); g.quadraticCurveTo(24, 61, 11, 57); g.closePath();
    var lg = g.createLinearGradient(0, 0, 0, 64);
    lg.addColorStop(0, '#8e2f16'); lg.addColorStop(0.42, '#e8721f');
    lg.addColorStop(0.82, '#ffc463'); lg.addColorStop(1, '#fff0c4');
    g.fillStyle = lg; g.fill();
    var sg = g.createLinearGradient(0, 0, 48, 0);
    sg.addColorStop(0, 'rgba(50,8,0,0.5)'); sg.addColorStop(0.38, 'rgba(0,0,0,0)');
    sg.addColorStop(0.62, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(50,8,0,0.5)');
    g.fillStyle = sg; g.fill();
    var rg = g.createRadialGradient(24, 50, 0, 24, 50, 22);
    rg.addColorStop(0, 'rgba(255,250,228,0.95)'); rg.addColorStop(1, 'rgba(255,190,100,0)');
    g.fillStyle = rg; g.fill();
    g.strokeStyle = 'rgba(110,36,10,0.32)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(17, 5); g.lineTo(19, 58); g.moveTo(31, 5); g.lineTo(29, 58); g.stroke();
    g.strokeStyle = 'rgba(80,26,6,0.85)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(12, 57); g.quadraticCurveTo(24, 61, 36, 57); g.stroke();
  }

  function seed(L, fresh) {
    var r = api.random();
    L.u = r < 0.55 ? api.random() * 1.2 - 0.1 : 0.62 + (api.random() + api.random() - 1) * 0.32;
    var hmax = CAM + (hz + 80) * L.d / f;
    L.h = fresh ? api.random() * hmax : api.random() * 0.15;
  }

  function init() {
    lan = [];
    for (var i = 0; i < N; i++) {
      var L = {
        d: DMIN + (DMAX - DMIN) * Math.pow(api.random(), 0.8),
        v: (0.05 + api.random() * 0.05) * RISE,
        ph: api.random() * 6.283, sf: 0.6 + api.random() * 0.8, fq: 5 + api.random() * 5
      };
      lan.push(L);
    }
    lan.sort(function (a, b) { return b.d - a.d; });
    for (var j = 0; j < lan.length; j++) seed(lan[j], true);
  }

  function ridge(g, amp, sc, off, col, env) {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(0, hz + 1);
    for (var x = 0; x <= W + 6; x += 6) {
      var n = api.noise(x * sc + off, off * 0.37) * 0.7 + api.noise(x * sc * 3.1 + off, 4.2) * 0.3;
      var e = env(x / W);
      g.lineTo(x, hz - amp * e * (0.25 + 0.75 * n));
    }
    g.lineTo(W, hz + 1); g.closePath(); g.fill();
  }

  function pagoda(g, cx, base, u, col, win) {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(cx - u * 16, base + 1);
    g.quadraticCurveTo(cx - u * 7, base - u * 1.8, cx, base - u * 2);
    g.quadraticCurveTo(cx + u * 8, base - u * 1.8, cx + u * 18, base + 1); g.closePath(); g.fill();
    var y = base - u * 1.9;
    for (var i = 0; i < 3; i++) {
      var w = (2.6 - i * 0.55) * u, h = (2.2 - i * 0.35) * u;
      g.fillStyle = col; g.fillRect(cx - w, y - h, w * 2, h);
      g.fillStyle = win; g.fillRect(cx - w * 0.45, y - h * 0.78, w * 0.9, h * 0.55);
      y -= h;
      var rw = w + u * (2.3 - i * 0.25), rh = u * (1.15 - i * 0.1);
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(cx - rw, y - rh * 0.65);
      g.quadraticCurveTo(cx - rw * 0.75, y + rh * 0.2, cx - rw * 0.4, y + rh * 0.12);
      g.lineTo(cx + rw * 0.4, y + rh * 0.12);
      g.quadraticCurveTo(cx + rw * 0.75, y + rh * 0.2, cx + rw, y - rh * 0.65);
      g.quadraticCurveTo(cx + rw * 0.5, y - rh * 0.45, cx + w * 0.5, y - rh * 1.25);
      g.lineTo(cx - w * 0.5, y - rh * 1.25);
      g.quadraticCurveTo(cx - rw * 0.5, y - rh * 0.45, cx - rw, y - rh * 0.65);
      g.closePath(); g.fill();
      y -= rh * 1.2;
    }
    g.fillRect(cx - u * 0.14, y - u * 3.2, u * 0.28, u * 3.2);
    g.beginPath(); g.arc(cx, y - u * 1.2, u * 0.35, 0, 6.283); g.fill();
    g.beginPath(); g.arc(cx, y - u * 2.1, u * 0.28, 0, 6.283); g.fill();
  }

  function silhouettes(g) {
    ridge(g, H * 0.085, 0.0019, 3.1, api.mix(C.hor, C.hill, 0.55),
      function (q) { return 0.55 + 0.45 * Math.abs(q - 0.5) * 2; });
    ridge(g, H * 0.05, 0.0034, 9.7, C.hill,
      function (q) { return q < 0.5 ? 1 - q * 1.6 : 0.2 + Math.max(0, q - 0.66) * 2.4; });
    pagoda(g, W * 0.8, hz, Math.max(2.2, H * 0.0105), C.hill, api.rgba(C.warm, 0.9));
  }

  function build() {
    bg = new OffscreenCanvas(Math.max(1, Math.ceil(W)), Math.max(1, Math.ceil(H)));
    var g = bg.getContext('2d'), i;
    var sk = g.createLinearGradient(0, 0, 0, hz);
    sk.addColorStop(0, C.top); sk.addColorStop(0.55, api.mix(C.top, C.hor, 0.45)); sk.addColorStop(1, C.hor);
    g.fillStyle = sk; g.fillRect(0, 0, W, hz + 1);
    var hg = g.createRadialGradient(W * 0.6, hz, 0, W * 0.6, hz, W * 0.65);
    hg.addColorStop(0, api.rgba(C.warm, 0.2)); hg.addColorStop(1, api.rgba(C.warm, 0));
    g.fillStyle = hg; g.fillRect(0, 0, W, hz);
    var n = Math.min(900, (W * hz / 2200) | 0);
    for (i = 0; i < n; i++) {
      var x = api.random() * W, y = Math.pow(api.random(), 1.3) * hz * 0.92;
      var a = (0.15 + api.random() * 0.6) * (1 - 0.85 * api.calm(x, y, 40)) * (1 - 0.65 * y / hz);
      var r = api.random() < 0.05 ? 1.4 : 0.8;
      g.fillStyle = 'rgba(225,228,255,' + a.toFixed(3) + ')'; g.fillRect(x, y, r, r);
    }
    var wg = g.createLinearGradient(0, hz, 0, H);
    wg.addColorStop(0, api.mix(C.hor, C.water, 0.3)); wg.addColorStop(0.3, api.mix(C.hor, C.water, 0.75)); wg.addColorStop(1, C.water);
    g.fillStyle = wg; g.fillRect(0, hz, W, H - hz);
    var wh = g.createRadialGradient(W * 0.6, hz, 0, W * 0.6, hz, W * 0.5);
    wh.addColorStop(0, api.rgba(C.warm, 0.12)); wh.addColorStop(1, api.rgba(C.warm, 0));
    g.fillStyle = wh; g.fillRect(0, hz, W, H - hz);
    silhouettes(g);
    g.save(); g.translate(0, 2 * hz); g.scale(1, -1); g.globalAlpha = 0.55; silhouettes(g); g.restore();
    for (i = 0; i < 140; i++) {
      var ry = hz + 2 + (H - hz) * Math.pow(api.random(), 1.7), rx = api.random() * W;
      var rl = 20 + api.random() * 120 * (0.3 + (ry - hz) / (H - hz));
      g.fillStyle = 'rgba(170,175,255,' + (0.05 * (1 - 0.8 * api.calm(rx, ry, 30))).toFixed(3) + ')';
      g.fillRect(rx, ry, rl, 1);
    }
    twk = [];
    for (i = 0; i < 70; i++) {
      var tx = api.random() * W, ty = Math.pow(api.random(), 1.2) * hz * 0.85;
      twk.push({ x: tx, y: ty, ph: api.random() * 6.283, sp: 0.6 + api.random() * 1.6, k: 1 - api.calm(tx, ty, 40) });
    }
  }

  function layout(w, h) {
    W = w || api.width; H = h || api.height;
    hz = H * 0.64; f = H * 0.85;
    build();
  }

  mkGlow(); mkLantern();
  layout(api.width, api.height);
  init();

  return {
    resize: function (w, h) { layout(w, h); },
    zones: function () { build(); },
    frame: function (t, dt) {
      var i, L, s, x, y, a, fl, c, gs;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(bg, 0, 0, W, H);
      for (i = 0; i < twk.length; i++) {
        var q = twk[i], ta = (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * q.sp + q.ph))) * 0.8 * q.k;
        ctx.fillStyle = 'rgba(240,240,255,' + ta.toFixed(3) + ')'; ctx.fillRect(q.x, q.y, 1.6, 1.6);
      }
      for (i = 0; i < lan.length; i++) {
        L = lan[i];
        L.h += L.v * (dt || 0);
        s = f * 0.2 / L.d;
        L.x = L.u * W + Math.sin(t * 0.33 * L.sf + L.ph) * f * 0.07 / L.d;
        L.y = hz + f * (CAM - L.h) / L.d + Math.sin(t * 0.8 + L.ph * 2) * f * 0.02 / L.d;
        if (L.y < -s * 2) { seed(L, false); L.y = hz + f * (CAM - L.h) / L.d; }
        L.s = s;
        fl = 0.8 + 0.2 * (0.5 + 0.5 * Math.sin(t * L.fq + L.ph)) * (0.6 + 0.4 * Math.sin(t * 2.3 + L.ph * 1.7));
        var depth = 1 - (L.d - DMIN) / (DMAX - DMIN);
        L.a = Math.min(1, L.h / 0.35) * (0.35 + 0.65 * depth) * fl;
        L.c = api.calm(L.x, L.y, 60);
      }
      ctx.save();
      ctx.beginPath(); ctx.rect(0, hz, W, H - hz); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < lan.length; i++) {
        L = lan[i];
        y = hz + f * (CAM + L.h) / L.d;
        if (y > H + L.s * 2) continue;
        c = api.calm(L.x, y, 50);
        a = L.a * 0.32 * (1 - 0.6 * c);
        if (a < 0.01) continue;
        gs = Math.max(3, L.s * 2.6);
        var sh = Math.sin(t * 1.4 + L.ph + y * 0.05) * gs * 0.12;
        ctx.globalAlpha = a;
        ctx.drawImage(glow, L.x - gs * 0.5 + sh, y - gs * 0.9, gs, gs * 1.8);
      }
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < lan.length; i++) {
        L = lan[i];
        a = L.a * (1 - 0.7 * L.c);
        if (a < 0.01) continue;
        gs = Math.max(3.2, L.s * 3);
        ctx.globalAlpha = Math.min(1, a * 0.9);
        ctx.drawImage(glow, L.x - gs * 0.5, L.y - gs * 0.45, gs, gs);
      }
      ctx.globalCompositeOperation = 'source-over';
      for (i = 0; i < lan.length; i++) {
        L = lan[i];
        if (L.s < 7) continue;
        a = Math.min(1, L.a * 1.1) * (1 - 0.7 * L.c);
        if (a < 0.01) continue;
        var lw = L.s * 0.75;
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(L.x, L.y);
        ctx.rotate(Math.sin(t * 0.5 * L.sf + L.ph) * 0.07);
        ctx.drawImage(lsp, -lw * 0.5, -L.s * 0.5, lw, L.s);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  };
});
