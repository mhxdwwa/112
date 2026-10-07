import{Dt as e,Ht as t,Lt as n,an as r,ar as i,fa as a,io as o,ir as s,j as c,lr as l,mr as u,on as d,pn as f,qt as p,ro as m,sr as h,tr as g}from"./three.core-DtjtRha-.js";import{n as _,t as v}from"./globals-29H6lCK0.js";import{t as y}from"./glsl-BgzraZja.js";import{i as b,r as x,t as S}from"./noise-D9IUCAHK.js";import{n as C,s as w}from"./atmosphere-BNENFJca.js";import{n as T}from"./wind-BKJvbr9K.js";import{_ as E,d as D,g as O,h as ee,n as te,p as k,u as A}from"./foliage-DmeOjhRT.js";var j=12,M=8,N=24,P=32,ne=95,re=3,ie=.7,F=.45,ae={value:1},I={value:new o(0,-1e4,0,0)},L=`
${y(`vec3`,`uCamPos`)}uniform vec4 uBBFocus;
varying float vBBFade;
float bbOcclusion(vec3 base) {
  vec2 c = uCamPos.xz, q = base.xz - c;
  float f = 1.0 - smoothstep(1.7, 2.6, length(q));
  if (uBBFocus.w > 0.5) {
    vec2 sg = uBBFocus.xz - c;
    float L2 = max(dot(sg, sg), 1e-4);
    float h = dot(q, sg) / L2;
    float ds = length(q - sg * clamp(h, 0.0, 1.0));
    f = max(f, (1.0 - smoothstep(0.8, 1.3, ds)) * step(0.0, h) * (1.0 - smoothstep(0.93, 1.0, h)));
  }
  return f;
}
`,R=`
  if (vBBFade > 0.004) {
    vec2 bq = floor(gl_FragCoord.xy);
    vec2 bh = floor(bq * 0.5);
    float bayer = fract(bh.x * 0.5 + bh.y * bh.y * 0.75) * 0.25 + fract(bq.x * 0.5 + bq.y * bq.y * 0.75) + 0.03125;
    if (vBBFade >= bayer) discard;
  }
`,z=(e,t,n,r=1)=>`rgba(${Math.round(Math.max(0,Math.min(255,e)))},${Math.round(Math.max(0,Math.min(255,t)))},${Math.round(Math.max(0,Math.min(255,n)))},${r})`;function oe(e,t,n,r,i){let[a,o,s]=r,c=(i()-.5)*n*1.6;e.beginPath(),e.moveTo(0,0);let l=[];for(let e=1;e<=10;e++){let r=e/10,i=n*Math.sin(Math.PI*Math.min(1,r*1.25)**.75)**1.1*(1-.35*r)*(r>.95?.3:1);l.push([i*.5,r*t,c*r*r])}for(let[t,n,r]of l)e.lineTo(r+t,n);for(let t=l.length-1;t>=0;t--){let[n,r,i]=l[t];e.lineTo(i-n,r)}e.closePath();let u=e.createLinearGradient(-n,0,n,t);u.addColorStop(0,z(a*.8,o*.82,s*.8)),u.addColorStop(.5,z(a,o,s)),u.addColorStop(1,z(a*1.12,o*1.1,s*.95)),e.fillStyle=u,e.fill(),e.strokeStyle=z(a*1.25,o*1.2,s*1.05,.55),e.lineWidth=Math.max(.7,n*.09),e.beginPath(),e.moveTo(0,0),e.quadraticCurveTo(c*.25,t*.5,c*.9,t*.93),e.stroke(),e.fillStyle=z(a*.55,o*.6,s*.55,.22),e.beginPath(),e.moveTo(0,0);for(let[t,n,r]of l)e.lineTo(r+t,n);for(let t=l.length-1;t>=0;t--){let[,n,r]=l[t];e.lineTo(r,n)}e.closePath(),e.fill(),i()<.22&&(e.save(),e.globalCompositeOperation=`source-atop`,e.fillStyle=z(150,130,60,.55),e.fillRect(-n*2,t*(.7+i()*.2),n*4,t),e.restore())}var B=[[58,88,30],[72,104,36],[86,118,40],[100,128,46],[66,96,40],[118,136,52],[80,100,34]];function se(e,t,n,r,i,{dense:a=!1}={}){e.save(),e.beginPath(),e.rect(t,n,r,r),e.clip(),e.translate(t+r/2,n+r),e.scale(1,-1);let o=[],s=(t,n,r,i)=>{e.strokeStyle=i,e.lineCap=`round`;for(let i=1;i<t.length;i++)e.lineWidth=n+(r-n)*(i/t.length),e.beginPath(),e.moveTo(t[i-1][0],t[i-1][1]),e.lineTo(t[i][0],t[i][1]),e.stroke()},c=(e,t,n,a,s,c)=>{for(let l=0;l<a;l++){let u=n+(a>1?l/(a-1)-.5:0)*s+(i()-.5)*.25,d=r*(.15+i()*.08)*c;o.push({x:e,y:t,a:u,L:d,W:d*(.13+i()*.05),col:B[Math.floor(i()*B.length)],k:.82+i()*.36})}},l=(e,t,n)=>{let o=[[0,0]],l=0,u=0,d=e,f=(i()-.5)*.05,p=[];for(let e=1;e<=14;e++)d+=f+(i()-.5)*.05,l+=Math.sin(d)*t/14,u+=Math.cos(d)*t/14,o.push([l,u]),u>r*.1&&e<14&&p.push([l,u,d]);s(o,n,n*.35,z(98,104,52));let m=i()<.5?-1:1;for(let[e,t,o]of p){if(i()>(a?.95:.9))continue;m=-m;let l=t/(r*.9),u=o+m*(.55+i()*.45),d=r*(.1+i()*.13)*(1.2-.55*l),f=e+Math.sin(u)*d,p=t+Math.cos(u)*d;s([[e,t],[f,p]],n*.45,n*.25,z(104,110,56)),c(f,p,u+m*.25,(a?4:3)+Math.floor(i()*3),1.5+i()*.7,1)}c(l,u,d,5+Math.floor(i()*3),1.9,1.05)};a?(l(-.28+(i()-.5)*.1,r*.9,r*.011),l(.3+(i()-.5)*.1,r*.82,r*.009),l((i()-.5)*.1,r*.6,r*.008)):l((i()-.5)*.2,r*.9,r*.012),o.sort((e,t)=>e.L-t.L);for(let t of o)e.save(),e.translate(t.x,t.y),e.rotate(-t.a),oe(e,t.L,t.W,t.col.map(e=>e*t.k),i),e.restore();e.restore()}function ce(e){let t=k(1024,1024),n=t.getContext(`2d`),r=x(e);for(let e=0;e<4;e++)se(n,e%2*512,Math.floor(e/2)*512,512,r,{dense:e===3});return D(n,1024,1024,8),{canvas:t,texture:A(t,{aniso:4})}}function le(e){let t=1024,n=k(1024,t),r=n.getContext(`2d`),i=x(e);for(let e=0;e<2;e++){r.save(),r.translate(e*512,0);let n=5+Math.floor(i()*4),a=[];for(let e=0;e<n;e++){let e=512*(.36+i()*.28),n=(e-256)*(1.2+i())+(i()-.5)*80,o=t*(.02+i()*.12),s=5+i()*4,c=.8+i()*.35;r.strokeStyle=z(96*c,112*c,58*c),r.lineWidth=s,r.lineCap=`round`,r.beginPath(),r.moveTo(e,t),r.quadraticCurveTo(e+n*.3,t*.5,e+n,o),r.stroke(),r.strokeStyle=z(60,66,36,.8),r.lineWidth=1.5;for(let a=994;a>t*.5;a-=34+i()*6){let i=(t-a)/(t-o),c=e+n*(.6*i*(1-i)+i*i);r.beginPath(),r.moveTo(c-s*.6,a),r.lineTo(c+s*.6,a),r.stroke()}a.push([e,n,o])}for(let e=0;e<2600;e++){let[e,n,o]=a[Math.floor(i()*a.length)],s=.5+.5*i()**.7,c=t-(t-o)*s,l=e+n*(.6*s*(1-s)+s*s),u=133.12*Math.sin(Math.PI*Math.min(1,(s-.45)/.6))+12,d=l+(i()-.5)*2*u*Math.sqrt(i()),f=14+i()*12,p=B[Math.floor(i()*B.length)],m=.75+.35*s+i()*.15;r.save(),r.translate(d,c+i()*20),r.rotate(Math.PI+(i()-.5)*2.2+(d<l?.5:-.5)),oe(r,f,f*.2,p.map(e=>e*m),i),r.restore()}r.restore()}return D(r,1024,t,8),{canvas:n,texture:A(n,{aniso:4})}}function ue(e,t){let r=[],i=[],a=[],o=[];for(let n=0;n<=t;n++){let o=(n/t)**1.25;for(let t=0;t<=e;t++){let n=t/e*Math.PI*2,s=Math.cos(n),c=Math.sin(n);r.push(s,o,c),i.push(s,0,c),a.push(t/e,o)}}let s=e+1;for(let n=0;n<t;n++)for(let t=0;t<e;t++){let e=n*s+t,r=e+1,i=e+s,a=i+1;o.push(e,i,r,r,i,a)}let l=new c;return l.setAttribute(`position`,new n(r,3)),l.setAttribute(`normal`,new n(i,3)),l.setAttribute(`uv`,new n(a,2)),l.setIndex(o),l}function de(e){let t=[],r=[],i=[],a=[];for(let n=0;n<=e;n++){let a=(n/e)**1.2;t.push(-1,a,0,1,a,0),r.push(0,0,1,0,0,1),i.push(0,a,1,a)}for(let t=0;t<e;t++){let e=t*2;a.push(e,e+1,e+2,e+1,e+3,e+2)}let o=new c;return o.setAttribute(`position`,new n(t,3)),o.setAttribute(`normal`,new n(r,3)),o.setAttribute(`uv`,new n(i,2)),o.setIndex(a),o}function fe(e,{sprays:t,len:r,wid:i,cells:a,top:o=!1,cross:s=1}){let l=[],u=[],d=[],f=[],p=[],h=new m(0,1,0),g=new m,_=new m,v=new m,y=new m,b=new m,x=new m,S=new m,C=(t,n,r,i,a,o,s,c,m)=>{let h=l.length/3,g=s%2*.5,_=.5-Math.floor(s/2)*.5,v=e()<.5;for(let e=0;e<4;e++){let s=e===0||e===3?0:1,p=e<2?0:1;S.copy(n).addScaledVector(r,p*a).addScaledVector(i,(s-.5)*o*(.35+.65*p)),S.y-=p*p*a*.12,l.push(S.x,S.y,S.z),u.push(m.x,m.y,m.z),d.push(g+(.18+(v?1-s:s)*.64)*.5,_+p*.5),f.push(t,p,c,0)}p.push(h,h+1,h+2,h,h+2,h+3)},w=Math.PI*(3-Math.sqrt(5)),T=e()*Math.PI*2;for(let n=0;n<t;n++){let o=(n+.3+e()*.4)/t,c=F+.54*o**.75;T+=w+(e()-.5)*.5,g.set(Math.cos(T),0,Math.sin(T));let l=.5+.5*Math.sin(Math.PI*Math.min(1,.1+o*.9)),u=(r[0]+(r[1]-r[0])*e())*l*(1-.45*o*o),d=(i[0]+(i[1]-i[0])*e())*(.8+.2*l)*.7,f=-.42+.5*o-1.1*Math.max(0,o-.7)+(e()-.5)*.3;_.copy(g).multiplyScalar(Math.cos(f)).addScaledVector(h,Math.sin(f)).normalize(),v.crossVectors(h,_).normalize(),y.crossVectors(_,v).normalize(),x.copy(g).multiplyScalar(.03);let p=e()*6.283,m=a[Math.floor(e()*a.length)];b.copy(g).multiplyScalar(.55).addScaledVector(h,.5).addScaledVector(y,.3).normalize();let S=(e()-.5)*1.3;if(C(c,x,_,v.clone().multiplyScalar(Math.cos(S)).addScaledVector(y,Math.sin(S)),u,d,m,p,b),o>.72||e()>s)continue;let E=(e()<.5?-1:1)*(.6+e()*.25);C(c,x,_,v.clone().multiplyScalar(Math.cos(E)).addScaledVector(y,Math.sin(E)).normalize(),u*.92,d*.8,a[Math.floor(e()*a.length)],p+.4,b)}if(o)for(let t=0;t<2;t++){let t=e()*Math.PI;g.set(Math.cos(t),0,Math.sin(t)),_.set(g.x*.35,1,g.z*.35).normalize(),v.crossVectors(h,g).normalize(),b.set(0,1,0).addScaledVector(g,.3).normalize(),C(.97,x.set(0,0,0),_,v,r[0]*.8,i[1]*.8,a[0],e()*6.283,b)}let E=new c;return E.setAttribute(`position`,new n(l,3)),E.setAttribute(`normal`,new n(u,3)),E.setAttribute(`uv`,new n(d,2)),E.setAttribute(`aLeaf`,new n(f,4)),E.setIndex(p),E}function pe(){let e=[],t=[],r=[],i=[];for(let n=0;n<1;n++){let a=n*Math.PI/2,o=Math.cos(a),s=Math.sin(a),c=e.length/3;e.push(-.5*o,0,-.5*s,.5*o,0,.5*s,.5*o,1,.5*s,-.5*o,1,-.5*s);for(let e=0;e<4;e++){let n=e===0||e===3?-1:1;t.push(-s*n*.7,.55,o*n*.7)}r.push(0,0,1,0,1,1,0,1),i.push(c,c+1,c+2,c,c+2,c+3)}let a=new c;return a.setAttribute(`position`,new n(e,3)),a.setAttribute(`normal`,new n(t,3)),a.setAttribute(`uv`,new n(r,2)),a.setIndex(i),a}function V(e,t,n){let i=new r;i.index=e.index;for(let t in e.attributes)i.setAttribute(t,e.attributes[t]);return n.forEach((e,n)=>i.setAttribute(e,new f(t,4,n*4))),i.instanceCount=0,i}var H=`
${T}
attribute vec4 aI0;   // base xyz, yaw
attribute vec4 aI1;   // height, radius, lean x, lean z (top offset, m)
attribute vec4 aI2;   // phase, age, node spacing, floor = first-branch height %, fract = crown scale / 2
uniform float uBBWind;
vec3 bbRotY(vec3 p, float c, float s) { return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z); }
// culm centre-line offset at height fraction t: lean (curved: stiff base) + wind (∝ t², bigger for tall culms)
vec3 bbAxis(float t, float H, out vec3 sw) {
  sw = windSway(aI0.xyz + vec3(0.0, H * 0.7, 0.0), 1.0, aI2.x) * uBBWind * (0.2 + 0.012 * H);
  float bk = t * (0.3 + 0.7 * t);
  // the leader arches over under the weight of its leaves (along the lean, or a random side for straight culms)
  vec2 ld = vec2(aI1.z, aI1.w);
  float ll = length(ld);
  vec2 dd = ll > 1e-3 ? ld / ll : vec2(cos(aI2.x), sin(aI2.x));
  float tip = smoothstep(0.55, 1.0, t);
  float droop = (0.5 + 0.2 * H) * (0.35 + 0.65 * fract(aI2.x * 3.31)) * tip * tip;
  return vec3(aI1.z, 0.0, aI1.w) * bk + vec3(dd.x, -0.5 * tip, dd.y) * droop + sw * (t * t);
}
`,me=`
void bbCulm(out vec3 P, out vec3 Nn) {
  float t = position.y, H = aI1.x, R = aI1.y;
  float along = t * H;
  float r = R * (1.0 - 0.62 * pow(t, 1.5)) * (1.0 + 0.3 * exp(-along * 6.0)) * (1.0 - 0.75 * smoothstep(0.86, 1.0, t));   // whip-thin leader
  float c = cos(aI0.w), s = sin(aI0.w);
  vec3 sw;
  vec3 ax = bbAxis(t, H, sw);
#ifdef BB_RIBBON
  // distant culm: a 2-sided ribbon turned to the viewer (or the light in the shadow pass), shaded as a cylinder
  vec3 axisP = aI0.xyz + vec3(0.0, along, 0.0) + ax;
  vec3 toC = cameraPosition - axisP; toC.y = 0.0;
  toC = normalize(toC + vec3(1e-4, 0.0, 0.0));
  vec3 side = vec3(toC.z, 0.0, -toC.x);
  P = axisP + side * (position.x * r * 1.15);
  Nn = normalize(side * position.x * 0.85 + toC * 0.53);
  return;
#endif
  vec3 ring = bbRotY(vec3(position.x * r, 0.0, position.z * r), c, s);
  P = aI0.xyz + vec3(0.0, along, 0.0) + ax + ring;
  // tilt the normal by the local slope of the centre line (lean + wind)
  vec3 slope = (vec3(aI1.z, 0.0, aI1.w) * (0.3 + 1.4 * t) + sw * 2.0 * t) / H;
  vec3 n = bbRotY(vec3(position.x, 0.0, position.z), c, s);
  Nn = normalize(n - vec3(0.0, dot(n, slope), 0.0));
}
`,U=`
attribute vec4 aLeaf; // t (authored for branches from ${F.toFixed(2)}), flutter weight, phase, 0
varying float vLeafAO;
void bbCrown(out vec3 P, out vec3 Nn) {
  float H = aI1.x;
  float tS = floor(aI2.w) * 0.01;
  float t = tS + (1.0 - tS) * (aLeaf.x - ${F.toFixed(3)}) / ${.55.toFixed(3)};
  float c = cos(aI0.w), s = sin(aI0.w);
  vec3 sw;
  vec3 ax = bbAxis(t, H, sw);
  float k = fract(aI2.w) * 2.0;
  vec3 lp = bbRotY(position * k, c, s);
  Nn = bbRotY(normal, c, s);
  // flutter: sprays bob + twist, stronger toward the tips and in gusts
  float g = windGust(aI0.xyz) * uBBWind;
  float ph = aLeaf.z + aI2.x;
  vec3 fl = vec3(sin(uTime * 5.3 + ph * 7.0), 0.7 * sin(uTime * 4.1 + ph * 5.0), sin(uTime * 6.1 + ph * 3.0)) * (0.05 * g * aLeaf.y);
  // sprays trail downwind a little more than the culm they hang on
  P = aI0.xyz + vec3(0.0, t * H, 0.0) + ax + lp + fl + sw * (0.25 * aLeaf.y * length(position.xz) * k);
  vLeafAO = mix(0.55, 1.0, smoothstep(tS - 0.05, 1.0, t)) * (0.8 + 0.2 * aLeaf.y);
}
`,W=`
#ifdef USE_MAP
  {
    vec2 bbDx = dFdx(vMapUv * 1024.0), bbDy = dFdy(vMapUv * 1024.0);
    float bbLod = 0.5 * log2(max(max(dot(bbDx, bbDx), dot(bbDy, bbDy)), 1e-6));
    diffuseColor.a *= 1.0 + max(bbLod, 0.0) * 0.16;
  }
#endif
`,G=`
  {
    vec3 fN = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
    diffuseColor.a *= smoothstep(0.06, 0.32, abs(dot(fN, normalize(vViewPosition))));
  }
`;function he(e,t=!1,n=!1){let r=t?new h:n?new l({color:16777215}):new u({color:16777215,roughness:.45,metalness:0,envMapIntensity:.85});return r.name=`bamboo-culm-${e}`,t||w(r),C(r,`bambooCulm-${e}-${t?`d`:`m`}${n?`r`:``}-v3`,e=>{Object.assign(e.uniforms,{uTime:v.uTime,uWind:v.uWind,tWindNoise:v.tWindNoise,uBBWind:ae}),Object.assign(e.uniforms,{uCamPos:v.uCamPos,uBBFocus:I});let r=e.vertexShader.replace(`void main() {`,(n?`#define BB_RIBBON
`:``)+H+me+(t?``:L)+`varying vec4 vBB; varying vec2 vBB2;
void main() {`);r=t?r.replace(`#include <begin_vertex>`,`vec3 transformed; { vec3 bbN; bbCulm(transformed, bbN); }`):r.replace(`#include <beginnormal_vertex>`,`vec3 bbP, objectNormal; bbCulm(bbP, objectNormal);
  vBB = vec4(position.y * aI1.x, uv.x, aI2.y, aI2.z); vBB2 = vec2(fract(aI2.x * 0.1591), position.y); vBBFade = bbOcclusion(aI0.xyz);`).replace(`#include <begin_vertex>`,`vec3 transformed = bbP;`),e.vertexShader=r,!t&&(e.fragmentShader=e.fragmentShader.replace(`void main() {`,(n?`#define BB_RIBBON
`:``)+S+`varying vec4 vBB; varying vec2 vBB2; varying float vBBFade;
float bbNodeDn; float bbAA; float bbAge;
void main() {
`+R).replace(`#include <color_fragment>`,`#include <color_fragment>
  {
    float along = vBB.x, around = vBB.y, age = vBB.z, sp = vBB.w, seed = vBB2.x * 97.0;
    bbAge = age;
    // young: saturated green; mature: yellow-green; old: grey-olive with lichen
    vec3 cY = vec3(0.075, 0.165, 0.045), cM = vec3(0.13, 0.185, 0.06), cO = vec3(0.23, 0.215, 0.115);
    vec3 c = age < 0.5 ? mix(cY, cM, age * 2.0) : mix(cM, cO, age * 2.0 - 1.0);
#ifndef BB_RIBBON
    float n1 = wx_vnoise(vec2(around * 26.0, along * 0.9 + seed));
    float n2 = wx_vnoise(vec2(around * 7.0 + seed, along * 3.1));
    c *= 0.84 + 0.26 * n1 + 0.1 * n2;
    // yellow sun-bleached streaks on mature culms
    c = mix(c, vec3(0.30, 0.30, 0.09), smoothstep(0.62, 0.9, wx_vnoise(vec2(around * 11.0 + seed, along * 0.35))) * smoothstep(0.25, 0.7, age) * 0.6);
    float lich = smoothstep(0.58, 0.78, wx_vnoise(vec2(around * 9.0, along * 2.2) + seed * 1.7)) * smoothstep(0.45, 1.0, age);
    c = mix(c, vec3(0.34, 0.34, 0.30), lich * 0.75);
#endif
    // nodes: dn = metres from the nearest node (+ above); internodes shorter near the base
    float spx = sp * mix(0.55, 1.0, smoothstep(0.0, 2.5, along));
    float f = fract(along / spx);
    float dn = (f < 0.5 ? f : f - 1.0) * spx;
    bbNodeDn = dn;
    bbAA = clamp(1.0 - fwidth(along) * 18.0, 0.0, 1.0);
    float line = exp(-pow(dn / 0.0045, 2.0));
    float ridge = exp(-pow((dn - 0.011) / 0.008, 2.0));
    float powder = smoothstep(-0.055, -0.03, dn) * (1.0 - smoothstep(-0.012, -0.004, dn));
    c = mix(c, vec3(0.42, 0.45, 0.40), powder * 0.55 * (1.0 - age) * bbAA);
    c *= 1.0 - 0.6 * line * bbAA;
    c *= 1.0 + 0.22 * ridge * bbAA;
    // base: soil splash, dry sheath remnants
    c = mix(vec3(0.11, 0.085, 0.05), c, smoothstep(0.05, 0.6, along));
    c = mix(c, vec3(0.22, 0.17, 0.10), (1.0 - smoothstep(0.5, 1.3, along)) * smoothstep(0.5, 0.75, wx_vnoise(vec2(around * 5.0, along * 2.2) + seed)) * 0.6);
    // sky occlusion inside the grove (lower culm sees less sky)
    c *= mix(0.62, 1.0, smoothstep(0.0, 0.5, vBB2.y));
    diffuseColor.rgb = c;
  }`).replace(`#include <roughnessmap_fragment>`,`#include <roughnessmap_fragment>
  roughnessFactor = mix(0.3, 0.72, bbAge) + 0.25 * exp(-pow(bbNodeDn / 0.01, 2.0));`).replace(`#include <normal_fragment_maps>`,`#include <normal_fragment_maps>
  {
    // node ridge bump along the culm axis (view-space up)
    vec3 axV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    float w = 0.009, dd = bbNodeDn - 0.006;
    float slope = -2.0 * dd / (w * w) * 0.0035 * exp(-dd * dd / (w * w));
    normal = normalize(normal - axV * slope * bbAA);
  }`))}),r}function ge(e,t,n=!1,r=!1){let i=E(),a=n?new h({map:e,alphaTest:.5}):r?new l({map:e,alphaTest:.5,side:2}):new u({map:e,alphaTest:.5,side:2,roughness:.9,metalness:0,envMapIntensity:.35});return a.name=`bamboo-crown-${t}`,n||(a.shadowSide=2,w(a)),C(a,`bambooCrown-${t}-${n?`d`:`m`}-${i.key}-v2`,e=>{Object.assign(e.uniforms,{uTime:v.uTime,uWind:v.uWind,tWindNoise:v.tWindNoise,uBBWind:ae},O(i)),Object.assign(e.uniforms,{uCamPos:v.uCamPos,uBBFocus:I});let t=e.vertexShader.replace(`void main() {`,H+U+(n?``:L)+`varying vec3 vBBTint;
void main() {`),r=`vBBTint = mix(vec3(1.0), vec3(1.14, 1.08, 0.72), smoothstep(0.55, 1.0, aI2.y) * 0.8) * (0.85 + 0.3 * fract(aI2.x * 3.71));`;t=n?t.replace(`#include <begin_vertex>`,`vec3 transformed; { vec3 bbN; bbCrown(transformed, bbN); ${r} }`):t.replace(`#include <beginnormal_vertex>`,`vec3 bbP, objectNormal; bbCrown(bbP, objectNormal); ${r} vBBFade = bbOcclusion(aI0.xyz);`).replace(`#include <begin_vertex>`,`vec3 transformed = bbP;`),e.vertexShader=t;let a=e.fragmentShader.replace(`void main() {`,`varying vec3 vBBTint;
`+(n?``:`varying float vLeafAO; varying float vBBFade;
`+ee(i))+`void main() {`+(n?``:R)).replace(`#include <alphatest_fragment>`,W+(n?``:G)+`#include <alphatest_fragment>`);n||(a=a.replace(`#include <color_fragment>`,`#include <color_fragment>
  diffuseColor.rgb *= vBBTint * vLeafAO;`).replace(`#include <normal_fragment_begin>`,te).replace(`#include <lights_fragment_begin>`,i.lightsChunk+`
  {
    // modest backlit translucency (thin leaves glow a little against the moon / low sun)
    vec3 sunC = ${i.sunC}; vec3 sunLv = ${i.sunD};
    float sunBack = pow(saturate(dot(-geometryViewDir, sunLv)), 4.0);
    float sunWrap = saturate(dot(-normal, sunLv) * 0.6 + 0.4);
    vec3 alb = diffuseColor.rgb;
    reflectedLight.directDiffuse += sunC * alb * vec3(1.05, 1.0, 0.72) * (sunBack * 1.1 + sunWrap * 0.25) * 0.6;
  }
`)),e.fragmentShader=a}),a}function _e(e){let t=E(),n=new l({map:e,alphaTest:.5,side:2});return n.name=`bamboo-far`,w(n),C(n,`bambooFar-${t.key}-v2`,e=>{Object.assign(e.uniforms,{uTime:v.uTime,uWind:v.uWind,tWindNoise:v.tWindNoise,uBBWind:ae},O(t)),e.vertexShader=e.vertexShader.replace(`void main() {`,T+`attribute vec4 aJ0; attribute vec4 aJ1; uniform float uBBWind; varying float vFH; varying float vTint;
void main() {`).replace(`#include <uv_vertex>`,`#include <uv_vertex>
  vMapUv = vec2((aJ1.z + uv.x) * 0.5, uv.y); vFH = uv.y; vTint = aJ1.w;`).replace(`#include <beginnormal_vertex>`,`
  // cylindrical billboard: one quad turned to the viewer, lit as a rounded clump (wraps toward its sides)
  vec2 bbT = cameraPosition.xz - aJ0.xz;
  bbT = bbT / max(length(bbT), 1e-3);
  vec3 bbToC = vec3(bbT.x, 0.0, bbT.y), bbSide = vec3(bbT.y, 0.0, -bbT.x);
  vec3 objectNormal = normalize(bbToC * 0.7 + vec3(0.0, 0.55, 0.0) + bbSide * position.x * 0.9);`).replace(`#include <begin_vertex>`,`
  vec3 transformed;
  {
    vec3 p = bbSide * (position.x * aJ1.y) + vec3(0.0, position.y * aJ1.x, 0.0);
    vec3 sw = windSway(aJ0.xyz + vec3(0.0, 8.0, 0.0), 1.0, aJ0.x * 0.37) * uBBWind * 0.3;
    transformed = aJ0.xyz + p + sw * position.y * position.y;
  }`),e.fragmentShader=e.fragmentShader.replace(`void main() {`,ee(t)+`varying float vFH; varying float vTint;
void main() {`).replace(`#include <color_fragment>`,`#include <color_fragment>
  diffuseColor.rgb *= vTint * mix(0.45, 1.0, smoothstep(0.1, 0.8, vFH));`).replace(`#include <alphatest_fragment>`,W+`#include <alphatest_fragment>`).replace(`#include <lights_fragment_begin>`,t.lightsChunk+`
  {
    vec3 sunC = ${t.sunC}; vec3 sunLv = ${t.sunD};
    float sunBack = pow(saturate(dot(-geometryViewDir, sunLv)), 4.0);
    reflectedLight.directDiffuse += sunC * diffuseColor.rgb * 0.35 * sunBack * vFH;
  }`)}),n}function ve(e){let t=[],r=[],i=[],a=[],o=(e,n,a,o,s,c,l,u,d)=>(t.push(e,n,a),r.push(o,s,c),i.push(l,u,d),t.length/3-1);for(let n of e){let{x:e,y:r,z:i,h:s,r0:c,kind:l,yaw:u,lean:d}=n,f=l===`shoot`?6:2,p=t.length/3;for(let t=0;t<=f;t++){let n=t/f,a=l===`shoot`?c*(1-n)**.85+.004:c,p=n*s;for(let m=0;m<=7;m++){let h=m/7*Math.PI*2+u,g=Math.cos(h),_=Math.sin(h),v=p;l===`stump`&&t===f&&(v=s+g*c*1.2);let y=e+d[0]*n*n,b=i+d[1]*n*n,x;if(l===`shoot`){let e=.7+.3*(.5+.5*Math.sin(n*22+m*.9));x=[.16*e,.1*e,.045*e],n>.85&&(x=[.12,.13,.05])}else x=[.2,.2,.1];o(y+g*a,r+v,b+_*a,g,l===`shoot`?.4:0,_,...x)}}for(let e=0;e<f;e++)for(let t=0;t<7;t++){let n=p+e*8+t,r=n+1,i=n+8,o=i+1;a.push(n,i,r,r,i,o)}if(l===`stump`){let n=p+f*8,l=o(e+d[0],r+s-.02,i+d[1],0,1,0,.03,.025,.015),m=t.length/3;for(let t=0;t<=7;t++){let n=t/7*Math.PI*2+u,a=Math.cos(n),l=Math.sin(n);o(e+d[0]+a*c*.75,r+s+a*c*.9,i+d[1]+l*c*.75,.3*a,.9,.3*l,.42,.38,.22)}for(let e=0;e<7;e++){let t=n+e,r=n+e+1,i=m+e,o=m+e+1;a.push(t,i,r,r,i,o,i,l,o)}}}let s=new c;return s.setAttribute(`position`,new n(t,3)),s.setAttribute(`normal`,new n(r,3)),s.setAttribute(`color`,new n(i,3)),s.setIndex(a),s.computeVertexNormals(),s.computeBoundingSphere(),s}async function ye(n,r={}){P=r.lod0??32,ne=r.lod1??95,ie=r.midKeep??.7;let{center:o={x:0,z:0},clearR:c=16,inner:l=18,outer:f=200,keepOut:h=[],path:v=null,pathClear:y=2.5,density:S=1,height:C=[9,15],seed:T=1}=r,E=performance.now(),D=(e,t)=>n.world.heightAt(e,t),O=x(740096+T*7919),ee=Math.min(c,l),te=3.1/Math.sqrt(Math.max(.05,S)),k=[],A=Math.ceil(f/te),F=(e,t,n)=>{for(let r of h)if((e-r.x)**2+(t-r.z)**2<(r.r+n)**2)return!0;if(v){let r=v(e,t);if(r!=null&&r<y+n)return!0}return!1};for(let e=-A;e<=A;e++)for(let t=-A;t<=A;t++){let n=o.x+(t+.15+O()*.7)*te,r=o.z+(e+.15+O()*.7)*te,i=O(),a=O(),s=O(),u=O(),d=Math.hypot(n-o.x,r-o.z);if(d<ee||d>f)continue;let p=b.fbm2(n*.021+T*3.1,r*.021-T*1.7,3),m=b.fbm2(n*.045-11.3,r*.045+5.2,2),h=g.clamp(.72+p*.9,.12,1);if(m<-.42&&(h*=.12),h*=g.smoothstep(d,c,c+4)*(d<l?.8:1),d>f-10&&(h*=(f-d)/10),i>h)continue;let _=3+Math.floor(a**1.2*10*(.6+.4*h)),v=.28+.07*Math.sqrt(_)+s*.35;F(n,r,v)||k.push({x:n,z:r,d,n:_,spread:v,hk:.85+.25*u+.1*p,edge:g.clamp(1-(d-c)/14,0,1)})}let L=[],R=Math.PI*2;for(let e of k){let t={x:(o.x-e.x)/Math.max(e.d,.001),z:(o.z-e.z)/Math.max(e.d,.001)},n=[];for(let t=0,r=0;t<e.n&&r<e.n*6;r++){let r=O()*R,i=e.spread*Math.sqrt(O()),a=e.x+Math.cos(r)*i,o=e.z+Math.sin(r)*i;n.some(e=>(e[0]-a)**2+(e[1]-o)**2<.2*.2)||F(a,o,.1)||(n.push([a,o]),t++)}for(let[r,i]of n){let n=O()<.22?.65+O()*.35:O()*.65,a=(C[0]+(C[1]-C[0])*O()**.8)*e.hk;a*=1-.18*e.edge*O();let o=.025+.032*g.clamp((a-8)/8,0,1)+(O()-.5)*.008,s=r-e.x,c=i-e.z,l=Math.hypot(s,c)||1,u=.25+O()*.9,d=O()*R,f=O()*.5,p=e.edge*(.8+O()*1.6),m=s/l*u+Math.cos(d)*f+t.x*p,h=c/l*u+Math.sin(d)*f+t.z*p,_=D(r,i)-.06;L.push({x:r,y:_,z:i,yaw:O()*R,h:a,R:o,lx:m*a/12,lz:h*a/12,phase:O()*40,age:n,sp:.3+O()*.15,ck:Math.min(1.9,(a/12)**.6*(.85+O()*.3)),ts:Math.round(100*(.47+.14*O()-e.edge*(.12+.12*O())))})}e.y=D(e.x,e.z)}let z=(e,t)=>`${Math.floor((e-o.x)/N)},${Math.floor((t-o.z)/N)}`,oe=new Map,B=(e,t)=>{let n=z(e,t),r=oe.get(n);if(!r){let[e,t]=n.split(`,`).map(Number);r={cx:o.x+(e+.5)*N,cz:o.z+(t+.5)*N,y:0,culms:[],clumps:[],cs:0,ce:0,ks:0,ke:0,minD:0,maxD:0,ymin:1/0,ymax:-1/0},oe.set(n,r)}return r};for(let e of L){let t=B(e.x,e.z);t.culms.push(e),t.ymin=Math.min(t.ymin,e.y),t.ymax=Math.max(t.ymax,e.y+e.h)}for(let e of k){let t=B(e.x,e.z);t.clumps.push(e),t.ymin=Math.min(t.ymin,e.y),t.ymax=Math.max(t.ymax,e.y+15)}let se=[...oe.values()],H=new Float32Array(Math.max(1,L.length)*j),me=new Float32Array(Math.max(1,k.length)*M),U=0,W=0;for(let e of se){for(let t=e.culms.length-1;t>0;t--){let n=Math.floor(O()*(t+1));[e.culms[t],e.culms[n]]=[e.culms[n],e.culms[t]]}e.cs=U;for(let t of e.culms)H.set([t.x,t.y,t.z,t.yaw,t.h,t.R,t.lx,t.lz,t.phase,t.age,t.sp,t.ts+t.ck*.5],U*j),U++;e.ce=U,e.cm=e.cs+Math.ceil((e.ce-e.cs)*ie),e.ks=W;for(let t of e.clumps){if(O()>.62)continue;let e=(C[0]+C[1])*.5*t.hk;me.set([t.x,t.y-.1,t.z,O()*Math.PI,e*1.1,(3.2+t.spread*2.2+O()*1.2)*1.25,O()<.5?0:1,.8+O()*.35],W*M),W++}e.ke=W,e.y=(e.ymin+e.ymax)*.5,e.rad=Math.hypot(N*.5*Math.SQRT2+3,(e.ymax-e.ymin)*.5+2),e.lod=-1,delete e.culms,delete e.clumps}let G=ce(740097+T),ye=le(740098+T),be=x(740099+T),xe=ue(6,12),Se=de(4),Ce=de(3),we=fe(be,{sprays:14,len:[1.4,2.2],wid:[.9,1.3],cells:[0,1,2],cross:.6}),Te=fe(be,{sprays:7,len:[2,2.8],wid:[1.4,1.8],cells:[3,3,2],cross:.45,top:!1}),Ee=pe(),De=(t,n)=>{let r=new d(new Float32Array(Math.max(1,t)*n),n,1);return r.setUsage(e),r},Oe=De(L.length,j),ke=De(L.length,j),Ae=De(k.length,M),K=[`aI0`,`aI1`,`aI2`],q={culm0:he(`L0`),culm1:he(`L1`,!1,!0),crown0:ge(G.texture,`L0`),crown1:ge(G.texture,`L1`,!1,!0),far:_e(ye.texture),culmDepth:he(`S`,!0,!0),crownDepth:ge(G.texture,`S`,!0)};q.culm1.shadowSide=2;let J=new p;J.name=`bamboo`;let je=new a(new m(o.x,D(o.x,o.z)+8,o.z),f+25),Me=(e,t,n,r)=>{e.boundingSphere=je.clone();let a=new i(e,t);return a.name=n,a.layers.set(_.WORLD),a.castShadow=!1,a.receiveShadow=!0,a.matrixAutoUpdate=!1,a.renderOrder=r,J.add(a),a},Y={culm0:Me(V(xe,Oe,K),q.culm0,`bamboo-culm-L0`,0),crown0:Me(V(we,Oe,K),q.crown0,`bamboo-crown-L0`,2),culm1:Me(V(Se,ke,K),q.culm1,`bamboo-culm-L1`,1),crown1:Me(V(Te,ke,K),q.crown1,`bamboo-crown-L1`,3),far:Me(V(Ee,Ae,[`aJ0`,`aJ1`]),q.far,`bamboo-far`,4)},X=[];for(let e=0;e<L.length;e++){let t=e*j;(H[t]-o.x)**2+(H[t+2]-o.z)**2<28900&&X.push(e)}let Ne=new d(new Float32Array(Math.max(1,X.length)*j),j,1);X.forEach((e,t)=>Ne.array.set(H.subarray(e*j,e*j+j),t*j));let Pe=[];for(let[e,t,n,r]of[[Ce,q.culm1,q.culmDepth,`culm`],[Te,q.crown1,q.crownDepth,`crown`]]){let a=V(e,Ne,K);a.instanceCount=X.length,a.boundingSphere=je.clone();let o=new i(a,t);o.name=`bamboo-shadow-${r}`,o.layers.set(_.WORLD),o.castShadow=!0,o.receiveShadow=!1,o.matrixAutoUpdate=!1,o.customDepthMaterial=n;let s=X.length;o.onBeforeRender=()=>{a.instanceCount=0},o.onAfterRender=()=>{a.instanceCount=s},J.add(o),Pe.push(o)}let Fe=[];for(let e=0,t=0;e<34&&t<400;t++){let t=O()*R,n=c+.6+O()*7,r=o.x+Math.cos(t)*n,i=o.z+Math.sin(t)*n;if(F(r,i,.3))continue;let a=O()<.7?`shoot`:`stump`,s=a===`shoot`?.25+O()**1.5*.9:.15+O()*.6,l=a===`shoot`?.05+O()*.06:.035+O()*.025;Fe.push({x:r,z:i,y:D(r,i)-.04,h:s,r0:l,kind:a,yaw:O()*R,lean:[(O()-.5)*.08,(O()-.5)*.08]}),e++}let Z=null;if(Fe.length){let e=new u({vertexColors:!0,roughness:.75,metalness:0});e.name=`bamboo-shoots`,w(e),Z=new i(ve(Fe),e),Z.name=`bamboo-shoots`,Z.layers.set(_.WORLD),Z.castShadow=!0,Z.receiveShadow=!0,Z.matrixAutoUpdate=!1,J.add(Z)}let Q=[],Ie=k.filter(e=>e.d<=140).sort((e,t)=>e.d-t.d).slice(0,600);for(let e of Ie)Q.push({x:e.x,z:e.z,r:g.clamp(e.spread*.75+.12,.35,.6)});if(Array.isArray(n.world.colliders)&&n.world.colliders.push(...Q),n.world.addBlocker)for(let e of Q)n.world.addBlocker(e);J.updateMatrixWorld(!0),n.scene.add(J);let Le=new t,Re=new s,ze=new a,$={p:new m(1e9,0,0),f:new m,fov:0,aspect:0},Be=new m,Ve=[],He={near:0,mid:0,far:0,chunks:0,recull:0,ms:0},Ue=(e,t,n,r)=>{for(let e of t)e.instanceCount=n;n>0&&(e.clearUpdateRanges(),e.addUpdateRange(0,n*r),e.needsUpdate=!0)};function We(e=!1){let t=n.camera;t.updateMatrixWorld(),t.getWorldDirection(Be);let r=t.position;if(!e&&r.distanceToSquared($.p)<.0625&&Be.dot($.f)>.9997&&t.fov===$.fov&&t.aspect===$.aspect)return;let i=performance.now();$.p.copy(r),$.f.copy(Be),$.fov=t.fov,$.aspect=t.aspect,Re.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),Le.setFromProjectionMatrix(Re),Ve.length=0;for(let e of se)ze.center.set(e.cx,e.y,e.cz),ze.radius=e.rad+2,Le.intersectsSphere(ze)&&(e.dist=Math.hypot(e.cx-r.x,e.cz-r.z),Ve.push(e));Ve.sort((e,t)=>e.dist-t.dist);let a=Oe.array,o=ke.array,s=Ae.array,c=0,l=0,u=0,d=N*.72,f=P*P,p=r.x,m=r.z;for(let e of Ve){let t=e.dist;if(t-d>ne+re){let t=e.ke-e.ks;t&&(s.set(me.subarray(e.ks*M,e.ke*M),u*M),u+=t);continue}if(t+d<P){let t=e.ce-e.cs;t&&(a.set(H.subarray(e.cs*j,e.ce*j),c*j),c+=t);continue}if(t-d>P&&t+d<ne){let t=e.cm-e.cs;t&&(o.set(H.subarray(e.cs*j,e.ce*j),l*j),l+=t);continue}if(t>ne){let t=e.ke-e.ks;t&&(s.set(me.subarray(e.ks*M,e.ke*M),u*M),u+=t);continue}if(t-d>P){let t=e.cm-e.cs;t&&(o.set(H.subarray(e.cs*j,e.ce*j),l*j),l+=t);continue}for(let t=e.cs;t<e.ce;t++){let n=t*j,r=H[n]-p,i=H[n+2]-m;if(r*r+i*i<f){for(let e=0;e<j;e++)a[c*j+e]=H[n+e];c++}else if(t<e.cm){for(let e=0;e<j;e++)o[l*j+e]=H[n+e];l++}}}Ue(Oe,[Y.culm0.geometry,Y.crown0.geometry],c,j),Ue(ke,[Y.culm1.geometry,Y.crown1.geometry],l,j),Ue(Ae,[Y.far.geometry],u,M),Y.culm0.visible=Y.crown0.visible=c>0,Y.culm1.visible=Y.crown1.visible=l>0,Y.far.visible=u>0,Object.assign(He,{near:c,mid:l,far:u,chunks:Ve.length,recull:He.recull+1,ms:+(performance.now()-i).toFixed(2)})}We(!0);let Ge=performance.now()-E,Ke={root:J,colliders:Q,meshes:Y,proxies:Pe,atlases:{leaves:G,clumps:ye},update(){},lateUpdate(){if(r.focus){let e=r.focus();e&&Ke.setFocus(e)}J.visible&&We()},setFocus(e){e?I.value.set(e.x,e.y,e.z,1):I.value.w=0},focusUniform:I,cull:()=>We(!0),setVisible(e){J.visible=e},setWindResponse(e){ae.value=e},stats(){return{clumps:k.length,culms:L.length,chunks:se.length,colliders:Q.length,shadowCasters:X.length,shoots:Fe.length,visible:{...He},tris:{culmL0:xe.index.count/3,culmL1:Se.index.count/3,crownL0:we.index.count/3,crownL1:Te.index.count/3},buildMs:+Ge.toFixed(1)}},dispose(){if(n.scene.remove(J),n.remove?.(Ke),Array.isArray(n.world.colliders)){let e=new Set(Q);for(let t=n.world.colliders.length-1;t>=0;t--)e.has(n.world.colliders[t])&&n.world.colliders.splice(t,1)}for(let e of[xe,Se,Ce,we,Te,Ee])e.dispose();J.traverse(e=>{e.isMesh&&e.geometry.dispose()});for(let e of Object.values(q))e.dispose();Z?.material.dispose(),G.texture.dispose(),ye.texture.dispose()}};return n.add(Ke),Ke}export{ye as createBamboo};