// Event Horizon: a lensed black hole (WebGL). Background stars and gas are bent around the hole, a thin
// tilted accretion disk crosses in front, its far side is lensed into a halo, and Doppler beaming makes the
// approaching side brighter. The hole sits in the largest free area; inside text zones the shader fades to calm.
T3Scene(function (api) {
  var gl = api.canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
  var P = api.palette, S = P.scene || [];
  if (!gl) { // no WebGL: a still gradient so the theme still works
    var c2 = api.canvas.getContext('2d');
    return { frame: function () { var g = c2.createRadialGradient(api.width * 0.75, api.height * 0.3, 10, api.width * 0.75, api.height * 0.3, api.width * 0.6); g.addColorStop(0, api.rgba(P.accent, 0.35)); g.addColorStop(1, P.bg); c2.fillStyle = g; c2.fillRect(0, 0, api.width, api.height); } };
  }
  var VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var FS = [
    'precision highp float;',
    'uniform vec2 R;uniform float T;uniform vec2 M;uniform vec3 BG,HOT,WARM,COOL;uniform vec3 HOLE;uniform vec4 Z[8];uniform int ZN;uniform float SPIN;',
    'float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<4;i++){v+=a*n(p);p=m*p;a*=.5;}return v;}',
    'vec3 stars(vec2 p){vec3 c=vec3(0.);for(int l=0;l<3;l++){float fl=float(l);vec2 q=p*(.035-fl*.009)+fl*7.1;vec2 id=floor(q),f=fract(q)-.5;float r=h(id+fl*3.3);',
    ' if(r>.93-fl*.02){vec2 o=vec2(h(id*1.7),h(id*2.3))-.5;float d=length(f-o*.7);float tw=.65+.35*sin(T*(.4+r*2.)+r*50.);',
    '  c+=mix(vec3(1.),mix(COOL,WARM,h(id*5.)),.35)*smoothstep(.07-fl*.015,0.,d)*tw*(1.15-fl*.3);}}return c;}',
    'float zone(vec2 fc){float m=0.;for(int i=0;i<8;i++){if(i>=ZN)break;vec4 z=Z[i];vec2 d=max(max(z.xy-fc,fc-z.zw),0.);m=max(m,1.-smoothstep(0.,90.,length(d)));}return m;}',
    'void main(){vec2 fc=gl_FragCoord.xy;float rs=HOLE.z;vec2 c=HOLE.xy+M*vec2(10.,6.);vec2 p=(fc-c)/rs;float r=length(p);',
    // gravitational lensing of everything behind the hole
    ' vec2 q=p-p/(r*r+1e-3)*1.5;vec2 bp=c+q*rs;',
    ' vec3 col=BG;vec2 np=bp/R.y;float neb=fbm(np*2.4+vec2(T*.003,0.));',
    ' col+=mix(COOL,WARM,fbm(np*1.2+3.))*pow(neb,3.2)*.32;col+=stars(bp);',
    ' float shadow=smoothstep(1.02,.97,r);col*=1.-shadow;',
    // photon ring
    ' col+=HOT*exp(-pow((r-1.035)*30.,2.))*1.3;',
    // thin, slightly tilted disk crossing in front of the hole
    ' vec2 dp=vec2(p.x,p.y+p.x*.07);float dr=length(vec2(dp.x,dp.y/.12));',
    ' float band=smoothstep(1.3,1.65,dr)*smoothstep(5.6,2.6,dr);float ang=atan(dp.y/.12,dp.x);',
    ' float turb=fbm(vec2(dr*3.2-T*SPIN,ang*2.5+T*.08));float heat=smoothstep(5.2,1.3,dr);',
    ' vec3 dc=mix(mix(WARM*.55,WARM,heat),HOT,heat*heat);float dop=1.+.6*clamp(-dp.x/3.,-1.,1.);',
    ' float front=step(dp.y,0.);float vis=mix(1.-shadow,1.,front);col+=dc*band*(.4+.8*turb)*dop*vis*1.35;',
    // far side of the disk, lensed into a halo over and under the hole
    ' float halo=exp(-pow((r-1.3)*5.,2.));float ht=fbm(vec2(r*6.-T*SPIN*.9,atan(p.y,p.x)*3.));',
    ' col+=dc*halo*smoothstep(.1,.75,abs(p.y)/max(r,1e-3))*(.45+.75*ht)*(p.y>0.?1.15:.7);',
    ' col+=WARM*exp(-max(r-1.,0.)*1.5)*.10*(1.-shadow);',
    // calm behind text: keep only a faint ghost of the scene inside measured UI zones
    ' float zm=zone(fc);col=mix(col,BG+(col-BG)*.22,zm*.9);',
    ' vec2 uv=fc/R;col*=1.-.5*smoothstep(.55,1.3,length((uv-.5)*vec2(1.25,1.))*1.6);',
    ' col+=(h(fc+fract(T*7.))-.5)*.018;gl_FragColor=vec4(max(col,0.),1.);}'
  ].join('\n');
  function sh(type, src) { var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
  var prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var U = {}; ['R', 'T', 'M', 'BG', 'HOT', 'WARM', 'COOL', 'HOLE', 'Z', 'ZN', 'SPIN'].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });
  gl.uniform3fv(U.BG, api.vec3(S[0] || P.bg)); gl.uniform3fv(U.HOT, api.vec3(S[1] || '#fff1d6'));
  gl.uniform3fv(U.WARM, api.vec3(S[2] || P.accent)); gl.uniform3fv(U.COOL, api.vec3(S[3] || P.accent2));
  gl.uniform1f(U.SPIN, api.params.spin || 0.35);
  var hole = [0, 0, 60], mx = 0, my = 0, tmx = 0, tmy = 0;
  function layout() {
    var f = api.free(30), W = api.width, H = api.height, k = api.params.size || 1;
    if (f.w < 70 || f.h < 140) f = { x: W * 0.55, y: 0, w: W * 0.45, h: H * 0.6 };
    var r = Math.max(26, Math.min(120, Math.min(f.w * 0.3, f.h * 0.2))) * k;
    var cx = f.x + f.w * 0.5, cy = f.y + Math.min(f.h * 0.4, f.h - r * 3);
    hole = [cx * api.dpr, (H - cy) * api.dpr, r * api.dpr];
    gl.viewport(0, 0, api.pxWidth, api.pxHeight);
  }
  layout();
  return {
    resize: layout,
    zones: layout,
    pointer: function (e) { if (e.kind === 'move') { tmx = e.x / api.width * 2 - 1; tmy = -(e.y / api.height * 2 - 1); } },
    frame: function (t, dt) {
      mx += (tmx - mx) * Math.min(1, dt * 1.5); my += (tmy - my) * Math.min(1, dt * 1.5);
      gl.uniform2f(U.R, api.pxWidth, api.pxHeight); gl.uniform1f(U.T, t); gl.uniform2f(U.M, mx * api.dpr, my * api.dpr);
      gl.uniform3f(U.HOLE, hole[0], hole[1], hole[2]);
      gl.uniform4fv(U.Z, api.zonesGL); gl.uniform1i(U.ZN, api.zoneCount);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  };
});
