import{$r as e,Dr as t,Dt as n,Lt as r,Rn as i,U as a,V as o,Yt as s,an as c,ar as l,do as u,ea as d,in as f,io as p,j as m,no as h,ta as g,tr as _}from"./three.core-DtjtRha-.js";import{t as v}from"./globals-29H6lCK0.js";var y=512,b=64,x=b/y,S=256,C=[1/.15,1/.003,1/.012,1/.6],w=`
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`,ee=`
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uShift;
uniform vec4 uDecay;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy) + ivec2(uShift);
  vec4 v = vec4(0.0);
  if (p.x >= 0 && p.y >= 0 && p.x < ${y} && p.y < ${y}) v = texelFetch(tSrc, p, 0);
  gl_FragColor = v * uDecay;
}
`,te=`
attribute vec4 iSeg;    // x0, z0, x1, z1 (world)
attribute vec4 iParam;  // radius, soft (0..1 inner fraction), noise edge, seed
attribute vec4 iVal;    // channel amounts
uniform vec4 uRect;     // x0, z0, span, 1/span
varying vec2 vW;
varying vec4 vSeg, vParam, vVal;
void main() {
  float r = iParam.x;
  vec2 a = iSeg.xy, b = iSeg.zw;
  vec2 lo = min(a, b) - r, hi = max(a, b) + r;
  vec2 w = mix(lo, hi, position.xy * 0.5 + 0.5);
  vW = w; vSeg = iSeg; vParam = iParam; vVal = iVal;
  vec2 uv = (w - uRect.xy) * uRect.w;
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}
`,T=`
precision highp float;
varying vec2 vW;
varying vec4 vSeg, vParam, vVal;
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1, 0)), u.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), u.x), u.y); }
void main() {
  vec2 a = vSeg.xy, b = vSeg.zw, pa = vW - a, ba = b - a;
  float hh = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  float d = length(pa - ba * hh);
  float r = vParam.x;
  // ragged edge for blood/dust splats
  if (vParam.z > 0.0) {
    float n = vn(vW * 7.0 + vParam.w * 17.0) * 0.65 + vn(vW * 19.0 - vParam.w * 5.0) * 0.35;
    r *= mix(1.0, 0.45 + 0.9 * n, vParam.z);
  }
  float f = 1.0 - smoothstep(r * vParam.y, r, d);
  if (f <= 0.0) discard;
  gl_FragColor = vVal * f;
}
`;function E(E){let{renderer:D}=E,O={type:s,format:e,minFilter:i,magFilter:i,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1,wrapS:o,wrapT:o},k=new u(y,y,O),A=new u(y,y,O);k.texture.name=`tInteractA`,A.texture.name=`tInteractB`;{let e=D.getRenderTarget(),t=D.getClearColor(new a),n=D.getClearAlpha();D.setClearColor(0,0);for(let e of[k,A])D.setRenderTarget(e),D.clear(!0,!1,!1);D.setClearColor(t,n),D.setRenderTarget(e)}let j=new t(-1,1,1,-1,0,1),M=new m;M.setAttribute(`position`,new r([-1,-1,0,3,-1,0,-1,3,0],3));let N=new g({uniforms:{tSrc:{value:null},uShift:{value:new h},uDecay:{value:new p(1,1,1,1)}},vertexShader:w,fragmentShader:ee,depthTest:!1,depthWrite:!1,blending:0}),P=new l(M,N);P.frustumCulled=!1;let F=new d;F.add(P);let I=new c;I.setAttribute(`position`,new r([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3)),I.setIndex([0,1,2,0,2,3]);let L=new f(new Float32Array(S*4),4).setUsage(n),R=new f(new Float32Array(S*4),4).setUsage(n),z=new f(new Float32Array(S*4),4).setUsage(n);I.setAttribute(`iSeg`,L),I.setAttribute(`iParam`,R),I.setAttribute(`iVal`,z);let B=[L,R,z];I.instanceCount=0;let V=v.uInteractRect.value,H=new g({uniforms:{uRect:{value:V}},vertexShader:te,fragmentShader:T,depthTest:!1,depthWrite:!1,blending:5,blendEquation:104,blendEquationAlpha:104,blendSrc:201,blendDst:201,blendSrcAlpha:201,blendDstAlpha:201}),U=new l(I,H);U.frustumCulled=!1;let W=new d;W.add(U);let G=0,K=0;function q(e,t,n,r,i,a,o,s,c,l,u){if(G>=S)return;let d=Math.min(e,n)-i,f=Math.max(e,n)+i,p=Math.min(t,r)-i,m=Math.max(t,r)+i;if(f<V.x||d>V.x+b||m<V.y||p>V.y+b)return;let h=G++*4;L.array[h]=e,L.array[h+1]=t,L.array[h+2]=n,L.array[h+3]=r,R.array[h]=Math.max(i,x*.75),R.array[h+1]=a,R.array[h+2]=o,R.array[h+3]=K++%97*.731,z.array[h]=s,z.array[h+1]=c,z.array[h+2]=l,z.array[h+3]=u}let J=new h(NaN,NaN),Y=null,X=[0,0,0,0],Z=[1,1,1,1],ne=0,re=0,Q=Array(8).fill(!1),$={rt:k,autoTrample:!0,setActor(e,t,n,r,i=.45){e<0||e>=8||(v.uActors.value[e].set(t,n,r,i),Q[e]=!0)},clearActor(e){e<0||e>=8||(v.uActors.value[e].set(0,-999,0,0),Q[e]=!1)},trample(e,t,n=.35,r=.8){q(e,t,e,t,n,.25,.15,Math.min(r,1),0,0,0)},cut(e,t,n,r,i=.3){q(e,t,n,r,Math.max(i*.5,.08),.55,0,0,1,0,0)},stain(e,t,n=.4,r=1){q(e,t,e,t,n,.35,.85,0,0,Math.min(r,1),0)},dust(e,t,n=.8,r=1){q(e,t,e,t,n,.2,.5,0,0,0,Math.min(r,1))},shock(e,t,n=1){v.uShock.value[ne++%4].set(e,t,v.uTime.value,n)},slash(e,t,n,r,i=1,a=1){let o=re++%4;v.uSlash.value[o].set(e,t,n,r),v.uSlashB.value[o].set(v.uTime.value,i,a,0)},setFocus(e,t){Y=e==null?null:{x:e,z:t}},update(e){let t=E.camera.position,n=t.y-E.world.heightAt(t.x,t.z);v.uCamGround.value.set(t.x,t.z,.8*(1-_.smoothstep(n,1.3,2.4)));let r=t.x,i=t.z,a=v.uActors.value[0];Y?(r=Y.x,i=Y.z):a.w>0&&(r=a.x,i=a.z);let o=Math.round((r-b/2)/x)*x,s=Math.round((i-b/2)/x)*x,c=0,l=0;if(Number.isNaN(J.x)?J.set(o,s):(c=Math.round((o-J.x)/x),l=Math.round((s-J.y)/x)),J.set(o,s),V.set(o,s,b,1/b),this.autoTrample)for(let e=0;e<8;e++){let t=v.uActors.value[e];if(!Q[e]||t.w<=0)continue;let n=E.world.heightAt(t.x,t.z);t.y-n>.6||q(t.x,t.z,t.x,t.z,t.w*.8,.2,.2,.38,0,0,0)}for(let t=0;t<4;t++){X[t]+=e;let n=Math.exp(-X[t]/C[t]);1-n>=.0012?(Z[t]=n,X[t]=0):Z[t]=1}N.uniforms.uDecay.value.fromArray(Z);let u=D.getRenderTarget(),d=D.autoClear;if(D.autoClear=!1,N.uniforms.tSrc.value=k.texture,N.uniforms.uShift.value.set(c,l),D.setRenderTarget(A),D.render(F,j),G>0){I.instanceCount=G;for(let e=0;e<3;e++){let t=B[e];t.clearUpdateRanges(),t.addUpdateRange(0,G*4),t.needsUpdate=!0}D.setRenderTarget(A),D.render(W,j),G=0}D.setRenderTarget(u),D.autoClear=d;let f=k;k=A,A=f,$.rt=k,v.tInteract.value=k.texture},dispose(){k.dispose(),A.dispose(),I.dispose(),M.dispose(),N.dispose(),H.dispose(),E.remove($)}};return v.tInteract.value=k.texture,E.add($),$}export{E as createInteraction};