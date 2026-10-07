import{Ht as e,Lt as t,an as n,ar as r,fa as i,ir as a,lr as o,no as s,ro as c}from"./three.core-DtjtRha-.js";import{a as l,n as u,t as d}from"./globals-29H6lCK0.js";import{r as f,t as p}from"./noise-D9IUCAHK.js";import{n as m,s as h}from"./atmosphere-BNENFJca.js";import{n as g}from"./wind-BKJvbr9K.js";import{_,a as v,c as y,d as b,f as x,g as S,h as C,i as w,l as T,n as E,o as D,p as O,t as k,u as A,v as j,y as M}from"./foliage-DmeOjhRT.js";var N=1024,P=512,F=256;function I(e,t,n,r,i){let a=t.length;if(a<2)return;let o=[],s=[];for(let e=0;e<a;e++){let i=t[Math.max(0,e-1)],c=t[Math.min(a-1,e+1)],l=c[0]-i[0],u=c[1]-i[1],d=Math.hypot(l,u)||1;l/=d,u/=d;let f=(n+(r-n)*(e/(a-1)))*.5;o.push([t[e][0]-u*f,t[e][1]+l*f]),s.push([t[e][0]+u*f,t[e][1]-l*f])}e.beginPath(),e.moveTo(o[0][0],o[0][1]);for(let t=1;t<a;t++)e.lineTo(o[t][0],o[t][1]);for(let t=a-1;t>=0;t--)e.lineTo(s[t][0],s[t][1]);e.closePath(),e.fillStyle=i,e.fill()}function L(e,t,n,r=10){let i=[];for(let a=0;a<=r;a++){let o=a/r,s=1-o;i.push([s*s*e[0]+2*s*o*t[0]+o*o*n[0],s*s*e[1]+2*s*o*t[1]+o*o*n[1]])}return i}function R(e,t,n,r,i=14){let a=[];for(let o=0;o<=i;o++){let s=o/i,c=1-s,l=c*c*c,u=3*c*c*s,d=3*c*s*s,f=s*s*s;a.push([l*e[0]+u*t[0]+d*n[0]+f*r[0],l*e[1]+u*t[1]+d*n[1]+f*r[1]])}return a}var z=(e,t,n,r=1)=>`rgb(${Math.round(Math.min(255,e*r))},${Math.round(Math.min(255,t*r))},${Math.round(Math.min(255,n*r))})`;function B(e,t,n,r,i,a,o,s,c=[84,108,38]){let l=[(t+r)/2+a,(n+i)/2],u=L([t,n],l,[r,i],16);I(e,u,o,s,z(...c,.72)),I(e,u.map(([e,t])=>[e-o*.12,t]),o*.55,s*.5,z(...c,1.12))}function V(e,t,n,r,i){let a=5+Math.floor(i()*3),o=[];for(let e=0;e<a;e++){let t=e/a*Math.PI*2+i()*.6,n=.05+i()*.55;o.push({dx:Math.cos(n)*Math.cos(t),dy:-Math.sin(n),dz:Math.cos(n)*Math.sin(t)})}o.sort((e,t)=>e.dz-t.dz);for(let a of o){let o=.72+.28*(a.dz*.5+.5),s=t+a.dx*12*r,c=n+a.dy*10*r-2*r;I(e,L([t,n],[t+a.dx*6*r,n-4*r],[s,c],6),2.2*r,1.6*r,z(96,104,36,o));let l=Math.atan2(a.dy-.35,a.dx);for(let t=0;t<6;t++){let n=l+(t-2.5)*.2+(i()-.5)*.15,a=(40+i()*22)*r,u=[s+Math.cos(n)*a*.75,c+Math.sin(n)*a*.55-a*.42],d=[s+Math.cos(n)*a*.55,c+Math.sin(n)*a*.2-a*.12];I(e,L([s,c],d,u,10),1.5*r,.7*r,z(212,44,34,o)),e.fillStyle=z(92,26,18,o),e.beginPath(),e.ellipse(u[0],u[1],2.2*r,1.3*r,n,0,Math.PI*2),e.fill(),e.fillStyle=z(226,170,70,o),e.beginPath(),e.arc(u[0]+.6*r,u[1]-.5*r,.7*r,0,Math.PI*2),e.fill()}for(let t=0;t<6;t++){let n=l+(t-2.5)*.42+(i()-.5)*.2,a=(17+i()*7)*r,u=Math.cos(n),d=Math.sin(n),f=[s+u*a*.9,c+d*a*.9-2*r],p=[s+u*a*1.25-u*3*r,c+d*a*1.1+6*r],m=[s+u*a*.95-u*6*r,c+d*a*.8+8*r],h=R([s,c],f,p,m,12),g=.8+.4*i();I(e,h,4.4*r,1.4*r,z(176,22,20,o*g)),I(e,h.slice(1,9),1.6*r,.6*r,z(226,58,42,o*g))}}e.fillStyle=z(120,20,16),e.beginPath(),e.arc(t,n-r,3.2*r,0,Math.PI*2),e.fill()}function H(e,t,n,r){let i=r?[[.36,.64,.95],[.66,.44,.82]]:[[.5,.74,1]];for(let[r,a,o]of i){let i=t+F*(.5+(r-.5)*.4),s=t+F*r+(n()-.5)*16,c=P*(1-a);B(e,i,514,s,c+6,(n()-.5)*18,6.5,4.2,[78,112,40]),V(e,s,c,1.5*o,n)}}function U(e,t,n,r,i,a,o,s,c,l,u,d,f=.3){e.save(),e.translate(t,n),e.rotate(a),e.scale(1,i);for(let t=0;t<u;t++){let n=t/u*Math.PI*2+d()*.2,i=r*(.82+d()*.3);e.save(),e.rotate(n);let a=e.createLinearGradient(0,0,i,0);a.addColorStop(0,s),a.addColorStop(.45,o),a.addColorStop(1,o),e.fillStyle=a,e.beginPath(),e.ellipse(i*.55,0,i*.5,r*f*.5,0,0,Math.PI*2),e.fill(),e.restore()}e.fillStyle=l,e.beginPath(),e.arc(0,0,r*.34,0,Math.PI*2),e.fill(),e.fillStyle=c,e.beginPath(),e.arc(-r*.04,-r*.05,r*.27,0,Math.PI*2),e.fill(),e.restore()}function W(e,t,n,r,i,a,o){let s=Math.cos(r),c=Math.sin(r),l=[t+s*i,n+c*i],u=[t+s*i*.5-c*i*.12,n+c*i*.5+s*i*.12];I(e,L([t,n],u,l,8),a,.6,o)}function G(e,t,n){let r=2+Math.floor(n()*2);for(let i=0;i<r;i++){let a=.22+.56*(i+n()*.8)/r,o=.55+n()*.36,s=t+F*a,c=P*(1-o),l=t+F*(.5+(a-.5)*.3);B(e,l,514,s,c+4,(n()-.5)*30,3.6,2.6,[70,96,36]);for(let t=0;t<2;t++){let t=P-(P-c)*(.15+n()*.45);W(e,l+(s-l)*((P-t)/(P-c)),t,-Math.PI/2+(n()<.5?-1:1)*(.6+n()*.5),26+n()*18,6,z(62,86,32,.8+n()*.3))}U(e,s,c,26+n()*10,.38+n()*.55,(n()-.5)*.5,z(245,243,234),z(206,202,186),z(232,196,78),z(186,138,40),15+Math.floor(n()*5),n,.34)}}function K(e,t,n){let r=[t+F*.5,514],i=[],a=18+Math.floor(n()*7);for(let e=0;e<a;e++){let e=(n()-.5)*2,r=.5+.36*Math.sqrt(1-e*e)*(.72+n()*.28);i.push([t+F*(.5+e*.38),P*(1-r),10+n()*6])}for(let[t,a]of i){let i=[r[0]+(t-r[0])*.35,P-(P-a)*.45];B(e,r[0]+(n()-.5)*20,r[1],i[0],i[1],(n()-.5)*10,3.2,2.4,[66,88,34]),B(e,i[0],i[1],t,a+2,(n()-.5)*12,2.4,1.5,[72,96,36])}for(let t=0;t<26;t++){let t=r[0]+(n()-.5)*110,i=492-n()*220;e.fillStyle=z(52,74,28,.75+n()*.4);for(let n=0;n<3;n++)e.beginPath(),e.ellipse(t+(n-1)*5,i+Math.abs(n-1)*3,6,3.2,(n-1)*.7,0,Math.PI*2),e.fill()}i.sort((e,t)=>t[1]-e[1]);for(let[t,r,a]of i){if(n()<.2){e.fillStyle=z(200,150,40),e.beginPath(),e.arc(t,r,a*.45,0,Math.PI*2),e.fill();continue}U(e,t,r,a,.45+n()*.5,(n()-.5)*.6,z(244,204,58),z(214,150,34),z(206,142,30),z(160,96,20),13+Math.floor(n()*4),n,.42)}}var q=null;function J(){if(q)return q;let e=O(N,P),t=e.getContext(`2d`,{willReadFrequently:!0});t.clearRect(0,0,N,P);let n=f(l.seed+4711);t.save(),t.beginPath(),t.rect(0,0,F,P),t.clip(),H(t,0,n,!1),t.restore(),t.save(),t.beginPath(),t.rect(F,0,F,P),t.clip(),G(t,F,n),t.restore(),t.save(),t.beginPath(),t.rect(F*2,0,F,P),t.clip(),K(t,F*2,n),t.restore(),t.save(),t.beginPath(),t.rect(F*3,0,F,P),t.clip(),H(t,F*3,n,!0),t.restore(),b(t,N,P,8);let r=A(e,{aniso:8});return r.name=`flowerAtlas`,q={canvas:e,texture:r},q}function Y(){let e=[0,.38,.72,1],r=[],a=[];for(let t=0;t<2;t++){let n=r.length/3;for(let n of e)r.push(-.5,n,t,.5,n,t);for(let t=0;t<e.length-1;t++){let e=n+t*2;a.push(e,e+1,e+3,e,e+3,e+2)}}let o=new n;return o.setAttribute(`position`,new t(r,3)),o.setAttribute(`normal`,new t(new Float32Array(r.length).map((e,t)=>+(t%3==1)),3)),o.setAttribute(`uv`,new t(new Float32Array(r.length/3*2),2)),o.setIndex(a),o.instanceCount=0,o.boundingSphere=new i(new c,1e6),o}var X=`
${p}
${g}
${v}
${D}
${y}
${k}
uniform vec4 uTiles[64];
uniform float uK, uDensityMul;
uniform vec4 uRing;
varying vec4 vFl;        // x height along the card 0..1, y AO, z species (0 lily, 1 daisy, 2 chrysanthemum), w tint
`,Z=`
  vec3 flPos = vec3(0.0); vec3 flNormal = vec3(0.0, 1.0, 0.0); vec2 flUv = vec2(0.0);
  {
    int per = int(uK * uK + 0.5);
    int ti = gl_InstanceID / per;
    int bi = gl_InstanceID - ti * per;
    vec4 tile = uTiles[ti];
    int kk = int(uK + 0.5);
    vec2 cell = vec2(float(bi % kk), float(bi / kk));
    vec2 tc = floor(tile.xy / tile.z + 0.5);
    vec2 root = tile.xy + (cell + wx_hash22(tc * 91.3 + cell * 1.91 + 4.4)) * (tile.z / uK);
    float h1 = wx_hash12(root * 61.7 + 0.3), h2 = wx_hash12(root * 17.9 - 4.1), h3 = wx_hash12(root * 33.1 + 8.8);
    float h4 = wx_hash12(root * 7.7 + 2.2);
    float core;
    float fpatch = vegFlowerPatch(root, core);
    vec4 gi = gxGround(root);
    float dist = length(root - cameraPosition.xz);
    // species: lilies where the core weight wins the per-flower lottery; fringes split daisy / chrysanthemum
    bool lily = h2 < core * 0.92;
    float fringe = wx_vnoise(root * 0.23 + 3.0);
    float kind = lily ? (h3 < 0.3 ? 3.0 : 0.0) : (fringe > 0.48 ? 1.0 : 2.0);
    float dens = fpatch * (lily ? 0.9 : kind == 1.0 ? 0.16 : 0.26) * smoothstep(0.25, 0.55, gi.r);
    float keep = step(h1, dens * uDensityMul) * (1.0 - smoothstep(uRing.z, uRing.w, dist + h4 * 6.0));
    float S = kind == 0.0 || kind == 3.0 ? mix(0.46, 0.64, h3) : kind == 1.0 ? mix(0.36, 0.5, h3) : mix(0.32, 0.46, h3);
    S *= keep;
    vec2 iuv; vec4 im = vec4(0.0);
    if (S > 0.0) im = vegInteractAt(root, iuv);
    S *= step(im.g, 0.35);                                   // cut: the blade took the heads
    if (uCamGround.z > 0.0) S *= smoothstep(uCamGround.z * 0.6, uCamGround.z * 1.3, length(root - uCamGround.xy));
    if (S > 0.01) {
      vec3 base = vec3(root.x, gxHeight(root) - 0.02, root.y);
      float yaw = h4 * 3.14159 + position.z * 1.5708;
      vec3 ax = vec3(cos(yaw), 0.0, sin(yaw));
      // bend (radians): wind sway + everything that pushes plants; exact circular-arc bend preserves the length
      vec3 sw = windSway(base, 0.25, root.x * 3.0 + h2 * 6.0);
      float contact = 0.0;
      vec2 bend = sw.xz * 1.7 / S + vegPush(root, base.y, S, im, iuv, 1.0, contact);
      bend += vec2(0.21, -0.13) * (h2 - 0.5);               // natural stance
      float a = min(length(bend), 1.35);
      vec2 bd = bend / max(length(bend), 1e-4);
      float yn = position.y;
      float ang = a * yn;
      float along = a > 1e-3 ? (1.0 - cos(ang)) / a : 0.5 * a * yn * yn;
      float up = a > 1e-3 ? sin(ang) / a : yn;
      vec3 p = base + vec3(bd.x, 0.0, bd.y) * along * S + vec3(0.0, up * S, 0.0) + ax * position.x * S * 0.5;
      flPos = p;
      // soft lighting normal: card normal turned toward the viewer, blended toward the sky
      vec3 cn = vec3(-ax.z, 0.0, ax.x);
      if (dot(cn, cameraPosition - p) < 0.0) cn = -cn;
      flNormal = normalize(cn * 0.62 + vec3(bd.x * sin(a), 0.75, bd.y * sin(a)));
      float u = position.x + 0.5;
      if (h3 > 0.5) u = 1.0 - u;                              // mirrored variants
      flUv = vec2((kind + u) * 0.25, yn);
      vFl = vec4(yn, mix(0.32, 1.0, smoothstep(0.0, 0.62, yn)) * (1.0 - 0.3 * contact), kind == 3.0 ? 0.0 : kind, 0.88 + 0.24 * h1);
    } else {
      flPos = vec3(root.x, -1e4, root.y);                      // culled: collapse off-screen
      vFl = vec4(0.0);
    }
  }
`,Q=`
varying vec4 vFl;
uniform vec2 uAtlasSize;
`,$=`
  {
    vec2 tx = dFdx(vMapUv * uAtlasSize), ty = dFdy(vMapUv * uAtlasSize);
    float lod = 0.5 * log2(max(max(dot(tx, tx), dot(ty, ty)), 1e-6));
    diffuseColor.a = min(1.0, diffuseColor.a * (1.0 + max(lod, 0.0) * 0.3));
    diffuseColor.rgb *= (vFl.z > 0.5 && vFl.z < 1.5 ? 0.92 : 1.1) * vFl.w * vFl.y;
  }
`;function ee(e,t){return`
  {
    vec3 sunC = ${e}; vec3 sunLv = ${t};
    float sunBack = pow(saturate(dot(-geometryViewDir, sunLv)), 4.0);
    // petals transmit (lilies most: thin red tissue glows like stained glass); stems and leaves far less
    float petal = smoothstep(0.45, 0.7, vFl.x);
    float gain = vFl.z < 0.5 ? 1.8 : vFl.z < 1.5 ? 0.55 : 0.9;
    // transmission keeps (and deepens) the petal hue: red tissue glows crimson, not sunset-orange
    vec3 alb = diffuseColor.rgb;
    vec3 chroma = alb / max(max(alb.r, max(alb.g, alb.b)), 1e-3);
    vec3 tcol = alb * mix(vec3(1.0), chroma * chroma, 0.8);
    reflectedLight.directDiffuse += sunC * tcol * (sunBack * gain + 0.12) * mix(0.25, 1.0, petal);
  }
`}function te(t,n={}){let{scene:i,camera:c}=t,l=j(t),f=J(),p=n.radius??55,g=new w(t,{tile:10,k:16,ring:[-2,-1,p-20,p],cap:64,max:64,pad:.8}),v={value:n.density??1},y={value:new s(N,P)},b=new o({map:f.texture,side:2,alphaTest:.5});b.name=`flowers`,h(b);let D=_();m(b,`flowers-${D.key}-v1`,e=>{Object.assign(e.uniforms,g.uniforms,l.uniforms,M(),S(D),{uDensityMul:v,uAtlasSize:y,uFlowerSpots:x,tWindNoise:d.tWindNoise}),e.vertexShader=e.vertexShader.replace(`void main() {`,X+`
void main() {
`+Z).replace(`#include <uv_vertex>`,`#include <uv_vertex>
  vMapUv = flUv;`).replace(`#include <beginnormal_vertex>`,`vec3 objectNormal = flNormal;`).replace(`#include <begin_vertex>`,`vec3 transformed = flPos;`),e.fragmentShader=e.fragmentShader.replace(`void main() {`,Q+C(D)+`
void main() {`).replace(`#include <alphatest_fragment>`,$+`
#include <alphatest_fragment>`).replace(`#include <normal_fragment_begin>`,E).replace(`#include <lights_fragment_begin>`,D.lightsChunk+`
`+ee(D.sunC,D.sunD))});let O=Y(),k=new r(O,b);k.name=`flowers`,k.frustumCulled=!1,k.castShadow=!1,k.receiveShadow=!0,k.renderOrder=-5,k.layers.set(u.MAIN_ONLY),k.matrixAutoUpdate=!1,i.add(k);let A=new e,F=new a,I={mesh:k,atlas:f,tiles:g,setDensity(e){v.value=Math.max(0,e)},stats(){return{tiles:g.count,slots:O.instanceCount}},lateUpdate(){T(c,A,F);let e=g.select(c.position,A);O.instanceCount=e*g.perTile,k.visible=e>0&&v.value>0},dispose(){i.remove(k),O.dispose(),b.dispose(),t.remove(I)}};return t.add(I),I}export{J as n,te as t};