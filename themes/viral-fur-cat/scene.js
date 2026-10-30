// Purrfect Plush: a giant fluffy kitten peeks up from the bottom-right over a dark plush fur carpet.
// Move: the carpet pile combs in your direction and slowly relaxes; the cat's star eyes follow you.
// Click: a pat. A paw print presses into the pile, the cat squints with flattened ears, hearts float up;
// rapid pats build purr sparkles.
// sceneColors: 0 carpet root, 1 carpet tip sheen, 2 cat fur light, 3 cat fur shade,
//              4 blush pink (beans, nose, hearts), 5 eye dark, 6 sparkle white, 7 lavender rim.
T3Scene(function (api) {
  var gl = api.canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) throw Error('WebGL unavailable');
  var FS = [
    'precision highp float;',
    'uniform vec2 RES,M,LOOK; uniform float SC,T,K,PURR,ACT,BLINK; uniform vec3 CAT;',
    'uniform vec3 BG,C0,C1,C2,C3,C4,C5,C6,C7;',
    'uniform sampler2D FLD; uniform vec4 Z[8]; uniform int ZN;',
    'uniform vec4 PW[6]; uniform vec4 HT[10]; uniform vec4 SP[12];',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}',
    'float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}',
    'mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}',
    'float zmask(float fe){float m=0.;for(int i=0;i<8;i++){if(i>=ZN)break;vec2 d=max(max(Z[i].xy-gl_FragCoord.xy,gl_FragCoord.xy-Z[i].zw),vec2(0.));m=max(m,1.-smoothstep(0.,fe*SC,length(d)));}return m;}',
    // paw print sdf in unit space (y down)
    'float paw(vec2 l){float d=length((l-vec2(0.,.22))/vec2(.46,.36))-1.;d*=.36;',
    ' d=min(d,length(l-vec2(-.52,-.26))-.17);d=min(d,length(l-vec2(-.19,-.56))-.18);',
    ' d=min(d,length(l-vec2(.19,-.56))-.18);d=min(d,length(l-vec2(.52,-.26))-.17);return d;}',
    'float heart(vec2 p){p.x=abs(p.x);p.y=-p.y+.25;if(p.y+p.x>1.)return length(p-vec2(.25,.75))-.3536;',
    ' vec2 a=p-vec2(0.,1.),b=p-.5*max(p.x+p.y,0.);return sqrt(min(dot(a,a),dot(b,b)))*sign(p.x-p.y);}',
    // cat head sdf, q in units of R, y up
    'float tri(vec2 p,vec2 q){p.x=abs(p.x);vec2 a=p-q*clamp(dot(p,q)/dot(q,q),0.,1.);vec2 b=p-q*vec2(clamp(p.x/q.x,0.,1.),1.);',
    ' float s=-sign(q.y);vec2 d=min(vec2(dot(a,a),s*(p.x*q.y-p.y*q.x)),vec2(dot(b,b),s*(p.y-q.y)));return -sqrt(d.x)*sign(d.y);}',
    'vec2 earL(vec2 q,float s){return rot(s*(.32+.95*K))*(q-vec2(s*.58,.62-.2*K));}',
    'float earD(vec2 q,float s){vec2 l=earL(q,s);return tri(vec2(l.x,.5-l.y),vec2(.3,.78))-.12;}',
    'float catD(vec2 q){float d=(length(q/vec2(1.,.84))-1.)*.84;',
    ' d=smin(d,(length((q-vec2(0.,-.3))/vec2(1.1,.62))-1.)*.62,.2);',
    ' d=smin(d,earD(q,-1.),.13);d=smin(d,earD(q,1.),.13);return d;}',
    'void main(){',
    ' vec2 p=vec2(gl_FragCoord.x,RES.y*SC-gl_FragCoord.y)/SC;',
    ' float m=zmask(42.),mc=zmask(70.);',
    // cat geometry first (so its interior skips the carpet)
    ' vec2 q=(p-CAT.xy)/CAT.z;q.y=-q.y;float R=CAT.z;',
    ' float ang=atan(q.y,q.x),rr=length(q);',
    ' float dC=catD(q);',
    ' float fl=.035+.05*noise(vec2(ang*40.,1.))+.04*noise(vec2(ang*130.,7.));',
    ' float hairs=smoothstep(.3,.8,noise(vec2(ang*520.,rr*9.)))*.6+smoothstep(.4,.9,noise(vec2(ang*260.,rr*5.+9.)))*.5;',
    ' float cov=dC<0.?1.:(1.-smoothstep(0.,fl,dC))*(.5+.5*hairs);',
    ' cov=max(cov,1.-smoothstep(-.012,.004,dC));',
    ' vec3 col;',
    ' if(cov<.999){',
    // paw prints pressed into the pile
    '  float flt=0.,rim=0.;',
    '  for(int i=0;i<6;i++){vec4 w=PW[i];if(w.z<0.)continue;float pr=smoothstep(0.,.12,w.z)*(1.-smoothstep(3.5,8.,w.z));',
    '   vec2 l=rot(w.w)*(p-w.xy)/34.;float d=paw(l);flt=max(flt,pr*(1.-smoothstep(-.04,.05,d)));rim=max(rim,pr*exp(-abs(d-.06)*22.));}',
    '  vec4 fd=texture2D(FLD,p/RES);vec2 cb=fd.rg*2.-1.;',
    '  vec2 dir=normalize(vec2(.2,1.)+cb*2.6);',
    '  float lowm=noise(p*.012)*.6+noise(p*.03)*.4;',
    '  float best=0.,tip=0.;',
    '  if(m<.985){',
    '   vec2 g=floor(p/9.);',
    '   for(int j=-2;j<=2;j++)for(int i=-2;i<=2;i++){vec2 id=g+vec2(float(i),float(j));',
    '    vec2 root=(id+vec2(hash(id),hash(id+7.13)))*9.;float h3=hash(id+3.1);',
    '    vec2 sd=normalize(dir+(vec2(hash(id+1.7),hash(id+9.2))-.5)*.55);',
    '    float L=(10.+8.*h3)*(1.-.6*flt);vec2 v=p-root;float a=clamp(dot(v,sd),0.,L);float dd=length(v-sd*a);',
    '    float k=a/L;float wd=1.5*(1.-.55*k)+.35;float s=1.-smoothstep(wd*.45,wd,dd);',
    '    float val=s*(.35+.65*k)*(.55+.45*h3);if(val>best){best=val;tip=k;}}',
    '  }',
    '  float sheen=.45+.75*smoothstep(-1.,1.,dot(dir,normalize(vec2(-.45,-.9))));',
    '  sheen+=.35*length(cb);',
    '  float edge=smoothstep(.2,1.,length((p/RES-vec2(.42,.45))*vec2(1.2,1.)));',
    '  vec3 base=C0*(.55+.4*lowm)*(.8+.45*edge);',
    '  vec3 sc=mix(C0,C1,tip*tip)*sheen*(.85+.3*lowm)*(.8+.35*edge);',
    '  col=mix(base*.75,sc,best);',
    '  col=mix(col,C0*.4+C4*.07,flt*.85);col+=C7*.16*rim;',
    '  float pd=length(p-M);col+=C7*.10*exp(-pd*pd/(150.*150.))*ACT*(1.-m);',
    '  col*=1.-.5*exp(-max(dC,0.)*12.)*(1.-cov);',
    '  col=mix(col,mix(BG,col,.28),m);',
    ' } else col=BG;',
    // cat fur
    ' if(cov>.001){',
    '  vec2 nq=q/vec2(1.05,.92);nq*=min(1.,.97/max(length(nq),.001));vec3 n=normalize(vec3(nq,sqrt(max(.02,1.-dot(nq,nq)))));',
    '  float dif=max(0.,dot(n,normalize(vec3(-.45,.6,.8))));',
    '  float fib=noise(vec2(ang*90.,rr*9.))*.55+noise(vec2(ang*200.,rr*22.))*.45;',
    '  vec3 fur=mix(C3,C2,.35+.65*dif)*(.84+.22*fib);',
    '  fur+=C7*.22*smoothstep(-.14,.02,dC);fur=mix(fur,C2*.92+C7*.12,smoothstep(-.01,.03,dC));',
    '  fur*=.72+.28*smoothstep(-1.1,-.15,q.y);',
    '  for(int s=0;s<2;s++){float sg=float(s)*2.-1.;vec2 l=earL(q,sg);',
    '   float ie=tri(vec2(l.x*1.15,.4-l.y),vec2(.2,.58))-.04;fur=mix(fur,C4*.7+C2*.3,(1.-smoothstep(-.08,.06,ie))*.55*smoothstep(-.3,.2,l.y));}',
    '  for(int s=0;s<2;s++){float sg=float(s)*2.-1.;vec2 b=q-vec2(sg*.56,-.2);fur=mix(fur,C4,(.28+.3*K)*exp(-dot(b,b)*26.));}',
    // eyes
    '  for(int s=0;s<2;s++){float sg=float(s)*2.-1.;vec2 ep=q-vec2(sg*.32,.05);',
    '   float bl=max(BLINK,smoothstep(.1,.45,K));float ed=length(ep/vec2(.205,.225*(1.-.93*bl)+.001));',
    '   vec2 lo=LOOK*.055;float ir=length(ep-lo);',
    '   vec3 ec=mix(C5*2.6+C7*.18,C5,smoothstep(0.,.18,ir));',
    '   ec*=.55+.45*smoothstep(.045,.085,length(ep-lo*1.25));',
    '   ec+=C4*.55*smoothstep(.55,1.,ed)*smoothstep(.02,-.16,ep.y);',
    '   ec+=vec3(.07)*(1.-smoothstep(0.,.16,length(ep-vec2(-.06,.1))));',
    '   vec2 sp=ep-lo*.45-vec2(-.028,.045);float tw=1.+.07*sin(T*3.1+sg);',
    '   float st=pow(abs(sp.x/(.078*tw)),.55)+pow(abs(sp.y/(.105*tw)),.55);ec=mix(ec,C6,1.-smoothstep(.9,1.05,st));',
    '   vec2 s2=ep-lo*.45-vec2(.075,.1);float st2=pow(abs(s2.x/.022),.55)+pow(abs(s2.y/.03),.55);ec=mix(ec,C6,1.-smoothstep(.9,1.1,st2));',
    '   ec=mix(ec,C6*.95,1.-smoothstep(.016,.024,length(ep-lo*.45-vec2(-.085,-.08))));',
    '   float eye=(1.-smoothstep(.95,1.03,ed))*(1.-smoothstep(.85,.98,bl));fur=mix(fur,ec,eye);',
    '   float arc=abs(length(ep-vec2(0.,-.1))-.13);float hap=(1.-smoothstep(.012,.024,arc))*step(-.04,ep.y)*smoothstep(.6,.95,bl);',
    '   fur=mix(fur,C5*1.4,hap);}',
    // nose, mouth, whisker roots
    '  float nd=heart((q-vec2(0.,-.19))/vec2(.085,-.075)*vec2(1.,1.))*.075;',
    '  vec3 nc=mix(C4,C6,.35*(1.-smoothstep(0.,.03,length(q-vec2(-.02,-.165)))));fur=mix(fur,nc*.95,1.-smoothstep(-.004,.006,nd));',
    '  for(int s=0;s<2;s++){float sg=float(s)*2.-1.;float md=abs(length(q-vec2(sg*.055,-.27))-.055);',
    '   fur=mix(fur,C5*2.,(1.-smoothstep(.006,.013,md))*step(q.y,-.27)*.85);}',
    '  col=mix(col,mix(fur,mix(BG,fur,.42),mc*.6),cov);',
    ' }',
    // whiskers
    ' for(int s=0;s<2;s++){float sg=float(s)*2.-1.;for(int w=0;w<3;w++){float fw=float(w);',
    '  vec2 a0=vec2(sg*.4,-.2-fw*.05);vec2 dv=normalize(vec2(sg,.12-.16*fw));vec2 v=q-a0;float t=clamp(dot(v,dv),0.,.85);',
    '  float wd=length(v-dv*t)*R;float wa=(1.-smoothstep(.4,1.3,wd))*(1.-t/.85)*.55*(1.-mc);col=mix(col,C6,wa);}}',
    // hearts and purr sparkles
    ' float pm=1.-m*.85;',
    ' for(int i=0;i<10;i++){vec4 h=HT[i];if(h.z<0.)continue;float sz=h.w*smoothstep(0.,.22,h.z);float al=1.-smoothstep(1.6,2.6,h.z);',
    '  vec2 hp=(p-h.xy)/max(sz,1.);float hd=heart(hp);float hc=1.-smoothstep(-.02,.04,hd);',
    '  vec3 hcol=C4*(.75+.35*smoothstep(.6,-.4,hp.y))+C6*.6*(1.-smoothstep(0.,.18,length(hp-vec2(-.2,-.3))));',
    '  col=mix(col,hcol,hc*al*pm);col+=C4*.15*exp(-max(hd,0.)*5.)*al*pm;}',
    ' for(int i=0;i<12;i++){vec4 s=SP[i];if(s.z<0.)continue;float al=sin(clamp(s.z/1.4,0.,1.)*3.14159);',
    '  vec2 d=(p-s.xy)/s.w;float st=pow(abs(d.x),.5)+pow(abs(d.y),.5);',
    '  col+=(C6*(1.-smoothstep(.6,1.,st))+mix(C4,C7,.5)*.35*exp(-dot(d,d)*1.5))*al*pm;}',
    ' col+=(hash(gl_FragCoord.xy+T)-.5)*.012;',
    ' gl_FragColor=vec4(col,1.);',
    '}'].join('\n');
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
  ['RES', 'M', 'LOOK', 'SC', 'T', 'K', 'PURR', 'ACT', 'BLINK', 'CAT', 'BG', 'C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'FLD', 'Z[0]', 'ZN', 'PW[0]', 'HT[0]', 'SP[0]']
    .forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });

  // comb field: a small CPU grid uploaded as a linear-filtered texture
  var GW = 64, GH = 40, fx = new Float32Array(GW * GH), fy = new Float32Array(GW * GH), px8 = new Uint8Array(GW * GH * 4);
  var tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  function upload() {
    for (var i = 0; i < GW * GH; i++) { px8[i * 4] = Math.max(0, Math.min(255, 128 + fx[i] * 127)); px8[i * 4 + 1] = Math.max(0, Math.min(255, 128 + fy[i] * 127)); px8[i * 4 + 2] = 128; px8[i * 4 + 3] = 255; }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GW, GH, 0, gl.RGBA, gl.UNSIGNED_BYTE, px8);
  }
  // seed a few lazy swirls so the still frame already shows combed pile
  var R0 = api.random() * 9;
  for (var j = 0; j < GH; j++) for (var i = 0; i < GW; i++) {
    var a = api.noise(i * .09 + R0, j * .09) * 6.28, s = Math.max(0, api.noise(i * .05 + 20, j * .05 + R0) - .45) * 1.6;
    fx[j * GW + i] = Math.cos(a) * s; fy[j * GW + i] = Math.sin(a) * s;
  }
  upload();
  function brush(x, y, dx, dy, rad, k, radial) {
    var W = api.width, H = api.height, ci = x / W * GW, cj = y / H * GH, rx = rad / W * GW, ry = rad / H * GH;
    for (var j = Math.max(0, Math.floor(cj - ry)); j <= Math.min(GH - 1, Math.ceil(cj + ry)); j++)
      for (var i = Math.max(0, Math.floor(ci - rx)); i <= Math.min(GW - 1, Math.ceil(ci + rx)); i++) {
        var ox = ((i + .5) / GW * W) - x, oy = ((j + .5) / GH * H) - y, d = Math.sqrt(ox * ox + oy * oy);
        if (d > rad) continue;
        var w = (1 - d / rad) * (1 - d / rad) * k, n = j * GW + i, tx = dx, ty = dy;
        if (radial) { tx = ox / (d + 1); ty = oy / (d + 1); }
        fx[n] += (tx - fx[n]) * w; fy[n] += (ty - fy[n]) * w;
      }
  }

  var S = api.palette.scene, cat = [0, 0, 100], mx = -999, my = -999, lx = null, ly = null, act = 0, actT = 0;
  var K = 0, purr = 0, blinkT = 2 + api.random() * 3, blink = 0, look = [0, 0], lookT = [0, 0];
  var paws = [], hearts = [], sparks = [], pawI = 0, PW = new Float32Array(24), HT = new Float32Array(40), SP = new Float32Array(48);
  for (var n0 = 0; n0 < 6; n0++) paws.push({ x: 0, y: 0, age: -1, r: 0 });
  for (n0 = 0; n0 < 10; n0++) hearts.push({ x: 0, y: 0, vx: 0, vy: 0, age: -1, s: 0 });
  for (n0 = 0; n0 < 12; n0++) sparks.push({ x: 0, y: 0, age: -1, s: 0 });
  function oldest(list) { var o = list[0]; for (var i = 1; i < list.length; i++) { if (list[i].age < 0) return list[i]; if (list[i].age > o.age) o = list[i]; } return o.age < 0 ? o : o; }
  function free(list) { for (var i = 0; i < list.length; i++) if (list[i].age < 0) return list[i]; return oldest(list); }
  function heart(x, y, s) { var h = free(hearts); h.x = x; h.y = y; h.vx = (api.random() - .5) * 40; h.vy = -55 - api.random() * 45; h.age = 0; h.s = s; }
  function spark(x, y, s) { var p = free(sparks); p.x = x; p.y = y; p.age = 0; p.s = s; }

  function place(zz) {
    var W = api.width, H = api.height, E = W * .5, zs = (zz && zz.length ? zz : api.zones) || [];
    for (var i = 0; i < zs.length; i++) { var z = zs[i]; if (z.kind === 'messages' || z.kind === 'composer' || z.kind === 'hero') E = Math.max(E, Math.min(W * .88, z.x + z.w)); }
    var R = api.preview ? Math.min(H * .44, W * .3) : Math.min(H * .31, W * .22);
    cat[2] = R; cat[0] = Math.min(W - R * .42, Math.max(W - R * .62, E + R * .36)); cat[1] = H - R * .62;
    gl.viewport(0, 0, api.pxWidth, api.pxHeight);
  }
  place();

  return {
    resize: function () { place(); }, zones: function (z) { place(z); },
    pointer: function (e) {
      if (e.overUI) { act = 0; lx = null; return; }
      act = 1; mx = e.x; my = e.y;
      if (e.kind === 'move' && lx !== null) {
        var dx = e.x - lx, dy = e.y - ly, sp = Math.sqrt(dx * dx + dy * dy);
        if (sp > .5) brush(e.x, e.y, dx / sp, dy / sp, 95, Math.min(.65, sp / 40), false);
      }
      lx = e.x; ly = e.y;
      if (e.kind === 'down') {
        var p = paws[pawI++ % paws.length]; p.x = e.x; p.y = e.y; p.age = 0; p.r = (api.random() - .5) * .7;
        brush(e.x, e.y, 0, 0, 70, .8, true);
        K = 1; purr = Math.min(3, purr + .45);
        heart(e.x, e.y - 30, 15 + api.random() * 6); heart(e.x - 18, e.y - 18, 10 + api.random() * 5);
        heart(cat[0] + (api.random() - .5) * cat[2] * .8, cat[1] - cat[2] * .95, 18 + api.random() * 8);
        if (purr > .8) for (var i = 0; i < Math.min(5, Math.floor(purr * 2)); i++) {
          var a = api.random() * 6.28, r = cat[2] * (.9 + api.random() * .4);
          spark(cat[0] + Math.cos(a) * r, cat[1] - Math.abs(Math.sin(a)) * r, 9 + api.random() * 10);
        }
      }
    },
    frame: function (t, dt) {
      dt = Math.min(dt, .1);
      var W = api.width, H = api.height, i;
      K *= Math.exp(-dt * 1.1); purr *= Math.exp(-dt * .5);
      actT += (act - actT) * Math.min(1, dt * 4);
      var dec = Math.exp(-dt * .28);
      for (i = 0; i < GW * GH; i++) { fx[i] *= dec; fy[i] *= dec; }
      if (dt > 0) upload();
      blinkT -= dt; if (blinkT < 0) { blink = 1; blinkT = 2.5 + api.random() * 4; }
      blink = Math.max(0, blink - dt * 7);
      var ex = cat[0], ey = cat[1] - cat[2] * .05, bob = Math.sin(t * 1.2) * cat[2] * .01;
      if (actT > .05) { var dx = mx - ex, dy = my - ey, d = Math.sqrt(dx * dx + dy * dy) + 1, k = Math.min(1, d / 260); lookT[0] = dx / d * k; lookT[1] = -dy / d * k; }
      else { lookT[0] = Math.sin(t * .31) * .6 - .3; lookT[1] = Math.sin(t * .23 + 1) * .3; }
      var lk = dt > 0 ? Math.min(1, dt * 7) : 1; look[0] += (lookT[0] - look[0]) * lk; look[1] += (lookT[1] - look[1]) * lk;
      for (i = 0; i < 6; i++) { var p = paws[i]; if (p.age >= 0) { p.age += dt; if (p.age > 8) p.age = -1; } PW[i * 4] = p.x; PW[i * 4 + 1] = p.y; PW[i * 4 + 2] = p.age; PW[i * 4 + 3] = p.r; }
      for (i = 0; i < 10; i++) { var h = hearts[i]; if (h.age >= 0) { h.age += dt; h.x += (h.vx + Math.sin(h.age * 4 + i) * 22) * dt; h.y += h.vy * dt; if (h.age > 2.6) h.age = -1; } HT[i * 4] = h.x; HT[i * 4 + 1] = h.y; HT[i * 4 + 2] = h.age; HT[i * 4 + 3] = h.s; }
      if (purr > 1.2 && dt > 0 && api.random() < dt * purr * 3) { var a = api.random() * 3.14, r = cat[2] * (1 + api.random() * .35); spark(cat[0] - Math.cos(a) * r, cat[1] - Math.sin(a) * r, 8 + api.random() * 9); }
      for (i = 0; i < 12; i++) { var s = sparks[i]; if (s.age >= 0) { s.age += dt; s.y -= dt * 12; if (s.age > 1.4) s.age = -1; } SP[i * 4] = s.x; SP[i * 4 + 1] = s.y; SP[i * 4 + 2] = s.age; SP[i * 4 + 3] = s.s; }
      gl.uniform2f(U.RES, W, H); gl.uniform1f(U.SC, api.pxWidth / W);
      gl.uniform2f(U.M, mx, my); gl.uniform2f(U.LOOK, look[0], look[1]);
      gl.uniform1f(U.T, t); gl.uniform1f(U.K, K); gl.uniform1f(U.PURR, purr); gl.uniform1f(U.ACT, actT); gl.uniform1f(U.BLINK, blink);
      gl.uniform3f(U.CAT, cat[0], cat[1] + bob, cat[2]);
      gl.uniform3fv(U.BG, api.vec3(api.palette.bg));
      for (i = 0; i < 8; i++) gl.uniform3fv(U['C' + i], api.vec3(S[i] || api.palette.accent));
      gl.uniform1i(U.FLD, 0);
      gl.uniform4fv(U['Z[0]'], api.zonesGL); gl.uniform1i(U.ZN, api.zoneCount);
      gl.uniform4fv(U['PW[0]'], PW); gl.uniform4fv(U['HT[0]'], HT); gl.uniform4fv(U['SP[0]'], SP);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  };
});
