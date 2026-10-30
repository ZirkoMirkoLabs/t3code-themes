// Liquid Chrome v3: the whole screen is a bright mirror pool of mercury under big studio softboxes.
// Adapted from webgl-viral/liquid-morph (studio softbox metal shading), rebuilt as a perspective pool.
// sceneColors: 0 unused (kept for contrast checks), 1 cool studio tint, 2 softbox white, 3 horizon haze.
// Pointer: a soft wake of smooth ripples follows the cursor. Click: one droplet falls, splashes into a
// crown, sends up a rounded rebound droplet and rings out, fading to nothing.
T3Scene(function (api) {
  var gl = api.canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) throw Error('WebGL unavailable');
  function shader(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; }

  var FS = [
    'precision highp float;',
    'uniform vec2 R; uniform float T, HY, SEED;',
    'uniform vec3 BG, TINT, BOX, HAZE;',
    'uniform vec4 W[12]; uniform vec4 D[4];',
    'uniform vec4 Z[8]; uniform int ZN;',
    'const float PI = 3.14159265;',
    'const vec3 INK = vec3(.09, .09, .135);',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float safe(){ float m = 0.; for (int i = 0; i < 8; i++) { if (i >= ZN) break; float rr = R.y * .02; vec2 d = max(max(Z[i].xy - gl_FragCoord.xy, gl_FragCoord.xy - Z[i].zw) + rr, vec2(0.)); m = max(m, 1. - smoothstep(rr, rr + max(1., R.y * .012), length(d))); } return 1. - m; }',
    // a large softbox: rounded panel with a very soft edge and a gentle internal gradient
    'float box(vec3 r, vec3 dir, vec2 size, float soft){ vec3 f = normalize(dir), rt = normalize(cross(vec3(0., 1., 0.), f)), up = cross(f, rt); float z = dot(r, f); vec2 uv = vec2(dot(r, rt), dot(r, up)) / max(.01, z); vec2 e = max(abs(uv) - size + soft, 0.); float m = 1. - smoothstep(0., soft * 2., length(e)); return m * (.8 + .2 * smoothstep(-size.y, size.y, uv.y)) * smoothstep(0., .15, z); }',
    // studio dome: bright cool grey, violet ink near the floor, a few crisp dark seams, big softboxes
    'vec3 env(vec3 r){',
    '  float y = r.y;',
    '  vec3 c = mix(INK, TINT * .26, smoothstep(.0, .16, y));',
    '  c = mix(c, TINT * .46, smoothstep(.2, .8, y));',
    '  c = mix(c, c * vec3(.6, .6, .8), (1. - smoothstep(.12, .4, y)) * .5);',
    '  c = mix(c, INK, (1. - smoothstep(.004, .02, abs(y - .33))) * .65);',
    '  c = mix(c, INK * 1.6, (1. - smoothstep(.004, .012, abs(y - .52 - .06 * r.x))) * .5);',
    '  c += BOX * 1.1 * box(r, vec3(-.35, .62, .7), vec2(.9, .16), .09);',
    '  c += BOX * .9 * box(r, vec3(.5, .75, .45), vec2(.35, .3), .1);',
    '  c += BOX * .12 * box(r, vec3(0., 1., .1), vec2(1.3, .8), .3);',
    '  return c;',
    '}',
    // the visible backdrop above the horizon: a clean infinity cove with soft glows
    'vec3 sky(vec2 p){',
    '  float u = max(p.y - HY, 0.);',
    '  vec3 c = mix(HAZE * .7, TINT * .36, smoothstep(0., .22, u));',
    '  c += BOX * .22 * exp(-u * 30.);',
    '  vec2 a = (p - vec2(-.1, HY + .15)) / vec2(.95, .075); float m = pow(pow(abs(a.x), 4.) + pow(abs(a.y), 4.), .25);',
    '  c += BOX * .42 * (1. - smoothstep(.55, 1.15, m)) * (.8 + .2 * smoothstep(-1., 1., a.y));',
    '  return c;',
    '}',
    'vec3 tone(vec3 c){ return pow(clamp((c * (2.51 * c + .03)) / (c * (2.43 * c + .59) + .14), 0., 1.), vec3(1. / 2.2)); }',
    // ring packet travelling out from s.xy: smooth Gaussian envelope, fades in and out, no seams
    'vec3 wave(vec4 s, vec2 P, float k, float speed, float decay, float life, float fw){ float age = T - s.z; if (age <= 0. || s.w <= 0. || age > life) return vec3(0.); vec2 v = P - s.xy; float r = length(v) + 1e-3; float d = r - age * speed;',
    '  float sg = .5 + age * .35, g = exp(-d * d / (sg * sg)), dg = -2. * d / (sg * sg) * g;',
    '  float a = s.w * exp(-age * decay) * smoothstep(0., .12, age) * smoothstep(life, life * .55, age) / (1. + r * .9) * exp(-k * k * fw * fw * .5);',
    '  float sn = sin(d * k), cs = cos(d * k);',
    '  float h = a * sn * g; float dr = a * (k * cs * g + sn * dg);',
    '  return vec3(h, v / r * dr); }',
    // broad swell component, filtered out where it gets finer than a pixel (no horizon noise)
    'vec3 sw(vec2 k, float amp, float ph, vec2 P, float fw){ float a = amp * exp(-dot(k, k) * fw * fw * .5); float q = dot(k, P) + ph; return a * vec3(sin(q), cos(q) * k); }',
    // returns (height, d/dx, d/dz)
    'vec3 height(vec2 P, float fw){',
    '  float a = T * .32 + SEED;',
    '  vec3 h = sw(vec2(.45, .8), .16, a, P, fw);',
    '  h += sw(vec2(-.7, 1.05), .1, -a * 1.2 + 1.3, P, fw);',
    '  h += sw(vec2(1.25, -.6), .06, a * 1.5 + 2.1, P, fw);',
    '  h += sw(vec2(1.6, 2.2), .045, -a * 1.9 + .7, P, fw);',
    '  h += sw(vec2(-2.6, 1.4), .028, a * 2.3 + 4.2, P, fw);',
    '  for (int i = 0; i < 12; i++) h += wave(W[i], P, 4.5, 1.1, .9, 1.6, fw);',
    '  for (int i = 0; i < 4; i++) h += wave(D[i], P, 6., 1.2, .55, 4., fw);',
    '  return h;',
    '}',
    'vec3 chrome(vec3 n, vec3 v){ vec3 r = reflect(v, n); r.y = abs(r.y) * .85 + .015; return env(normalize(r)); }',
    'float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.) / k; return min(a, b) - h * h * k * .25; }',
    // splash silhouette in local screen units (y up, impact at the origin)
    'float splash(vec2 q, float age, float amp){',
    '  if (age < 0.) { float fall = -age / .26; return length((q - vec2(0., fall * fall * 1.6 + .07 * amp)) * vec2(1., .9)) - .065 * amp; }',
    '  float d = 9.;',
    '  float ca = age / .55;',
    '  if (ca < 1.) {',
    '    float Rr = .08 + .32 * sqrt(ca) * amp, Hc = .2 * amp * sin(PI * ca), th = .022 * amp * (1. - ca);',
    '    float ex = clamp(q.x / Rr, -1., 1.), ell = .28 * Rr * sqrt(max(0., 1. - ex * ex));',
    '    float tip = Hc * (.85 + .15 * cos(acos(ex) * 7. + SEED));',
    '    float side = abs(q.x) - Rr - th * .5;',
    '    float wallF = max(side, max(-ell - th - q.y, q.y + ell - tip));',
    '    float wallB = max(side, max(ell - th - q.y, q.y - ell - tip * .9));',
    '    d = min(wallF, wallB);',
    '    d = smin(d, length(q * vec2(1., 3.2)) / 3.2 - .04 * amp * (1. - ca), .03);',
    '    for (int k = 0; k < 6; k++) { float ang = (float(k) + .5) / 6. * PI; d = smin(d, length(q - vec2(-cos(ang) * Rr, -.28 * Rr * sin(ang) + tip + .02 * amp)) - .02 * amp * (1. - ca), .04); }',
    '  }',
    // rebound: a smooth mound lifts a round droplet that pinches off, rises and falls back
    '  float ja = (age - .38) / .85;',
    '  if (ja > 0. && ja < 1.) {',
    '    float jh = .3 * amp * sin(PI * ja), rr = .055 * amp * (1. - .35 * ja) * min(1., (1. - ja) * 14.);',
    '    float mound = length(q * vec2(1., 1.8)) / 1.8 - .07 * amp * (1. - ja);',
    '    float drop = length(q - vec2(0., jh + rr * .6)) - rr;',
    '    d = min(d, smin(mound, drop, .09 * amp * (1. - smoothstep(.15, .45, ja)) + .001));',
    '  }',
    '  return d;',
    '}',
    'void main(){',
    '  float S = safe();',
    '  vec2 p = (gl_FragCoord.xy - .5 * R) / R.y;',
    '  float hy = HY;',
    '  vec3 col;',
    '  vec3 skyc = sky(p);',
    '  if (p.y < hy) {',
    '    float t = 1. / max(hy - p.y, 1e-4);',
    '    vec2 P = vec2(p.x * t, t);',
    '    float fw = t * t * 2.2 / R.y;',
    '    vec3 H = height(P, fw);',
    '    vec3 n = normalize(vec3(-H.y, 1., -H.z));',
    '    n = normalize(mix(vec3(0., 1., 0.), n, mix(.15, 1., S)));',
    '    vec3 v = normalize(vec3(p.x, p.y - hy, 1.));',
    '    vec3 c = chrome(n, v);',
    '    c *= .9 + .1 * smoothstep(-.12, .12, H.x);',
    '    float mist = smoothstep(3., 26., t);',
    '    c = mix(c, sky(vec2(p.x, hy)), mist);',
    '    col = tone(c);',
    '  } else {',
    '    col = tone(skyc);',
    '  }',
    // splash: falling drop, crown and rebound droplet (screen space, scaled by perspective)
    '  for (int i = 0; i < 4; i++) {',
    '    vec4 d = D[i];',
    '    float age = T - d.z;',
    '    if (d.w <= 0. || age < -.28 || age > 1.25) continue;',
    '    float sc = 1. / d.y;',
    '    vec2 q = (p - vec2(d.x * sc, hy - sc)) / sc;',
    '    float amp = d.w / .22;',
    '    float dd = splash(q, age, amp);',
    '    if (dd < .03) {',
    '      float ee = 1.5 / R.y / sc;',
    '      vec2 g = vec2(splash(q + vec2(ee, 0.), age, amp) - dd, splash(q + vec2(0., ee), age, amp) - dd) / ee;',
    '      float rim = clamp(-dd / (.04 * amp), 0., 1.);',
    '      vec3 n = normalize(vec3(g * (1. - rim * .8), .3 + rim));',
    '      vec3 r = reflect(vec3(0., 0., 1.), vec3(n.x, n.y, -n.z));',
    '      vec3 bc = tone(env(normalize(vec3(r.x, abs(r.y) * .9 + .08, abs(r.z)))) * 1.1);',
    '      float cov = 1. - smoothstep(-ee * 1.2, ee * 1.2, dd);',
    '      col = mix(col, bc, cov * mix(.25, 1., S));',
    '    }',
    '  }',
    // text zones resolve to the flat theme background
    '  col += (hash(gl_FragCoord.xy + fract(T)) - .5) * .006;',
    '  col = mix(BG, col, S);',
    '  gl_FragColor = vec4(col, 1.);',
    '}'
  ].join('\n');

  var prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  var al = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
  var U = {};
  ['R', 'T', 'HY', 'SEED', 'BG', 'TINT', 'BOX', 'HAZE', 'W[0]', 'D[0]', 'Z[0]', 'ZN'].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });

  var sc = api.palette.scene || [];
  function col(i, fb) { return api.vec3(sc[i] || fb); }
  var BG = api.vec3(api.palette.bg), TINT = col(1, '#c7d0dc'), BOX = col(2, '#ffffff'), HAZE = col(3, '#9aa3ae');

  var W = new Float32Array(48), D = new Float32Array(16);
  var wi = 0, di = 0, now = 0, lastWake = -1, lx = -1e3, ly = -1e3;
  var seed = api.random() * 40, hy = 0.28;

  // screen CSS px -> pool world (x, z); null above the horizon
  function toPool(x, y) {
    var h = api.height, px = (x - api.width * .5) / h, py = (h - y - h * .5) / h;
    if (py > hy - .04) return null;
    var t = 1 / (hy - py);
    return [px * t, t];
  }
  function place() { gl.viewport(0, 0, api.pxWidth, api.pxHeight); }
  place();

  function drop(x, y, amp, at) {
    var P = toPool(x, y); if (!P) return;
    if (D[di * 4 + 3] > 0 && at + .26 - D[di * 4 + 2] < 4) return; // never cut off a ring that is still visible
    D[di * 4] = P[0]; D[di * 4 + 1] = P[1]; D[di * 4 + 2] = at + .26; D[di * 4 + 3] = amp; di = (di + 1) % 4;
  }
  function wake(x, y, amp) {
    var P = toPool(x, y); if (!P) return;
    W[wi * 4] = P[0]; W[wi * 4 + 1] = P[1]; W[wi * 4 + 2] = now; W[wi * 4 + 3] = amp; wi = (wi + 1) % 12;
  }

  return {
    resize: place,
    zones: place,
    pointer: function (e) {
      if (e.overUI) return;
      if (e.kind === 'down') { drop(e.x, e.y, .22, now); return; }
      if (e.kind === 'move') {
        var dx = e.x - lx, dy = e.y - ly, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 40 && now - lastWake > .14) { wake(e.x, e.y, Math.min(.05, .018 + dist * .0006)); lastWake = now; lx = e.x; ly = e.y; }
      }
    },
    frame: function (t) {
      now = t;
      gl.uniform2f(U.R, api.pxWidth, api.pxHeight);
      gl.uniform1f(U.T, t); gl.uniform1f(U.HY, hy); gl.uniform1f(U.SEED, seed);
      gl.uniform3fv(U.BG, BG); gl.uniform3fv(U.TINT, TINT); gl.uniform3fv(U.BOX, BOX); gl.uniform3fv(U.HAZE, HAZE);
      gl.uniform4fv(U['W[0]'], W); gl.uniform4fv(U['D[0]'], D);
      gl.uniform4fv(U['Z[0]'], api.zonesGL); gl.uniform1i(U.ZN, api.zoneCount);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  };
});
