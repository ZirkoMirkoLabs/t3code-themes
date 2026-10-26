// Summer Meadow welcome: a warm sun blooms, a strip of grass sways in, the title rises letter by letter,
// then dandelion seeds drift up and across on a gentle breeze. Seed layout and timing are seeded per mount.
T3Welcome(function (api) {
  var ctx = api.canvas.getContext('2d'), P = api.palette, S = P.scene || [];
  var green = S[5] || '#3e8c3c', light = S[6] || '#9ad857', sun = '#ffd56a';
  var text = api.text || 'Summer Meadow', W, H, size;
  var blades = [], seeds = [], delays = [];
  for (var i = 0; i < 70; i++) blades.push({ u: api.random(), h: 0.25 + api.random() * 0.45, p: api.random() * 6.28, d: api.random() * 0.8 });
  for (var j = 0; j < 18; j++) seeds.push({ u: api.random(), v: api.random(), s: 0.02 + api.random() * 0.04, p: api.random() * 6.28 });
  for (var k = 0; k < text.length; k++) delays.push(0.6 + k * 0.06 + api.random() * 0.12);
  function layout() { W = api.width; H = api.height; size = Math.min(44, H * 0.32); }
  layout();
  return {
    resize: layout,
    frame: function (t) {
      ctx.clearRect(0, 0, W, H);
      var cx = W / 2, cy = H * 0.45, sIn = Math.min(1, t / 1.2);
      // sun bloom behind the title
      var g = ctx.createRadialGradient(cx + W * 0.18, cy - H * 0.1, 0, cx + W * 0.18, cy - H * 0.1, H * 0.6 * (0.6 + 0.4 * sIn));
      g.addColorStop(0, api.rgba(sun, 0.55 * sIn)); g.addColorStop(0.35, api.rgba(sun, 0.18 * sIn)); g.addColorStop(1, api.rgba(sun, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // grass strip swaying in waves
      var base = H * 0.98;
      ctx.beginPath();
      blades.forEach(function (b) {
        var grow = Math.max(0, Math.min(1, (t - b.d) / 0.9)), h = b.h * H * 0.55 * grow;
        if (h <= 0) return;
        var x = W * 0.08 + b.u * W * 0.84, w = Math.sin(x * 0.012 - t * 1.4) * 0.5 + 0.5, bend = (w * 0.5 + Math.sin(t * 2 + b.p) * 0.08) * h;
        ctx.moveTo(x - 1.6, base); ctx.quadraticCurveTo(x + bend * 0.25, base - h * 0.55, x + bend, base - h); ctx.quadraticCurveTo(x + bend * 0.25 + 0.6, base - h * 0.55, x + 1.6, base);
      });
      ctx.fillStyle = api.rgba(green, 0.85); ctx.fill();
      // title rises letter by letter
      ctx.font = 'italic 600 ' + size + 'px Georgia, "Palatino Linotype", serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      var total = ctx.measureText(text).width, x0 = cx - total / 2;
      for (var i = 0; i < text.length; i++) {
        var a = Math.max(0, Math.min(1, (t - delays[i]) / 0.5)), e = 1 - Math.pow(1 - a, 3);
        var pre = ctx.measureText(text.slice(0, i)).width, bob = Math.sin(t * 1.2 + i * 0.5) * 1.2 * a;
        ctx.globalAlpha = e;
        ctx.fillStyle = api.rgba('#ffffff', 0.6); ctx.fillText(text[i], x0 + pre + 1, cy + (1 - e) * 14 + bob + 1.5);
        ctx.fillStyle = P.text; ctx.fillText(text[i], x0 + pre, cy + (1 - e) * 14 + bob);
      }
      ctx.globalAlpha = 1;
      // dandelion seeds on the breeze
      var sAl = Math.max(0, Math.min(1, (t - 1.8) / 1.5));
      if (sAl > 0) {
        ctx.strokeStyle = api.rgba(P.muted, 0.55 * sAl); ctx.lineWidth = 0.8; ctx.beginPath();
        seeds.forEach(function (o) {
          var x = ((o.u + t * o.s) % 1) * W, y = H * (0.15 + 0.7 * o.v) + Math.sin(t * 0.8 + o.p) * 6;
          for (var q = 0; q < 6; q++) { var an = q * 1.047 + o.p + t * 0.3; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(an) * 3.5, y + Math.sin(an) * 3.5); }
          ctx.moveTo(x, y); ctx.lineTo(x - 1.5, y + 5);
        });
        ctx.stroke();
      }
      ctx.fillStyle = api.rgba(light, 0.5); ctx.fillRect(W * 0.08, base, W * 0.84, 1);
    }
  };
});
