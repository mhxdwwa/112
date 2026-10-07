import{$r as e,Ja as t,Rn as n,Wi as r,ft as i,no as a}from"./three.core-DtjtRha-.js";import{t as o}from"./globals-29H6lCK0.js";import{t as s}from"./glsl-BgzraZja.js";import{r as c}from"./noise-D9IUCAHK.js";var l=256;function u(){let e=new Uint8Array(l*l*4),t=e=>{let t=new Float32Array(l*l),n=.5,r=0;for(let i=0;i<4;i++){let a=8<<i,o=c(e+i*101),s=new Float32Array(a*a);for(let e=0;e<s.length;e++)s[e]=o();let u=l/a;for(let e=0;e<l;e++){let r=e/u,i=Math.floor(r),o=r-i,c=o*o*(3-2*o),d=i%a,f=(i+1)%a;for(let r=0;r<l;r++){let i=r/u,o=Math.floor(i),p=i-o,m=p*p*(3-2*p),h=o%a,g=(o+1)%a,_=s[d*a+h],v=s[d*a+g],y=s[f*a+h],b=s[f*a+g];t[e*l+r]+=n*(_+(v-_)*m+(y+(b-y)*m-(_+(v-_)*m))*c)}}r+=n,n*=.5}let i=1/0,a=-1/0;for(let e=0;e<t.length;e++)t[e]/=r,i=Math.min(i,t[e]),a=Math.max(a,t[e]);for(let e=0;e<t.length;e++)t[e]=(t[e]-i)/(a-i);return t},n=t(9001),r=t(4242);for(let t=0;t<l*l;t++)e[t*4]=Math.round(n[t]*255),e[t*4+1]=Math.round(r[t]*255),e[t*4+2]=0,e[t*4+3]=255;return e}var d=u(),f=new i(d,l,l,e,t);f.wrapS=f.wrapT=r,f.magFilter=n,f.minFilter=n,f.generateMipmaps=!1,f.colorSpace=``,f.needsUpdate=!0,o.tWindNoise.value=f;function p(e,t,n=0){let r=e*l-.5,i=t*l-.5,a=Math.floor(r),o=Math.floor(i),s=r-a,c=i-o,u=(a%l+l)%l,f=(u+1)%l,p=(o%l+l)%l,m=(p+1)%l,h=d[(p*l+u)*4+n],g=d[(p*l+f)*4+n],_=d[(m*l+u)*4+n],v=d[(m*l+f)*4+n];return((h+(g-h)*s)*(1-c)+(_+(v-_)*s)*c)/255}var m=`
#ifndef WX_WIND
#define WX_WIND
${s(`float`,`uTime`)}${s(`vec4`,`uWind`)}${s(`sampler2D`,`tWindNoise`)}// gust fronts: λ≈126 m, travelling downwind; cat's-paw puffs 5–15 m drifting at 9 m/s
float windGust(vec3 wp) {
  float along = dot(wp.xz, uWind.xy);
  float g = 0.55 + 0.45 * sin(uTime * 0.6 - along * 0.05) * (0.6 + 0.4 * sin(uTime * 0.19 + wp.x * 0.011 - wp.z * 0.013));
  float n = texture2D(tWindNoise, (wp.xz - uWind.xy * uTime * 9.0) / 46.0).r;
  return max(g * (0.6 + 0.8 * n), 0.08) * uWind.z;
}
// sway wave travels DOWNWIND (−k·along); returns a world-space horizontal displacement direction * amount
vec3 windSway(vec3 wp, float flex, float phase) {
  float g = windGust(wp), t = uTime, along = dot(wp.xz, uWind.xy);
  float s = sin(t * 1.7 - along * 0.7 + phase) * 0.55 + sin(t * 2.9 - along * 1.3 + phase * 1.9) * 0.20;
  vec3 dir = vec3(uWind.x, 0.0, uWind.y), side = vec3(-uWind.y, 0.0, uWind.x);
  return (dir * (0.55 + s) * g + side * sin(t * 1.7 + phase * 2.3) * 0.18 * g) * flex;
}
// high-frequency flutter (leaves, cloth edges): -1..1
float windFlutter(vec3 wp, float t) {
  return texture2D(tWindNoise, wp.xz / 7.0 + vec2(t * 0.9, t * 0.37)).g * 2.0 - 1.0;
}
#endif
`;function h(){return{uTime:o.uTime,uWind:o.uWind,tWindNoise:o.tWindNoise}}function g(e,t,n=o.uTime.value){let r=o.uWind.value,i=e*r.x+t*r.y,a=.55+.45*Math.sin(n*.6-i*.05)*(.6+.4*Math.sin(n*.19+e*.011-t*.013)),s=p((e-r.x*n*9)/46,(t-r.y*n*9)/46,0);return Math.max(a*(.6+.8*s),.08)*r.z}function _(e,t,n=o.uTime.value){return p(e/7+n*.9,t/7+n*.37,1)*2-1}function v(e,t,n=o.uTime.value,r=new a){let i=o.uWind.value,s=g(e,t,n);return r.set(i.x*s,i.y*s)}var y={from:1,to:1,t:0,dur:0};function b(e,t=.6){Object.assign(y,{from:o.uWind.value.z,to:e,t:0,dur:Math.max(t,.001)})}function x(e){if(y.t<y.dur){y.t=Math.min(y.dur,y.t+e);let t=y.t/y.dur;o.uWind.value.z=y.from+(y.to-y.from)*(t*t*(3-2*t))}}export{x as a,h as c,b as i,v as l,m as n,_ as o,p as r,g as s,d as t};