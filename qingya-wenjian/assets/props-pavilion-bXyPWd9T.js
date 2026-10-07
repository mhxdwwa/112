import{A as e,Ba as t,Lt as n,O as r,Tn as i,U as a,ct as o,j as s,mr as c,no as l,ra as u,ro as d,z as f}from"./three.core-DtjtRha-.js";import{n as p,s as m}from"./atmosphere-BNENFJca.js";import{t as h}from"./ground-glsl-B_t_Z4yP.js";import{a as g,c as _,i as v,r as y,s as b,t as x}from"./props-geo-Df9GNdKb.js";import{i as S}from"./props-stone-Dyes0SGL.js";var C={Rp:3.75,Hp:.5,Rc:2.7,colH:2.75,Re:4.3,yEave:3.3,lift:.62,flare:.09,yApex:5.8},w=C,T=(e,t,n)=>new d(e,t,n),E=(e,t,n=0)=>T(Math.cos(e*Math.PI/3)*t,n,Math.sin(e*Math.PI/3)*t);function D(e,t,n){let r=E(e,w.Re),i=E(e+1,w.Re),a=Math.abs(2*t-1)**3;return n.set(r.x+(i.x-r.x)*t,0,r.z+(i.z-r.z)*t).multiplyScalar(1+w.flare*a),n}var O=e=>w.yEave+w.lift*Math.abs(2*e-1)**2.6,k=(e,t)=>w.yApex-(w.yApex-O(t))*(1-(1-e)**1.75);function A(e,t,n,r,i=0,a=1){return D(e,n,r),r.multiplyScalar(t*a),r.y=k(t,n)-i,r}function j(){let e={pos:[],uv:[],idx:[]},t={pos:[],uv:[],idx:[]},r={pos:[],uv:[],idx:[]},i=new d,a=new d,o=w.Re*Math.cos(Math.PI/6),c=e=>.1+.14*e;for(let n=0;n<6;n++){let s=E(n+1,1).sub(E(n,1)).normalize(),l=E(n,1).add(E(n+1,1)).normalize(),u=e.pos.length/3,d=t.pos.length/3;for(let r=0;r<=18;r++){let u=r/18;for(let r=0;r<=26;r++){let d=r/26;A(n,u,d,i),e.pos.push(i.x,i.y,i.z),e.uv.push(i.x*s.x+i.z*s.z,(o-(i.x*l.x+i.z*l.z))*1.3),A(n,u,d,a,c(u),.985),t.pos.push(a.x,a.y,a.z),t.uv.push(a.x*s.x+a.z*s.z,a.x*l.x+a.z*l.z)}}for(let n=0;n<18;n++)for(let r=0;r<26;r++){let i=n*27+r,a=i+1,o=i+26+1,s=o+1;e.idx.push(u+i,u+a,u+o,u+a,u+s,u+o),t.idx.push(d+i,d+o,d+a,d+a,d+o,d+s)}let f=r.pos.length/3;for(let e=0;e<=26;e++){let t=e/26;A(n,1,t,i),A(n,1,t,a,c(1),.985);let o=i.x*s.x+i.z*s.z;r.pos.push(i.x,i.y+.01,i.z,a.x,a.y,a.z),r.uv.push(o,.3,o,0)}for(let e=0;e<26;e++){let t=f+e*2;r.idx.push(t,t+2,t+1,t+1,t+2,t+3)}}let l=(e,t)=>{let r=new s;return r.setAttribute(`position`,new n(e.pos,3)),r.setAttribute(`uv`,new n(e.uv.map(e=>e*t),2)),r.setIndex(e.idx),r.computeVertexNormals(),r.toNonIndexed()};return{top:l(e,1/2.6),under:b(l(t,1),1),fascia:b(l(r,1),3)}}function M(){let n=[],r=new d;for(let e=0;e<6;e++){let i=[];for(let t=1;t<=10;t++)A(e,.05+t/10*.95,0,r),i.push(r.clone().add(T(0,.075,0)));let a=i[i.length-1],o=a.clone().setY(0).normalize();i.push(a.clone().addScaledVector(o,.22).add(T(0,.1,0))),i.push(a.clone().addScaledVector(o,.36).add(T(0,.24,0))),i.push(a.clone().addScaledVector(o,.4).add(T(0,.33,0)));let s=new f(i),c=new t(s,40,.075,7,!1);n.push(c.toNonIndexed()),n.push(_(y(.14,.16,.22),{pos:[a.x,a.y+.02,a.z],rotY:-Math.atan2(o.z,o.x)+Math.PI/2}))}let a=[[0,0],[.42,0],[.42,.07],[.3,.12],[.26,.2],[.32,.34],[.3,.48],[.14,.58],[.1,.64],[.2,.74],[.21,.86],[.12,.96],[.05,1.02],[.035,1.18],[0,1.24]].map(([e,t])=>new l(e,t)),o=new i(a,14).toNonIndexed();o.translate(0,w.yApex-.12,0),n.push(o);for(let t of n)t.deleteAttribute(`uv`),t.setAttribute(`uv`,new e(new Float32Array(t.getAttribute(`position`).count*2),2));return n}function N(t){let n=[],i=[],a=[],{Rp:s,Hp:c,Rc:l,colH:f}=w,p=(e,t,n)=>{let r=new o(e,e,n-t,6,1).toNonIndexed();return r.rotateY(Math.PI/6),r.translate(0,(t+n)/2,0),r.computeVertexNormals(),r},m=t=>{let n=t.getAttribute(`position`),r=t.getAttribute(`normal`),i=new Float32Array(n.count*2);for(let e=0;e<n.count;e++){let t=r.getX(e),a=r.getY(e),o=r.getZ(e);if(Math.abs(a)>.7)i[e*2]=n.getX(e)/2,i[e*2+1]=n.getZ(e)/2;else{let r=-o,a=t;i[e*2]=(n.getX(e)*r+n.getZ(e)*a)/2,i[e*2+1]=n.getY(e)/2}}return t.setAttribute(`uv`,new e(i,2)),b(t,0)};n.push(m(p(s+.1,-.35,.14)),m(p(s,.14,c-.09)),m(p(s+.06,c-.09,c)));let h=s*Math.cos(Math.PI/6);for(let e of[1,-1])n.push(m(_(new r(2,.52,.66).toNonIndexed(),{pos:[0,-.09,e*(h+.29)]}))),n.push(m(_(new r(1.9,.34,.36).toNonIndexed(),{pos:[0,.17,e*(h+.14)]})));for(let e=0;e<6;e++){let t=E(e,l);i.push(_(v(.132,.115,f,14,{part:0}),{pos:[t.x,c,t.z]}));let r=v(.21,.19,.16,14,{part:0});r.deleteAttribute(`aPart`),n.push(b(m(_(r,{pos:[t.x,c-.02,t.z]})),0))}let C=c+f;for(let e=0;e<6;e++){let t=E(e,l),n=E(e+1,l),r=n.clone().sub(t).normalize(),a=t.clone().addScaledVector(r,-.16),o=n.clone().addScaledVector(r,.16);i.push(x(a.clone().setY(C-.14),o.clone().setY(C-.14),.15,.27,{part:1})),i.push(x(t.clone().setY(C-.47),n.clone().setY(C-.47),.1,.12,{part:1})),i.push(x(a.clone().setY(C+.2),o.clone().setY(C+.2),.16,.16,{part:3}));let s=l;for(let e=1;e<11;e++){let n=t.clone().addScaledVector(r,s*e/11);i.push(_(y(.03,.26,.03,{part:1}),{pos:[n.x,C-.66,n.z]}))}if(i.push(x(t.clone().setY(C-.79),n.clone().setY(C-.79),.035,.035,{part:1})),e!==1&&e!==4){let e=t.clone().add(n).multiplyScalar(.5).clone().setY(0).normalize(),a=t.clone().addScaledVector(e,-.1),o=n.clone().addScaledVector(e,-.1);a.addScaledVector(r,.14),o.addScaledVector(r,-.14),i.push(x(a.clone().setY(c+.43),o.clone().setY(c+.43),.34,.06,{part:2})),i.push(x(a.clone().addScaledVector(e,.1).setY(c+.21),o.clone().addScaledVector(e,.1).setY(c+.21),.05,.42,{part:3}));for(let t=0;t<=12;t++){let n=a.clone().lerp(o,t/12).addScaledVector(e,.14).setY(c+.46),r=n.clone().addScaledVector(e,.21).setY(c+.46+.46);i.push(x(n,r,.03,.022,{part:0}))}let s=a.clone().addScaledVector(e,.35).setY(c+.93),l=o.clone().addScaledVector(e,.35).setY(c+.93);i.push(x(s,l,.07,.05,{part:0}))}}for(let e=0;e<6;e++){let t=E(e,l),n=t.clone().normalize();i.push(_(y(.3,.14,.3,{part:1}),{pos:[t.x,C+.07,t.z],rotY:-e*Math.PI/3})),i.push(x(n.clone().multiplyScalar(l-.35).setY(C+.1),n.clone().multiplyScalar(l+1.1).setY(C+.45),.12,.15,{part:3}))}let T=j();i.push(T.under,T.fascia);let D=new d,O=new d;for(let e=0;e<6;e++)for(let t=1;t<17;t++){let n=t/17;A(e,.58,n,D,.1+.14*.58+.04,.985),A(e,1,n,O,.27,.985),i.push(x(D,O,.065,.065,{part:1}))}{let e=new u,n=1.12,r=.35;e.moveTo(-1.12/2,0),e.lineTo(n/2,0),e.lineTo(n/2,r),e.lineTo(-1.12/2,r),e.lineTo(-1.12/2,0);let i=S(e,.04,.008,`plaque`,`plaque`,t,{bevelSegments:1}),o=l*Math.cos(Math.PI/6)+.1;a.push(_(i,{pos:[0,C-.42,o],rotX:.2}))}let k=M();return{geos:{stone:g(n),wood:g(i),tiles:T.top,ceramic:g(k),carved:g(a)},dims:{...w,top:w.yApex+1.1}}}var P=`
varying float vPart;
`,F=`
{
  vec3 wp = vWxWorldPos;
  float n1 = wx_vnoise(wp.xz * 2.3 + wp.y * 3.1), n2 = wx_vnoise(vec2(wp.x + wp.z, wp.y) * 9.0);
  float grain = wx_vnoise(vec2((wp.x - wp.z) * 40.0, wp.y * 2.0));
  vec3 bare = diffuseColor.rgb;                                        // the weathered planks scan (calibrated)
  int part = int(vPart + 0.5);
  vec3 paint = part == 0 ? vec3(0.26, 0.036, 0.024) : part == 1 ? vec3(0.055, 0.105, 0.092) : vec3(0.03, 0.026, 0.022);
  // sun-bleached paint and flaking: more loss low on the columns and on exposed faces
  paint = mix(paint, paint * vec3(1.45, 1.6, 1.55) + vec3(0.03, 0.02, 0.015), smoothstep(0.4, 0.9, n1) * 0.6);
  float peel = smoothstep(0.52, 0.66, n1 * 0.55 + n2 * 0.35 + grain * 0.2 + (part == 2 ? 1.0 : 0.0) - smoothstep(0.3, 2.0, wp.y - \${Y0}) * 0.12);
  diffuseColor.rgb = mix(paint * (0.85 + 0.3 * grain), bare, peel);
  wdRough = mix(0.62, 0.9, peel);
}
`,I=`
{
  vec3 wp = vWxWorldPos;
  float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  float moss = smoothstep(0.0, 0.04, diffuseColor.g - diffuseColor.r * 0.95);
  vec3 grey = lum * vec3(0.8, 0.86, 0.92);                            // fired grey tiles (青瓦), a trace of warmth kept
  vec3 c = mix(grey, diffuseColor.rgb * 0.8, 0.14);
  c = mix(c, lum * vec3(1.3, 1.08, 0.6), moss * 0.8);                 // moss → dry ochre lichen
  c *= 0.85 + 0.3 * wx_vnoise(wp.xz * 0.9);                            // weathering blotches across the roof
  diffuseColor.rgb = c;
}
`,L=`
{
  vec3 wp = vWxWorldPos;
  float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  diffuseColor.rgb = mix(diffuseColor.rgb, lum * vec3(1.08, 1.0, 0.86), 0.5);   // warm the grey scan toward the steppe
  if (wt_inWorld(wp.xz) > 0.5) {
    float hA = wp.y - wt_groundHeight(wp.xz);
    float k = 1.0 - smoothstep(0.0, 0.35 + 0.25 * wx_vnoise(wp.xz * 4.0), hA);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.12, 0.095, 0.065), k * 0.75);
    diffuseColor.rgb *= mix(0.6, 1.0, smoothstep(-0.05, 0.4, hA));
  }
}
`;function R(e,t){try{let n=e.map?.image,r=(typeof OffscreenCanvas<`u`?new OffscreenCanvas(16,16):Object.assign(document.createElement(`canvas`),{width:16,height:16})).getContext(`2d`,{willReadFrequently:!0});r.drawImage(n,0,0,16,16);let i=r.getImageData(0,0,16,16).data,a=0;for(let e=0;e<i.length;e+=4){let t=e=>(e/=255,e<=.04045?e/12.92:((e+.055)/1.055)**2.4);a+=.2126*t(i[e])+.7152*t(i[e+1])+.0722*t(i[e+2])}let o=t/Math.max(a/256,.001);e.color.setScalar(o)}catch{}}function z(e,t=0){let n=(e,t,n)=>{let r=new c({name:t,map:e?.map||null,normalMap:e?.normalMap||null,roughnessMap:e?.armMap||null,roughness:1,metalness:0});return e?.map&&R(r,n),m(r),r},r=n(e.stone,`pavilion:stone`,.16);p(r,`wtPavStone`,e=>{e.fragmentShader=e.fragmentShader.replace(`void main() {`,h+`
void main() {`).replace(`#include <map_fragment>`,`#include <map_fragment>
`+L)});let i=n(e.wood,`pavilion:wood`,.11);p(i,`wtPavWood`,e=>{e.vertexShader=e.vertexShader.replace(`void main() {`,`attribute float aPart;
varying float vPart;
void main() {
vPart = aPart;`),e.fragmentShader=e.fragmentShader.replace(`void main() {`,P+`
void main() {
float wdRough = 0.85;`).replace(`#include <map_fragment>`,`#include <map_fragment>
`+F.replace("${Y0}",t.toFixed(3))).replace(`#include <roughnessmap_fragment>`,`#include <roughnessmap_fragment>
roughnessFactor = wdRough;`)}),i.side=2;let o=n(e.tiles,`pavilion:tiles`,.09);p(o,`wtPavTiles`,e=>{e.fragmentShader=e.fragmentShader.replace(`#include <map_fragment>`,`#include <map_fragment>
`+I)}),o.side=2;let s=new c({name:`pavilion:ceramic`,color:new a(.05,.053,.056),roughness:.5,metalness:0});return m(s),{stone:r,wood:i,tiles:o,ceramic:s}}export{N as n,z as r,C as t};