// Liquid Chrome welcome: inflated mercury type that pools together from beads, then drips and reforms.
// Height field = heavily blurred glyph alpha (puffy inflation) + seeded drip capsules hanging from the letters.
T3Welcome(function (api) {
  var gl = api.canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, premultipliedAlpha: false });
  if (!gl) throw Error('WebGL unavailable');
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; }
  var FS = [
    'precision highp float;',
    'varying vec2 uv; uniform sampler2D tex; uniform vec2 R; uniform float T, SEED; uniform vec4 DR[5];',
    'float box(vec3 r, vec3 dir, vec2 size, float soft){ vec3 f = normalize(dir), rt = normalize(cross(vec3(0., 1., 0.), f)), up = cross(f, rt); float z = dot(r, f); vec2 q = vec2(dot(r, rt), dot(r, up)) / max(.01, z); vec2 e = abs(q) - size; return (1. - smoothstep(-soft, soft, max(e.x, e.y))) * smoothstep(0., .1, z); }',
    'vec3 env(vec3 r){ vec3 c = mix(vec3(.05, .06, .08), vec3(.62, .68, .76), smoothstep(-.6, .8, r.y * .8 + r.z * .3));',
    '  c += vec3(2.6) * box(r, vec3(-.4, .55, .8), vec2(1.1, .55), .07);',
    '  c += vec3(1.4, 1.5, 1.65) * box(r, vec3(.8, .2, .55), vec2(.16, .9), .06);',
    '  c = mix(c, vec3(.012, .016, .03), box(r, vec3(.25, -.55, .45), vec2(1.2, .12), .04) * .9);',
    '  c = mix(c, vec3(.02, .025, .05), box(r, vec3(.55, .1, .82), vec2(.05, 1.6), .03) * .85);',
    '  return pow(clamp((c * (2.51 * c + .03)) / (c * (2.43 * c + .59) + .14), 0., 1.), vec3(1. / 2.2)); }',
    'float smax(float a, float b, float k){ float h = max(k - abs(a - b), 0.) / k; return max(a, b) + h * h * k * .25; }',
    // drip: x, y of the letter underside (uv), phase, length scale
    'float drip(vec2 q, vec4 d){',
    '  if (d.w <= 0.) return 0.;',
    '  float u = fract(T * .22 + d.z);',
    '  float grow = smoothstep(0., .55, u) * (1. - smoothstep(.78, 1., u));',
    '  float L = d.w * grow;',
    '  float pinch = smoothstep(.5, .62, u);',
    '  vec2 a = vec2(d.x, d.y + .02), b = vec2(d.x, d.y - L);',
    '  float k = clamp((a.y - q.y) / max(L + .02, .001), 0., 1.);',
    '  vec2 pa = q - vec2(d.x, clamp(q.y, b.y, a.y));',
    '  float rad = mix(.065, .03, k) * (1. - pinch * .7 * smoothstep(.4, 1., k));',
    '  float h = 1. - smoothstep(rad * .2, rad, length(pa * vec2(R.x / R.y, 1.)));',
    '  float fall = max(0., u - .6) * 2.2;',
    '  vec2 bc = vec2(d.x, b.y - .05 - fall * fall);',
    '  float br = .075 * (.4 + .6 * smoothstep(.1, .55, u)) * (1. - smoothstep(.9, 1., u));',
    '  float bead = 1. - smoothstep(br * .2, br, length((q - bc) * vec2(R.x / R.y, 1.)));',
    '  return max(h * (1. - pinch * smoothstep(.75, 1., k) * .9), bead);',
    '}',
    'float height(vec2 q, float thr){',
    '  float a = texture2D(tex, q).a;',
    '  float h = smoothstep(thr, thr + .5, a);',
    '  for (int i = 0; i < 5; i++) h = max(h, drip(q, DR[i]) * .9);',
    '  return h;',
    '}',
    'void main(){',
    '  float intro = clamp(T / 2.2, 0., 1.);',
    '  float e = 1. - pow(1. - intro, 3.);',
    '  vec2 q = uv;',
    '  q.x += sin(q.y * 18. + T * 3. + SEED) * .02 * (1. - e);',
    '  q.y += sin(q.x * 11. - T * 2.2 + SEED) * .012 * (1. - e) + sin(q.x * 4. + T * .7) * .004;',
    '  float thr = mix(.82, .18, e);',
    '  vec2 px = 1.5 / R;',
    '  float h = height(q, thr);',
    '  float hx = height(q + vec2(px.x, 0.), thr) - height(q - vec2(px.x, 0.), thr);',
    '  float hy = height(q + vec2(0., px.y), thr) - height(q - vec2(0., px.y), thr);',
    '  vec3 n = normalize(vec3(-hx * 2.4, -hy * 2.4, .35 + h * .9));',
    '  n.x += sin(q.x * 9. + T * .4) * .05;',
    '  vec3 r = reflect(vec3(0., 0., -1.), normalize(n));',
    '  vec3 col = env(r);',
    '  float alpha = smoothstep(.02, .12, h);',
    '  float glint = pow(max(0., sin((q.x - q.y * .3) * 3. - T * 1.1)), 40.) * h;',
    '  col += glint * .5;',
    '  gl_FragColor = vec4(col, alpha);',
    '}'
  ].join('\n');
  var prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 a;varying vec2 uv;void main(){uv=a*.5+.5;gl_Position=vec4(a,0.,1.);}'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  var al = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
  var tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  var uR = gl.getUniformLocation(prog, 'R'), uT = gl.getUniformLocation(prog, 'T'), uD = gl.getUniformLocation(prog, 'DR[0]');
  gl.uniform1f(gl.getUniformLocation(prog, 'SEED'), api.random() * 6.28);
  var drips = new Float32Array(20), phases = [];
  for (var i = 0; i < 5; i++) phases.push(api.random());

  function layout() {
    var w = Math.max(2, Math.ceil(api.width)), h = Math.max(2, Math.ceil(api.height));
    var c = new OffscreenCanvas(w, h), g = c.getContext('2d');
    var text = api.text || 'pour it in';
    var size = Math.min(h * .56, 96);
    g.font = '900 ' + size + 'px "Segoe UI Black", "Arial Black", Bahnschrift, sans-serif';
    var tw = g.measureText(text).width;
    if (tw > w * .9) { size *= w * .9 / tw; g.font = '900 ' + size + 'px "Segoe UI Black", "Arial Black", Bahnschrift, sans-serif'; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
    var cy = h * .4;
    g.filter = 'blur(' + Math.max(2.5, size * .05) + 'px)';
    g.fillText(text, w / 2, cy);
    g.filter = 'none';
    // find letter undersides to hang the drips from
    var data = g.getImageData(0, 0, w, h).data, cands = [];
    for (var x = Math.floor(w * .08); x < w * .92; x += 3) {
      for (var y = h - 1; y > cy; y--) { if (data[(y * w + x) * 4 + 3] > 200) { cands.push([x, y]); break; } }
    }
    cands.sort(function (a, b) { return b[1] - a[1]; });
    var picks = [];
    for (var k = 0; k < cands.length && picks.length < 2; k++) {
      var ok = true;
      for (var j = 0; j < picks.length; j++) if (Math.abs(picks[j][0] - cands[k][0]) < w * .1) ok = false;
      if (ok && api.random() < .85) picks.push(cands[k]);
    }
    for (var m = 0; m < 5; m++) {
      var p = picks[m] || [w * (.2 + .15 * m), cy];
      drips[m * 4] = p[0] / w; drips[m * 4 + 1] = 1 - (p[1] - size * .06) / h; drips[m * 4 + 2] = phases[m]; drips[m * 4 + 3] = (.1 + .08 * phases[m]) * (picks[m] ? 1 : 0);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.viewport(0, 0, api.pxWidth, api.pxHeight);
    gl.uniform2f(uR, w, h); gl.uniform4fv(uD, drips);
  }
  layout();
  return {
    resize: layout,
    frame: function (t) {
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uT, t); gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  };
});
