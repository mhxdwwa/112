import{Dt as e,Lt as t,an as n,ar as r,fa as i,in as a,no as o,ro as s,ta as c}from"./three.core-DtjtRha-.js";import{n as l,t as u}from"./globals-29H6lCK0.js";import{t as d}from"./glsl-BgzraZja.js";u.tSceneCopy??={value:null},u.uCamNearFar??={value:new o(.3,7e3)};var f=`
#ifndef WX_FX_COMMON
#define WX_FX_COMMON
${d(`vec2`,`uResolution`)}${d(`vec4`,`uLamps`,`[8]`)}${d(`vec3`,`uLampC`,`[8]`)}${d(`int`,`uLampN`)}
${d(`float`,`uLampOn`)}${d(`vec3`,`uSkyUp`)}${d(`vec3`,`uAmbK`)}${d(`float`,`uNight`)}${d(`float`,`uRain`)}
${d(`float`,`uSunVis`)}
// virtual lamps (same falloff as the lit materials: w / (d² + .35), 30 m cut), as irradiance / π
vec3 fx_lamps(vec3 wp) {
  vec3 s = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    if (i >= uLampN) break;
    vec4 lp = uLamps[i];
    vec3 d = lp.xyz - wp; float d2 = dot(d, d);
    if (d2 > 900.0 || lp.w <= 0.0) continue;
    s += uLampC[i] * (lp.w * uLampOn / (d2 + 0.35) * (1.0 - smoothstep(400.0, 900.0, d2)));
  }
  return s * 0.3183;
}
// sky ambient for small diffuse bits (hemisphere average)
vec3 fx_amb() { return (uSkyUp * 0.85 + uFogCool * 0.25) * uAmbK; }
// hue of the key light at unit peak: golden (1,.63,.31) at sunset, cold at blue hour
vec3 fx_sunHue() { return uSunCol / max(max(uSunCol.r, max(uSunCol.g, uSunCol.b)), 1e-3); }
float fx_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// HDR blade/qi core colour: warm white in daylight, steel-white at blue hour/night
vec3 fx_hotCore() { return mix(mix(vec3(1.0, 0.86, 0.66), fx_sunHue() * vec3(1.0, 1.1, 1.3), 0.25), vec3(0.8, 0.9, 1.0), clamp(uNight, 0.0, 1.0)); }
#endif
`,p=`
#ifndef WX_FX_FRAG
#define WX_FX_FRAG
${d(`sampler2D`,`tSceneCopy`)}
vec2 fx_screenUv() { return gl_FragCoord.xy / uResolution; }
float fx_sceneZ(vec2 uv) { float z = texture2D(tSceneCopy, uv).a; return z <= 0.0 ? 1e5 : z; }
float fx_soft(float viewZ, float range) { return clamp((fx_sceneZ(fx_screenUv()) - viewZ) / range, 0.0, 1.0); }
#endif
`;function m(e={}){return{...u,...e}}function h({vs:e,fs:t,uniforms:n={},additive:r=!1,blending:i,depthTest:a=!0,depthWrite:o=!1,side:s=2,defines:l={},transparent:u=!0,alphaToCoverage:d=!1}){let f=new c({vertexShader:e,fragmentShader:t,uniforms:m(n),defines:l,transparent:u,depthTest:a,depthWrite:o,side:s,alphaToCoverage:d,blending:i??(r?2:1)});return f.fog=!1,f.lights=!1,f.toneMapped=!1,f}function g(e,t,{layer:n=l.TRANSPARENT,order:i=0,name:a}={}){let o=new r(e,t);return o.layers.set(n),o.frustumCulled=!1,o.renderOrder=i,o.castShadow=!1,o.receiveShadow=!1,o.matrixAutoUpdate=!1,a&&(o.name=a),o}function _(r,o,{centered:c=!1,rows:l=1}={}){let u=new n,d=[],f=[];for(let e=0;e<=l;e++){let t=e/l;if(d.push(-1,c?t*2-1:t,0,1,c?t*2-1:t,0),e<l){let t=e*2;f.push(t,t+1,t+3,t,t+3,t+2)}}u.setAttribute(`position`,new t(d,3)),u.setIndex(f);for(let[t,n]of Object.entries(o)){let i=new a(new Float32Array(r*n),n);i.setUsage(e),u.setAttribute(t,i)}return u.instanceCount=0,u.boundingSphere=new i(new s,1e6),u}var v=class{constructor(e,t){this.cap=e,this.S=t,this.d=new Float32Array(e*t),this.n=0,this.rr=0}spawn(){return this.n<this.cap?this.n++*this.S:(this.rr=(this.rr+1)%this.cap,this.rr*this.S)}kill(e){let t=--this.n*this.S;e!==t&&this.d.copyWithin(e,t,t+this.S)}};function y(e,t,n){if(e.instanceCount=t,t)for(let r of n){let n=e.attributes[r];n.clearUpdateRanges(),n.addUpdateRange(0,t*n.itemSize),n.needsUpdate=!0}}var b=2654435769;function x(){return b^=b<<13,b^=b>>>17,b^=b<<5,(b>>>0)%1e7/1e7}var S=(e,t)=>e+(t-e)*x();function C(e,t,n){let r=1-x()*(1-Math.cos(t)),i=Math.sqrt(1-r*r),a=x()*Math.PI*2,o=e.x,s=e.y,c=e.z,l,u,d;Math.abs(s)<.9?(l=-c,u=0,d=o):(l=0,u=c,d=-s);let f=Math.hypot(l,u,d)||1;l/=f,u/=f,d/=f;let p=s*d-c*u,m=c*l-o*d,h=o*u-s*l,g=Math.cos(a)*i,_=Math.sin(a)*i;return n.set(o*r+l*g+p*_,s*r+u*g+m*_,c*r+d*g+h*_)}export{y as a,m as c,S as d,C as i,_ as l,p as n,h as o,v as r,g as s,f as t,x as u};