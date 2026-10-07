import{Dr as e,Ja as t,Rn as n,Rt as r,_r as i,ar as a,do as o,ea as s,ft as c,io as l,jr as u,ro as d,ta as f,zi as p}from"./three.core-DtjtRha-.js";import{t as m}from"./globals-29H6lCK0.js";import{c as h,n as g}from"./terrain-field-BBDhBkq_.js";var _=1024,v=1536;function y(){let e=h(),t=e.n,n=e.H,r=e.xs,i=2*v/_,a=new Int32Array(_),o=new Float32Array(_);for(let e=0;e<_;e++){let n=Math.min(g.edge-.001,Math.max(-g.edge+.001,-1536+(e+.5)*i)),s=0,c=t-1;for(;c-s>1;){let e=s+c>>1;r[e]<=n?s=e:c=e}a[e]=s,o[e]=(n-r[s])/(r[s+1]-r[s])}let s=new Float32Array(_*_);for(let e=0;e<_;e++){let r=a[e],i=o[e],c=r*t;for(let r=0;r<_;r++){let l=a[r],u=o[r],d=c+l,f=n[d]+(n[d+1]-n[d])*u,p=n[d+t]+(n[d+t+1]-n[d+t])*u;s[e*_+r]=f+(p-f)*i}}return s}var b=`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`,x=`
precision highp float;
uniform highp sampler2D tH;
uniform vec4 uRect;
uniform vec3 uSun;
varying vec2 vUv;
float hAt(vec2 xz) {
  vec2 t = (xz - uRect.xy) * uRect.w * ${_}.0 - 0.5;
  if (t.x < 0.0 || t.y < 0.0 || t.x > 1023.0 || t.y > 1023.0) return -1e4;
  ivec2 i = ivec2(floor(t)); vec2 f = t - vec2(i);
  float a = texelFetch(tH, i, 0).r, b = texelFetch(tH, min(i + ivec2(1, 0), ivec2(1023)), 0).r;
  float c = texelFetch(tH, min(i + ivec2(0, 1), ivec2(1023)), 0).r, d = texelFetch(tH, min(i + ivec2(1, 1), ivec2(1023)), 0).r;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
void main() {
  vec2 xz = uRect.xy + vUv * uRect.z;
  float h0 = hAt(xz) + 0.6;
  vec3 L = normalize(uSun);
  float lh = max(length(L.xz), 1e-3);
  vec2 d = L.xz / lh;
  float tanE = L.y / lh;
  float vis = 1.0, t = 2.5;
  for (int i = 0; i < 56; i++) {
    vec2 p = xz + d * t;
    float clear = h0 + t * tanE - hAt(p);
    vis = min(vis, clamp(clear / (t * 0.035) + 0.5, 0.0, 1.0));   // ~2° soft penumbra
    t = t * 1.1 + 1.2;
    if (t > 1600.0 || vis <= 0.0) break;
  }
  gl_FragColor = vec4(vis, vis, vis, 1.0);
}
`;function S(h){let{renderer:g}=h,S=new c(y(),_,_,p,r);S.minFilter=S.magFilter=i,S.generateMipmaps=!1,S.needsUpdate=!0;let C=new o(_,_,{type:t,depthBuffer:!1,stencilBuffer:!1});C.texture.minFilter=n,C.texture.magFilter=n,C.texture.generateMipmaps=!1,C.texture.colorSpace=``;let w=new f({uniforms:{tH:{value:S},uRect:{value:new l(-1536,-1536,2*v,1/(2*v))},uSun:{value:new d}},vertexShader:b,fragmentShader:x,depthTest:!1,depthWrite:!1}),T=new a(new u(2,2),w);T.frustumCulled=!1;let E=new s;E.add(T);let D=new e(-1,1,1,-1,0,1);m.tWtSunVis=m.tWtSunVis||{value:null},m.uWtSunRect=m.uWtSunRect||{value:new l},m.tWtSunVis.value=C.texture,m.uWtSunRect.value.set(-1536,-1536,2*v,1/(2*v));let O=new d(0,-2,0),k=-1e9,A={texture:C.texture,uniforms:{tWtSunVis:m.tWtSunVis,uWtSunRect:m.uWtSunRect},render(){w.uniforms.uSun.value.copy(m.uSunDir.value),O.copy(m.uSunDir.value);let e=g.getRenderTarget(),t=g.autoClear;g.setRenderTarget(C),g.autoClear=!0,g.render(E,D),g.setRenderTarget(e),g.autoClear=t},update(e,t,n,r){let i=m.uSunDir.value,a=performance.now();i.dot(O)<.999986&&a-k>500&&(k=a,A.render())}};return A.render(),h.add(A),A}export{S as t};