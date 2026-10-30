// Holo Foil v2: the whole screen is one tilting sheet of trading-card foil on a #05070F stage.
// Adapted from webgl-viral/holo-pack (read-only source); single fragment pass, no textures.
// sceneColors: 0 prism cyan, 1 prism magenta, 2 cosmos violet, 3 gold, 4 deep gold, 5 glint white.
// Patterns: Prism (diffraction rainbow + grating lines), Cosmos (twinkling glitter), Gold (embossed starbursts),
// blended across the sheet; an embossed rarity-star lattice runs through all three.
// Pointer tilts the sheet (hue shift, sheen band, lamp hot spot); click pops a perforated tear line that
// floods light and reseals. Four oversized cards float at the free-space edges with depth parallax.
// Safe zones (api.zonesGL) fall to a 9% ghost of the foil over palette.bg.
T3Scene(function (api) {
  var gl = api.canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) throw Error('WebGL unavailable');
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; }
  var FS = [
    'precision highp float;',
    'uniform vec2 R,TL,MP; uniform float T,A,SEED,ACT; uniform vec3 TC;',
    'uniform vec3 BG,C0,C1,C2,C3,C4,C5;',
    'uniform vec4 CD[4]; uniform vec4 CE[4];',
    'uniform vec4 Z[8]; uniform int ZN;',
    'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+1.),f.x),f.y);}',
    'vec3 film(float t){return .5+.5*cos(6.28318*(t+vec3(0.,.33,.67)));}',
    'vec3 holo(float t){vec3 a=film(t);return mix(a,mix(C0,C1,.5+.5*sin(t*6.28318)),.35);}',
    'float star4(vec2 q,float r){q=abs(q)/r;return sqrt(q.x)+sqrt(q.y)-1.;}',
    'float rect(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return min(max(q.x,q.y),0.)+length(max(q,0.))-r;}',
    'mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}',
    'float safeK(){float m=0.;for(int i=0;i<8;i++){if(i>=ZN)break;vec2 d=max(max(Z[i].xy-gl_FragCoord.xy,gl_FragCoord.xy-Z[i].zw),vec2(0.));m=max(m,1.-smoothstep(0.,max(1.,R.y*.05),length(d)));}return 1.-m;}',
    // the foil sheet itself
    'vec3 foil(vec2 p,vec2 tl,vec2 lamp){',
    ' float s=p.x*.55+p.y*.22+.16*sin(p.y*2.1+T*.05+SEED)+.08*sin(p.x*3.3-T*.04);',
    ' float wP=1.-smoothstep(-.42,-.08,s),wG=smoothstep(.22,.52,s),wC=max(0.,1.-wP-wG);',
    ' float ph=tl.x*1.15-tl.y*.85;',
    ' float gd=dot(p,vec2(.8,.6));',
    ' float sx=gd*.9-tl.x*.75+tl.y*.45-.18*sin(T*.17+SEED);float sheen=exp(-pow(sx/.6,2.))+.55*exp(-pow((sx+1.05)/.4,2.))+.45*exp(-pow((sx-1.)/.4,2.));',
    ' float band=gd*1.5+ph+.1*sin(T*.2);',
    // embossed rarity-star lattice
    ' vec2 g=p*3.4;g.x+=step(1.,mod(floor(g.y),2.))*.5;vec2 id=floor(g),f=fract(g)-.5;float hr=h21(id+SEED);',
    ' vec2 L=normalize(vec2(.6,.8)+tl*.9);float rs=.2+.08*hr;',
    ' float ht=smoothstep(.06,-.06,star4(f,rs)),htL=smoothstep(.06,-.06,star4(f+L*.025,rs));',
    ' float emb=ht-htL;',
    ' float ang=atan(f.y,f.x),rl=length(f);',
    ' float rays=pow(abs(sin(ang*10.+hr*3.)),10.)*smoothstep(.6,.05,rl)*(1.-ht);',
    // Prism
    ' float lines=.8+.2*sin((p.x*.6-p.y*.8)*520.);',
    ' vec3 prism=holo(band+.3*ht)*(.24+.75*sheen)*lines;',
    ' prism+=film(length(p-lamp)*5.-ph*2.)*.07*(1.-sheen*.5);',
    // Cosmos glitter
    ' vec2 cg=p*260.;float ch=h21(floor(cg)+7.);vec2 cf=fract(cg)-.5;',
    ' float tw=pow(max(0.,sin(ch*60.+tl.x*14.+tl.y*11.+T*.7)),22.)*step(.78,ch);',
    ' float dt=smoothstep(.32,.05,length(cf));',
    ' float nb=vn(p*2.6+T*.02);vec3 cosmos=mix(vec3(.02,.02,.07),mix(C2,C1,vn(p*1.3-SEED))*.5,nb)*(.6+.6*sheen);',
    ' cosmos+=holo(ch+ph)*tw*dt*1.7+holo(band*.5+.3)*sheen*.2;',
    // Gold starbursts
    ' vec3 gold=mix(C4*.35,C3,.5+.5*sin(gd*3.+ph*2.));gold*=.3+.7*sheen;',
    ' gold+=rays*C3*(.22+.5*sheen)+film(band)*.06;',
    ' vec3 col=prism*wP+cosmos*wC+gold*wG;',
    ' col+=holo(band*.7+.2)*.06;col=mix(col,holo(band+.5)*(.45+.6*sheen),ht*.35);',
    ' col+=vec3(emb)*(.14+.35*sheen);',
    // specular glints: tilt-driven + a slow periodic sweep
    ' float gx=dot(p,normalize(vec2(1.,.55)))-(tl.x*.9+fract(T*.06+SEED)*5.-2.5);',
    ' col+=C5*(exp(-gx*gx*420.)*.4+exp(-gx*gx*18.)*.05);',
    ' float sp=exp(-dot(p-lamp,p-lamp)*3.2)*ACT;',
    ' col+=col*sp*1.1+holo(band+rl)*sp*.08;',
    ' return col;}',
    // an oversized collector card
    'vec3 card(vec2 cp,vec2 tl,vec4 ce,vec3 col){',
    ' float d=rect(cp,vec2(.72,1.),.07);',
    ' float typ=ce.z;vec3 tint=typ<.5?mix(C0,C1,.5):(typ<1.5?C2:C3);',
    ' float ph=tl.x*1.4-tl.y*1.1+ce.y;',
    ' float sh=exp(-pow((cp.x*.7+cp.y*.5-tl.x*.9+tl.y*.6-.3*sin(T*.3+ce.y*6.))/.5,2.));',
    ' vec3 cc=vec3(.025,.03,.065)+tint*.04;',
    ' float fr=smoothstep(-.075,-.06,d);',
    ' vec3 frame=typ>1.5?mix(C4,C3,.5+.5*sin(cp.y*4.+ph*2.))*(.55+.6*sh):holo(cp.x*.5+cp.y*.7+ph)*(.45+.65*sh);',
    ' cc=mix(cc,frame,fr);',
    ' cc+=holo(cp.y+ph)*exp(-abs(d+.11)*420.)*.55;',
    ' float aw=rect(cp-vec2(0.,.17),vec2(.57,.5),.03);',
    ' if(aw<0.){vec2 a=cp-vec2(0.,.17);float st=star4(a,.3);float ra=atan(a.y,a.x);',
    '  vec3 art=(typ<.5?holo(a.x*1.2+a.y*.8+ph):(typ<1.5?mix(vec3(.02,.02,.08),C2*.6,vn(a*5.+ce.y*9.)):mix(C4*.4,C3,.5+.5*sin(length(a)*14.-ph*3.))))*(.35+.6*sh);',
    '  float gl=h21(floor(a*90.)+ce.y);art+=holo(gl+ph)*pow(max(0.,sin(gl*50.+ph*9.)),20.)*step(.6,gl)*.9;',
    '  art+=pow(abs(sin(ra*8.)),12.)*smoothstep(.55,.1,length(a))*.25*tint;',
    '  art=mix(art,holo(ph+length(a)*2.)*(.7+.5*sh)+.15,smoothstep(.02,-.02,st));',
    '  art+=exp(-abs(length(a)-.42)*90.)*.3*tint;',
    '  cc=mix(cc,art,smoothstep(0.,-.01,aw));}',
    ' cc+=exp(-abs(aw)*300.)*holo(cp.x+ph)*.4;',
    ' float tb=step(abs(cp.y-.82),.045)*step(abs(cp.x+.12),.45);',
    ' cc=mix(cc,vec3(.01,.012,.03),tb*.85);',
    ' cc+=step(.45,h21(vec2(floor(cp.x*16.),ce.y*7.)))*step(abs(cp.y-.82),.018)*step(cp.x,.18)*step(-.5,cp.x)*.55;',
    ' float rsd=star4(cp-vec2(.52,.82),.085);cc=mix(cc,mix(C3,C5,.4)*(1.+sh),smoothstep(.04,-.04,rsd));',
    ' float u=(cp.x+.6)/1.2*4.,ix=floor(u);',
    ' float bx=step(0.,ix)*step(ix,3.)*step(abs(fract(u)-.5),.42)*step(abs(cp.y+.62),.14);',
    ' cc=mix(cc,vec3(.015,.018,.04)+holo(ix*.2+ph)*.05,bx);',
    ' cc+=bx*step(abs(cp.y+.66),.035)*step(abs(fract(u)-.5),.22)*.6;',
    ' cc+=C5*exp(-pow((cp.x*.8+cp.y*.6-tl.x*1.2-1.6*fract(T*.09+ce.y)+.8)*9.,2.))*.25*step(d,0.);',
    ' return cc;}',
    'void main(){',
    ' float sk=safeK();',
    ' vec2 p=(gl_FragCoord.xy-R*.5)/R.y;',
    ' vec2 tl=TL;',
    ' p/=1.+dot(p,tl)*.22;',
    ' vec2 lamp=(MP-R*.5)/R.y;',
    // tear line
    ' vec2 c=(TC.xy-R*.5)/R.y;vec2 tg=vec2(cos(TC.z),sin(TC.z)),n=vec2(-tg.y,tg.x);',
    ' vec2 dd=p-c;float al=dot(dd,tg),dn=dot(dd,n);',
    ' float open=smoothstep(.14,.38,A)*(1.-smoothstep(.95,2.,A));',
    ' float pop=smoothstep(0.,.04,A)*(1.-smoothstep(.1,.32,A));',
    ' float perf=smoothstep(0.,.03,A)*(1.-smoothstep(1.7,2.4,A));',
    ' float gap=open*.06*(1.-.65*smoothstep(.15,1.3,abs(al)));',
    ' float jag=(vn(vec2(al*38.,SEED))-.5)*.014*open;',
    ' float ad=abs(dn+jag);float sd=sign(dn+1e-5);',
    ' vec2 ps=p-n*sd*gap;',
    ' vec3 col=foil(ps,tl+n*sd*open*.45,lamp);',
    ' if(open>0.&&ad<gap){float x=ad/max(gap,1e-4);col=mix(vec3(1.,.98,.96)*1.25,holo(al*1.5+T*.6)*1.4,x*x);}',
    ' else if(A<3.){float e=max(ad-gap,0.);col+=holo(al*2.+T)*exp(-e*260.)*open*1.1;col+=mix(C5,C3,.25)*open*.42*exp(-e*6.5);',
    '  vec2 hq=vec2(fract(al*30.)-.5,e*30.);float hole=1.-smoothstep(.17,.25,length(hq));',
    '  col=mix(col,C5*(.55+pop*2.2),hole*perf*(1.-open*.85));',
    '  float r=length(dd);col+=holo(r*3.)*exp(-pow((r-A*1.3)*12.,2.))*(1.-smoothstep(0.,.7,A))*.7;}',
    ' col+=open*.04;',
    // floating cards
    ' for(int i=0;i<4;i++){vec4 cd=CD[i];vec4 ce=CE[i];if(ce.w<.01)continue;',
    '  vec2 cp=rot(cd.w)*((gl_FragCoord.xy-cd.xy)/cd.z);cp/=1.+dot(cp,tl*vec2(.1,.07));',
    '  float d2=rect(cp-vec2(.07,-.09),vec2(.72,1.),.07);col*=1.-.6*ce.w*smoothstep(.22,-.06,d2);',
    '  float d=rect(cp,vec2(.72,1.),.07);',
    '  if(d<.02){float aa=1.6/cd.z;col=mix(col,card(cp,tl*(.6+ce.x),ce,col),smoothstep(aa,-aa,d)*ce.w);}}',
    // stage vignette, tone map, safe zones
    ' vec2 v=gl_FragCoord.xy/R-.5;float vg=smoothstep(.95,.25,length(v*vec2(1.,.85))*1.25);',
    ' col=mix(BG,col,.3+.7*vg);',
    ' col=col/(1.+col*.28);',
    ' col=mix(BG+(col-BG)*.09,col,sk);',
    ' gl_FragColor=vec4(col+(h21(gl_FragCoord.xy+T)-.5)*.012,1.);}'
  ].join('\n');
  var p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
  gl.useProgram(p);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  var al = gl.getAttribLocation(p, 'a'); gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
  var u = {};
  ['R', 'TL', 'MP', 'T', 'A', 'SEED', 'ACT', 'TC', 'BG', 'C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'CD[0]', 'CE[0]', 'Z[0]', 'ZN'].forEach(function (k) { u[k] = gl.getUniformLocation(p, k); });

  var P = api.palette, S = P.scene;
  function sc(i, d) { return api.vec3(S[i] || d); }
  var seed = api.random() * 40, tx = 0, ty = 0, tilX = 0, tilY = 0, act = 0, mx = -1e4, my = -1e4;
  var now = 0, t0 = -1, tearT = -100, tear = [0, 0, 0], autoTear = !api.preview && api.motion === 'live';
  var cards = [], CD = new Float32Array(16), CE = new Float32Array(16);
  // card layout relative to the largest free rectangle: big, bleeding off its edges
  var LAYOUT = [
    [0.86, 0.30, 0.36, 0.22, 1.00, 0.0, 0],
    [1.04, 0.88, 0.30, -0.32, 0.65, 0.35, 2],
    [0.06, 1.04, 0.27, 0.42, 0.45, 0.7, 1],
    [0.40, -0.10, 0.20, -0.18, 0.25, 0.15, 0]
  ];
  function place() {
    gl.viewport(0, 0, api.pxWidth, api.pxHeight);
    var f = api.free(0), base = Math.min(Math.max(f.h, api.height * 0.6), 900);
    cards = LAYOUT.map(function (L, i) {
      return { x: f.x + f.w * L[0], y: f.y + f.h * L[1], s: Math.max(70, base * L[2]), r: L[3] + (api.random() - 0.5) * 0.1, d: L[4], h: L[5] + seed * 0.01, k: L[6], ph: i * 1.7 };
    });
  }
  place();
  function startTear(x, y) {
    tear = [x * api.dpr, (api.height - y) * api.dpr, (api.random() - 0.5) * 0.9];
    tearT = now;
  }
  return {
    resize: place, zones: place,
    pointer: function (e) {
      if (e.overUI) { act = 0; return; }
      act = 1; mx = e.x; my = e.y;
      tx = (e.x / api.width - 0.5) * 2; ty = -(e.y / api.height - 0.5) * 2;
      if (e.kind === 'down') startTear(e.x, e.y);
    },
    frame: function (t, dt) {
      now = t; if (t0 < 0) t0 = t;
      if (autoTear && t - t0 > 0.7) { autoTear = false; var f = api.free(40); startTear(f.x + f.w * 0.5, f.y + f.h * 0.45); }
      var k = 1 - Math.exp(-Math.min(dt, 0.1) * 4);
      var idx = Math.sin(t * 0.21 + seed) * 0.35, idy = Math.cos(t * 0.17 + seed * 0.7) * 0.25;
      var gx = act ? tx : idx, gy = act ? ty : idy;
      if (dt === 0) { tilX = gx; tilY = gy; } else { tilX += (gx - tilX) * k; tilY += (gy - tilY) * k; }
      var W = api.width, H = api.height, D = api.dpr;
      for (var i = 0; i < 4; i++) {
        var c = cards[i], o = i * 4;
        var px = c.x - tilX * c.d * 46 + Math.sin(t * 0.4 + c.ph) * 5, py = c.y + tilY * c.d * 34 + Math.cos(t * 0.33 + c.ph) * 7;
        CD[o] = px * D; CD[o + 1] = (H - py) * D; CD[o + 2] = c.s * D; CD[o + 3] = c.r + Math.sin(t * 0.25 + c.ph) * 0.03 + tilX * 0.04 * c.d;
        CE[o] = c.d; CE[o + 1] = c.h; CE[o + 2] = c.k; CE[o + 3] = 1;
      }
      gl.uniform2f(u.R, api.pxWidth, api.pxHeight);
      gl.uniform2f(u.TL, tilX, tilY);
      gl.uniform2f(u.MP, mx * D, (H - my) * D);
      gl.uniform1f(u.T, t); gl.uniform1f(u.A, Math.min(t - tearT, 99)); gl.uniform1f(u.SEED, seed); gl.uniform1f(u.ACT, act);
      gl.uniform3f(u.TC, tear[0], tear[1], tear[2]);
      gl.uniform3fv(u.BG, api.vec3(P.bg));
      gl.uniform3fv(u.C0, sc(0, '#5ee7ff')); gl.uniform3fv(u.C1, sc(1, '#ff5cd6')); gl.uniform3fv(u.C2, sc(2, '#6b4bff'));
      gl.uniform3fv(u.C3, sc(3, '#ffc857')); gl.uniform3fv(u.C4, sc(4, '#9a6a1c')); gl.uniform3fv(u.C5, sc(5, '#ffffff'));
      gl.uniform4fv(u['CD[0]'], CD); gl.uniform4fv(u['CE[0]'], CE);
      gl.uniform4fv(u['Z[0]'], api.zonesGL); gl.uniform1i(u.ZN, api.zoneCount);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  };
});
