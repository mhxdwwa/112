import{Pt as e,io as t,mr as n,no as r,ra as i}from"./three.core-DtjtRha-.js";import{n as a,s as o}from"./atmosphere-BNENFJca.js";import{t as s}from"./ground-glsl-B_t_Z4yP.js";var c=400,l=`
${s}
uniform sampler2D tCarve;
uniform vec4 uCarveTint;   // rgb stone base (linear), w lichen amount
`,u=`
vec4 cvT = texture2D(tCarve, vNormalMapUv);
float cvRoughness = 0.9, cvMetal = 0.0;
{
  vec3 wp = vWxWorldPos;
  float recess = 1.0 - smoothstep(0.35, 0.96, cvT.r);            // 1 in the deepest carve
  // bluestone base with weathered pale patches
  float n1 = wx_vnoise(wp.xz * 1.7 + wp.y * 2.3), n2 = wx_vnoise(vec2(wp.x + wp.z, wp.y) * 7.0);
  float n3 = wx_vnoise(vec2(wp.x * 23.0 + wp.z * 23.0, wp.y * 23.0));
  vec3 base = uCarveTint.rgb * (0.85 + 0.3 * n2);
  vec3 alb = mix(base, vec3(0.19, 0.185, 0.17) * (0.9 + 0.2 * n3), smoothstep(0.45, 0.85, n1) * 0.7);
  // rain streaks running down from the top edges (darker, vertical)
  float streak = wx_vnoise(vec2((wp.x + wp.z) * 26.0, wp.y * 0.9)) * wx_vnoise(vec2((wp.x - wp.z) * 9.0, wp.y * 0.4 + 3.0));
  alb *= 1.0 - 0.35 * smoothstep(0.25, 0.6, streak);
  // lichen: ochre rosettes and white crust dots, mostly on weathered, upward / windward faces
  float lic = smoothstep(0.62, 0.8, wx_vnoise(wp.xz * 6.0 + wp.y * 4.0) * 0.6 + wx_vnoise(wp.xz * 19.0 - wp.y * 11.0) * 0.4 + (1.0 - cvT.a) * 0.3);
  alb = mix(alb, mix(vec3(0.30, 0.23, 0.09), vec3(0.24, 0.22, 0.12), n3), lic * uCarveTint.w);
  float crust = smoothstep(0.78, 0.9, wx_vnoise(wp.xz * 41.0 + wp.y * 37.0));
  alb = mix(alb, vec3(0.40, 0.40, 0.36), crust * 0.6 * uCarveTint.w);
  // carved recesses hold dust and shadow; faded vermilion pigment in the main inscription
  alb *= mix(1.0, 0.42, recess);
  alb = mix(alb, vec3(0.30, 0.045, 0.03) * (0.8 + 0.4 * n2), cvT.g * (1.0 - cvT.b) * recess * 0.85);
  // painted board (plaque): dark lacquer with grain, gilded characters and frame
  if (cvT.b > 0.5) {
    float grain = wx_vnoise(vec2(wp.x * 3.0 + wp.z * 3.0, wp.y * 90.0));
    vec3 lac = vec3(0.028, 0.022, 0.018) * (0.8 + 0.4 * grain);
    alb = mix(lac, vec3(0.50, 0.34, 0.10), cvT.g);
    cvRoughness = mix(0.62, 0.38, cvT.g); cvMetal = cvT.g * 0.75;
  } else {
    cvRoughness = mix(0.86, 0.97, recess);
  }
  // soil creeping up from the ground line
  if (wt_inWorld(wp.xz) > 0.5) {
    float hA = wp.y - wt_groundHeight(wp.xz);
    float k = 1.0 - smoothstep(0.0, 0.28 + 0.2 * n2, hA);
    alb = mix(alb, vec3(0.12, 0.095, 0.065), k * 0.8);
    alb *= mix(0.55, 1.0, smoothstep(-0.02, 0.35, hA));
  }
  diffuseColor.rgb = alb;
}
`;function d(e){let r=new n({color:16777215,roughness:.9,metalness:0,normalMap:e.normal});r.name=`props:carved`,r.normalScale.set(1,1);let i={tCarve:{value:e.carve},uCarveTint:{value:new t(.085,.092,.094,.85)}};return r.userData.uniforms=i,o(r),a(r,`wtCarved`,e=>{Object.assign(e.uniforms,i),e.fragmentShader=e.fragmentShader.replace(`void main() {`,l+`
void main() {`).replace(`#include <map_fragment>`,`#include <map_fragment>
`+u).replace(`#include <roughnessmap_fragment>`,`#include <roughnessmap_fragment>
roughnessFactor = cvRoughness;`).replace(`#include <metalnessmap_fragment>`,`#include <metalnessmap_fragment>
metalnessFactor = cvMetal;`)}),r}function f(t,n,i,a,o,s,{curveSegments:l=10,bevelSegments:u=2}={}){let d=t.getPoints(l),f=1/0,p=-1/0,m=1/0,h=-1/0;for(let e of d)f=Math.min(f,e.x),p=Math.max(p,e.x),m=Math.min(m,e.y),h=Math.max(h,e.y);let g=s.region(`stone`),_=(g.u1-g.u0)/(256/c),v=(g.v1-g.v0)/(1024/c),y=r,b=(e,t,n)=>{let r=(e-f)/(p-f),i=(t-m)/(h-m),c=n?a:o;return c?s.uv(c,n?r:1-r,i):new y(g.u0+.05*(g.u1-g.u0)+(e-f)*_,g.v0+(t-m)*v)},x=new e(t,{depth:n,bevelEnabled:i>0,bevelThickness:i,bevelSize:i,bevelSegments:u,curveSegments:l,UVGenerator:{generateTopUV(e,t,n,r,i){let a=t[n*3+2]>0;return[b(t[n*3],t[n*3+1],a),b(t[r*3],t[r*3+1],a),b(t[i*3],t[i*3+1],a)]},generateSideWallUV(e,t,n,r,a,o){let s=t[n*3],c=t[n*3+1],l=t[r*3],u=t[r*3+1],d=Math.abs(c-u)<Math.abs(s-l),p=e=>new y(g.u0+(t[e*3+2]+i+.03)*_,g.v0+((d?t[e*3]-f:t[e*3+1]-m)+.05)*v);return[p(n),p(r),p(a),p(o)]}}});return x.translate(0,0,-n/2),x.computeVertexNormals(),x.index?x.toNonIndexed():x}function p(e,t,n,r,i,a){let o=a,s=()=>(o=o*16807%2147483647,o/2147483647);for(let a=1;a<=r;a++){let o=a/(r+1);e.lineTo(t.x+(n.x-t.x)*o+(s()-.5)*i,t.y+(n.y-t.y)*o+(s()-.5)*i)}e.lineTo(n.x,n.y)}var m={w:.84,h:2.04,arch:.17,t:.22,bevel:.016,sinkIntoPlinth:.12};function h(e){let{w:t,h:n,arch:r}=m,a=t/2,o=new i;o.moveTo(-a,0),o.lineTo(a,0),o.lineTo(a,n*.62),p(o,{x:a,y:n*.62},{x:a-.012,y:n*.66},2,.01,3),o.lineTo(a-.01,n-.07),p(o,{x:a-.01,y:n-.07},{x:a-.19,y:n+r*.72},5,.022,11);let s=(a*a+r*r)/(2*r),c=n+r-s,l=Math.atan2(n+r*.72-c,a-.19),u=Math.PI-Math.atan2(n-c,a);for(let e=1;e<=16;e++){let t=l+(u-l)*(e/16);o.lineTo(Math.cos(t)*s,c+Math.sin(t)*s)}return o.lineTo(-a,n*.3),p(o,{x:-a,y:n*.3},{x:-a,y:n*.22},2,.014,5),o.lineTo(-a,0),f(o,m.t,m.bevel,`steleFront`,`steleBack`,e,{curveSegments:4,bevelSegments:2})}var g={w:1.32,d:.66,h:.46};function _(e){let{w:t,d:n,h:r}=g,a=new i,o=.08;a.moveTo(-t/2+o,-n/2),a.lineTo(t/2-o,-n/2),a.lineTo(t/2,-n/2+o),a.lineTo(t/2,n/2-o),a.lineTo(t/2-o,n/2),a.lineTo(-t/2+o,n/2),a.lineTo(-t/2,n/2-o),a.lineTo(-t/2,-n/2+o),a.lineTo(-t/2+o,-n/2);let s=f(a,r,.03,null,null,e,{bevelSegments:2});return s.rotateX(-Math.PI/2),s.translate(0,r/2,0),s}function v(e,t){let n=1.05,r=new i;return r.moveTo(-.3/2,0),r.lineTo(.3/2,0),r.lineTo(.26/2,n),r.lineTo(0,1.1400000000000001),r.lineTo(-.26/2,n),r.lineTo(-.3/2,0),f(r,.19,.012,`marker`+t%4,null,e,{bevelSegments:1})}function y(e,t){let n=.44,r=.62,a=new i;return a.moveTo(-.44/2,0),a.lineTo(n/2,0),a.lineTo(n/2,r),a.absarc(0,r,n/2,0,Math.PI,!1),a.lineTo(-.44/2,0),f(a,.12,.012,`head`+t%3,null,e,{curveSegments:10,bevelSegments:1})}export{y as a,h as c,f as i,m as n,v as o,d as r,_ as s,g as t};