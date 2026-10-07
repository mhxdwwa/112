import{Lt as e,an as t,fa as n,in as r,no as i,ro as a}from"./three.core-DtjtRha-.js";import{n as o,t as s}from"./globals-29H6lCK0.js";import{t as c}from"./atmosphere-BNENFJca.js";import{s as l}from"./wind-BKJvbr9K.js";import{t as u}from"./bus-B6XsRwpa.js";import{n as d,o as f,s as p,t as m}from"./common-tHchggSb.js";import{n as h,t as g}from"./ground-glsl-B_t_Z4yP.js";var _=[[.3,[14,12,14]],[.35,[28,24,28]],[.35,[56,48,56]]],v=_[2][1],y=[.86,1,1.15],b=`
${c}
${m}
attribute vec4 iSeed;                 // xyz position in the box 0..1, w: speed class / size variation
uniform vec3 uCamBox;                 // wrap centre (camera, raised)
uniform vec3 uOff[3];                 // integrated displacement per speed class (wrapped)
uniform vec3 uVel[3];                 // current velocity per speed class (m/s)
uniform vec3 uBox0, uBox1, uBox2;
uniform float uShutter, uWidth, uAlpha, uGain;
uniform vec2 uTierFrac;              // cumulative shares of tiers 0, 1
varying vec2 vQ; varying float vA, vViewZ; varying vec3 vCol;
void main() {
  float tr = fract(float(gl_InstanceID) * 0.6180339);   // golden-ratio sequence: any prefix is evenly mixed
  int tier = tr < uTierFrac.x ? 0 : tr < uTierFrac.y ? 1 : 2;
  vec3 B = tier == 0 ? uBox0 : tier == 1 ? uBox1 : uBox2;
  int cls = int(iSeed.w * 2.999);
  vec3 p = iSeed.xyz * B + uOff[cls];
  vec3 rel = mod(p - uCamBox + B * 0.5, B) - B * 0.5;
  vec3 head = uCamBox + rel;
  vec3 vel = uVel[cls];
  vec3 toC = head - cameraPosition;
  float d = length(toC);
  // fades: box faces (hide the wrap), distance, lens
  vec3 e = abs(rel) / (B * 0.5);
  float a = 1.0 - smoothstep(0.72, 1.0, max(e.x, e.z));
  a *= 1.0 - smoothstep(0.6, 1.0, e.y);
  a *= tier < 2 ? 1.0 : 1.0 - smoothstep(20.0, 28.0, d);
  a *= smoothstep(0.7, 2.4, d);
  // motion-blurred quad along the velocity: head at y = 0, tail at y = 1
  vec3 axis = -vel * uShutter;
  vec3 V = toC / max(d, 1e-3);
  vec3 side = cross(normalize(axis), V);
  side /= max(length(side), 1e-3);
  float px = 2.0 * d / (projectionMatrix[1][1] * uResolution.y);   // metres per pixel at this depth
  float w = uWidth * (0.8 + 0.4 * fract(iSeed.w * 7.13));
  float wd = max(w, px * 0.85);
  a *= w / wd;                                                    // keep coverage when widened to ~1 px
  vec3 wp = head + axis * position.y * (0.75 + 0.5 * fract(iSeed.w * 3.7)) + side * position.x * wd;
  // light: fog/sky in-scatter along the ray (a drop refracts the bright sky into the dark scene), ambient, glints
  vec3 fogC = wx_skyFogColor(V);
  float mu = max(dot(V, uSunDir), 0.0);
  vec3 lit = fogC * 1.6 + fx_amb() * 0.6 + uSunCol * uSunVis * (0.012 + 0.35 * pow(mu, 12.0))
           + vec3(0.75, 0.82, 1.0) * uFlash * 0.55 + fx_lamps(head) * 1.2;
  vCol = lit * uGain;
  vA = a * uAlpha;
  vQ = position.xy;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vViewZ = -mv.z;
  gl_Position = vA < 0.002 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;   // culled drops cost no fragments
}`,x=`
${c}
${m}
${d}
varying vec2 vQ; varying float vA, vViewZ; varying vec3 vCol;
void main() {
  float x = abs(vQ.x);
  float prof = (1.0 - x * x) * smoothstep(0.0, 0.18, vQ.y) * (1.0 - smoothstep(0.35, 1.0, vQ.y) * 0.75);
  float a = vA * prof * fx_soft(vViewZ, 0.35);
  gl_FragColor = vec4(vCol, a);
}`,S=`
${c}
${g}
${m}
attribute vec4 iSeed;
attribute float aPart;
uniform vec3 uCamBox;
uniform float uBoxN, uBoxF, uNearFrac, uRainK, uGain;
varying vec2 vQ; varying float vPh, vA, vViewZ, vPart, vSeed; varying vec3 vCol;
float h12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main() {
  bool nearTier = fract(float(gl_InstanceID) * 0.6180339) < uNearFrac;
  float B = nearTier ? uBoxN : uBoxF;
  float life = 0.26 + 0.14 * iSeed.z;
  float cyc = uTime / life + iSeed.w * 17.0;
  float id = floor(cyc), ph = cyc - id;
  vec2 r = vec2(h12(vec2(id, iSeed.x * 311.0)), h12(vec2(iSeed.y * 173.0, id + 7.0)));
  vec2 rel = mod(r * B - uCamBox.xz + B * 0.5, B) - B * 0.5;
  vec2 xz = uCamBox.xz + rel;
  // only a share of the splashes live at lower rain levels (a cycle-hashed lottery keeps it flicker-free)
  float live = step(h12(vec2(id * 1.7, iSeed.z * 91.0)), uRainK);
  float gy = wt_groundHeight(xz);
  vec3 base = vec3(xz.x, gy + 0.015, xz.y);
  vec3 toC = base - cameraPosition; float d = length(toC);
  float a = live * (1.0 - smoothstep(0.7, 1.0, max(abs(rel.x), abs(rel.y)) / (B * 0.5)));
  a *= smoothstep(0.6, 1.6, d) * (1.0 - smoothstep(nearTier ? 20.0 : 14.0, nearTier ? 26.0 : 24.0, d));
  float sz = 0.06 + 0.04 * iSeed.x;
  vec3 wp;
  if (aPart < 0.5) {
    // crown: grows fast, jets lean out; faces the camera about the vertical axis
    vec3 sd = normalize(vec3(-toC.z, 0.0, toC.x) + 1e-5);
    float s = sz;
    wp = base + sd * position.x * s + vec3(0.0, position.y * s, 0.0);
  } else {
    float s = 0.02 + 0.1 * sqrt(ph) * (0.7 + 0.6 * iSeed.y);
    wp = base + vec3(position.x * s, 0.0, (position.y * 2.0 - 1.0) * s);
    a *= 0.8;
  }
  // light (same recipe as the streaks, a touch brighter: a splash is a cluster of lit droplets)
  vec3 V = toC / max(d, 1e-3);
  float mu = max(dot(V, uSunDir), 0.0);
  vCol = (wx_skyFogColor(V) * 1.6 + fx_amb() * 0.6 + uSunCol * uSunVis * (0.02 + 0.3 * pow(mu, 8.0))
         + vec3(0.75, 0.82, 1.0) * uFlash * 0.6 + fx_lamps(base) * 1.4) * uGain;
  vQ = position.xy; vPh = ph; vA = a; vPart = aPart; vSeed = iSeed.y + id * 0.137;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vViewZ = -mv.z;
  gl_Position = a < 0.002 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
}`,C=`
${c}
${m}
${d}
varying vec2 vQ; varying float vPh, vA, vViewZ, vPart, vSeed; varying vec3 vCol;
void main() {
  float a;
  if (vPart < 0.5) {
    // crown burst: a few droplets thrown up and out on parabolic arcs, plus the low sheet at the impact point
    float t = vPh * 0.3;                                   // seconds since impact (quad spans ~±1 = size)
    a = exp(-40.0 * vQ.y * vQ.y) * exp(-4.0 * vQ.x * vQ.x) * (1.0 - smoothstep(0.0, 0.5, vPh)) * 0.5;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float h = fract(sin(fi * 12.9898 + vSeed * 78.233) * 43758.5453);
      float vx = (h - 0.5) * 2.6, vy = 3.0 + 2.0 * fract(h * 7.31);
      vec2 dp = vec2(vx * t, vy * t - 9.8 * t * t * 2.2) * 1.1;
      vec2 e = (vQ - dp) * vec2(1.0, 0.7);
      a += exp(-dot(e, e) * 260.0) * 0.9;
    }
    a *= (1.0 - vPh) * 0.7;
  } else {
    // expanding ring (a thin crest with a faint inner trough)
    float r = length(vec2(vQ.x, vQ.y * 2.0 - 1.0));
    float ring = exp(-pow((r - 0.8) / 0.08, 2.0)) + 0.25 * exp(-pow((r - 0.55) / 0.1, 2.0));
    a = ring * (1.0 - vPh) * (1.0 - vPh) * 0.28 * step(r, 1.0);
  }
  a *= vA * fx_soft(vViewZ, 0.06);
  if (a < 0.002) discard;
  gl_FragColor = vec4(vCol, a);
}`;function w(i){let o=new t;o.setAttribute(`position`,new e([-1,0,0,1,0,0,1,1,0,-1,1,0],3)),o.setIndex([0,1,2,0,2,3]);let s=new Float32Array(i*4),c=1831565813,l=()=>(c^=c<<13,c^=c>>>17,c^=c<<5,(c>>>0)%1e7/1e7);for(let e=0;e<s.length;e++)s[e]=l();return o.setAttribute(`iSeed`,new r(s,4)),o.instanceCount=i,o.boundingSphere=new n(new a,1e6),o}function T(i){let o=new t;o.setAttribute(`position`,new e([-1,0,0,1,0,0,1,1,0,-1,1,0,-1,0,0,1,0,0,1,1,0,-1,1,0],3)),o.setAttribute(`aPart`,new e([0,0,0,0,1,1,1,1],1)),o.setIndex([0,1,2,0,2,3,4,5,6,4,6,7]);let s=new Float32Array(i*4),c=461845907,l=()=>(c^=c<<13,c^=c>>>17,c^=c<<5,(c>>>0)%1e7/1e7);for(let e=0;e<s.length;e++)s[e]=l();return o.setAttribute(`iSeed`,new r(s,4)),o.instanceCount=i,o.boundingSphere=new n(new a,1e6),o}var E=e=>e*e*(3-2*e),D=(e,t)=>e-Math.floor(e/t)*t;function O(e,t={}){let{intensity:n=1,wind:r=!0,wet:c=!0,count:d=40960,splashes:m=520}=t,g=w(d),O=y.map(()=>new a),k=y.map(()=>new a(0,-9,0)),A={uCamBox:{value:new a},uOff:{value:O},uVel:{value:k},uBox0:{value:new a(..._[0][1])},uBox1:{value:new a(..._[1][1])},uBox2:{value:new a(..._[2][1])},uTierFrac:{value:new i(_[0][0],_[0][0]+_[1][0])},uShutter:{value:.03},uWidth:{value:.0022},uAlpha:{value:.32},uGain:{value:1}},j=f({vs:b,fs:x,uniforms:A});j.name=`fx.rain`;let M=p(g,j,{layer:o.TRANSPARENT,order:4,name:`fx.rain`});e.scene.add(M);let N=T(m),P={...h(),uCamBox:{value:new a},uBoxN:{value:12},uBoxF:{value:34},uNearFrac:{value:.45},uRainK:{value:1},uGain:{value:.85}},F=f({vs:S,fs:C,uniforms:P});F.name=`fx.rain.splash`;let I=p(N,F,{layer:o.TRANSPARENT,order:5,name:`fx.rain.splash`});e.scene.add(I);let L={k:0,from:0,to:Math.max(0,Math.min(1,n)),t:0,dur:0,sent:-1,beat:0};L.k=L.to;let R={rain:0},z=(e=0)=>{L.beat+=e,!(L.beat<1&&Math.abs(L.k-L.sent)<.02&&(L.k!==L.to||L.sent===L.to))&&(L.beat=0,L.sent=L.k,R.rain=L.k,u.emit(`weather`,R))},B=()=>{let e=L.k;g.instanceCount=Math.round(d*Math.min(1,e*1.15)),M.visible=e>.003,P.uRainK.value=e,I.visible=e>.003,s.uRain.value=e};B();let V={streaks:M,splash:I,uniforms:A,splashUniforms:P,get intensity(){return L.k},setIntensity(e,t=2){if(e=Math.max(0,Math.min(1,+e||0)),t<=0){L.k=L.to=e,L.dur=0,B(),z();return}Object.assign(L,{from:L.k,to:e,t:0,dur:t})},update(t){L.dur>0&&(L.t=Math.min(L.t+t,L.dur),L.k=L.from+(L.to-L.from)*E(L.t/L.dur),L.t>=L.dur&&(L.dur=0,L.k=L.to),B()),z(t);let n=L.k;if(c){let e=s.uWet.value;s.uWet.value=n>.02?Math.min(1,e+t*n/14):Math.max(0,e-t/150)}if(!M.visible)return;let i=e.camera.position,a=s.uWind.value,o=r?l(i.x,i.z):0,u=a.x*o*1.9,d=a.y*o*1.9,f=-(8.4+1.2*n);for(let e=0;e<3;e++){let n=y[e];k[e].set(u*n,f*n,d*n);let r=O[e];r.set(D(r.x+k[e].x*t,v[0]),D(r.y+k[e].y*t,v[1]),D(r.z+k[e].z*t,v[2]))}A.uCamBox.value.set(i.x,i.y+3,i.z),P.uCamBox.value.copy(i)},dispose(){e.remove?.(V),e.scene.remove(M,I),g.dispose(),j.dispose(),N.dispose(),F.dispose(),s.uRain.value=0,R.rain=0,u.emit(`weather`,R)}};return e.add(V),z(),V}export{O as createRain};