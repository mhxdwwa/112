const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./layout-BF55wjY-.js","./layout-BRcTijZA.js","./levels-BiJcK8X0.js","./steppe-B-XUAVRl.js","./bamboo-D4bMiQa3.js","./town-DbPZJVkl.js"])))=>i.map(i=>d[i]);
import{n as e}from"./three.module-YNTH5p0u.js";import{$r as t,E as n,Hn as r,Ja as i,L as a,Qi as o,Rn as s,Rt as c,Wi as l,_r as u,ft as d,io as f,tr as p,zi as m}from"./three.core-DtjtRha-.js";import{t as h}from"./globals-29H6lCK0.js";import{t as g}from"./glsl-BgzraZja.js";import{i as _}from"./noise-D9IUCAHK.js";import{t as v}from"./preload-helper-uBIymjUX.js";var y=null;function b(){if(y)return y;let t=e.lights_fragment_begin,n=e.lights_pars_begin;if(/gSunColor\s*=/.test(t)&&/gSunColor/.test(n+t))return y={key:`sunS`,lightsChunk:`#include <lights_fragment_begin>`,sunC:`gSunColor`,sunD:`gSunDir`},y;let r=t.indexOf(`#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )`),i=r>=0?t.indexOf(`RE_Direct( directLight`,r):-1;return i<0?(y={key:`sunG`,lightsChunk:`#include <lights_fragment_begin>
vec3 wxSunC = uSunCol * 0.59 * uSunVis; vec3 wxSunD = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);`,sunC:`wxSunC`,sunD:`wxSunD`,needsGlobals:!0},y):(y={key:`sunF`,lightsChunk:`vec3 wxSunC = vec3( 0.0 ); vec3 wxSunD = vec3( 0.0, 1.0, 0.0 ); float wxSunBest = -1.0;
`+t.slice(0,i)+`{ float wxL = dot( directionalLights[ i ].color, vec3( 0.2126, 0.7152, 0.0722 ) ); if ( wxL > wxSunBest ) { wxSunBest = wxL; wxSunC = directLight.color; wxSunD = directLight.direction; } }
		`+t.slice(i),sunC:`wxSunC`,sunD:`wxSunD`},y)}function x(e){return e.needsGlobals?g(`vec3`,`uSunCol`)+g(`vec3`,`uSunDir`)+g(`float`,`uSunVis`):``}function S(e){return e.needsGlobals?{uSunCol:h.uSunCol,uSunDir:h.uSunDir,uSunVis:h.uSunVis}:{}}var C=`
float faceDirection = 1.0;
vec3 normal = normalize( vNormal );
vec3 nonPerturbedNormal = normal;
`,w=`
mat3 wx_invRotScale(mat3 m) { return transpose(m) / max(dot(m[0], m[0]), 1e-8); }
`;function T(e,t,n,r=6){let i=e.getImageData(0,0,t,n),a=i.data,o=new Uint8Array(t*n);for(let e=0;e<t*n;e++)o[e]=a[e*4+3];let s=new Uint8Array(t*n);for(let e=0;e<t*n;e++)s[e]=+(o[e]>8);let c=new Uint8Array(t*n);for(let e=0;e<r;e++){c.set(s);for(let e=0;e<n;e++)for(let r=0;r<t;r++){let i=e*t+r;if(s[i])continue;let o=0,l=0,u=0,d=0;r>0&&s[i-1]&&(o+=a[(i-1)*4],l+=a[(i-1)*4+1],u+=a[(i-1)*4+2],d++),r<t-1&&s[i+1]&&(o+=a[(i+1)*4],l+=a[(i+1)*4+1],u+=a[(i+1)*4+2],d++),e>0&&s[i-t]&&(o+=a[(i-t)*4],l+=a[(i-t)*4+1],u+=a[(i-t)*4+2],d++),e<n-1&&s[i+t]&&(o+=a[(i+t)*4],l+=a[(i+t)*4+1],u+=a[(i+t)*4+2],d++),d&&(a[i*4]=o/d,a[i*4+1]=l/d,a[i*4+2]=u/d,c[i]=1)}s.set(c)}let l=0,u=0,d=0,f=0;for(let e=0;e<t*n;e++)o[e]>8&&(l+=a[e*4],u+=a[e*4+1],d+=a[e*4+2],f++);f&&(l/=f,u/=f,d/=f);for(let e=0;e<t*n;e++)s[e]||(a[e*4]=l,a[e*4+1]=u,a[e*4+2]=d),a[e*4+3]=o[e];e.putImageData(i,0,0)}function E(e,{srgb:t=!0,mips:n=!0,aniso:i=4,repeat:c=!1}={}){let u=new a(e);return u.colorSpace=t?o:``,u.generateMipmaps=n,u.minFilter=n?r:s,u.magFilter=s,u.anisotropy=i,u.premultiplyAlpha=!1,c&&(u.wrapS=u.wrapT=l),u.needsUpdate=!0,u}function D(e,t){let n=document.createElement(`canvas`);return n.width=e,n.height=t,n}function O(e,n=320,r=512){let a=e.world.heightAt,o=e.world.pathAt,l=r,h=n*2/l,g=new Float32Array(l*l);for(let e=0;e<l;e++){let t=-n+(e+.5)*h;for(let r=0;r<l;r++)g[e*l+r]=a(-n+(r+.5)*h,t)}let v=(e,t)=>{let n=new Float32Array(l*l),r=new Float32Array(l*l);for(let r=0;r<l;r++){let i=0,a=0;for(let n=-t;n<=t;n++)n>=0&&n<l&&(i+=e[r*l+n],a++);for(let o=0;o<l;o++){n[r*l+o]=i/a;let s=o-t,c=o+t+1;s>=0&&(i-=e[r*l+s],a--),c<l&&(i+=e[r*l+c],a++)}}for(let e=0;e<l;e++){let i=0,a=0;for(let r=-t;r<=t;r++)r>=0&&r<l&&(i+=n[r*l+e],a++);for(let o=0;o<l;o++){r[o*l+e]=i/a;let s=o-t,c=o+t+1;s>=0&&(i-=n[s*l+e],a--),c<l&&(i+=n[c*l+e],a++)}}return r},y=v(g,Math.max(1,Math.round(3.5/h))),b=v(g,Math.max(2,Math.round(11/h))),x=new Uint8Array(l*l*4),S=p.smoothstep;for(let e=0;e<l;e++){let t=-n+(e+.5)*h;for(let r=0;r<l;r++){let i=-n+(r+.5)*h,a=e*l+r,s=g[a],c=g[e*l+Math.min(l-1,r+1)]-g[e*l+Math.max(0,r-1)],u=g[Math.min(l-1,e+1)*l+r]-g[Math.max(0,e-1)*l+r],d=Math.hypot(c,u)/(2*h),f=1-Math.min(.55,Math.max(0,(y[a]-s)*.2+(b[a]-s)*.035)),p=0;if(o){let e=o(i,t);e&&(p=1-S(e.dist,e.width*.55,e.width*.55+1.6))}let m=S(d,.55,.9),v=_.fbm2(i*.05,t*.05,2),C=(1-m)*(1-p)*(.62+.38*S(v,-.5,.3)),w=S(Math.hypot(i,t),18,8),T=Math.min(1,Math.max(0,(1-f)*1.6+.3*_.fbm2(i*.01+7,t*.01,2))),E=(.35+.65*S(_.fbm2(i*.02-3,t*.02+9,2)+T*.4,-.2,.6))*(1-.6*w);x[a*4]=Math.round(C*255),x[a*4+1]=Math.round(Math.min(1,E)*255),x[a*4+2]=Math.round(T*255),x[a*4+3]=Math.round(f*255)}}let C=new d(g,l,l,m,c);C.minFilter=C.magFilter=u,C.generateMipmaps=!1,C.needsUpdate=!0,C.name=`vegFallbackHeight`;let w=new d(x,l,l,t,i);return w.minFilter=w.magFilter=s,w.generateMipmaps=!1,w.needsUpdate=!0,w.name=`vegFallbackGround`,{tH:C,tG:w,rect:new f(-n,-n,n*2,1/(n*2))}}var k=new WeakMap;function A(e){let t=k.get(e);if(t)return t;let n={tGH:{value:null},tGG:{value:null},uHRect:{value:new f},uGRect:{value:new f},uGreenMode:{value:0}},r=null;function i(){let t=!!h.tHeight.value,i=!!h.tGround.value;(!t||!i)&&!r&&(r=O(e)),t?(n.tGH.value=h.tHeight.value,n.uHRect.value.copy(h.uWorldRect.value)):(n.tGH.value=r.tH,n.uHRect.value.copy(r.rect)),i?(n.tGG.value=h.tGround.value,n.uGRect.value.copy(h.uWorldRect.value),n.uGreenMode.value=1):(n.tGG.value=r.tG,n.uGRect.value.copy(r.rect),n.uGreenMode.value=0)}return i(),t={uniforms:n,get usingFallback(){return n.tGG.value===r?.tG||n.tGH.value===r?.tH},update(){(h.tHeight.value&&n.tGH.value!==h.tHeight.value||h.tGround.value&&n.tGG.value!==h.tGround.value)&&i()}},e.add({update:t.update}),k.set(e,t),t}var j=`
#ifndef VEG_GROUND
#define VEG_GROUND
uniform sampler2D tGH;        // ground height (R32F, manual bilinear)
uniform sampler2D tGG;        // ground info: R density, G height factor, B late-green / moisture, A cavity
uniform vec4 uHRect, uGRect;  // x0, z0, size, 1/size of tGH / tGG
uniform float uGreenMode;
float gxHeight(vec2 xz) {
  vec2 uv = (xz - uHRect.xy) * uHRect.w;
  ivec2 sz = textureSize(tGH, 0);
  vec2 p = uv * vec2(sz) - 0.5;
  vec2 fl = floor(p);
  vec2 f = p - fl;
  ivec2 i = clamp(ivec2(fl), ivec2(0), sz - 2);
  float a = texelFetch(tGH, i, 0).r, b = texelFetch(tGH, i + ivec2(1, 0), 0).r;
  float c = texelFetch(tGH, i + ivec2(0, 1), 0).r, d = texelFetch(tGH, i + ivec2(1, 1), 0).r;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
vec4 gxGround(vec2 xz) {
  vec2 uv = (xz - uGRect.xy) * uGRect.w;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec4(0.0, 0.5, 0.0, 1.0);
  return textureLod(tGG, uv, 0.0);
}
#endif
`,M=`
${g(`sampler2D`,`tInteract`)}${g(`vec4`,`uInteractRect`)}
${g(`vec4`,`uActors`,`[8]`)}${g(`vec4`,`uShock`,`[4]`)}${g(`vec4`,`uSlash`,`[4]`)}${g(`vec4`,`uSlashB`,`[4]`)}
${g(`vec3`,`uCamGround`)}${g(`float`,`uTime`)}${g(`vec4`,`uWind`)}
`;function N(){return{tInteract:h.tInteract,uInteractRect:h.uInteractRect,uActors:h.uActors,uShock:h.uShock,uSlash:h.uSlash,uSlashB:h.uSlashB,uCamGround:h.uCamGround,uTime:h.uTime,uWind:h.uWind}}var P=`
#ifndef VEG_PUSH
#define VEG_PUSH
vec2 vegPush(vec2 root, float baseY, float H, vec4 im, vec2 iuv, float reach, inout float contact) {
  vec2 push = vec2(0.0);
  for (int i = 0; i < 8; i++) {
    vec4 a = uActors[i];
    if (a.w <= 0.0) continue;
    vec2 d = root - a.xz;
    float dl = length(d);
    float R = (a.w * 1.35 + 0.3 * H) * reach;
    float f = (1.0 - smoothstep(0.25 * R, R, dl)) * step(a.y - baseY, 1.6 + H);
    push += (d / max(dl, 1e-3)) * f * 1.25;
    contact = max(contact, exp(-(dl * dl) / 0.49));
  }
  if (uCamGround.z > 0.0) {
    vec2 d = root - uCamGround.xy; float dl = length(d);
    push += d / max(dl, 1e-3) * (1.0 - smoothstep(uCamGround.z, uCamGround.z * 2.4, dl)) * 0.9;
  }
  if (im.r > 0.01) {
    float e = 0.1875 * uInteractRect.w;
    float gx = textureLod(tInteract, iuv + vec2(e, 0.0), 0.0).r - textureLod(tInteract, iuv - vec2(e, 0.0), 0.0).r;
    float gz = textureLod(tInteract, iuv + vec2(0.0, e), 0.0).r - textureLod(tInteract, iuv - vec2(0.0, e), 0.0).r;
    vec2 gr = vec2(gx, gz);
    vec2 tdir = length(gr) > 0.02 ? -normalize(gr) : normalize(uWind.xy + vec2(0.31, -0.17));
    push += tdir * im.r * 1.3;
  }
  for (int i = 0; i < 4; i++) {
    vec4 s = uShock[i];
    float age = uTime - s.z;
    if (age < 0.0 || age > 0.9) continue;
    vec2 d = root - s.xy; float dl = length(d);
    float ring = exp(-pow((dl - 9.0 * age) / 1.2, 2.0));
    float k = 1.0 - age / 0.9;
    push += d / max(dl, 1e-3) * s.w * k * k * ring * 1.2;
  }
  for (int i = 0; i < 4; i++) {
    vec4 c = uSlash[i]; vec4 sb = uSlashB[i];
    float age = uTime - sb.x;
    if (age < 0.0 || age > 0.6) continue;
    vec2 pa = root - c.xy, ba = c.zw - c.xy;
    float hh = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
    vec2 dv = pa - ba * hh; float dl = length(dv);
    if (dl > 2.5) continue;
    float a2 = clamp((age - hh * 0.12) / 0.35, 0.0, 1.0);
    float pulse = sin(3.14159 * a2) * exp(-dl / 1.2) * (1.0 - smoothstep(1.8, 2.5, dl));
    vec2 nrm = dl > 1e-3 ? dv / dl : normalize(vec2(-ba.y, ba.x) + 1e-4);
    push += nrm * sb.y * pulse * 1.1 / (1.0 + max(sb.z - 0.6, 0.0) * 0.7);
  }
  return push;
}
vec4 vegInteractAt(vec2 root, out vec2 iuv) {
  iuv = (root - uInteractRect.xy) * uInteractRect.w;
  bool inMap = all(greaterThan(iuv, vec2(0.004))) && all(lessThan(iuv, vec2(0.996)));
  return inMap ? textureLod(tInteract, iuv, 0.0) : vec4(0.0);
}
#endif
`,F=`
#ifndef VEG_FLOWER_PATCH
#define VEG_FLOWER_PATCH
${g(`vec4`,`uFlowerSpots`,`[6]`)}
float vegFlowerPatch(vec2 xz, out float core) {
  float n = wx_vnoise(xz * 0.075 + vec2(9.1, -3.3)) * 0.62 + wx_vnoise(xz * 0.19 + vec2(-4.7, 7.9)) * 0.38;
  float region = wx_vnoise(xz * 0.013 + vec2(2.3, 5.7));             // some hillsides bloom, some don't
  float p = smoothstep(0.6, 0.78, n + (region - 0.5) * 0.28);
  // red spider lily cores in ~1/3 of the noise meadows
  core = smoothstep(0.74, 0.86, n) * smoothstep(0.52, 0.64, wx_vnoise(xz * 0.021 + vec2(-8.0, 1.0)));
  for (int i = 0; i < 6; i++) {
    vec4 s = uFlowerSpots[i];
    if (s.z <= 0.0) continue;
    float d = length(xz - s.xy) / s.z;
    if (d > 1.2) continue;
    float e = (0.85 + 0.3 * wx_vnoise(xz * 0.6 + float(i) * 7.0)) - d;   // ragged patch edge
    float w = smoothstep(0.0, 0.35, e) * s.w;
    p = max(p, w);
    core = max(core, w);
  }
  return p;
}
#endif
`,I={value:Array.from({length:6},()=>new f(0,0,0,0))};h.uFlowerSpots??=I;function L(e=[]){for(let t=0;t<6;t++){let n=e[t];n?I.value[t].set(n.x,n.z,n.r,n.strength??1):I.value[t].set(0,0,0,0)}}var R=(await v(()=>import(`./layout-BF55wjY-.js`),__vite__mapDeps([0,1,2,3,4,5]),import.meta.url).catch(()=>null))?.LAYOUT,z=R??null;L(R?.higanbana??[{x:-10.5,z:-25.5,r:7},{x:6.5,z:5.5,r:2.6},{x:-26,z:-12,r:4}]);var B=class{constructor(e,{tile:t,k:r,ring:i,cap:a=64,max:o=64,pad:s=1.8}){this.app=e,this.tile=t,this.k0=r,this.ring=i.slice(),this.cap=Math.min(a,o),this.pad=s,this.uniforms={uTiles:{value:Array.from({length:o},()=>new f(0,0,t,0))},uK:{value:r},uRing:{value:new f(...i)}},this.cand=Array.from({length:2048},()=>({x:0,z:0,d:0})),this.list=[],this.count=0,this.hCache=new Map,this._box=new n}setRing(e){this.ring=e.slice(),this.uniforms.uRing.value.set(...e)}setDensity(e){this.uniforms.uK.value=Math.max(2,Math.round(this.k0*Math.sqrt(Math.max(.05,e))))}get perTile(){let e=this.uniforms.uK.value;return e*e}range(e,t){let n=(e+32768)*65536+(t+32768),r=this.hCache.get(n);if(!r){let i=this.tile,a=this.app.world.heightAt,o=1/0,s=-1/0;for(let n=0;n<=4;n++)for(let r=0;r<=4;r++){let c=a(e*i+n/4*i,t*i+r/4*i);c<o&&(o=c),c>s&&(s=c)}r={lo:o-.3,hi:s+.3},this.hCache.size>2e4&&this.hCache.clear(),this.hCache.set(n,r)}return r}select(e,t){let n=this.tile,r=e.x,i=e.z,a=this.ring[0]-2,o=this.ring[3]+.5,s=Math.floor((r-o)/n),c=Math.floor((r+o)/n),l=Math.floor((i-o)/n),u=Math.floor((i+o)/n),d=this.list,f=0;for(let e=l;e<=u;e++)for(let l=s;l<=c;l++){let s=l*n,c=e*n,u=Math.max(s-r,0,r-s-n),p=Math.max(c-i,0,i-c-n),m=Math.hypot(u,p);if(m>o)continue;let h=Math.max(Math.abs(s-r),Math.abs(s+n-r)),g=Math.max(Math.abs(c-i),Math.abs(c+n-i));if(Math.hypot(h,g)<a)continue;let _=this.range(l,e);if(this._box.min.set(s-.8,_.lo,c-.8),this._box.max.set(s+n+.8,_.hi+this.pad,c+n+.8),!t.intersectsBox(this._box))continue;if(f>=this.cand.length)break;let v=this.cand[f];v.x=s,v.z=c,v.d=m,d[f]=v,f++}d.length=f,d.sort(V);let p=Math.min(f,this.cap),m=this.uniforms.uTiles.value;for(let e=0;e<p;e++)m[e].set(d[e].x,d[e].z,n,0);return this.count=p,p}},V=(e,t)=>e.d-t.d;function H(e,t,n){return e.updateMatrixWorld(),n.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),t.setFromProjectionMatrix(n),t}export{b as _,j as a,P as c,T as d,I as f,S as g,x as h,B as i,H as l,L as m,C as n,M as o,D as p,w as r,z as s,F as t,E as u,A as v,N as y};