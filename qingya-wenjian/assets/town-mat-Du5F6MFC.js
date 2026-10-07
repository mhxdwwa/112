import{Hn as e,L as t,Qi as n,Rn as r,U as i,V as a,Yt as o,ft as s,io as c,mr as l,mt as u,no as d,or as f,zi as p}from"./three.core-DtjtRha-.js";import{t as m}from"./globals-29H6lCK0.js";import{t as h}from"./glsl-BgzraZja.js";import{n as g,s as _}from"./atmosphere-BNENFJca.js";import{c as v,n as y}from"./wind-BKJvbr9K.js";import{t as b}from"./ground-glsl-B_t_Z4yP.js";m.tTownLight??={value:null},m.uTownRect??={value:new c(-140,-70,1/280,1/140)},m.uTownLightCol??={value:new i(1,.46,.17)};var x=`
${b}
${h(`sampler2D`,`tTownLight`)}${h(`vec4`,`uTownRect`)}${h(`vec3`,`uTownLightCol`)}
// warm lantern / shop-front irradiance at world point wp with world normal nW (baked 2-D field, height-shaped)
vec3 town_light(vec3 wp, vec3 nW) {
  vec2 uv = (wp.xz - uTownRect.xy) * uTownRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec3(0.0);
  float L = texture2D(tTownLight, uv).r;
  if (L < 0.002) return vec3(0.0);
#ifdef TW_ON_GROUND
  float y = 0.04;
#else
  float y = wp.y - wt_groundHeight(wp.xz);
#endif
  float g = (1.0 + 1.2 * exp(-(y - 3.2) * (y - 3.2) * 0.45)) * smoothstep(10.0, 5.0, y);
  float s = y < 3.2 ? 1.0 : -1.0;
  float nf = clamp(0.62 + 0.8 * nW.y * s, 0.0, 1.0);
  return uTownLightCol * (L * g * nf);
}
`,S=`
#include <lights_fragment_end>
{
  vec3 tlN = inverseTransformDirection(normal, viewMatrix);
  reflectedLight.indirectDiffuse += material.diffuseColor * town_light(vWxWorldPos, tlN);
}
`;function C(e,t=!1){e.fragmentShader=e.fragmentShader.replace(`void main() {`,(t?`#define TW_ON_GROUND
`:``)+x+`
void main() {`).replace(`#include <lights_fragment_end>`,S)}function w(e,t={x0:-140,z0:-70,w:280,d:140},n=.5){let i=Math.round(t.w/n),c=Math.round(t.d/n),l=new Float32Array(i*c);for(let r of e){let e=Math.max(0,Math.floor((r.x-9-t.x0)/n)),a=Math.min(i-1,Math.ceil((r.x+9-t.x0)/n)),o=Math.max(0,Math.floor((r.z-9-t.z0)/n)),s=Math.min(c-1,Math.ceil((r.z+9-t.z0)/n)),u=r.h*r.h;for(let c=o;c<=s;c++){let o=t.z0+(c+.5)*n-r.z;for(let s=e;s<=a;s++){let e=t.x0+(s+.5)*n-r.x,a=e*e+o*o;if(a>81)continue;let d=1-Math.sqrt(a)/9;l[c*i+s]+=r.i/(a+u)*d*d}}}let d=new Uint16Array(i*c);for(let e=0;e<l.length;e++)d[e]=u.toHalfFloat(Math.min(l[e],60));let f=new s(d,i,c,p,o);return f.magFilter=r,f.minFilter=r,f.wrapS=f.wrapT=a,f.needsUpdate=!0,m.tTownLight.value=f,m.uTownRect.value.set(t.x0,t.z0,1/t.w,1/t.d),f}var T=2048,E={};for(let e=0;e<12;e++)E[`banner`+e]=[e*170,0,170,640];for(let e=0;e<4;e++)E[`plaque`+e]=[e*512,640,512,256];for(let e=0;e<8;e++)E[`sign`+e]=[e%4*512,896+Math.floor(e/4)*128,512,128];for(let e=0;e<8;e++)E[`cloth`+e]=[e*256,1152,256,256];for(let e=0;e<8;e++)E[`lchar`+e]=[e*256,1408,256,256];E.backdrop=[0,1664,1024,384],E.door0=[1024,1664,256,384],E.door1=[1280,1664,256,384],E.valance=[1536,1664,512,192],E.curtain=[1536,1856,512,192];function D(e){let[t,n,r,i]=E[e],a=T,o=1.5;return[(t+o)/a,1-(n+i-o)/a,(t+r-o)/a,1-(n+o)/a]}var O=[{t:`酒`,bg:`#e6d8b8`,fg:`#1b120c`,edge:`#8c1c14`},{t:`茶`,bg:`#27384f`,fg:`#efe6cf`,edge:`#d8c690`},{t:`藥`,bg:`#ddd0ae`,fg:`#15213a`,edge:`#27384f`},{t:`當`,bg:`#171310`,fg:`#e8d7a8`,edge:`#a4262a`},{t:`米`,bg:`#b88834`,fg:`#1a130b`,edge:`#5c3a12`},{t:`布`,bg:`#314a66`,fg:`#f2ead5`,edge:`#f2ead5`},{t:`麵`,bg:`#e8dcc0`,fg:`#8c1c14`,edge:`#1b120c`},{t:`客棧`,bg:`#8c1c14`,fg:`#f0d488`,edge:`#f0d488`},{t:`油`,bg:`#ded2b0`,fg:`#1b120c`,edge:`#b88834`},{t:`糕`,bg:`#a3262a`,fg:`#fbeccd`,edge:`#fbeccd`}],k=[`一曲長風吹古渡`,`滿街燈火照歸人`],A=[`長街燈火`,`風物清嘉`,`聲遏行雲`,`長風古鎮`],j=[`陳記茶莊`,`萬和酒家`,`回春堂`,`錦繡綢莊`,`德昌米行`,`聚福樓`,`清風客棧`,`老街麵館`],M=[`福`,`喜`,`酒`,`茶`,`吉`,`春`,`壽`,`燈`],N=`"STKaiti", "Kaiti SC", "KaiTi", "BiauKai", "Songti SC", "STSong", "Noto Serif CJK SC", serif`;function P(){let r=T,i=document.createElement(`canvas`);i.width=i.height=r;let a=i.getContext(`2d`);a.clearRect(0,0,r,r);let o=(()=>{let e=7;return()=>(e=e*16807%2147483647)/2147483647})(),s=(e,t,n,r,i=.08,s=900)=>{for(let c=0;c<s;c++)a.fillStyle=o()<.5?`rgba(0,0,0,${i*o()})`:`rgba(255,255,255,${i*.6*o()})`,a.fillRect(e+o()*n,t+o()*r,1+o()*3,1+o()*10)},c=(e,t,n,r,i,{vertical:o=!1,gap:s=1,stroke:c=null,weight:l=`bold`}={})=>{a.font=`${l} ${r}px ${N}`,a.textAlign=`center`,a.textBaseline=`middle`;let u=[...e];u.forEach((e,l)=>{let d=(l-(u.length-1)/2)*r*s,f=o?t:t+d,p=o?n+d:n;c&&(a.strokeStyle=c,a.lineWidth=r*.08,a.strokeText(e,f,p)),a.fillStyle=i,a.fillText(e,f,p)})};O.forEach((e,t)=>{let[n,r,i,o]=E[`banner`+t];a.save(),a.beginPath(),a.moveTo(n+6,r),a.lineTo(n+i-6,r),a.lineTo(n+i-6,r+o-70);for(let e=0;e<3;e++){let t=n+i-6-e*(i-12)/3,s=n+i-6-(e+1)*(i-12)/3;a.lineTo((t+s)/2,r+o-4),a.lineTo(s,r+o-70)}a.closePath(),a.clip(),a.fillStyle=e.bg,a.fillRect(n,r,i,o),s(n,r,i,o,.07,700),a.fillStyle=e.edge,a.fillRect(n+6,r,i-12,34),a.fillRect(n+6,r+o-70-22,i-12,12),a.fillRect(n+6,r,12,o),a.fillRect(n+i-18,r,12,o);let l=[...e.t].length;c(e.t,n+i/2,r+34+(o-70-56)/2,l>1?104:128,e.fg,{vertical:!0,gap:1.1}),a.restore()}),k.forEach((e,t)=>{let[n,r,i,o]=E[`banner`+(10+t)];a.fillStyle=`#6e120e`,a.fillRect(n,r,i,o),s(n,r,i,o,.05,400),a.strokeStyle=`#c9a24c`,a.lineWidth=6,a.strokeRect(n+10,r+10,i-20,o-20),c(e,n+i/2,r+o/2,76,`#e8c36a`,{vertical:!0,gap:1.08})}),A.forEach((e,t)=>{let[n,r,i,o]=E[`plaque`+t],l=t===2?`#20120c`:`#17302f`;a.fillStyle=`#7a5520`,a.fillRect(n,r,i,o),a.fillStyle=`#c99a44`,a.fillRect(n+8,r+8,i-16,o-16),a.fillStyle=l,a.fillRect(n+26,r+26,i-52,o-52),s(n+26,r+26,i-52,o-52,.05,300),c(e,n+i/2,r+o/2+4,104,`#e9c56c`,{gap:1.08,stroke:`#5a3b10`})}),j.forEach((e,t)=>{let[n,r,i,o]=E[`sign`+t],l=t%3!=2;a.fillStyle=l?`#140f0b`:`#8a6a44`,a.fillRect(n,r,i,o),s(n,r,i,o,l?.05:.12,500),a.strokeStyle=l?`#b38a3e`:`#3a2616`,a.lineWidth=6,a.strokeRect(n+7,r+7,i-14,o-14);let u=[...e].length;c(e,n+i/2,r+o/2+3,u>3?84:92,l?`#e4bf66`:`#17100a`,{gap:u>3?1.12:1.4})});let l=[()=>{p([`#8c1c14`,`#e6dcc4`],32)},()=>{f(`#28405e`),m(`#e9e4d4`)},()=>{f(`#b8862e`)},()=>{p([`#26364c`,`#dcd5c2`],24)},()=>{f(`#d9cfb4`)},()=>{f(`#6c1712`)},()=>{f(`#3b4a3a`)},()=>{p([`#a0342a`,`#c9a24c`],20)}],u=0,d=0;function f(e){a.fillStyle=e,a.fillRect(u,d,256,256)}function p(e,t){for(let n=0;n*t<256;n++)a.fillStyle=e[n%e.length],a.fillRect(u+n*t,d,t,256)}function m(e){a.fillStyle=e;for(let e=0;e<8;e++)for(let t=0;t<8;t++)a.beginPath(),a.arc(u+16+e*32,d+16+t*32+e%2*8,5,0,7),a.fill()}l.forEach((e,t)=>{[u,d]=E[`cloth`+t],e(),s(u,d,256,256,.08,500)}),M.forEach((e,t)=>{let[n,r,i,a]=E[`lchar`+t];c(e,n+i/2,r+a/2+6,200,`#0c0806`,{weight:`bold`})});{let[e,t,n,r]=E.backdrop;a.fillStyle=`#6a0f0c`,a.fillRect(e,t,n,r),s(e,t,n,r,.06,1500),a.strokeStyle=`#c9a24c`,a.lineWidth=14,a.strokeRect(e+14,t+14,n-28,r-28),a.lineWidth=4,a.strokeRect(e+34,t+34,n-68,r-68);let i=e+n/2,o=t+r/2;a.strokeStyle=`#d8b35a`;for(let e of[120,104,60])a.lineWidth=e===104?3:8,a.beginPath(),a.arc(i,o,e,0,7),a.stroke();let l=(e,t,n,r)=>{a.lineWidth=6,a.beginPath();for(let i=0;i<14;i+=.1){let o=n*(1-i/16),s=i*r,c=e+Math.cos(s)*o*.3*i/2,l=t+Math.sin(s)*o*.3*i/2;i===0?a.moveTo(c,l):a.lineTo(c,l)}a.stroke()};for(let r=0;r<6;r++)l(e+150+r*30,t+120+r%2*140,22,r%2?1:-1),l(e+n-150-r*30,t+120+r%2*140,22,r%2?-1:1);c(`福`,i,o+6,110,`#e9c56c`)}[`出將`,`入相`].forEach((e,t)=>{let[n,r,i,o]=E[`door`+t];a.fillStyle=`#7d1712`,a.fillRect(n,r,i,o),s(n,r,i,o,.07,500),a.fillStyle=`#c9a24c`,a.fillRect(n,r,i,26),c(e,n+i/2,r+o/2,92,`#ebc774`,{vertical:!0,gap:1.2})});{let[e,t,n,r]=E.valance;a.save(),a.beginPath(),a.moveTo(e,t),a.lineTo(e+n,t),a.lineTo(e+n,t+90);for(let i=4;i>0;i--){let o=e+i*n/4,s=e+(i-1)*n/4;a.quadraticCurveTo((o+s)/2,t+r+40,s,t+90)}a.closePath(),a.clip(),a.fillStyle=`#8a1510`,a.fillRect(e,t,n,r);for(let i=0;i<4;i++){let o=a.createRadialGradient(e+(i+.5)*n/4,t+40,10,e+(i+.5)*n/4,t+60,120);o.addColorStop(0,`rgba(255,120,90,0.25)`),o.addColorStop(1,`rgba(0,0,0,0.25)`),a.fillStyle=o,a.fillRect(e+i*n/4,t,n/4,r)}a.fillStyle=`#c9a24c`,a.fillRect(e,t,n,18),a.restore()}{let[e,t,n,r]=E.curtain;for(let i=0;i<n;i+=4){let n=.75+.25*Math.sin(i*.11);a.fillStyle=`rgb(${Math.round(130*n)},${Math.round(20*n)},${Math.round(16*n)})`,a.fillRect(e+i,t,4,r)}s(e,t,n,r,.05,300)}let h=new t(i);return h.colorSpace=n,h.anisotropy=8,h.generateMipmaps=!0,h.minFilter=e,h}var F=`
{
  vec3 wp = vWxWorldPos;
  vec2 uvm = vTwUv;                                   // metres
  int part = int(vTwP.x + 0.5);
  float sd = vTwP.y;
  float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  float n1 = wx_vnoise(wp.xz * 0.7 + wp.y * 0.9 + sd * 17.0);
  vec3 c = vec3(0.1);
  twRough = 0.8;
  if (part == 0) {                                     // dark lacquered timber, rubbed lighter at edges
    c = vec3(0.052, 0.03, 0.019) * (0.55 + 1.4 * lum) * (0.85 + 0.3 * sd);
    twRough = 0.55;
  } else if (part == 1 || part == 10) {                // boards: warm grey-brown weathered wood + seams
    float seam = part == 10 ? 0.26 : 0.22;
    float sx = abs(fract(uvm.x / seam + sd * 3.0) - 0.5);
    c = diffuseColor.rgb * vec3(0.62, 0.5, 0.4) * (part == 10 ? 0.62 : 0.85) * (0.8 + 0.4 * sd);
    c *= 1.0 - 0.55 * smoothstep(0.43, 0.49, sx);
    twRough = 0.82;
  } else if (part == 2) {                              // lime plaster: off-white, rain streaks, damp grey foot
    float streak = wx_vnoise(vec2(uvm.x * 5.0 + sd * 40.0, uvm.y * 0.35));
    float blot = wx_vnoise(uvm * 0.8 + sd * 9.0) * 0.6 + wx_vnoise(uvm * 3.1) * 0.4;
    c = vec3(0.56, 0.55, 0.52) * (0.88 + 0.14 * sd);
    c *= 1.0 - 0.34 * smoothstep(0.5, 0.9, streak) * smoothstep(0.3, 2.5, uvm.y);
    c *= 1.0 - 0.3 * smoothstep(0.45, 0.85, blot);
    c = mix(c, c * vec3(0.8, 0.84, 0.78), smoothstep(0.6, 0.8, wx_vnoise(uvm * 0.35 + 3.0)));
    c = mix(c, vec3(0.2, 0.2, 0.18), (1.0 - smoothstep(0.0, 0.9 + 0.5 * blot, uvm.y)) * 0.65);   // damp foot
    twRough = 0.95; twFlat = 1.0;
  } else if (part == 3) {                              // vermilion lacquer, worn
    c = mix(vec3(0.3, 0.04, 0.025), vec3(0.16, 0.05, 0.03), smoothstep(0.55, 0.8, n1));
    twRough = 0.5;
  } else if (part == 4 || part == 11) {                // paper lattice (step-fret or square grid)
    vec2 q = uvm / (sd > 0.7 ? 0.11 : 0.14);
    vec2 f = abs(fract(q) - 0.5);
    float bar = max(smoothstep(0.36, 0.42, f.x), smoothstep(0.36, 0.42, f.y));
    if (sd > 0.7) bar = max(bar, smoothstep(0.38, 0.44, abs(fract(q.x * 0.5 + q.y * 0.5) - 0.5)) * 0.8);
    bool lit = part == 4 && sd > 0.42;
    float flick = 0.9 + 0.1 * sin(uTime * (2.0 + sd * 3.0) + sd * 40.0);
    vec3 paper = lit ? vec3(0.4, 0.33, 0.24) : vec3(0.22, 0.2, 0.17);
    c = mix(paper, vec3(0.03, 0.02, 0.014), bar);
    if (lit) twEmis = vec3(1.0, 0.6, 0.3) * (0.9 + 1.0 * fract(sd * 7.3)) * flick * (1.0 - bar) * (0.75 + 0.5 * wx_vnoise(uvm * 1.3 + sd * 5.0));
    twRough = 0.9; twFlat = 1.0;
  } else if (part == 5) {                              // lit shop interior: dim lamp-warm room, shelves + wares in silhouette
    float h = uvm.y;
    float band = 0.0;
    for (int k = 0; k < 3; k++) {
      float y0 = 1.05 + float(k) * 0.62;
      band = max(band, step(y0, h) * step(h, y0 + 0.05));
      float w = wx_vnoise(vec2(uvm.x * 4.5 + sd * 31.0 + float(k) * 7.0, float(k)));
      float top = y0 + 0.08 + 0.34 * w;
      band = max(band, step(y0 + 0.05, h) * step(h, top) * step(0.45, w) * 0.85);
    }
    float counterZone = 1.0 - smoothstep(0.7, 1.0, h);
    c = vec3(0.06, 0.04, 0.028);
    float lamp = exp(-pow(h - 2.35, 2.0) * 0.9) * (0.7 + 0.6 * wx_vnoise(vec2(uvm.x * 0.8 + sd * 5.0, 1.0)));
    float glow = (0.1 + 0.55 * lamp) * (0.6 + 0.5 * sd);
    twEmis = vec3(1.0, 0.46, 0.17) * glow * (1.0 - 0.9 * band) * (1.0 - 0.7 * counterZone);
    twRough = 0.9; twFlat = 1.0;
  } else if (part == 6) {
    c = vec3(0.025, 0.022, 0.02); twRough = 0.7;
  } else if (part == 7) {                              // blue-green painted beams with gilt edge lines
    float e = abs(fract(uvm.y * 3.0) - 0.5);
    c = mix(vec3(0.03, 0.075, 0.07), vec3(0.3, 0.2, 0.06), smoothstep(0.42, 0.47, e));
    c = mix(c, vec3(0.1, 0.03, 0.02), step(0.6, wx_vnoise(uvm * 2.0)) * 0.4);
    twRough = 0.55;
  } else if (part == 8) {
    c = vec3(0.42, 0.27, 0.07) * (0.7 + 0.5 * lum); twRough = 0.38;
  } else {
    c = vec3(0.012, 0.01, 0.009); twRough = 0.95;
  }
  diffuseColor.rgb = c;
}
`;function I(e){e.vertexShader=e.vertexShader.replace(`void main() {`,`attribute vec2 aP;
varying vec2 vTwP;
varying vec2 vTwUv;
void main() {
vTwP = aP; vTwUv = uv;`),e.fragmentShader=e.fragmentShader.replace(`void main() {`,`varying vec2 vTwP;
varying vec2 vTwUv;
void main() {`)}function L(e,t,n={}){return new l({name:e,map:t?.map||null,normalMap:t?.normalMap||null,roughnessMap:t?.armMap||null,roughness:1,metalness:0,...n})}function R(e){let t=L(`town:building`,{map:e?.map});return _(t,{wetBias:-.22}),g(t,`twBuilding`,e=>{I(e),e.fragmentShader=e.fragmentShader.replace(`void main() {`,`void main() {
float twRough = 0.8; float twFlat = 0.0; vec3 twEmis = vec3(0.0);`).replace(`#include <map_fragment>`,`diffuseColor *= texture2D(map, vMapUv * 0.45);
`+F).replace(`#include <roughnessmap_fragment>`,`#include <roughnessmap_fragment>
roughnessFactor = twRough;`).replace(`#include <emissivemap_fragment>`,`#include <emissivemap_fragment>
totalEmissiveRadiance += twEmis;`),C(e)}),t}var z=`
{
  vec3 wp = vWxWorldPos;
  int part = int(vTwP.x + 0.5);
  float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 c = mix(diffuseColor.rgb, lum * vec3(0.86, 0.93, 1.02), 0.6);      // blue-grey 青石
  if (part == 2) c *= vec3(1.18, 1.15, 1.08);
  if (part == 3) c *= 0.55;
  c *= 0.85 + 0.3 * wx_vnoise(wp.xz * 0.4 + wp.y * 0.3);
  if (part == 1) {
    float wl = wp.y - uTwWater;
    c = mix(c, c * vec3(0.45, 0.5, 0.38), 1.0 - smoothstep(-0.1, 0.45 + 0.25 * wx_vnoise(wp.xz * 2.0 + wp.y), wl));   // tide stain
    c = mix(c, vec3(0.03, 0.045, 0.03), 1.0 - smoothstep(-0.3, 0.05, wl));
    twWetK = 1.0 - smoothstep(0.0, 0.35, wl);
  }
  diffuseColor.rgb = c;
}
`;function B(e,t){let n=L(`town:stone`,e);return e?.map&&n.color.setScalar(.9),_(n),n.userData.uTwWater={value:t},g(n,`twStone`,e=>{I(e),e.uniforms.uTwWater=n.userData.uTwWater,e.fragmentShader=e.fragmentShader.replace(`void main() {`,`uniform float uTwWater;
void main() {
float twWetK = 0.0;`).replace(`#include <map_fragment>`,`#include <map_fragment>
`+z).replace(`#include <roughnessmap_fragment>`,`#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.25, twWetK);`),C(e)}),n}var V=`
{
  vec3 wp = vWxWorldPos;
  int part = int(vTwP.x + 0.5);
  float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  float moss = smoothstep(0.0, 0.04, diffuseColor.g - diffuseColor.r * 0.95);
  vec3 c = lum * vec3(0.5, 0.54, 0.6) * 0.62;                           // fired grey-black 青瓦
  c = mix(c, lum * vec3(0.55, 0.6, 0.38), moss * 0.35);
  c *= 0.75 + 0.5 * wx_vnoise(wp.xz * 0.6 + vTwP.y * 13.0);
  if (part == 1) c = vec3(0.028, 0.03, 0.032) * (0.8 + 0.4 * wx_vnoise(wp.xz * 3.0));
  diffuseColor.rgb = c;
}
`;function H(e){let t=L(`town:tiles`,{map:e?.map});return t.roughness=.62,_(t,{wetBias:.25}),g(t,`twTiles`,e=>{I(e),e.fragmentShader=e.fragmentShader.replace(`#include <map_fragment>`,`#include <map_fragment>
`+V)}),t}var U=`
{
  vec3 wp = vWxWorldPos;
  int part = int(vTwP.x + 0.5);
  float n = wx_vnoise(wp.xz * 3.0 + wp.y * 2.0 + vTwP.y * 11.0);
  vec3 c; float r;
  if (part == 0) { c = vec3(0.04, 0.042, 0.045) * (0.8 + 0.4 * n); r = 0.6; }
  else if (part == 1) { c = mix(vec3(0.05, 0.028, 0.015), vec3(0.11, 0.06, 0.03), n) * (0.7 + 0.6 * vTwP.y); r = 0.22; }
  else if (part == 2) { c = vec3(0.3, 0.035, 0.022) * (0.8 + 0.3 * n); r = 0.85; }
  else if (part == 3) { float w = abs(fract(vTwUv.x * 14.0) - 0.5) + abs(fract(vTwUv.y * 10.0) - 0.5); c = vec3(0.24, 0.16, 0.07) * (0.6 + 0.6 * w); r = 0.9; }
  else if (part == 4) { c = vec3(0.022, 0.02, 0.02); r = 0.5; }
  else if (part == 5) { c = vec3(0.5, 0.33, 0.09) * (0.8 + 0.3 * n); r = 0.35; }
  else if (part == 6) { c = vec3(0.06, 0.045, 0.03); r = 0.9; }
  else if (part == 7) { c = vec3(0.5, 0.49, 0.46) * (0.85 + 0.2 * n); r = 0.9; }
  else if (part == 8) { c = vec3(0.045, 0.03, 0.02) * (0.8 + 0.4 * n); r = 0.5; }
  else { c = vec3(0.02, 0.018, 0.016) * (0.8 + 0.4 * n); r = 0.75; }
  diffuseColor.rgb = c; twRough = r;
}
`;function W(){let e=new l({name:`town:misc`,color:16777215,roughness:.7,metalness:0});return _(e),g(e,`twMisc`,e=>{I(e),e.fragmentShader=e.fragmentShader.replace(`void main() {`,`void main() {
float twRough = 0.7;`).replace(`#include <color_fragment>`,`#include <color_fragment>
`+U).replace(`#include <roughnessmap_fragment>`,`#include <roughnessmap_fragment>
roughnessFactor = twRough;`),C(e)}),e}var G=`
{
  float fw = aP.x;
  if (fw > 0.0) {
    vec3 wpS = (modelMatrix * vec4(transformed, 1.0)).xyz;
    float g = windGust(wpS);
    float ph = aP.y;
    vec3 dw = vec3(uWind.x, 0.0, uWind.y);
    float flap = sin(uTime * 3.1 + ph * 6.0 - fw * 3.5) * 0.09 + sin(uTime * 5.7 + ph * 3.0 - fw * 6.0) * 0.035;
    transformed += (dw * (0.1 + 0.22 * g) * uWind.z + normal * flap * (0.6 + g)) * fw * fw;
  }
}
`;function K(e){let t=new l({name:`town:signs`,map:e,roughness:.85,metalness:0,alphaTest:.5,side:2});return _(t),g(t,`twSigns`,e=>{Object.assign(e.uniforms,v()),e.vertexShader=e.vertexShader.replace(`void main() {`,`attribute vec2 aP;
varying float vOneSide;
`+y+`
void main() {
vOneSide = step(99.0, aP.y);`).replace(`#include <begin_vertex>`,`#include <begin_vertex>
`+G),e.fragmentShader=e.fragmentShader.replace(`void main() {`,`varying float vOneSide;
void main() {
if (vOneSide > 0.5 && !gl_FrontFacing) discard;`),C(e)}),t}var q=`
lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
{
  vec3 wp = vWxWorldPos;
  vec2 xz = wp.xz;
  vec3 c = lum * vec3(0.8, 0.88, 0.98) * 1.05;                         // blue-grey 青石板
  float groove = 0.0;
  float br = step(abs(xz.x - uTwBridge.x), uTwBridge.y) * step(abs(xz.y), 4.6);
  // street centre band: long granite slabs 條石 laid across the street (outside the plaza, off the bridge)
  float band = step(abs(xz.y), 1.05) * step(uTwPlaza.x, abs(xz.x - uTwPlaza.z)) * (1.0 - br);
  if (band > 0.5) {
    float k = floor(xz.x / 0.46);
    float fx = abs(fract(xz.x / 0.46) - 0.5);
    float h = wx_hash12(vec2(k, 3.0));
    vec2 suv = vec2(fract(xz.x / 0.46) * 0.46 + h * 7.0, xz.y + h * 3.0);
    vec3 s2 = texture2D(map, suv * 0.33).rgb;
    c = dot(s2, vec3(0.2126, 0.7152, 0.0722)) * vec3(0.9, 0.93, 0.98) * (0.75 + 0.45 * h);
    groove = smoothstep(0.44, 0.49, fx) + smoothstep(0.96, 1.03, abs(xz.y)) ;
  }
  // bridge: stepped slabs across the arch (dark riser line + worn nosing)
  if (br > 0.5) {
    float u = abs(xz.x - uTwBridge.x) / 0.42;
    float fx = fract(u), st = floor(u);
    float qz = xz.y / 1.3 + 0.5 * mod(st, 2.0);
    float h = wx_hash12(vec2(st, floor(qz)) + 7.0);
    vec3 s2 = texture2D(map, vec2(fx * 0.42 + h * 3.0, fract(qz) * 1.3) * 0.4).rgb;
    c = dot(s2, vec3(0.2126, 0.7152, 0.0722)) * vec3(0.92, 0.95, 1.0) * (0.8 + 0.35 * h);
    c *= 0.45 + 0.55 * smoothstep(0.0, 0.22, 1.0 - fx);                 // riser shadow on the uphill side
    groove = max(groove, max(1.0 - smoothstep(0.0, 0.06, 1.0 - fx), smoothstep(0.46, 0.5, abs(fract(qz) - 0.5))));
  }
  // plaza: running-bond granite slabs 1.2 × 0.6 m, a ring of dark stones round the centre
  if (abs(xz.x - uTwPlaza.z) < uTwPlaza.x - 4.0 && abs(xz.y - uTwPlaza.w) < uTwPlaza.y) {
    vec2 q = xz - uTwPlaza.zw;
    float row = floor(q.y / 0.6);
    float qx = q.x / 1.2 + 0.5 * mod(row, 2.0);
    vec2 cell = vec2(floor(qx), row);
    vec2 f = vec2(fract(qx), fract(q.y / 0.6));
    float h = wx_hash12(cell + 11.0);
    vec3 s2 = texture2D(map, (vec2(f.x * 1.2, f.y * 0.6) + h * 5.0) * 0.4).rgb;
    c = dot(s2, vec3(0.2126, 0.7152, 0.0722)) * vec3(0.84, 0.9, 0.98) * (0.78 + 0.4 * h);
    float r = length(q);
    c *= 1.0 - 0.35 * step(4.2, r) * step(r, 4.9) - 0.2 * step(0.0, r) * step(r, 0.9);
    groove = max(groove, max(smoothstep(0.46, 0.5, abs(f.x - 0.5)), smoothstep(0.44, 0.5, abs(f.y - 0.5))));
    groove = max(groove, smoothstep(0.035, 0.0, abs(r - 4.2)) + smoothstep(0.035, 0.0, abs(r - 4.9)));
  }
  // gutters 陰溝 along the facades: darker kerb stones
  float gut = smoothstep(4.35, 4.55, abs(xz.y)) * (1.0 - smoothstep(4.95, 5.1, abs(xz.y))) * step(uTwPlaza.x, abs(xz.x - uTwPlaza.z)) * (1.0 - br);
  c *= 1.0 - 0.45 * gut;
  c *= 1.0 - 0.6 * groove;
  // worn, polished traffic line, dust in the corners
  float wear = exp(-xz.y * xz.y * 0.12);
  c *= 0.85 + 0.3 * wx_vnoise(xz * 0.35) ;
  twRough = mix(0.82, 0.55, wear) + 0.2 * groove;
  diffuseColor.rgb = c;
}
`;function J(e,{plazaW:t,plazaD:n,plazaX:r=0,plazaZ:i=0,bridgeX:a,bridgeHalf:o}){let s=L(`town:paving`,{map:e?.map,normalMap:e?.normalMap});_(s,{wetBias:.05});let l={value:new c(t/2,n/2,r,i)},u={value:new d(a,o)};return g(s,`twPave`,e=>{e.uniforms.uTwPlaza=l,e.uniforms.uTwBridge=u,e.fragmentShader=e.fragmentShader.replace(`void main() {`,`uniform vec4 uTwPlaza;
uniform vec2 uTwBridge;
void main() {
float twRough = 0.8; float lum = 0.2;`).replace(`#include <map_fragment>`,`#include <map_fragment>
`+q).replace(`#include <roughnessmap_fragment>`,`#include <roughnessmap_fragment>
roughnessFactor = twRough * (0.85 + 0.3 * lum);`),C(e,!0)}),s}var Y=`
${h(`sampler2D`,`tSceneCopy`)}
uniform mat4 projectionMatrix;
float twH(vec2 p) {
  vec2 q = p + vec2(0.0, uTime * 0.18);
  return wx_vnoise(q * vec2(0.9, 0.45)) * 0.55 + wx_vnoise(q * vec2(2.1, 1.3) + vec2(uTime * 0.2, 0.0)) * 0.3 + wx_vnoise(q * 5.0 - uTime * 0.35) * 0.15;
}
vec4 tw_ssr(vec3 P, vec3 R) {
  float t = 0.25;
  vec4 last = vec4(0.0);
  for (int i = 0; i < 14; i++) {
    vec3 Q = P + R * t;
    vec4 c = projectionMatrix * (viewMatrix * vec4(Q, 1.0));
    if (c.w <= 0.0) break;
    vec2 uv = c.xy / c.w * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0) return vec4(0.0);
    if (uv.y > 1.0) break;
    vec4 sc = texture2D(tSceneCopy, uv);
    if (sc.a > 0.0 && sc.a < c.w && c.w - sc.a < max(t * 0.5, 0.4)) {
      float edge = smoothstep(0.0, 0.08, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
      return vec4(sc.rgb, edge);
    }
    last = sc;
    t *= 1.45;
  }
  return vec4(last.rgb, last.a > 0.0 ? (1.0 - smoothstep(40.0, 120.0, last.a)) * 0.8 : 0.0);
}
`,X=`
{
  vec2 p = vWxWorldPos.xz;
  float e = 0.06;
  float h0 = twH(p), hx = twH(p + vec2(e, 0.0)), hz = twH(p + vec2(0.0, e));
  float k = 0.022 * (0.6 + 0.6 * uWind.z);
  twNW = normalize(vec3(-(hx - h0) / e * k, 1.0, -(hz - h0) / e * k));
  normal = normalize((viewMatrix * vec4(twNW, 0.0)).xyz);
}
`,Z=`
{
  vec3 V = normalize(cameraPosition - vWxWorldPos);
  vec3 R = reflect(-V, twNW); R.y = max(R.y, 0.02); R = normalize(R);
  float F = 0.02 + 0.98 * pow(1.0 - clamp(dot(twNW, V), 0.0, 1.0), 5.0);
  vec3 sky = wx_skyFogColor(R) * F;
  reflectedLight.indirectSpecular = max(reflectedLight.indirectSpecular, sky);
  vec4 hit = tw_ssr(vWxWorldPos, R);
  reflectedLight.indirectSpecular = mix(reflectedLight.indirectSpecular, hit.rgb * (F * 0.9 + 0.1), hit.a);
  reflectedLight.indirectDiffuse *= 0.4;
}
`;function Q(){let e=new l({name:`town:water`,color:new i(.012,.02,.018),roughness:.06,metalness:0});return _(e),g(e,`twWater`,e=>{e.uniforms.tSceneCopy=m.tSceneCopy||(m.tSceneCopy={value:null}),e.fragmentShader=e.fragmentShader.replace(`void main() {`,Y+`
void main() {
vec3 twNW = vec3(0.0, 1.0, 0.0);`).replace(`#include <normal_fragment_maps>`,`#include <normal_fragment_maps>
`+X).replace(`#include <lights_fragment_end>`,`#include <lights_fragment_end>
`+Z)}),e}var $=`
{
  vec3 hp = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float g = windGust(hp);
  float ph = aLant.x;
  vec2 wd = uWind.xy;
  float amp = (0.035 + 0.09 * g) * uWind.z;
  float ax = amp * (0.55 + 0.45 * sin(uTime * 1.6 + ph * 6.28));
  float ay = 0.035 * sin(uTime * 2.2 + ph * 11.0) * uWind.z;
  vec2 T = wd * ax + vec2(-wd.y, wd.x) * ay;
  vec3 c0 = normalize(instanceMatrix[0].xyz), c2 = normalize(instanceMatrix[2].xyz);
  vec3 T3 = vec3(T.x, 0.0, T.y);
  vec2 Tl = vec2(dot(T3, c0), dot(T3, c2)) * aLant.w;
  transformed.xz += -transformed.y * Tl;
  vLant = aLant; vLoc = position; vPart = aP.x; vTint = aTint;
}
`,ee=`
{
  vec3 V = normalize(cameraPosition - vWxWorldPos);
  vec3 N = normalize(vLNrm);
  float facing = abs(dot(N, V));
  float t = clamp((-vLoc.y - 0.14) / 0.98, 0.0, 1.0);
  float ang = atan(vLoc.z, vLoc.x);
  float line = smoothstep(0.36, 0.5, abs(fract(ang * 2.546479) - 0.5));  // 16 ribs
  vec3 red = mix(vec3(1.0, 0.1, 0.025), vec3(0.75, 0.38, 0.15), vTint);
  vec3 core = mix(vec3(1.0, 0.38, 0.09), vec3(0.85, 0.55, 0.28), vTint);
  float prof = sin(t * 3.14159);
  vec3 col = mix(red, core, clamp(pow(facing, 3.0) * prof * 0.85, 0.0, 1.0)) * (0.28 + 0.95 * pow(facing, 0.8) * (0.45 + 0.55 * prof));
  col *= 1.0 - 0.4 * line;
  col *= 1.0 - 0.75 * (1.0 - smoothstep(0.02, 0.08, t)) - 0.75 * smoothstep(0.92, 0.98, t);
  if (vLant.y >= 0.0) {
    float cell = floor(vLant.y + 0.5);
    for (int s = 0; s < 2; s++) {
      float a0 = s == 0 ? 1.5708 : -1.5708;
      float da = ang - a0; da = mod(da + 3.14159, 6.28318) - 3.14159;
      vec2 cu = vec2(-da / 1.35 + 0.5, (1.0 - t - 0.5) / 0.62 + 0.5);
      if (cu.x > 0.0 && cu.x < 1.0 && cu.y > 0.0 && cu.y < 1.0) {
        vec2 auv = vec2((cell * 256.0 + 2.0 + cu.x * 252.0) / 2048.0, 1.0 - (1408.0 + 2.0 + (1.0 - cu.y) * 252.0) / 2048.0);
        float a = texture2D(tTwAtlas, auv).a;
        col *= 1.0 - 0.88 * a;
      }
    }
  }
  float flick = 0.93 + 0.07 * sin(uTime * 9.0 + vLant.x * 30.0) * sin(uTime * 3.7 + vLant.x * 11.0);
  col *= vLant.z * flick;
  int part = int(vPart + 0.5);
  if (part == 1) col = vec3(0.05, 0.025, 0.012) + red * 0.08 * vLant.z * (1.0 - facing * 0.5);
  if (part == 2) col = red * vec3(0.5, 0.3, 0.3) * 0.18 * vLant.z;
  diffuseColor.rgb = col;
}
`;function te(e){let t=new f({name:`town:lanterns`,color:16777215});return _(t),g(t,`twLantern`,t=>{Object.assign(t.uniforms,v()),t.uniforms.tTwAtlas={value:e},t.vertexShader=t.vertexShader.replace(`void main() {`,`attribute vec4 aLant;
attribute float aTint;
attribute vec2 aP;
varying vec4 vLant;
varying vec3 vLoc;
varying float vPart;
varying float vTint;
varying vec3 vLNrm;
`+y+`
void main() {`).replace(`#include <begin_vertex>`,`#include <begin_vertex>
`+$).replace(`#include <project_vertex>`,`#include <project_vertex>
vLNrm = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);`),t.fragmentShader=t.fragmentShader.replace(`void main() {`,`uniform sampler2D tTwAtlas;
varying vec4 vLant;
varying vec3 vLoc;
varying float vPart;
varying float vTint;
varying vec3 vLNrm;
void main() {`).replace(`#include <color_fragment>`,`#include <color_fragment>
`+ee)}),t}export{B as _,M as a,x as c,P as d,R as f,K as g,J as h,k as i,D as l,W as m,T as n,A as o,te as p,O as r,j as s,E as t,w as u,H as v,Q as y};