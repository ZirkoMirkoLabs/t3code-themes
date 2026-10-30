// Gooey candy title: pours in (seeded), then slowly melts into drips and pulls itself back together.
T3Welcome(function (api) {
  var c = api.canvas.getContext('2d'), S = api.palette.scene, rnd = api.random;
  var seed = rnd() * 50, period = 6.5 + rnd() * 2, W, H, src, sc, bottoms, drips, top, bot, size;
  function build() {
    W = api.width; H = api.height;
    var text = (api.text || 'melt a new world').toLowerCase();
    size = Math.min(64, H * 0.42);
    var font = '900 ' + size + 'px "Arial Rounded MT Bold", "Segoe UI Black", "Arial Black", sans-serif';
    c.font = font; while (c.measureText(text).width > W * 0.9 && size > 22) { size -= 2; font = font.replace(/\d+px/, size + 'px'); c.font = font; }
    src = new OffscreenCanvas(Math.max(1, Math.ceil(W)), Math.max(1, Math.ceil(H)));
    sc = src.getContext('2d'); sc.font = font; sc.textAlign = 'center'; sc.textBaseline = 'middle';
    var y = H * 0.36;
    top = y - size * 0.6; bot = y + size * 0.62;
    // deep plum underside gives the goo thickness
    sc.fillStyle = '#2a1240'; sc.fillText(text, W / 2, y + size * 0.08);
    var g = sc.createLinearGradient(W * 0.1, 0, W * 0.9, 0);
    g.addColorStop(0, S[0]); g.addColorStop(0.35, S[2]); g.addColorStop(0.65, S[1]); g.addColorStop(1, S[4]);
    sc.fillStyle = g; sc.fillText(text, W / 2, y);
    sc.globalCompositeOperation = 'source-atop';
    var gl = sc.createLinearGradient(0, top, 0, bot);
    gl.addColorStop(0, 'rgba(255,255,255,0.55)'); gl.addColorStop(0.3, 'rgba(255,255,255,0.08)'); gl.addColorStop(0.75, 'rgba(60,10,70,0)'); gl.addColorStop(1, 'rgba(60,10,70,0.35)');
    sc.fillStyle = gl; sc.fillRect(0, 0, W, H);
    sc.globalCompositeOperation = 'source-over';
    // per-column bottom of the glyphs -> drip roots (one small readback on resize)
    var img = sc.getImageData(0, 0, src.width, src.height).data, sw = src.width;
    bottoms = [];
    for (var x = 0; x < sw; x += 2) {
      var b = -1; for (var yy = Math.min(src.height - 1, Math.ceil(bot + 4)); yy > top; yy--) { if (img[(yy * sw + x) * 4 + 3] > 200) { b = yy; break; } }
      bottoms.push(b);
    }
    drips = [];
    var tries = 0;
    while (drips.length < 16 && tries++ < 400) {
      var i = (rnd() * bottoms.length) | 0, bx = i * 2;
      if (bottoms[i] < 0 || drips.some(function (d) { return Math.abs(d.x - bx) < 14; })) continue;
      var px = sc.getImageData(bx, Math.max(0, bottoms[i] - Math.round(size * 0.16)), 1, 1).data;
      if (px[3] < 200) continue;
      drips.push({ x: bx, y: bottoms[i] - 2, len: 18 + rnd() * (H - bottoms[i] - 26), w: 2.5 + rnd() * 3.5, ph: rnd() * 6.28, col: 'rgb(' + px[0] + ',' + px[1] + ',' + px[2] + ')' });
    }
  }
  build();
  function frame(t) {
    c.clearRect(0, 0, W, H);
    var intro = Math.min(1, t / 1.8), ei = 1 - Math.pow(1 - intro, 3);
    // melt cycle after the intro: 0 = crisp, 1 = fully sagging
    var cyc = t < 1.8 ? 0 : 0.5 - 0.5 * Math.cos((t - 1.8) / period * Math.PI * 2);
    var melt = cyc * cyc * (3 - 2 * cyc);
    var strip = 4, sag = size * 0.22 * melt;
    // pour-in: the title fills from the top as liquid with a wobbling front
    for (var x = 0; x < W; x += strip) {
      var wob = Math.sin(x * 0.045 + seed + t * 1.3) * 0.5 + Math.sin(x * 0.11 + seed * 2) * 0.5;
      var front = top + (bot - top + 30) * ei + wob * 8 * (1 - ei);
      var hgt = Math.max(0, Math.min(H, front));
      if (hgt <= 0) continue;
      var dy = sag * (0.55 + 0.45 * wob), stretch = sag * 0.6 * (0.5 + 0.5 * Math.sin(x * 0.07 + seed));
      c.drawImage(src, x, 0, strip, hgt, x, dy, strip, hgt + stretch);
    }
    // drips hang from the letter bottoms, swell, and pinch into droplets
    c.lineCap = 'round';
    for (var i = 0; i < drips.length; i++) {
      var d = drips[i]; if (d.y > top + (bot - top + 30) * ei) continue;
      var wobd = Math.sin(d.x * 0.045 + seed + t * 1.3) * 0.5 + Math.sin(d.x * 0.11 + seed * 2) * 0.5;
      var y0 = d.y + sag * (0.55 + 0.45 * wobd) + sag * 0.3;
      var grow = (0.18 + 0.82 * melt) * ei * (0.85 + 0.15 * Math.sin(t * 0.9 + d.ph));
      var L = d.len * grow, y1 = Math.min(H - d.w - 2, y0 + L);
      c.strokeStyle = d.col; c.fillStyle = d.col;
      c.lineWidth = d.w * 2; c.beginPath(); c.moveTo(d.x, y0 - 2); c.lineTo(d.x, y1); c.stroke();
      c.beginPath(); c.arc(d.x, y1, d.w * 1.35, 0, 6.283); c.fill();
      // detached droplet while fully melted
      var fall = (t * 0.35 + d.ph) % 1;
      if (melt > 0.6) { var yd = y1 + 6 + fall * 18; if (yd < H - 3) { c.globalAlpha = (1 - fall) * (melt - 0.6) * 2.5; c.beginPath(); c.arc(d.x, yd, d.w * 0.9, 0, 6.283); c.fill(); c.globalAlpha = 1; } }
      c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.arc(d.x - d.w * 0.4, y1 - d.w * 0.4, d.w * 0.4, 0, 6.283); c.fill();
    }
  }
  return { frame: frame, resize: build };
});
