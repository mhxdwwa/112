import{Dt as e,E as t,Ht as n,Lt as r,an as i,ar as a,fa as o,in as s,ir as c,lr as l,no as u,ro as d,tr as f}from"./three.core-DtjtRha-.js";import{a as p,n as m,t as h}from"./globals-29H6lCK0.js";import{i as g,r as _,t as v}from"./noise-D9IUCAHK.js";import{n as y,s as b}from"./atmosphere-BNENFJca.js";import{n as x}from"./wind-BKJvbr9K.js";import{_ as S,c as C,d as w,g as T,h as E,n as D,o as O,p as k,s as A,u as j,y as M}from"./foliage-DmeOjhRT.js";var N=256,P=512,F=.975,I=32,L=null;function R(){if(L)return L;let e=k(N,P),t=e.getContext(`2d`,{willReadFrequently:!0});t.clearRect(0,0,N,P);let n=_(p.seed+3032),r=e=>[118+10*e*e,P*(1-e)];t.lineCap=`round`,t.strokeStyle=`rgb(196,178,140)`,t.lineWidth=2.6,t.beginPath();for(let e=0;e<=20;e++){let[n,i]=r(e/20*.9);e?t.lineTo(n,i):t.moveTo(n,i)}t.stroke();for(let e=0;e<26;e++){let i=.04+e/25*.78+(n()-.5)*.03,a=e%2?1:-1,[o,s]=r(i),c=(.1+.35*i+n()*.12)*a,l=P*(.26+n()*.22)*(1-.35*i),u=[];for(let e=0;e<=12;e++){let t=e/12,n=c*(.4+t*1.1)+.08*t*t,r=o+Math.sin(n)*l*t,i=s-Math.cos(n)*l*t;u.push([Math.max(3,Math.min(233,r)),Math.max(3,i)])}t.strokeStyle=`rgb(206,188,150)`,t.lineWidth=1.3,t.beginPath(),u.forEach(([e,n],r)=>r?t.lineTo(e,n):t.moveTo(e,n)),t.stroke();for(let e=0;e<16;e++){let r=.08+e/16*.92+n()*.03,i=Math.min(11,Math.floor(r*12)),[o,s]=u[i],[c,l]=u[i+1],d=Math.atan2(c-o,-(l-s))+(n()-.5)*.9+a*.25,f=14+n()*26,p=.85+n()*.3;t.strokeStyle=`rgba(${Math.round(237*p)},${Math.round(225*p)},${Math.round(196*p)},${.75+n()*.25})`,t.lineWidth=.9+n()*.8;let m=o+Math.sin(d)*f,h=s-Math.cos(d)*f;t.beginPath(),t.moveTo(o,s),t.quadraticCurveTo(o+Math.sin(d-a*.3)*f*.6,s-Math.cos(d-a*.3)*f*.6,Math.max(1,Math.min(235,m)),Math.max(1,h)),t.stroke()}}t.fillStyle=`#ffffff`,t.fillRect(240,0,16,P),w(t,N,P,6);let i=j(e,{aniso:8});return i.name=`plumeAtlas`,L={canvas:e,texture:i},L}function z({leaves:e,leafSegs:t,culms:n,culmSegs:a,cards:s,cardRows:c}){let l=[],u=[],f=[],p=(e,t,n)=>{let r=l.length/3;for(let r=0;r<n;r++){let i=1-(1-r/n)**1.3;l.push(-1,i,0,1,i,0),u.push(e,t,0,e,t,0)}l.push(0,1,0),u.push(e,t,0);for(let e=0;e<n-1;e++){let t=r+e*2;f.push(t,t+1,t+3,t,t+3,t+2)}let i=r+(n-1)*2;f.push(i,i+1,r+n*2)};for(let n=0;n<e;n++)p(0,n,t);for(let e=0;e<n;e++)p(1,e,a);for(let e=0;e<n;e++)for(let t=0;t<s;t++){let n=l.length/3;for(let n=0;n<=c;n++){let r=n/c;l.push(-1,r,0,1,r,0),u.push(2,e,t,2,e,t)}for(let e=0;e<c;e++){let t=n+e*2;f.push(t,t+1,t+3,t,t+3,t+2)}}let m=new i;return m.setAttribute(`position`,new r(l,3)),m.setAttribute(`normal`,new r(new Float32Array(l.length).map((e,t)=>+(t%3==1)),3)),m.setAttribute(`uv`,new r(new Float32Array(l.length/3*2),2)),m.setAttribute(`aElem`,new r(u,3)),m.setIndex(f),m.instanceCount=0,m.boundingSphere=new o(new d,1e6),m}var B=`
${v}
${x}
${O}
${C}
attribute vec3 aElem;     // kind (0 leaf, 1 culm, 2 plume ribbon), element index, ribbon index
attribute vec4 iPos;      // tuft root (world) + scale
attribute vec4 iMisc;     // yaw, seed, combed lean xz
uniform vec2 uFade;       // shrink-fade start / end (m)
uniform float uLeafW, uPixelWorld;
varying vec3 vPlCol;      // albedo
varying vec4 vPl;         // x t along element, y AO, z translucency gain, w kind

float plH(float a, float b) { return fract(sin(a * 12.9898 + b * 78.233) * 43758.5453); }

// quadratic Bézier from the root with a stiff base; bend = xz direction * angle (radians); L = length
void plCurve(vec2 bend, float L, float stiff, float t, out vec3 p, out vec3 tg) {
  float ang = min(length(bend), 1.55);
  vec2 bd = bend / max(length(bend), 1e-4);
  vec3 P2 = vec3(bd.x * sin(ang), cos(ang), bd.y * sin(ang)) * L;
  float a1 = ang * stiff;
  vec3 P1 = vec3(bd.x * sin(a1), cos(a1), bd.y * sin(a1)) * L * 0.6;
  float Lb = (2.0 * length(P2) + length(P1) + length(P2 - P1)) / 3.0;
  P1 *= L / Lb; P2 *= L / Lb;
  p = 2.0 * (1.0 - t) * t * P1 + t * t * P2;
  tg = normalize(2.0 * (1.0 - t) * P1 + 2.0 * t * (P2 - P1) + vec3(0.0, 1e-4, 0.0));
}
`,V=`
  vec3 plPos = vec3(0.0, -1e4, 0.0); vec3 plNormal = vec3(0.0, 1.0, 0.0); vec2 plUv = vec2(${F}, 0.5);
  vPlCol = vec3(0.0); vPl = vec4(0.0);
  {
    float kind = aElem.x, ei = aElem.y;
    vec3 base = iPos.xyz;
    float seed = iMisc.y;
    float dist = length(base.xz - cameraPosition.xz);
    float S = iPos.w * (1.0 - smoothstep(uFade.x, uFade.y, dist + plH(seed, 3.0) * 10.0));
    vec2 iuv; vec4 im = vegInteractAt(base.xz, iuv);
    float cut = smoothstep(0.3, 0.6, im.g);
    if (uCamGround.z > 0.0) S *= smoothstep(uCamGround.z * 0.8, uCamGround.z * 1.8, length(base.xz - uCamGround.xy));
    if (S > 0.01) {
      // shared tuft wind: gust + the downwind sway wave (bible §5.4) + cross-wind wobble
      vec2 wdir = uWind.xy, wside = vec2(-wdir.y, wdir.x);
      float g = windGust(base);
      float along = dot(base.xz, wdir);
      float s01 = 0.5 + 0.5 * sin(uTime * 1.7 - along * 0.7 + seed * 6.2832);
      vec2 windB = wdir * (0.3 + 0.55 * s01) * g + wside * sin(uTime * 1.7 + seed * 14.0 + along * 0.31) * 0.12 * g;
      float contact = 0.0;
      vec2 push = vegPush(base.xz, base.y, 1.3 * S, im, iuv, 1.5, contact);
      vec2 comb = iMisc.zw;
      vec3 V = normalize(cameraPosition - base - vec3(0.0, 0.7 * S, 0.0));
      float t = position.y;
      if (kind < 0.5) {
        // ---- arching leaf ----
        float a1 = plH(seed, ei * 7.13 + 1.0), a2 = plH(seed, ei * 3.71 + 2.0), a3 = plH(seed, ei * 5.37 + 3.0);
        float yaw = iMisc.x + ei * 2.39996 + (a1 - 0.5) * 0.7;
        vec2 o = vec2(cos(yaw), sin(yaw));
        float L = S * mix(0.85, 1.4, a2) * (1.0 - 0.62 * cut);
        float chord = mix(0.3, 1.25, a3 * a3) + 0.25 * cut;
        vec2 bend = o * chord + comb * 0.25 + windB * 0.5 + push * 0.8;
        vec3 p, tn;
        plCurve(bend, L, 0.28, t, p, tn);
        vec2 bd = normalize(bend + 1e-4);
        vec3 sideV = normalize(vec3(-bd.y, 0.0, bd.x));
        float w = uLeafW * S * mix(0.8, 1.2, a1) * (1.0 - 0.86 * pow(t, 1.4));
        vec3 wp = base + p;
        vec3 Nf = normalize(cross(sideV, tn));
        float fv = dot(Nf, normalize(cameraPosition - wp));
        if (fv < 0.0) { Nf = -Nf; fv = -fv; }
        w *= 1.0 + (1.0 - fv) * 0.7;
        w = max(w, uPixelWorld * length(cameraPosition - wp) * 0.9);
        plPos = wp + sideV * position.x * w * 0.5;
        plNormal = normalize(mix(normalize(Nf + sideV * position.x * 0.35), normalize(vec3(o.x * 0.6, 0.8, o.y * 0.6)), 0.45));
        // autumn susuki leaves: dark base, olive-straw blade, pale bleached tips; some tufts russet
        float rus = plH(seed, 9.0);
        vec3 mid = mix(vec3(0.20, 0.18, 0.075), vec3(0.24, 0.13, 0.06), smoothstep(0.6, 0.95, rus));
        vec3 tip = mix(vec3(0.50, 0.42, 0.20), vec3(0.52, 0.34, 0.16), smoothstep(0.6, 0.95, rus));
        vec3 alb = mix(vec3(0.03, 0.028, 0.012), mid, smoothstep(0.0, 0.5, t));
        alb = mix(alb, tip, smoothstep(0.55, 1.0, t)) * (0.85 + 0.3 * a2);
        vPlCol = alb;
        vPl = vec4(t, mix(0.35, 1.0, smoothstep(0.0, 0.6, t)) * (1.0 - 0.35 * contact), 1.5, 0.0);
      } else {
        // ---- culm (kind 1) and the plume ribbons that ride on its top (kind 2) ----
        float c1 = plH(seed, ei * 11.3 + 5.0), c2 = plH(seed, ei * 4.9 + 6.0), c3 = plH(seed, ei * 8.1 + 7.0);
        float Hc = S * mix(1.45, 2.1, c1) * (1.0 - cut);
        float yawc = iMisc.x + ei * 2.1 + c2 * 1.4;
        vec2 lean = vec2(cos(yawc), sin(yawc)) * mix(0.05, 0.22, c3) + comb * 0.3;
        float nodT = sin(uTime * 2.2 + c1 * 6.0 + along * 0.4) * 0.06 * g;
        vec2 bendC = lean + windB * 0.9 + push + wdir * nodT;
        vec2 bd = normalize(bendC + 1e-4);
        if (kind < 1.5) {
          vec3 p, tn;
          plCurve(bendC, Hc, 0.2, t * 0.9, p, tn);
          vec3 sideV = normalize(cross(tn, V));
          float w = max(0.0065 * S * (1.0 - 0.4 * t), uPixelWorld * length(cameraPosition - base - p) * 0.8);
          plPos = base + p + sideV * position.x * w * 0.5;
          plNormal = normalize(V * 0.5 + vec3(0.0, 0.6, 0.0));
          vPlCol = mix(vec3(0.10, 0.075, 0.03), vec3(0.34, 0.26, 0.12), smoothstep(0.0, 0.4, t));
          vPl = vec4(t, mix(0.4, 1.0, smoothstep(0.0, 0.5, t)), 1.1, 1.0);
        } else {
          // ribbon row v follows the culm from 72% to its tip, then droops downwind (the panicle's weight)
          float v = t;
          vec3 p, tn;
          plCurve(bendC, Hc, 0.2, mix(0.66, 0.9, v), p, tn);
          vec3 nodDir = normalize(vec3(bd.x + wdir.x * 0.6, 0.0, bd.y + wdir.y * 0.6));
          float droop = (0.05 + 0.05 * g + 0.4 * nodT) * v * v * Hc;
          p += nodDir * droop - vec3(0.0, droop * 0.35, 0.0);
          vec3 side0 = normalize(cross(tn, vec3(bd.x, 0.0, bd.y) + vec3(0.0, 0.001, 0.0)));
          vec3 axis = aElem.z < 0.5 ? side0 : normalize(cross(tn, side0));
          float Wp = 0.2 * S * mix(0.85, 1.15, c2);
          plPos = base + p + axis * position.x * Wp * 0.5;
          plUv = vec2((position.x * 0.5 + 0.5) * 0.92, v);
          plNormal = normalize(V * 0.45 + vec3(0.0, 0.55, 0.0) + (axis * position.x) * 0.3);
          vPlCol = vec3(0.96, 0.86, 0.68) * mix(0.86, 1.04, c3);
          vPl = vec4(0.7 + 0.3 * v, 1.0, 1.9, 2.0);
        }
      }
    }
  }
`,H=`
varying vec3 vPlCol;
varying vec4 vPl;
uniform vec2 uTexSize;
`,U=`
  {
    vec2 tx = dFdx(vMapUv * uTexSize), ty = dFdy(vMapUv * uTexSize);
    float lod = 0.5 * log2(max(max(dot(tx, tx), dot(ty, ty)), 1e-6));
    diffuseColor.a = min(1.0, diffuseColor.a * (1.0 + max(lod, 0.0) * 0.35));
    // plume albedo (0.85, 0.75, 0.55) comes from the texture (sRGB #ede1c4); leaves / culms from the vertex colour
    diffuseColor.rgb *= vPlCol * vPl.y;
  }
`;function W(e,t){return`
  {
    vec3 sunC = ${e}; vec3 sunLv = ${t};
    float sunBack = pow(saturate(dot(-geometryViewDir, sunLv)), 4.0);
    float glow = vPl.w > 1.5 ? 0.3 : 0.18;
    // light through silky hairs / dry leaves is warmer than the surface colour
    vec3 tcol = diffuseColor.rgb * vec3(1.05, 0.92, 0.72);
    reflectedLight.directDiffuse += sunC * tcol * (sunBack * vPl.z + glow) * vPl.x;
  }
`}function G(e,{max:t,density:n}){let r=e.world,i=f.smoothstep,a=_(p.seed+3031),o=A,s=o?.knoll??{x:0,z:0},c=o?.duelCircle??{x:0,z:0,r:16},l=o?.oldTree??{x:-20,z:-14},u=o?.stele??{x:4,z:3},d=(o?.roadWidth??3.2)*.5,m=1.7,v=[],y=h.uWind.value;function b(e,t){let a=r.groundInfo?r.groundInfo(e,t):null,o=a?a.grass:.8;if(o<.3)return 0;let f=Math.hypot(e-s.x,t-s.z);if(Math.hypot(e-c.x,t-c.z)<c.r*.9||Math.hypot(e-l.x,t-l.z)<3.2||Math.hypot(e-u.x,t-u.z)<2.5||r.isBlocked&&r.isBlocked(e,t,.6))return 0;let p=g.fbm2(e*.045+13.1,t*.045-7.7,3),m=i(p,-.05,.45),h=0;if(r.pathAt){let n=r.pathAt(e,t).dist-d;h=Math.max(h,i(n,.5,1.6)*(1-i(n,3.5,8))*.55*(.35+.65*m))}return h=Math.max(h,i(f,17,24)*(1-i(f,34,48))*.28*m),a&&(h=Math.max(h,i(a.green,.28,.55)*(1-i(a.green,.8,.98))*.4*m)),h=Math.max(h,i(g.fbm2(e*.012-4.4,t*.012+2.2,2),.28,.55)*.3*m),h*=.9*n*(.5+.5*i(o,.3,.7)),h}function x(e,t,n){let i=r.heightAt(e,t),o=r.groundInfo?r.groundInfo(e,t):null,s=o?o.green:.3,c=(.82+a()*.36)*(.92+.2*s)*(n?.9:1),l=.12+a()*.18;v.push(e,i-.04,t,c,a()*Math.PI*2,a()*1e3,y.x*l,y.y*l)}for(let e=-270;e<270&&v.length/8<t;e+=m)for(let n=-270;n<270;n+=m){let r=n+a()*m,i=e+a()*m;if(r*r+i*i>72900){a();continue}let o=b(r,i);if(o<=0||a()>=o)continue;x(r,i,!1);let s=a()<.55?1+Math.floor(a()*3):0;for(let e=0;e<s;e++){let e=a()*Math.PI*2,t=.7+a()*1.1,n=r+Math.cos(e)*t,o=i+Math.sin(e)*t;b(n,o)>.05&&x(n,o,!0)}if(v.length/8>=t)break}return new Float32Array(v)}async function K(r,i={}){let{scene:o,camera:p}=r,g=Math.round((i.max??4600)*Math.min(1,i.density??1)),_=i.fade??[110,140],v=R(),x=G(r,{max:g,density:1}),C=x.length/8,w=new Map;for(let e=0;e<C;e++){let t=Math.floor(x[e*8]/I),n=Math.floor(x[e*8+2]/I),r=t*4096+n,i=w.get(r);i||(i={cx:t,cz:n,ids:[],lo:1/0,hi:-1/0},w.set(r,i)),i.ids.push(e),i.lo=Math.min(i.lo,x[e*8+1]),i.hi=Math.max(i.hi,x[e*8+1])}let O=[...w.values()].map(e=>({...e,ids:Int32Array.from(e.ids),box:new t(new d(e.cx*I-2,e.lo-.2,e.cz*I-2),new d((e.cx+1)*I+2,e.hi+2.4,(e.cz+1)*I+2))})),k={value:new u(_[0],_[1])},A={value:.001},j={value:new u(N,P)},F=S();function L(t,n,r){let i=z(n),c=new s(new Float32Array(Math.max(1,C)*4),4).setUsage(e),u=new s(new Float32Array(Math.max(1,C)*4),4).setUsage(e);i.setAttribute(`iPos`,c),i.setAttribute(`iMisc`,u);let d=new l({map:v.texture,side:2,alphaTest:.5});d.name=t,b(d);let f={value:r};y(d,`${t}-${F.key}-v1`,e=>{Object.assign(e.uniforms,M(),T(F),{uFade:k,uLeafW:f,uPixelWorld:A,uTexSize:j,tWindNoise:h.tWindNoise}),e.vertexShader=e.vertexShader.replace(`void main() {`,B+`
void main() {
`+V).replace(`#include <uv_vertex>`,`#include <uv_vertex>
  vMapUv = plUv;`).replace(`#include <beginnormal_vertex>`,`vec3 objectNormal = plNormal;`).replace(`#include <begin_vertex>`,`vec3 transformed = plPos;`),e.fragmentShader=e.fragmentShader.replace(`void main() {`,H+E(F)+`
void main() {`).replace(`#include <alphatest_fragment>`,U+`
#include <alphatest_fragment>`).replace(`#include <normal_fragment_begin>`,D).replace(`#include <lights_fragment_begin>`,F.lightsChunk+`
`+W(F.sunC,F.sunD))});let p=new a(i,d);return p.name=t,p.frustumCulled=!1,p.castShadow=!1,p.receiveShadow=!0,p.renderOrder=-5,p.layers.set(m.MAIN_ONLY),p.matrixAutoUpdate=!1,o.add(p),{geo:i,mat:d,mesh:p,iPos:c,iMisc:u,n:0}}let K=L(`plumes-near`,{leaves:12,leafSegs:5,culms:3,culmSegs:6,cards:2,cardRows:5},.022),q=L(`plumes-far`,{leaves:6,leafSegs:3,culms:3,culmSegs:3,cards:1,cardRows:3},.036),J=new n,Y=new c,X=1;function Z(e,t){let n=e.n++*4,r=t*8,i=e.iPos.array,a=e.iMisc.array;i[n]=x[r],i[n+1]=x[r+1],i[n+2]=x[r+2],i[n+3]=x[r+3],a[n]=x[r+4],a[n+1]=x[r+5],a[n+2]=x[r+6],a[n+3]=x[r+7]}function Q(e){e.geo.instanceCount=e.n,e.mesh.visible=e.n>0;for(let t of[e.iPos,e.iMisc])t.clearUpdateRanges(),t.addUpdateRange(0,Math.max(4,e.n*4)),t.needsUpdate=!0}let $={near:K,far:q,atlas:v,count:C,cells:O.length,setDensity(e){X=Math.max(0,Math.min(1,e))},nearest(e,t,n=new d){let r=1/0,i=-1;for(let n=0;n<C;n++){let a=(x[n*8]-e)**2+(x[n*8+2]-t)**2;a<r&&(r=a,i=n)}return i<0?null:n.set(x[i*8],x[i*8+1],x[i*8+2])},stats(){return{tufts:C,near:K.n,far:q.n}},update(){let e=r.pipeline?.H||r.renderer.domElement.height||900;A.value=2*Math.tan(f.degToRad(p.fov)*.5)/e},lateUpdate(){p.updateMatrixWorld(),Y.multiplyMatrices(p.projectionMatrix,p.matrixWorldInverse),J.setFromProjectionMatrix(Y);let e=p.position.x,t=p.position.z,n=_[1]+2;K.n=0,q.n=0;for(let r of O){let i=Math.max(r.cx*I-e,0,e-(r.cx+1)*I),a=Math.max(r.cz*I-t,0,t-(r.cz+1)*I);if(i*i+a*a>n*n||!J.intersectsBox(r.box))continue;let o=r.ids;for(let r=0;r<o.length;r++){let i=o[r],a=i*8,s=x[a+5]*.618%1;if(s>X)continue;let c=x[a]-e,l=x[a+2]-t,u=c*c+l*l;if(u>n*n)continue;let d=42+8*s;Z(u<d*d?K:q,i)}}Q(K),Q(q)},dispose(){for(let e of[K,q])o.remove(e.mesh),e.geo.dispose(),e.mat.dispose();r.remove($)}};return r.add($),$}export{K as createPlumes,R as plumeAtlas};