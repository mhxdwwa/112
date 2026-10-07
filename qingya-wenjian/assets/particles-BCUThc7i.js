import{ro as e}from"./three.core-DtjtRha-.js";import{t}from"./atmosphere-BNENFJca.js";import{a as n,d as r,i,l as a,n as o,o as s,r as c,s as l,t as u,u as d}from"./common-tHchggSb.js";var f=`
${t}
${u}
attribute vec3 iPos; attribute vec3 iVel; attribute vec4 iData;   // age01, width m, seed, amount
uniform float uStretch, uMaxLen;
varying vec2 vL; varying float vLen, vEnergy, vViewZ; varying vec4 vData;
varying vec3 vWp, vSide, vDir, vToCam, vAtT, vAtS, vLamp;
void main() {
  vec3 axis = iVel * uStretch;
  float L = length(axis);
  if (L > uMaxLen) { axis *= uMaxLen / L; L = uMaxLen; }
  vec3 dir = L > 1e-5 ? axis / L : vec3(0.0, 1.0, 0.0);
  vec3 toCam = normalize(cameraPosition - iPos);
  vec3 side = cross(dir, toCam); float sl = length(side);
  side = sl > 1e-3 ? side / sl : normalize(cross(vec3(0.0, 1.0, 0.0), toCam) + vec3(1e-4, 0.0, 0.0));
  vec4 mvc = viewMatrix * vec4(iPos, 1.0);
  float z = max(-mvc.z, 0.05);
  float px = 2.0 * z / (projectionMatrix[1][1] * uResolution.y);
  float w = max(iData.y, px * 0.8);
  vEnergy = iData.y / w;
  float along = w - (L + 2.0 * w) * position.y;
  vec3 wp = iPos + dir * along + side * position.x * w;
  vL = vec2(position.x, along / w); vLen = L / w;
  vData = iData; vWp = wp; vSide = side; vDir = dir; vToCam = toCam;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vViewZ = -mv.z;
#ifdef LIT
  vAtS = wx_applyAtmosphere(vec3(0.0), wp);
  vAtT = wx_applyAtmosphere(vec3(1.0), wp) - vAtS;
  vLamp = fx_lamps(iPos);
#else
  vAtS = vec3(0.0); vLamp = vec3(0.0);
  vAtT = wx_applyAtmosphereT(vec3(1.0), wp, 0.0);
#endif
  gl_Position = projectionMatrix * mv;
}`,p=`
#define WX_FOG_ADD
${t}
${u}
${o}
varying vec2 vL; varying float vLen, vEnergy, vViewZ; varying vec4 vData;
varying vec3 vWp, vSide, vDir, vToCam, vAtT, vAtS, vLamp;
void main() {
  float a = vL.y;
  float da = a > 0.0 ? a : (a < -vLen ? a + vLen : 0.0);
  float d2 = vL.x * vL.x + da * da;
  float prof = exp(-d2 * 2.2);
  float tailK = mix(1.0, 0.1, clamp(-a / max(vLen, 1e-3), 0.0, 1.0));
  float age = vData.x, seed = vData.z;
  float heat = pow(1.0 - age, 1.25);
  vec3 hue = mix(vec3(1.0, 0.26, 0.05), vec3(1.0, 0.64, 0.30), heat);
  hue = mix(hue, vec3(1.0, 0.92, 0.8), smoothstep(0.85, 1.0, heat) * 0.6);   // white-hot at birth
  float flick = 0.72 + 0.28 * sin(age * 90.0 + seed * 61.0);
  vec3 c = hue * mix(1.5, 24.0, heat * heat) * flick * vData.w;
  c *= prof * tailK * vEnergy * fx_soft(vViewZ, 0.06) * vAtT;
  gl_FragColor = vec4(c, 1.0);
}`,m=`
${t}
${u}
${o}
uniform float uInk;
varying vec2 vL; varying float vLen, vEnergy, vViewZ; varying vec4 vData;
varying vec3 vWp, vSide, vDir, vToCam, vAtT, vAtS, vLamp;
void main() {
  float a = vL.y;
  float da = a > 0.0 ? a : (a < -vLen ? a + vLen : 0.0);
  // teardrop: round head, thinning tail
  float t01 = clamp(-a / max(vLen, 1e-3), 0.0, 1.0);
  float wx = vL.x / mix(1.0, 0.35, t01);
  float r = sqrt(wx * wx + da * da);
  float mask = 1.0 - smoothstep(0.62, 1.0, r);
  float age = vData.x;
  float alpha = mask * (1.0 - smoothstep(0.8, 1.0, age)) * min(vEnergy * 1.4, 1.0) * fx_soft(vViewZ, 0.04);
  if (alpha < 0.01) discard;
  float nx = clamp(wx, -0.98, 0.98);
  vec3 N = normalize(vSide * nx + vToCam * sqrt(1.0 - nx * nx) + vDir * clamp(da, -1.0, 1.0) * 0.6);
  vec3 L = uSunDir, V = vToCam;
  float ink = max(uInk, vData.w);
  vec3 albedo = mix(vec3(0.19, 0.006, 0.005), vec3(0.008, 0.008, 0.01), ink);
  vec3 sunC = uSunCol * uSunVis;
  vec3 col = albedo * (fx_amb() + sunC * 0.4 * max(dot(N, L), 0.0) + vLamp);
  float back = pow(max(dot(-V, L), 0.0), 4.0);
  col += mix(vec3(0.85, 0.05, 0.025), vec3(0.03), ink) * sunC * 0.28 * back * (1.0 - r * 0.6);   // ruby when backlit
  vec3 H = normalize(L + V);
  float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  col += sunC * pow(max(dot(N, H), 0.0), 140.0) * 0.9;                                         // wet glint
  col += (uSkyUp * uAmbK) * fres * 0.5;
  col = col * vAtT + vAtS;
  gl_FragColor = vec4(col, alpha);
}`,h=`
${t}
${u}
attribute vec3 iPos; attribute vec3 iCol; attribute vec4 iData;   // size m, age01, kind (0 glow, 1 glow+star, 2 star), rot
varying vec2 vQ; varying vec3 vCol, vAtT; varying vec4 vData; varying float vCZ; varying vec2 vCUv;
void main() {
  float S = iData.x;
  float ext = iData.z > 0.5 ? 2.6 : 1.0;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec2 q = position.xy;               // -1..1
  vec3 wp = iPos + (right * q.x + up * q.y) * S * ext;
  vQ = q * ext; vCol = iCol; vData = iData;
  vec4 c = viewMatrix * vec4(iPos, 1.0);
  vCZ = -c.z;
  vec4 cc = projectionMatrix * c;
  vCUv = cc.xy / cc.w * 0.5 + 0.5;
  vAtT = wx_applyAtmosphereT(vec3(1.0), iPos, 0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`,g=`
#define WX_FOG_ADD
${t}
${u}
${o}
varying vec2 vQ; varying vec3 vCol, vAtT; varying vec4 vData; varying float vCZ; varying vec2 vCUv;
void main() {
  // 5-tap manual occlusion against the opaque snapshot (depthTest is off so the halo can wrap edges)
  vec2 o = vec2(3.0) / uResolution;
  float zc = vCZ - 0.12, vis = 0.0;
  vis += step(zc, fx_sceneZ(vCUv));
  vis += step(zc, fx_sceneZ(vCUv + vec2(o.x, 0.0))); vis += step(zc, fx_sceneZ(vCUv - vec2(o.x, 0.0)));
  vis += step(zc, fx_sceneZ(vCUv + vec2(0.0, o.y))); vis += step(zc, fx_sceneZ(vCUv - vec2(0.0, o.y)));
  vis *= 0.2;
  if (vis <= 0.0) discard;
  float age = vData.y, kind = vData.z;
  float env = smoothstep(0.0, 0.06, age) * pow(1.0 - age, 1.6);
  float rr = length(vQ) * 0.5;            // 0.5 = sprite edge (glow radius = size)
  float g = 0.0;
  if (kind < 1.5) g = exp(-pow(rr / 0.03, 2.0)) * 5.0 + exp(-pow(rr / 0.1, 2.0)) + exp(-pow(rr / 0.3, 2.0)) * 0.35;
  if (kind > 0.5) {
    float c = cos(vData.w), s = sin(vData.w);
    vec2 p = mat2(c, -s, s, c) * vQ;
    float arm = exp(-abs(p.x) * 2.6) * exp(-p.y * p.y * 900.0) + exp(-abs(p.y) * 2.6) * exp(-p.x * p.x * 900.0);
    vec2 d = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p;
    arm += 0.3 * (exp(-abs(d.x) * 5.0) * exp(-d.y * d.y * 1400.0) + exp(-abs(d.y) * 5.0) * exp(-d.x * d.x * 1400.0));
    float star = arm * (0.6 + 0.4 * exp(-dot(p, p) * 8.0)) * 3.0;
    g += star * (kind > 1.5 ? 1.0 : 0.8) * (1.0 - smoothstep(0.0, 1.0, age) * 0.5);
  }
  float edge = 1.0 - smoothstep(0.8, 1.0, max(abs(vQ.x), abs(vQ.y)) / (kind > 0.5 ? 2.6 : 1.0));
  vec3 c = vCol * g * env * vis * edge * vAtT;
  gl_FragColor = vec4(c, 1.0);
}`,_=9.8;function v(t,{interaction:o,lamps:u,heightAt:v}){let y=v,b=new c(640,13),x=a(640,{iPos:3,iVel:3,iData:4}),S=s({vs:f,fs:p,additive:!0,uniforms:{uStretch:{value:.028},uMaxLen:{value:.35}}});t.scene.add(l(x,S,{order:20,name:`fx.sparks`}));let C=new c(600,13),w=a(600,{iPos:3,iVel:3,iData:4}),T={value:0},E=s({vs:f,fs:m,defines:{LIT:1},uniforms:{uStretch:{value:.016},uMaxLen:{value:.12},uInk:T}});t.scene.add(l(w,E,{order:14,name:`fx.blood`}));let D=new c(64,11),O=a(64,{iPos:3,iCol:3,iData:4},{centered:!0}),k=s({vs:h,fs:g,additive:!0,depthTest:!1});t.scene.add(l(O,k,{order:30,name:`fx.glow`}));let A=new e,j=new e;function M(e,t,n,r,i,a){let o=b.spawn(),s=b.d;return s[o]=e.x,s[o+1]=e.y,s[o+2]=e.z,s[o+3]=t.x*n,s[o+4]=t.y*n,s[o+5]=t.z*n,s[o+6]=0,s[o+7]=r,s[o+8]=i,s[o+9]=d(),s[o+10]=a,s[o+11]=0,s[o+12]=1.5,o}function N(e,t,n,r,i,a=.35){let o=D.spawn(),s=D.d;s[o]=e.x,s[o+1]=e.y,s[o+2]=e.z,s[o+3]=n[0],s[o+4]=n[1],s[o+5]=n[2],s[o+6]=t,s[o+7]=0,s[o+8]=i,s[o+9]=r,s[o+10]=a}let P={sparks(e,t,n=1){n=Math.max(.2,n),j.copy(t??A.set(0,1,0)),j.lengthSq()<1e-6&&j.set(0,1,0),j.normalize();let a=Math.round(22+19*n);for(let t=0;t<a;t++){let t=d()<.18;i(j,t?1.1:.61,A);let a=M(e,A,t?r(1.2,3.5):r(4,9)*(.85+.15*n),t?r(.7,1.3):r(.25,.6),t?r(.006,.01):r(.008,.014),t?.35:r(.7,1.2));t&&(b.d[a+12]=3.5)}N(e,.34+.12*n,[3.2,.78*3.2,.52*3.2],+(n>=1.8),.12+.04*n,d()*3),n>=1.8&&N(e,.6,[3,.95*3,2.55],2,.09,d()*3),u?.flash?.(e,[1,.62,.3],3.5+2.5*n,.12)},hitGlow(e,t=.5,n){let r=n||[1,.85,.6],i=3.4;N(e,Math.max(.12,t),[r[0]*i,r[1]*i,r[2]*i],1,.22,.35+d()*.2)},droplets(e,t,n,a){j.copy(t??A.set(1,0,0)),j.lengthSq()<1e-6&&j.set(1,0,0),j.normalize();for(let t=0;t<n;t++){i(j,.55,A),A.y+=r(.05,.5),A.normalize();let t=C.spawn(),n=C.d,o=r(1.6,5.2),s=d()<.2;n[t]=e.x+r(-.05,.05),n[t+1]=e.y+r(-.05,.05),n[t+2]=e.z+r(-.05,.05),n[t+3]=A.x*o,n[t+4]=A.y*o,n[t+5]=A.z*o,n[t+6]=0,n[t+7]=r(.9,1.6),n[t+8]=s?r(.011,.016):r(.004,.009),n[t+9]=d(),n[t+10]=+!!a,n[t+11]=0,n[t+12]=.4}},setInk(e){T.value=+!!e},update(e){if(e<=0)return;let t=b.d;for(let n=b.n-1;n>=0;n--){let r=n*b.S;if(t[r+6]+=e,t[r+6]>=t[r+7]){b.kill(r);continue}let i=Math.exp(-t[r+12]*e);t[r+3]*=i,t[r+5]*=i,t[r+4]=t[r+4]*i-_*e*(t[r+12]>2?.25:1),t[r]+=t[r+3]*e,t[r+1]+=t[r+4]*e,t[r+2]+=t[r+5]*e;let a=y(t[r],t[r+2]);t[r+1]<a+.01&&(t[r+11]<1&&t[r+4]<-.5?(t[r+1]=a+.01,t[r+4]=-t[r+4]*.3,t[r+3]*=.55,t[r+5]*=.55,t[r+11]=1):(t[r+1]=a+.01,t[r+4]=0,t[r+3]*=.8,t[r+5]*=.8,t[r+7]=Math.min(t[r+7],t[r+6]+.08)))}let n=C.d,r=0;for(let t=C.n-1;t>=0;t--){let i=t*C.S;if(n[i+6]+=e,n[i+6]>=n[i+7]){C.kill(i);continue}let a=Math.exp(-n[i+12]*e);n[i+3]*=a,n[i+5]*=a,n[i+4]=n[i+4]*a-_*e,n[i]+=n[i+3]*e,n[i+1]+=n[i+4]*e,n[i+2]+=n[i+5]*e;let s=y(n[i],n[i+2]);n[i+1]<s+.02&&(o?.stain&&r<6&&n[i+9]<.45&&(o.stain(n[i],n[i+2],.08+n[i+8]*8,.55),r++),C.kill(i))}let i=D.d;for(let t=D.n-1;t>=0;t--){let n=t*D.S;i[n+7]+=e/i[n+8],i[n+7]>=1&&D.kill(n)}},lateUpdate(){F(b,x,1),F(C,w,0);let e=O.attributes.iPos.array,t=O.attributes.iCol.array,r=O.attributes.iData.array,i=D.d;for(let n=0;n<D.n;n++){let a=n*D.S;e[n*3]=i[a],e[n*3+1]=i[a+1],e[n*3+2]=i[a+2],t[n*3]=i[a+3],t[n*3+1]=i[a+4],t[n*3+2]=i[a+5],r[n*4]=i[a+6],r[n*4+1]=i[a+7],r[n*4+2]=i[a+9],r[n*4+3]=i[a+10]}n(O,D.n,[`iPos`,`iCol`,`iData`])}};function F(e,t,r){let i=t.attributes.iPos.array,a=t.attributes.iVel.array,o=t.attributes.iData.array,s=e.d;for(let t=0;t<e.n;t++){let n=t*e.S;i[t*3]=s[n],i[t*3+1]=s[n+1],i[t*3+2]=s[n+2],a[t*3]=s[n+3],a[t*3+1]=s[n+4],a[t*3+2]=s[n+5],o[t*4]=s[n+6]/s[n+7],o[t*4+1]=s[n+8],o[t*4+2]=s[n+9],o[t*4+3]=s[n+10]}n(t,e.n,[`iPos`,`iVel`,`iData`])}return P}export{v as t};