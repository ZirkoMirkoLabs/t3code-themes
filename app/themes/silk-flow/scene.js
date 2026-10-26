// Silk (WebGL): wide silk folds as a slowly warped height field, lit with soft diffuse, a broad sheen and a
// tight specular, deep shadow in the valleys. Colour runs plum -> indigo -> peach across the frame.
// sceneColors: [0] deep shadow, [1] plum, [2] indigo, [3] peach, [4] specular highlight.
// Inside text zones the folds fade to a calm ghost; dither in the shader keeps gradients from banding.
T3Scene(function (api) {
  var gl = api.canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
  var P = api.palette, S = P.scene || [];
  if (!gl) { // no WebGL: a still gradient so the theme still works
    var c2 = api.canvas.getContext('2d');
    return { frame: function () { var g = c2.createLinearGradient(0, api.height, api.width, 0); g.addColorStop(0, S[1] || P.bg); g.addColorStop(0.55, S[2] || P.surface); g.addColorStop(1, S[3] || P.accent); c2.fillStyle = g; c2.fillRect(0, 0, api.width, api.height); } };
  }
  var VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var FS = [
    'precision highp float;',
    'uniform vec2 R;uniform float T;uniform vec3 C0,C1,C2,C3,C4;uniform vec4 Z[8];uniform int ZN;',
    'float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float zone(vec2 fc){float m=0.;for(int i=0;i<8;i++){if(i>=ZN)break;vec4 z=Z[i];vec2 d=max(max(z.xy-fc,fc-z.zw),0.);m=max(m,1.-smoothstep(0.,110.,length(d)));}return m;}',
    // the silk height field: a sheet whose rows are bent by slow, layered waves
    'float H(vec2 p){float w=sin(p.x*1.05+T*.11)*.55+sin(p.x*.52-T*.07+1.3)*.85+sin(p.x*2.0+p.y*.4+T*.05)*.10;',
    ' float y=p.y+w;return sin(y*2.4+sin(p.x*.8-T*.09)*1.2)*.55+sin(y*1.1-T*.06+p.x*.3)*.45;}',
    'void main(){vec2 fc=gl_FragCoord.xy;vec2 uv=fc/R;vec2 p=(fc-.5*R)/R.y*2.2;',
    ' p=mat2(.93,-.37,.37,.93)*p;',
    ' float e=.006;float h0=H(p),hx=H(p+vec2(e,0.)),hy=H(p+vec2(0.,e));',
    ' vec3 n=normalize(vec3((h0-hx)/e*.32,(h0-hy)/e*.32,1.));',
    ' vec3 L=normalize(vec3(-.45,.55,.7));vec3 Hv=normalize(L+vec3(0.,0.,1.));',
    ' float dif=clamp(dot(n,L),0.,1.);float nh=clamp(dot(n,Hv),0.,1.);',
    ' float spec=pow(nh,48.);float sheen=pow(nh,7.);',
    ' float k=clamp(uv.x*.6+uv.y*.32+h0*.12,0.,1.);',
    ' vec3 base=mix(C1,C2,smoothstep(0.,.5,k));base=mix(base,C3,smoothstep(.5,1.05,k+h0*.08));',
    ' vec3 col=C0*.7+base*(.12+.88*dif*dif);',
    ' col*=.5+.5*smoothstep(-1.,1.,h0);',
    ' col+=C4*spec*.5+C3*sheen*.10;',
    ' float zm=zone(fc);col=mix(col,C0+(col-C0)*.3,zm*.85);',
    ' col*=1.-.35*smoothstep(.5,1.25,length((uv-.5)*vec2(1.2,1.))*1.5);',
    ' col+=(h(fc+fract(T*3.1))-.5)*(3./255.);',
    ' gl_FragColor=vec4(max(col,0.),1.);}'
  ].join('\n');
  function sh(type, src) { var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
  var prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var U = {}; ['R', 'T', 'C0', 'C1', 'C2', 'C3', 'C4', 'Z', 'ZN'].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });
  gl.uniform3fv(U.C0, api.vec3(S[0] || P.bg)); gl.uniform3fv(U.C1, api.vec3(S[1] || '#4b1f5e'));
  gl.uniform3fv(U.C2, api.vec3(S[2] || '#2b2b7c')); gl.uniform3fv(U.C3, api.vec3(S[3] || P.accent));
  gl.uniform3fv(U.C4, api.vec3(S[4] || '#ffe8da'));
  var speed = api.params.speed || 1;
  function layout() { gl.viewport(0, 0, api.pxWidth, api.pxHeight); }
  layout();
  return {
    resize: layout,
    zones: layout,
    frame: function (t) {
      gl.uniform2f(U.R, api.pxWidth, api.pxHeight); gl.uniform1f(U.T, t * speed);
      gl.uniform4fv(U.Z, api.zonesGL); gl.uniform1i(U.ZN, api.zoneCount);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  };
});
