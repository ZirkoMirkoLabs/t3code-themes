// Riso Fold v2: an endless tunnel of folded, bevelled paper frames printed in three riso inks on ink-navy.
// sceneColors: 0 fluoro pink, 1 medium blue, 2 sunflower yellow, 3 flash paper (cool white).
// Each ink is computed as its own misregistered plate (own offset + own halftone screen angle) and the plates
// overprint by multiply. Pointer steers the vanishing point and bends the deep folds; click snaps a crease
// through the sheet and sends a fold-flash rippling down the tunnel. Text zones fade to a dim, calm print.
T3Scene(function (api) {
  var gl = api.canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) throw Error('WebGL unavailable');
  function shader(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; }
  var FS = [
    'precision highp float;',
    'uniform vec2 R,F,LOOK,CP,CN;uniform float T,Z,SC,DPR,MIS,CA,WAVE,WAMP;uniform vec3 BG,C0,C1,C2,PAPER;',
    'uniform vec4 Zr[8];uniform int ZN;',
    'const float RATIO=0.80;const float LR=-0.22314355;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}',
    'mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}',
    'float safeK(){float m=0.;for(int i=0;i<8;i++){if(i>=ZN)break;vec2 d=max(max(Zr[i].xy-gl_FragCoord.xy,gl_FragCoord.xy-Zr[i].zw),vec2(0.));m=max(m,1.-smoothstep(0.,R.y*.06,length(d)));}return m;}',
    // per-layer data: scale, angle, flash
    'float lscale(float k){return exp(LR*(k-Z));}',
    'float flashOf(float k){float d=(k-Z)-WAVE;return WAMP*exp(-d*d*1.6);}',
    'float lang(float k){return k*.27+sin(k*1.7+T*.11)*.06+flashOf(k)*.35;}',
    // squarish frame norm with a wavy hand-cut edge, local coords out
    'float nrm(vec2 p,float k,out vec2 q){float s=lscale(k);q=rot(lang(k))*p/s;vec2 a=abs(q*vec2(1.,1.28));float n=pow(pow(a.x,6.)+pow(a.y,6.),1./6.);float an=atan(q.y,q.x);return n*(1.+.022*sin(an*3.+k*2.4)+.012*sin(an*7.-k*1.3));}',
    // bend: deep layers follow the pointer more than near ones
    'vec2 bend(vec2 p){float r=length(p);return p-LOOK*exp(-r*.9);}',
    // one plate: returns (sheet ink id 0..2, shade amount 0..1, crease line 0..1, flash)
    'vec4 sheet(vec2 p){p=bend(p);vec2 q;float n0=length(p*vec2(1.,1.28))*.92;float kc=floor(Z+log(max(n0,1e-4))/LR);float k=kc+2.;',
    ' for(int j=0;j<4;j++){float kk=kc-1.+float(j);float nn=nrm(p,kk,q);if(nn>1.){k=kk;break;}}',
    ' nrm(p,k,q);vec2 qa=abs(q*vec2(1.,1.28));',
    // bevel facets of the frame: top lit, bottom deep
    ' float side=qa.x>qa.y?(q.x>0.?.42:.16):(q.y>0.?.0:.62);',
    ' float crease=1.-smoothstep(0.,.018,abs(qa.x-qa.y));',
    // cast shadow of the nearer sheet (k-1) lying over this one, light from top-left
    ' vec2 q2;float np=nrm(p+vec2(.05,-.07)*lscale(k-1.),k-1.,q2);float sh=smoothstep(.86,1.,np)*.75;',
    ' float fl=flashOf(k);side=mix(side,.62-side,clamp(fl,0.,1.));',
    ' return vec4(mod(k,3.),clamp(side*.5+sh*.85,0.,1.),crease,fl);}',
    'float ht(vec2 px,float ang,float amt){px=rot(ang)*px/(5.2*DPR);vec2 f=fract(px)-.5;float r=sqrt(clamp(amt,0.,1.))*.66;return smoothstep(r+.09,r-.09,length(f));}',
    'float plate(vec2 p,vec2 off,float id,float ang,vec2 px,out float flash){vec4 s=sheet(p+off);float ink=s.x;float shadeInk=ink<.5?1.:(ink<1.5?0.:1.);flash=s.w;',
    ' float flood=abs(ink-id)<.5?.94:0.;float sh=abs(shadeInk-id)<.5?ht(px,ang,s.y)+s.z*.7:0.;return clamp(flood+sh,0.,1.);}',
    'void main(){',
    ' vec2 px=gl_FragCoord.xy;vec2 p=(px-F)/SC;',
    // crease snap: split the sheet along the click line
    ' vec2 cp=(CP-F)/SC;float ls=dot(p-cp,CN);p+=CN*sign(ls)*CA*.05*exp(-abs(ls)*2.);',
    ' vec2 m=vec2(MIS/SC);float f1,f2,f3;',
    ' float g=noise(px*.9/DPR)*.5+noise(px*.13/DPR)*.5;',
    ' float cPk=plate(p,vec2(m.x,m.y*.4),0.,1.309,px,f1)*(.84+.2*g);',
    ' float cBl=plate(p,vec2(-m.x*.7,-m.y),1.,.262,px,f2)*(.80+.24*noise(px*.7/DPR+9.));',
    ' float cYe=plate(p,vec2(m.y*.3,m.x*.8),2.,0.,px,f3)*(.88+.16*noise(px*.8/DPR+3.));',
    ' vec3 ink=vec3(1.)*(1.-cPk*(1.-C0))*(1.-cBl*(1.-C1))*(1.-cYe*(1.-C2));float cov=max(max(cPk,cBl),cYe);',
    ' float fl=max(max(f1,f2),f3);',
    // depth fog: the vanishing point drops into ink-navy darkness
    ' float r=length(bend(p)*vec2(1.,1.28));float fog=smoothstep(.015,.32,r);',
    ' float paper=clamp(fl*.55,0.,.6)+CA*exp(-abs(ls)*SC/(2.2*DPR))*.9;',
    ' vec3 col=mix(BG,ink,cov*fog);col=mix(col,PAPER*(.45+.55*ink),paper*fog);',
    ' col+=(hash(px+T)-.5)*.035;',
    ' float s=safeK();col=mix(col,mix(BG,col,.13),s);',
    ' gl_FragColor=vec4(col,1.);}'
  ].join('\n');
  var p = gl.createProgram();
  gl.attachShader(p, shader(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
  gl.attachShader(p, shader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p)); gl.useProgram(p);
  var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  var a = gl.getAttribLocation(p, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  var u = {}; ['R', 'F', 'LOOK', 'CP', 'CN', 'T', 'Z', 'SC', 'DPR', 'MIS', 'CA', 'WAVE', 'WAMP', 'BG', 'C0', 'C1', 'C2', 'PAPER', 'Zr[0]', 'ZN'].forEach(function (k) { u[k] = gl.getUniformLocation(p, k); });
  var S = api.palette.scene, fr, fx, fy, sc, lx = 0, ly = 0, tlx = 0, tly = 0, z = api.random() * 30, kickV = 0;
  var ca = 0, cpx = 0, cpy = 0, cnx = 0, cny = 1, wave = 0, wamp = 0, mis = 2.6;
  function place() {
    fr = api.free(30);
    fx = fr.x + fr.w * 0.5; fy = fr.y + fr.h * 0.48;
    sc = Math.max(90, Math.min(fr.w * 0.36, fr.h * 0.42, api.height * 0.34));
    gl.viewport(0, 0, api.pxWidth, api.pxHeight);
  }
  place();
  return {
    resize: place, zones: place,
    pointer: function (e) {
      if (e.overUI) { tlx = 0; tly = 0; return; }
      tlx = Math.max(-0.9, Math.min(0.9, (e.x - fx) / sc * 0.55));
      tly = Math.max(-0.9, Math.min(0.9, (fy - e.y) / sc * 0.55));
      if (e.kind === 'down') {
        ca = 1; cpx = e.x; cpy = e.y; var ang = api.random() * Math.PI; cnx = Math.cos(ang); cny = Math.sin(ang);
        wave = -0.5; wamp = 1; kickV = 2.4; mis = 11;
      }
    },
    frame: function (t, dt) {
      var d = Math.min(dt, 0.1);
      lx += (tlx - lx) * Math.min(1, d * 3); ly += (tly - ly) * Math.min(1, d * 3);
      kickV *= Math.exp(-d * 2.5); z += d * (0.32 + kickV);
      ca *= Math.exp(-d * 3.2); wave += d * 7; wamp *= Math.exp(-d * 0.9);
      mis += (2.6 + Math.sin(t * 0.7) * 1.1 - mis) * Math.min(1, d * 2.2);
      var dpr = api.dpr, still = dt === 0;
      gl.uniform2f(u.R, api.pxWidth, api.pxHeight);
      gl.uniform2f(u.F, fx * dpr, (api.height - fy) * dpr);
      gl.uniform2f(u.LOOK, lx, ly);
      gl.uniform2f(u.CP, cpx * dpr, (api.height - cpy) * dpr); gl.uniform2f(u.CN, cnx, -cny);
      gl.uniform1f(u.T, t); gl.uniform1f(u.Z, still ? t * 0.32 : z); gl.uniform1f(u.SC, sc * dpr); gl.uniform1f(u.DPR, dpr);
      gl.uniform1f(u.MIS, mis * dpr); gl.uniform1f(u.CA, ca); gl.uniform1f(u.WAVE, wave); gl.uniform1f(u.WAMP, wamp);
      gl.uniform3fv(u.BG, api.vec3(api.palette.bg)); gl.uniform3fv(u.C0, api.vec3(S[0])); gl.uniform3fv(u.C1, api.vec3(S[1])); gl.uniform3fv(u.C2, api.vec3(S[2])); gl.uniform3fv(u.PAPER, api.vec3(S[3] || '#f2f4ff'));
      gl.uniform4fv(u['Zr[0]'], api.zonesGL); gl.uniform1i(u.ZN, api.zoneCount);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  };
});
