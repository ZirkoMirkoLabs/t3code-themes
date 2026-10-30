// Jelly Friend v2: a giant translucent gelatin creature at the bottom-right, bleeding off-frame, on true black.
// Adapted from webgl-viral/jelly-friend (read-only). One full-screen fragment pass; physics is spring-based in JS.
// sceneColors: 0 mint gel, 1 deep teal absorption, 2 light/specular, 3 cherry, 4 grape, 5 tangerine, 6 glass plate.
// Pointer dents the body and pushes treats and bubbles; click = "boing" screen ripple, squash, blink, maybe a slurp.
// Safe zones: everything is dimmed to ~25% and detail is muted inside text zones (api.zonesGL).
T3Scene(function (api) {
  var gl = api.canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) throw Error('WebGL unavailable');
  var FS = [
    'precision highp float;',
    'uniform vec2 SZ; uniform float DPR,T;',
    'uniform vec3 BG,C0,C1,C2,C3,C4,C5,C6;',
    'uniform vec4 BODY,WOB,MODE,DENT,PUSH,FACE,GAZE,PLATE,TS;',
    'uniform vec4 RP[2]; uniform vec4 TR[5]; uniform vec4 Z[8]; uniform int ZN;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*noise(p);p=p*2.07+vec2(1.7,9.2);a*=.5;}return v;}',
    'float caus(vec2 x){float c=0.,a=.7;for(int i=0;i<3;i++){vec2 w=x+vec2(sin(x.y*1.3+T*.9),cos(x.x*1.1-T*.7))*.35;float n=noise(w);c+=pow(1.-abs(n*2.-1.),7.)*a;x=x*1.9+vec2(T*.13,-T*.11);a*=.6;}return c;}',
    'float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}',
    'float safe(){float m=0.;for(int i=0;i<8;i++){if(i>=ZN)break;vec2 d=max(max(Z[i].xy-gl_FragCoord.xy,gl_FragCoord.xy-Z[i].zw),vec2(0.));m=max(m,1.-smoothstep(0.,40.*DPR,length(d)));}return m;}',
    // body signed distance (CSS px, bottom-left origin)
    'float bodyD(vec2 p){vec2 c=BODY.xy;float R=BODY.z;vec2 d=p-c;d.x-=d.y*WOB.z;d/=WOB.xy;',
    ' float m=length((d-vec2(0.,.45*R))*vec2(.95,1.08))-R;',
    ' float b=length((d-vec2(0.,.1*R))*vec2(.70,1.9))-R*.98;',
    ' float s=smin(m,b,R*.3);',
    ' float a=atan(d.y-.45*R,d.x);',
    ' s+=R*(MODE.x*cos(2.*a+MODE.z)+MODE.y*sin(3.*a-MODE.z*1.3)+.006*sin(a*5.+T*1.7)+.004*sin(a*9.-T*2.3));',
    ' vec2 dm=p-DENT.xy;s+=DENT.z*DENT.w*.55*exp(-dot(dm,dm)/(DENT.w*DENT.w));',
    ' return max(s,-d.y-R*.015);}',
    // treat shapes
    'float sdStar(vec2 p,float r,float rf){vec2 k1=vec2(.809017,-.587785);vec2 k2=vec2(-k1.x,k1.y);p.x=abs(p.x);p-=2.*max(dot(k1,p),0.)*k1;p-=2.*max(dot(k2,p),0.)*k2;p.x=abs(p.x);p.y-=r;vec2 ba=rf*vec2(-k1.y,k1.x)-vec2(0.,1.);float h=clamp(dot(p,ba)/dot(ba,ba),0.,r);return length(p-ba*h)*sign(p.y*ba.x-p.x*ba.y);}',
    'float dot2(vec2 v){return dot(v,v);}',
    'float sdHeart(vec2 p){p.x=abs(p.x);if(p.y+p.x>1.)return sqrt(dot2(p-vec2(.25,.75)))-.353553;return sqrt(min(dot2(p-vec2(0.,1.)),dot2(p-.5*max(p.x+p.y,0.))))*sign(p.x-p.y);}',
    'float treatD(vec2 lp,float s,float ty){',
    ' if(ty<.5){vec2 q=abs(lp-vec2(0.,s*.1))-vec2(s*.62);return length(max(q,0.))+min(max(q.x,q.y),0.)-s*.3;}',
    ' if(ty<1.5){return max(length((lp+vec2(0.,s*.55))/vec2(1.15,1.25))-s,-(lp.y+s*.55))-s*.06;}',
    ' if(ty<2.5){return sdStar(lp,s*.95,.5)-s*.16;}',
    ' if(ty<3.5){return abs(length(lp)-s*.62)-s*.3;}',
    ' return sdHeart(lp/(s*1.7)+vec2(0.,.52))*s*1.7-s*.05;}',
    'vec3 tcol(float ty){if(ty<.5)return C3;if(ty<1.5)return C4;if(ty<2.5)return C5;if(ty<3.5)return C0;return mix(C3,C2,.35);}',
    // composite one treat over col
    'vec3 treat(vec3 col,vec2 p,vec4 tr,float ty,float blur){if(tr.z<.5)return col;vec2 lp=p-tr.xy;lp.x/=1.+tr.w*.5;lp.y=(lp.y+tr.z)/(1.-tr.w)-tr.z;',
    ' float d=treatD(lp,tr.z,ty);if(d>blur*3.+2.)return col;vec3 tc=tcol(ty);float th=clamp(-d/(tr.z*.45),0.,1.);',
    ' vec3 g=tc*(.18+.85*sqrt(th));vec2 hl=(lp-vec2(-.28,.34)*tr.z)/tr.z;g+=C2*.55*exp(-dot(hl*vec2(2.2,4.),hl*vec2(2.2,4.)));g+=tc*exp(-abs(d)/(tr.z*.09))*.6;',
    ' float a=smoothstep(blur,-blur,d)*(.62+.33*th);return mix(col,g,a);}',
    // background: halo, bokeh, sparkles, plate, treats, floor caustics, reflection
    'vec3 bgc(vec2 q,vec2 pq,float m){vec3 col=BG;float R=BODY.z;',
    ' vec2 hc=(q-(BODY.xy+vec2(0.,.6*R)))/R;float hd=dot(hc,hc);col+=C1*.20*exp(-hd*.8)+C0*.05*exp(-hd*.25);',
    ' float sx=(q.x-BODY.x)/R;col+=C0*.035*exp(-sx*sx*1.6)*smoothstep(BODY.y,SZ.y,q.y);',
    ' for(int i=0;i<6;i++){float fi=float(i);vec2 o=vec2(hash(vec2(fi,1.3))*SZ.x*.75,SZ.y*(.25+.7*hash(vec2(fi,7.1))))+vec2(sin(T*.07+fi*2.),cos(T*.05+fi))*60.;float r=50.+110.*hash(vec2(fi,3.9));',
    '  vec3 cc=fi<1.5?C3:fi<3.?C4:fi<4.5?C5:C0;col+=cc*.06*smoothstep(r,r*.45,length(pq-o));}',
    ' vec2 g=pq/26.+vec2(0.,T*.25);vec2 ci=floor(g),cf=fract(g)-.5;float h=hash(ci);if(h>.86){vec2 off=(vec2(hash(ci+3.1),hash(ci+7.7))-.5)*.6;float r=.04+.1*fract(h*37.);float l=length(cf-off);',
    '  col+=mix(C2,C0,.5)*(smoothstep(r,r*.5,l)*.25+exp(-l*l*900.)*.3)*(1.-m*.8)*(.5+.5*sin(T*1.3+h*40.));}',
    ' if(PLATE.z>1.){vec2 pe=(q-PLATE.xy)/PLATE.zw;float e=length(pe)-1.;col+=C6*.05*smoothstep(.05,-.05,e)+C6*.22*exp(-abs(e)*28.)*(.6+.4*pe.y)+C2*.06*exp(-pow((pe.y-.35)*6.,2.))*smoothstep(.05,-.05,e);',
    '  for(int i=0;i<5;i++){vec2 gp=(q-TR[i].xy-vec2(0.,-TR[i].z*.95))/(TR[i].z*vec2(1.3,.35));col+=tcol(float(i))*.22*exp(-dot(gp,gp))*step(.5,TR[i].z);}',
    '  for(int i=0;i<5;i++){col=treat(col,q,TR[i],float(i),PLATE.z*.012+1.5);}}',
    ' float fx=(q.x-BODY.x)/R,fy=(q.y-BODY.y)/R;float pool=exp(-fx*fx*.55-pow((fy+.06)/.17,2.));',
    ' col+=C0*(caus(vec2(fx*4.,fy*11.)+pq*.002)*.5+.12)*pool;',
    ' if(q.y<BODY.y){float rd=bodyD(vec2(q.x,2.*BODY.y-q.y));float fade=exp(-(BODY.y-q.y)/(R*.22));col+=(C0*.07*smoothstep(2.,-2.,rd)+C0*.2*exp(-abs(rd)/(R*.015)))*fade;}',
    ' return col;}',
    'void main(){vec2 p=gl_FragCoord.xy/DPR;float m=safe();float R=BODY.z;',
    ' vec2 q=p;float ring=0.;for(int i=0;i<2;i++){if(RP[i].w<=0.)continue;vec2 d=p-RP[i].xy;float L=length(d)+.001;float x=L-RP[i].z*1100.;float w=exp(-x*x/5000.)*RP[i].w*exp(-RP[i].z*1.1);q+=d/L*sin(x*.05)*w*18.;ring+=w*(.5+.5*sin(x*.05));}',
    ' vec2 pd=q-PUSH.xy;float pl=length(pd)+.001;vec2 pq=q-pd/pl*PUSH.z*46.*exp(-pl*pl/26000.);',
    ' float s=bodyD(q);vec3 col;',
    ' if(s<3.){float e=1.5;vec2 gr=vec2(bodyD(q+vec2(e,0.))-bodyD(q-vec2(e,0.)),bodyD(q+vec2(0.,e))-bodyD(q-vec2(0.,e)))/(2.*e);',
    '  float th=clamp(-s/(R*.5),0.,1.);float h=sqrt(1.-(1.-th)*(1.-th));vec3 n=normalize(vec3(gr*(1.-h)*1.4,h+.06));',
    '  vec3 beh=bgc(q-n.xy*R*.12*(.25+h),pq,m);',
    '  vec3 g=beh*mix(vec3(1.),C0*1.25,.45+.4*th)*(1.-.5*th);',
    '  vec2 core=(q-(BODY.xy+vec2(0.,.3*R)))/R;g+=C0*.42*exp(-dot(core,core)*2.)+C1*.30*th;',
    '  float fx=(q.x-BODY.x)/R,fy=(q.y-BODY.y)/R;g+=C0*(caus(vec2(fx*4.,fy*7.)+n.xy)*.35+.1)*exp(-fy*fy*9.)*th;',
    '  float sw=fbm(q/R*2.6+vec2(T*.05,T*.08)+n.xy);g+=C0*.16*smoothstep(.5,.8,sw)*th*(1.-m);',
    '  g+=C0*exp(-abs(s)/(R*.022))*.85+C2*pow(1.-h,3.)*.28;',
    '  vec3 hv=normalize(vec3(-.45,.7,.55)+vec3(0.,0.,1.));g+=C2*pow(max(dot(n,hv),0.),60.)*.7;',
    '  vec2 c=BODY.xy;vec2 l1=(q-c-vec2(-.30*R,1.12*R)*WOB.xy)/(R*vec2(.24,.055));g+=C2*.55*smoothstep(1.,.2,length(l1));',
    '  vec2 l2=(q-c-vec2(.42*R,.95*R)*WOB.xy)/(R*vec2(.09,.11));g+=C2*.4*smoothstep(1.,.2,length(l2));',
    '  vec2 l3=(q-c-vec2(-.12*R,.86*R)*WOB.xy)/(R*vec2(.16,.035));g+=C2*.35*smoothstep(1.,.3,length(l3));',
    // suspended bubbles, two sizes
    '  for(int k=0;k<2;k++){float sc=k==0?R*.11:R*.045;vec2 u=(q-c)/sc+vec2(0.,T*(k==0?.1:.22))+n.xy*.8;vec2 ci=floor(u),cf=fract(u)-.5;float hh=hash(ci+float(k)*13.);',
    '   if(hh>(k==0?.93:.86)){vec2 off=(vec2(hash(ci+2.),hash(ci+5.))-.5)*.5;float r=(k==0?.1:.07)+.16*fract(hh*31.);float l=length(cf-off);float dep=.35+.65*fract(hh*17.);',
    '    g+=(C2*(smoothstep(r,r*.8,l)-smoothstep(r*.8,r*.45,l))*.28+C0*smoothstep(r,0.,l)*.12+C2*exp(-dot(cf-off-vec2(-.35,.35)*r,cf-off-vec2(-.35,.35)*r)*2400.)*.6)*dep*th*(1.-m*.8);}}',
    // face: blush, eyes, mouth
    '  vec2 fp=q-FACE.xy;float E=R*.062;',
    '  for(int i=0;i<2;i++){float sd=float(i)*2.-1.;vec2 bl=(fp-vec2(sd*.31*R,-.07*R))/(R*vec2(.075,.035));g+=C3*.28*exp(-dot(bl,bl)*1.5);',
    '   vec2 pe=fp-vec2(sd*.19*R,0.)-GAZE.xy;float bk=max(FACE.z,FACE.w);float ed=length(pe/vec2(E*.82,E*1.05*max(.08,1.-bk)))-1.;',
    '   float ein=smoothstep(.06,-.06,ed);g=mix(g,vec3(.004,.03,.03),ein*(1.-FACE.w));g+=C0*.9*exp(-abs(ed)*14.)*(1.-FACE.w)*(1.-bk*.7);',
    '   vec2 sp=pe-vec2(-.28,.35)*E;g+=C2*smoothstep(E*.24,E*.14,length(sp))*ein*(1.-FACE.w);g+=C2*.7*smoothstep(E*.12,E*.06,length(pe-vec2(.25,-.3)*E))*ein*(1.-FACE.w);',
    '   float arc=abs(length(pe+vec2(0.,E*.55))-E*.75);g+=mix(C2,C0,.4)*1.3*smoothstep(E*.16,E*.06,arc)*step(-E*.1,pe.y)*FACE.w;}',
    '  vec2 mp=fp-vec2(0.,-.14*R);float mo=GAZE.z;',
    '  float w=1e3;for(int i=0;i<2;i++){float sd=float(i)*2.-1.;w=min(w,abs(length(mp-vec2(sd*E*.4,E*.12))-E*.4)+step(E*.12,mp.y)*1e3);}',
    '  float mouth=smoothstep(E*.1,E*.04,w)*(1.-mo);float om=length(mp/vec2(E*.55,E*.75*mo+.01))-1.;mouth=max(mouth,smoothstep(.1,-.1,om)*step(.05,mo));',
    '  g=mix(g,vec3(.004,.03,.03),mouth);',
    '  col=mix(beh,g,smoothstep(1.5,-1.5,s));',
    ' }else{col=bgc(q,pq,m);}',
    ' if(TS.z>.5){col=treat(col,q,vec4(TS.xyz,0.),TS.w,1.2);}',
    ' col+=mix(C0,C2,.3)*ring*.22*(1.-m*.85);',
    ' col=mix(col,BG+(col-BG)*.24,m);',
    ' gl_FragColor=vec4(col+(hash(gl_FragCoord.xy+T)-.5)*.006,1.);}'
  ].join('\n');
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; }
  var prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  var al = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
  var U = {};
  ['SZ', 'DPR', 'T', 'BG', 'C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'BODY', 'WOB', 'MODE', 'DENT', 'PUSH', 'FACE', 'GAZE', 'PLATE', 'TS', 'RP[0]', 'TR[0]', 'Z[0]', 'ZN'].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });
  var P = api.palette, S = P.scene || [];
  gl.uniform3fv(U.BG, api.vec3(P.bg));
  ['C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6'].forEach(function (k, i) { gl.uniform3fv(U[k], api.vec3(S[i] || P.accent)); });

  // ---- layout ----
  var W, H, R, cx, cy, faceAt = 0, plate = { x: 0, y: 0, w: 0, h: 0 }, treats = [];
  function spring(k, c) { return { x: 0, v: 0, k: k, c: c }; }
  function step(s, target, dt) { s.v += (-(s.x - target) * s.k - s.v * s.c) * dt; s.x += s.v * dt; }
  for (var i = 0; i < 5; i++) treats.push({ bx: 0, by: 0, ox: spring(90, 7), oy: spring(90, 7), jig: spring(160, 6), size: spring(140, 9), gone: 0 });
  treats.forEach(function (t) { t.size.x = 1; });
  function place() {
    W = api.width; H = api.height;
    var zr = 0, zl = W, sb = 0, mainZ = false;
    (api.zones || []).forEach(function (z) {
      if (z.kind === 'sidebar') sb = Math.max(sb, z.x + z.w);
      if (z.kind === 'messages' || z.kind === 'composer' || z.kind === 'hero') { mainZ = true; zr = Math.max(zr, z.x + z.w); zl = Math.min(zl, z.x); }
    });
    if (!mainZ) { zr = W * 0.45; zl = W * 0.25; }
    R = Math.max(200, Math.min(H * 0.5, W * 0.38, 600));
    // face sits in the free strip right of the text lane; the body bulges further right, off-frame
    faceAt = W - zr > 150 ? zr + (W - zr) * 0.52 : W - R * 0.3;
    faceAt = Math.max(faceAt, W * 0.55);
    cx = faceAt + R * 0.22; cy = Math.max(40, H * 0.1);
    // glass plate of treats in the bottom-left gutter; fall back to behind the creature when the gutter is narrow
    var gut = zl - sb;
    if (gut > 170) { plate.w = Math.min(gut * 0.44, R * 0.5); plate.x = sb + gut * 0.5; plate.y = H * 0.2; }
    else { plate.w = R * 0.42; plate.x = Math.max(sb + plate.w, cx - R * 1.35); plate.y = cy + R * 0.5; }
    plate.h = plate.w * 0.16;
    var ts = plate.w * 0.17;
    treats.forEach(function (t, i) { t.bx = plate.x + (i - 2) * plate.w * 0.38 + (i % 2 ? 0 : 0); t.by = plate.y + ts * 0.9 + (i % 2 ? plate.h * 0.25 : -plate.h * 0.15); t.s = ts * (i === 2 ? 1.1 : 0.92); });
    gl.viewport(0, 0, api.pxWidth, api.pxHeight);
  }
  place();

  // ---- physics state ----
  var squash = spring(150, 6.5), lean = spring(40, 5), dent = spring(190, 9), push = spring(60, 9), a2 = spring(70, 2.6), a3 = spring(130, 3.2);
  var mx = -9999, my = -9999, active = false, ripples = [], nextBlink = 2 + api.random() * 3, blinkT = -1, happyT = -9, fly = null, now = 0, lastMx = 0, lastMy = 0;
  var faceX = 0, faceY = 0, mouthOpen = 0;
  function bodyNear(x, y) { var dx = (x - cx) / (R * 1.15), dy = (y - (cy + R * 0.45)) / (R * 1.0); return dx * dx + dy * dy < 1.1; }
  function slurp() {
    if (fly) return;
    var pool = treats.filter(function (t) { return !t.gone; }); if (!pool.length) return;
    var t = pool[Math.floor(api.random() * pool.length)], idx = treats.indexOf(t);
    t.gone = 1; fly = { i: idx, t0: now, x0: t.bx + t.ox.x, y0: t.by + t.oy.x, s: t.s };
  }
  return {
    resize: place, zones: place,
    pointer: function (e) {
      active = !e.overUI;
      if (e.overUI) return;
      var y = H - e.y;
      if (e.kind === 'move') {
        var sp = Math.min(1, Math.hypot(e.x - lastMx, y - lastMy) / 60); lastMx = e.x; lastMy = y;
        if (bodyNear(e.x, y)) { a2.v += sp * 0.012; a3.v -= sp * 0.008; }
      }
      mx = e.x; my = y;
      if (e.kind === 'down') {
        ripples.unshift({ x: e.x, y: y, t0: now }); ripples.length = Math.min(ripples.length, 2);
        var near = bodyNear(e.x, y);
        squash.v += near ? 3.2 : 2.2; a2.v += 0.06; a3.v += 0.04; blinkT = now; happyT = now;
        treats.forEach(function (t) { t.jig.v += 2.5 + api.random() * 2; });
        if (near || api.random() < 0.55) slurp();
      }
    },
    frame: function (t, dt) {
      now = t; dt = Math.min(dt || 0, 0.05);
      var h = dt / 2;
      for (var n = 0; n < 2 && dt > 0; n++) {
        step(squash, 0, h); step(lean, active ? Math.max(-0.25, Math.min(0.25, (mx - cx) / W)) * 0.35 : 0, h);
        step(dent, active && bodyNear(mx, my) ? 1 : 0, h); step(push, active ? 1 : 0, h); step(a2, 0, h); step(a3, 0, h);
        for (var i = 0; i < 5; i++) {
          var tr = treats[i], dx = tr.bx - mx, dy = tr.by - my, d2 = dx * dx + dy * dy, f = active ? Math.exp(-d2 / (tr.s * tr.s * 9)) * tr.s * 1.4 : 0, L = Math.sqrt(d2) + 0.01;
          step(tr.ox, dx / L * f, h); step(tr.oy, Math.max(-tr.s * 0.2, dy / L * f), h); step(tr.jig, f / tr.s * 0.12, h); step(tr.size, tr.gone ? 0 : 1, h);
        }
      }
      // blink and happy eyes
      if (t > nextBlink) { blinkT = t; nextBlink = t + 2.5 + api.random() * 4; }
      var bk = blinkT >= 0 ? Math.max(0, 1 - Math.abs(t - blinkT - 0.08) / 0.08) : 0;
      var happy = t - happyT < 0.9 ? Math.min(1, (0.9 - (t - happyT)) * 4) : 0;
      // squash/lean -> body transform; face follows it
      var sq = squash.x + 0.012 * Math.sin(t * 1.7), sx = 1 + sq * 0.55, sy = 1 - sq;
      var lx = (faceAt - cx) / R, ly = 0.74;
      faceX = cx + lx * R * sx + ly * R * sy * lean.x; faceY = cy + ly * R * sy;
      var gx = active ? Math.max(-1, Math.min(1, (mx - faceX) / 500)) * R * 0.018 : 0, gy = active ? Math.max(-1, Math.min(1, (my - faceY) / 400)) * R * 0.014 : 0;
      // slurp flight
      var TS = [0, 0, 0, -1], mouthT = 0;
      if (fly) {
        var u = (t - fly.t0) / 0.95;
        if (u >= 1) {
          squash.v -= 2.4; a2.v += 0.05; happyT = t; var tr = treats[fly.i], fi = fly.i; fly = null;
          setRespawn(tr, t + 3.5 + api.random() * 2);
        } else {
          var e = u * u * (3 - 2 * u), tx = faceX, ty = faceY - R * 0.14;
          TS = [fly.x0 + (tx - fly.x0) * e, fly.y0 + (ty - fly.y0) * e + Math.sin(Math.PI * u) * H * 0.3, fly.s * (1 - 0.55 * e) * 1.15, fly.i];
          mouthT = Math.min(1, u * 2.5);
        }
      }
      treats.forEach(function (tr) { if (tr.gone && tr.respawn && t > tr.respawn) { tr.gone = 0; tr.respawn = 0; tr.size.x = 0; tr.size.v = 6; tr.jig.v = 5; } });
      mouthOpen += (mouthT - mouthOpen) * Math.min(1, dt * 14 || 1);
      // uniforms
      gl.uniform2f(U.SZ, W, H); gl.uniform1f(U.DPR, api.dpr); gl.uniform1f(U.T, t);
      gl.uniform4f(U.BODY, cx, cy, R, 0); gl.uniform4f(U.WOB, sx, sy, lean.x, 0);
      gl.uniform4f(U.MODE, a2.x, a3.x, t * 3.1, 0); gl.uniform4f(U.DENT, mx, my, Math.max(-0.3, dent.x), R * 0.2);
      gl.uniform4f(U.PUSH, mx, my, Math.max(0, push.x), 0);
      gl.uniform4f(U.FACE, faceX, faceY, bk, happy); gl.uniform4f(U.GAZE, gx, gy, mouthOpen, 0);
      gl.uniform4f(U.PLATE, plate.x, plate.y, plate.w, plate.h); gl.uniform4f(U.TS, TS[0], TS[1], TS[2], TS[3]);
      var rp = new Float32Array(8);
      ripples.forEach(function (r, i) { var age = t - r.t0; if (age < 2.5) { rp[i * 4] = r.x; rp[i * 4 + 1] = r.y; rp[i * 4 + 2] = age; rp[i * 4 + 3] = 1; } });
      gl.uniform4fv(U['RP[0]'], rp);
      var trf = new Float32Array(20);
      treats.forEach(function (tr, i) { var bob = Math.sin(t * 1.3 + i * 1.7) * 0.02; trf[i * 4] = tr.bx + tr.ox.x; trf[i * 4 + 1] = tr.by + tr.oy.x; trf[i * 4 + 2] = tr.s * Math.max(0, tr.size.x); trf[i * 4 + 3] = Math.max(-0.35, Math.min(0.35, tr.jig.x * 0.1 + bob)); });
      gl.uniform4fv(U['TR[0]'], trf);
      gl.uniform4fv(U['Z[0]'], api.zonesGL); gl.uniform1i(U.ZN, api.zoneCount);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  };
  function setRespawn(tr, at) { tr.respawn = at; }
});
