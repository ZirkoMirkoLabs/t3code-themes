// Sugar Meltdown: a giant candy planet rises from the bottom-right corner and melts into space.
// Adapted from webgl-viral/melting-planets. One WebGL pass; drips, droplets, moons and the fling are simulated in JS.
// sceneColors: 0 strawberry, 1 mint, 2 butter, 3 vanilla, 4 lilac, 5 sun glow, 6 nebula plum, 7 deep space.
// Pointer = sun-lamp (facing side glows, softens, drips faster). Click = fling a gooey blob that splats into a new moon.
T3Scene(function (api) {
  var gl = api.canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) throw Error('WebGL unavailable');
  var ND = 9, NM = 10;
  var FS = [
    'precision highp float;',
    'uniform vec2 R; uniform vec3 PC; uniform float T, SEED, HEAT, RIM;',
    'uniform vec3 LAMP;',
    'uniform vec4 DA[9]; uniform vec4 DB[9]; uniform vec4 DC[9]; uniform vec4 DM[9];',
    'uniform vec4 MO[10]; uniform vec4 MC[10]; uniform int MN;',
    'uniform vec4 FA; uniform vec4 FB;',
    'uniform vec3 C0,C1,C2,C3,C4,C5,C6,C7,BG;',
    'uniform vec4 Z[8]; uniform int ZN;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}',
    'float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}',
    'float cap(vec2 p,vec2 a,vec2 b,float ra,float rb){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-5),0.,1.);return length(pa-ba*h)-mix(ra,rb,h);}',
    'float safe(){float m=0.;for(int i=0;i<8;i++){if(i>=ZN)break;vec2 d=max(max(Z[i].xy-gl_FragCoord.xy,gl_FragCoord.xy-Z[i].zw),vec2(0.));m=max(m,1.-smoothstep(0.,max(1.,R.y*.07),length(d)));}return m;}',
    // planet + drips + droplets + fling, in planet units (radius 1, y up)
    'float planet(vec2 p){float d=length(p)-1.;',
    ' for(int i=0;i<9;i++){vec2 a=DA[i].xy,e=DA[i].zw;float w=DB[i].x,tr=DB[i].y;',
    '  vec2 mm=DM[i].xy;d=smin(d,cap(p,a,mm,w,w*.8),.07);d=smin(d,cap(p,mm,e,w*.8,w*.5+tr*.2),.03);d=smin(d,length(p-e)-tr,.04);',
    '  if(DC[i].z>0.)d=smin(d,length(p-DC[i].xy)-DC[i].z,.035);}',
    ' if(FB.w>0.){d=smin(d,cap(p,FA.xy,FA.zw,FB.y*1.4,FB.y),.08);vec2 q=p-FA.zw;q.y/=max(.35,1.-FB.z*.6);q.x/=1.+FB.z*.8;d=smin(d,length(q)-FB.x,.05);}',
    ' return d;}',
    'float moon(vec2 p,vec4 m){vec2 q=p-m.xy;float d=length(q)-m.z;float L=m.z*(1.1+.5*sin(T*.7+m.w*3.1));d=smin(d,cap(q,vec2(-m.z*.2,-m.z*.5),vec2(-m.z*.25,-m.z-L),m.z*.26,m.z*.14),m.z*.5);d=smin(d,length(q-vec2(-m.z*.25,-m.z-L-m.z*.12))-m.z*.2,m.z*.25);return d;}',
    'vec3 candy(float k){k=fract(k);vec3 c=mix(C0,C1,step(.2,k));c=mix(c,C2,step(.4,k));c=mix(c,C4,step(.6,k));return mix(c,C0,step(.8,k));}',
    // glossy candy shading from a 2D sdf: height field built from inside depth
    'vec3 shade(vec2 p,float d,vec2 g,float Rl,vec3 base,float body){float s=max(-d,0.);float z=sqrt(max(s*(2.*Rl-s),1e-4));',
    ' vec3 n=normalize(vec3(g*(Rl-s)/z,1.));',
    ' vec3 Ld=normalize(vec3(LAMP.xy-p,.9));float lam=max(dot(n,Ld),0.);',
    ' float near=exp(-dot(LAMP.xy-p,LAMP.xy-p)*1.6)*LAMP.z;',
    ' vec3 S=normalize(vec3(.75,.85,-.35));float rim=pow(1.-n.z,2.2)*max(dot(normalize(n.xy+1e-4),normalize(S.xy)),0.);',
    ' vec3 col=base*(.42+.62*lam)+base*near*.35;',
    ' col+=C5*rim*(.9+RIM*.4);',
    ' vec3 H=normalize(Ld+vec3(0.,0.,1.));col+=vec3(1.)*pow(max(dot(n,H),0.),mix(70.,30.,near))*(.35+near*.45);',
    ' col+=vec3(1.,.9,.95)*pow(max(dot(n,normalize(vec3(-.5,.7,.6))),0.),140.)*.22*body;',
    ' col+=C5*near*.16;',
    ' col*=.82+.18*smoothstep(0.,.02,s);',
    ' return col;}',
    'void main(){',
    ' vec2 fc=gl_FragCoord.xy; vec2 uv=fc/R; float m=safe();',
    ' vec2 p=(fc-PC.xy)/PC.z;',
    // --- space backdrop
    ' vec3 col=mix(C7,BG*1.25,uv.y*.6+.2);',
    ' vec2 nq=fc/R.y*2.2+vec2(T*.012,SEED);float n1=fbm(nq+fbm(nq*1.3-T*.01)*1.4);',
    ' col+=C6*smoothstep(.35,.85,n1)*.75+C4*smoothstep(.62,.95,n1)*.10+C1*smoothstep(.7,1.,fbm(nq*.8+7.))*.06;',
    ' vec2 sp=vec2(R.x*1.03,R.y*1.06);float sd=length(fc-sp)/R.y;col+=C5*(.55*exp(-sd*sd*3.2)+.18*exp(-sd*1.4));',
    ' col+=C0*.10*exp(-length(p)*.9);',
    ' for(int k=0;k<2;k++){float cs=k==0?34.:83.;vec2 cell=floor(fc/cs);vec2 f=fract(fc/cs)-.5;float h=hash(cell+float(k)*17.);',
    '  if(h>.86){vec2 o=vec2(hash(cell+3.1),hash(cell+5.7))-.5;vec2 q=(f-o*.7)*cs;float tw=.55+.45*sin(T*(1.+h*3.)+h*40.);',
    '   float st=exp(-dot(q,q)*.5)*1.2;if(k==1)st+=(exp(-abs(q.x)*.9)*exp(-abs(q.y)*.18)+exp(-abs(q.y)*.9)*exp(-abs(q.x)*.18))*.55;',
    '   col+=mix(C3,C2,hash(cell+9.))*st*tw*(k==0?.55:.9);}}',
    // dashed orbit rings (behind planet)
    ' vec2 rq=mat2(.94,.34,-.34,.94)*p;',
    ' for(int k=0;k<2;k++){float rr=k==0?1.5:2.25;float e=(length(rq/vec2(rr,rr*.38))-1.)*rr*.38;float ang=atan(rq.y/.38,rq.x);',
    '  float dash=step(.45,fract(ang*(k==0?9.:13.)/6.2832+T*.01));col+=C3*.16*dash*smoothstep(.012,.0,abs(e))*(rq.y<0.?1.:.6);}',
    // back moons
    ' for(int i=0;i<10;i++){if(i>=MN)break;if(MC[i].w>0.)continue;vec4 mo=MO[i];if(length(p-mo.xy)>mo.z*3.5)continue;',
    '  float d=moon(p,mo);if(d<.006){vec2 e=vec2(.003,0.);vec2 g=normalize(vec2(moon(p+e,mo)-moon(p-e,mo),moon(p+e.yx,mo)-moon(p-e.yx,mo))+1e-5);',
    '   vec3 mc=shade(p,d,g,mo.z,MC[i].rgb,1.)*.8;col=mix(col,mc,smoothstep(.006,-.002,d));}}',
    // planet
    ' float rp=length(p);',
    ' if(rp<3.2){float d=planet(p);',
    '  col+=C0*.35*exp(-max(d,0.)*9.)*.35+C5*.25*exp(-max(d,0.)*5.)*smoothstep(-.2,.9,dot(normalize(p),vec2(.7,.7)));',
    '  if(d<.01){vec2 e=vec2(.004,0.);vec2 g=normalize(vec2(planet(p+e)-planet(p-e),planet(p+e.yx)-planet(p-e.yx))+1e-5);',
    '   float zb=sqrt(max(1.-rp*rp,0.));float body=smoothstep(0.,.25,zb);',
    '   vec2 sv=p/(zb*.8+.45);sv.x+=T*.018;sv.y=sv.y*.55+T*.022;',
    '   float near=exp(-dot(LAMP.xy-p,LAMP.xy-p)*1.6)*LAMP.z;',
    '   float k=fbm(sv*1.9+fbm(sv*2.6+SEED)*1.1+SEED);float edge=mix(.012,.05,near+HEAT*.3);',
    '   float band=k*2.6+.15*p.y;vec3 base=candy(floor(band*5.)/5.);float fr=fract(band*5.);',
    '   base=mix(base,candy(floor(band*5.+1.)/5.),smoothstep(1.-edge*5.,1.,fr));',
    '   base=mix(base,C3,smoothstep(.62,.66,fbm(sv*3.1-SEED))*body*.9);',
    '   float ink=exp(-pow(min(fr,1.-fr)/(edge*1.6),2.));base=mix(base,base*.62,ink*.55*(1.-near*.6));',
    '   vec2 sc=floor(sv*15.);vec2 sf=fract(sv*15.)-.5;float sh=hash(sc+SEED);',
    '   if(sh>.8&&body>.3){float an=sh*31.;vec2 so=mat2(cos(an),-sin(an),sin(an),cos(an))*(sf-(vec2(hash(sc+1.),hash(sc+2.))-.5)*.4);',
    '    base=mix(base,candy(sh*7.),smoothstep(.06,.02,length(so*vec2(1.,3.5))));}',
    '   base=mix(base,mix(base,C3,.35),near*.5);',
    '   vec3 pc=shade(p,d,g,1.,base,body);col=mix(col,pc,smoothstep(.006,-.004,d));}}',
    // front moons
    ' for(int i=0;i<10;i++){if(i>=MN)break;if(MC[i].w<.5)continue;vec4 mo=MO[i];if(length(p-mo.xy)>mo.z*3.5)continue;',
    '  float d=moon(p,mo);if(d<.006){vec2 e=vec2(.003,0.);vec2 g=normalize(vec2(moon(p+e,mo)-moon(p-e,mo),moon(p+e.yx,mo)-moon(p-e.yx,mo))+1e-5);',
    '   vec3 mc=shade(p,d,g,mo.z,MC[i].rgb,1.);col=mix(col,mc,smoothstep(.006,-.002,d));}}',
    ' float vig=1.-.35*pow(length(uv-.55),2.);col*=vig;',
    ' col+=(hash(fc+T)-.5)*.012;',
    ' gl_FragColor=vec4(mix(col,BG,m),1.);}'
  ].join('\n');
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; }
  var prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  var al = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
  var U = {};
  ['R', 'PC', 'T', 'SEED', 'HEAT', 'RIM', 'LAMP', 'DA', 'DB', 'DC', 'DM', 'MO', 'MC', 'MN', 'FA', 'FB', 'C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'BG', 'Z', 'ZN'].forEach(function (k) {
    U[k] = gl.getUniformLocation(prog, k) || gl.getUniformLocation(prog, k + '[0]');
  });

  var S = api.palette.scene, rnd = api.random, seed = rnd() * 40;
  var CANDY = [0, 1, 2, 4, 3];
  var W, H, cx, cy, Rp; // planet centre (CSS px, y down) and radius
  function place() {
    W = api.width; H = api.height;
    Rp = Math.max(110, Math.min(H * 0.5, W * 0.31));
    cx = W - Rp * 0.38; cy = H * 0.64;
    gl.viewport(0, 0, api.pxWidth, api.pxHeight);
  }
  place();

  // ---- drips along the left / lower-left rim (planet units, y up)
  var drips = [];
  for (var i = 0; i < ND; i++) {
    var ang = Math.PI * (0.8 + i * 0.42 / (ND - 1)) + (rnd() - 0.5) * 0.04;
    drips.push({ ang: ang, ph: rnd(), sp: 0.035 + rnd() * 0.04, w: 0.026 + rnd() * 0.022, len: 0.3 + rnd() * 0.55, drop: null, heat: 0 });
  }
  var DM = new Float32Array(ND * 4), DA = new Float32Array(ND * 4), DB = new Float32Array(ND * 4), DC = new Float32Array(ND * 4);

  // ---- moons: orbit around the planet on tilted ellipses
  var TILT = Math.atan2(0.34, 0.94), CT = Math.cos(TILT), ST = Math.sin(TILT), FLAT = 0.38;
  var moons = [];
  function moonColor() { var c = api.vec3(S[CANDY[(rnd() * 4) | 0]]); return c; }
  function addMoon(rho, th, r, col, born) {
    if (moons.length >= NM) moons.shift();
    moons.push({ rho: rho, th: th, r: r, w: (0.05 + rnd() * 0.05) / Math.pow(rho, 1.2), col: col || moonColor(), born: born || 0, k: rnd() });
  }
  function moonAt(px, py, r, col) { // place a moon so its orbit passes through planet-space point (px, py)
    var qx = px * CT + py * ST, qy = -px * ST + py * CT;
    var rho = Math.max(1.25, Math.sqrt(qx * qx + (qy / FLAT) * (qy / FLAT)));
    addMoon(rho, Math.atan2(qy / FLAT, qx), r, col, 1);
  }
  [[1.5, 2.6, 0.075], [2.25, 3.4, 0.11], [2.25, 0.4, 0.06], [1.85, 4.2, 0.05], [2.7, 2.2, 0.085]].forEach(function (m) { addMoon(m[0], m[1] + rnd() * 0.6, m[2]); });
  var MO = new Float32Array(NM * 4), MC = new Float32Array(NM * 4);

  // ---- pointer lamp + fling
  var lx = -1.35, ly = 0.95, li = 0.45, tx = lx, ty = ly, ti = 0.45, heat = 0;
  var fling = null; // {ax,ay,bx,by,sx,sy,ex,ey,t,col}
  function toPlanet(x, y) { return [(x - cx) / Rp, (cy - y) / Rp]; }
  function pointer(e) {
    if (e.overUI) { ti = 0.45; tx = -1.35; ty = 0.95; return; }
    var q = toPlanet(e.x, e.y); tx = q[0]; ty = q[1]; ti = 1;
    if (e.kind === 'down' && !fling) {
      var d = Math.hypot(q[0], q[1]) || 1, ux = q[0] / d, uy = q[1] / d;
      if (d < 1.15) { q = [ux * 1.6, uy * 1.6]; d = 1.6; }
      fling = { sx: ux * 0.95, sy: uy * 0.95, ex: q[0], ey: q[1], t: 0, col: moonColor(), r: 0.07 + rnd() * 0.05 };
    }
  }

  function step(t, dt) {
    dt = Math.min(dt, 0.1);
    var kk = dt > 0 ? 1 - Math.exp(-dt * 6) : 1; // still redraws snap to the lamp lx += (tx - lx) * kk; ly += (ty - ly) * kk; li += (ti - li) * kk;
    var hl = Math.hypot(lx, ly); heat += ((li > 0.8 && hl < 1.6 ? 1 : 0) - heat) * kk * 0.5;
    for (var i = 0; i < ND; i++) {
      var dr = drips[i], ax = Math.cos(dr.ang), ay = Math.sin(dr.ang);
      var dx = ax - lx, dy = ay - ly; dr.heat = Math.exp(-(dx * dx + dy * dy) * 1.3) * li;
      dr.ph += dt * dr.sp * (1 + dr.heat * 4.5);
      if (dr.ph >= 1) { // pinch off: the droplet floats away and becomes a tiny moon
        dr.ph -= 1;
        var e = dripEnd(dr, 0.97);
        dr.drop = { x: e[0], y: e[1], vx: e[2] * 0.12, vy: e[3] * 0.12 - 0.03, r: dr.w * 1.15 + 0.012, age: 0 };
      }
      var ph = dr.ph, grow = Math.min(1, ph / 0.85), neck = ph > 0.85 ? 1 - (ph - 0.85) / 0.15 : 1;
      var en = dripEnd(dr, ph), base = 1.0;
      DA[i * 4] = ax * base; DA[i * 4 + 1] = ay * base; DA[i * 4 + 2] = en[0]; DA[i * 4 + 3] = en[1]; DM[i * 4] = en[4]; DM[i * 4 + 1] = en[5];
      DB[i * 4] = dr.w * (0.55 + 0.45 * neck) * (1 + dr.heat * 0.3); DB[i * 4 + 1] = dr.w * (0.9 + 0.7 * grow);
      if (dr.drop) {
        var o = dr.drop; o.age += dt; o.x += o.vx * dt; o.y += o.vy * dt; o.vx *= 0.995;
        if (o.age > 5) { if (moons.length < 9) moonAt(o.x, o.y, Math.max(0.035, o.r * 0.9), null); dr.drop = null; }
      }
      if (dr.drop) { DC[i * 4] = dr.drop.x; DC[i * 4 + 1] = dr.drop.y; DC[i * 4 + 2] = dr.drop.r * Math.min(1, (5 - dr.drop.age) * 2); }
      else DC[i * 4 + 2] = 0;
    }
    var n = moons.length;
    for (var j = 0; j < n; j++) {
      var m = moons[j]; m.th += m.w * dt; if (m.born < 1) m.born = Math.min(1, m.born + dt);
      var ox = Math.cos(m.th) * m.rho, oy = Math.sin(m.th) * m.rho * FLAT;
      var x = ox * CT - oy * ST, y = ox * ST + oy * CT;
      MO[j * 4] = x; MO[j * 4 + 1] = y; MO[j * 4 + 2] = m.r * (1 + 0.04 * Math.sin(t * 1.3 + m.k * 9)); MO[j * 4 + 3] = m.k;
      MC[j * 4] = m.col[0]; MC[j * 4 + 1] = m.col[1]; MC[j * 4 + 2] = m.col[2]; MC[j * 4 + 3] = Math.sin(m.th) < 0 ? 1 : 0;
    }
    var FA = [0, 0, 0, 0], FB = [0, 0, 0, 0];
    if (fling) {
      fling.t += dt; var u = Math.min(1, fling.t / 0.75), e2 = 1 - Math.pow(1 - u, 3);
      var bx = fling.sx + (fling.ex - fling.sx) * e2, by = fling.sy + (fling.ey - fling.sy) * e2 + Math.sin(u * Math.PI) * 0.12;
      var strand = u < 0.85 ? 0.05 * (1 - u / 0.85) + 0.006 : 0, squash = 0;
      if (fling.t > 0.75) { var s2 = (fling.t - 0.75) / 0.45; squash = Math.sin(Math.min(1, s2) * Math.PI) * (1 - s2 * 0.5); }
      FA = [fling.sx, fling.sy, bx, by]; FB = [fling.r * (1 + squash * 0.25), strand, squash, 1];
      if (strand === 0) FA = [bx, by, bx, by];
      if (fling.t > 1.2) { moonAt(fling.ex, fling.ey, fling.r, fling.col); fling = null; FB = [0, 0, 0, 0]; }
    }
    return [FA, FB];
  }
  function dripEnd(dr, ph) {
    var ax = Math.cos(dr.ang), ay = Math.sin(dr.ang);
    var dx = -0.78 + ay * 0.15, dy = -0.62, dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
    var L = dr.len * (0.25 + 0.75 * Math.min(1, ph / 0.85)) * (1 + dr.heat * 0.5);
    var mx = ax + dx * L * 0.55, my = ay + dy * L * 0.55, ex = dx * 0.8 - 0.1, ey = dy - 0.45, el = Math.hypot(ex, ey);
    ex /= el; ey /= el;
    return [mx + ex * L * 0.5, my + ey * L * 0.5, ex, ey, mx, my];
  }
  // pre-roll so the still frame already has drips, drops and moons in motion
  for (var pr = 0; pr < 60; pr++) step(pr * 0.1, 0.1);

  function frame(t, dt) {
    var f = step(t, dt || 0), d = api.pxWidth / W;
    gl.uniform2f(U.R, api.pxWidth, api.pxHeight);
    gl.uniform3f(U.PC, cx * d, (H - cy) * d, Rp * d);
    gl.uniform1f(U.T, t); gl.uniform1f(U.SEED, seed); gl.uniform1f(U.HEAT, heat); gl.uniform1f(U.RIM, 0.5 + 0.5 * Math.sin(t * 0.3));
    gl.uniform3f(U.LAMP, lx, ly, li);
    gl.uniform4fv(U.DA, DA); gl.uniform4fv(U.DB, DB); gl.uniform4fv(U.DC, DC); gl.uniform4fv(U.DM, DM);
    gl.uniform4fv(U.MO, MO); gl.uniform4fv(U.MC, MC); gl.uniform1i(U.MN, moons.length);
    gl.uniform4fv(U.FA, f[0]); gl.uniform4fv(U.FB, f[1]);
    ['C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'].forEach(function (k, i) { gl.uniform3fv(U[k], api.vec3(S[i])); });
    gl.uniform3fv(U.BG, api.vec3(api.palette.bg));
    gl.uniform4fv(U.Z, api.zonesGL); gl.uniform1i(U.ZN, api.zoneCount);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  return { frame: frame, resize: place, zones: function () {}, pointer: pointer };
});
