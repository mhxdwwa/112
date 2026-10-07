import{n as e}from"./three.module-YNTH5p0u.js";import{t}from"./globals-29H6lCK0.js";import{t as n}from"./glsl-BgzraZja.js";import{t as r}from"./noise-D9IUCAHK.js";t.uSunDirTrue??={value:t.uSunDir.value.clone()},t.uGroundY??={value:0};var i=`
#ifndef WX_ATMOS
#define WX_ATMOS
${n(`vec3`,`uSunDir`)}${n(`vec3`,`uSunDirTrue`)}${n(`vec3`,`uSunCol`)}${n(`vec3`,`uFogCool`)}${n(`vec3`,`uFogWarm`)}
${n(`vec4`,`uFogParams`)}${n(`float`,`uMist`)}${n(`vec3`,`uCamPos`)}${n(`float`,`uTime`)}${n(`float`,`uStorm`)}
${n(`float`,`uFlash`)}${n(`vec3`,`uFlashDir`)}${n(`vec4`,`uWind`)}${n(`vec4`,`uCloudShadow`)}${n(`vec3`,`uHorizonGlow`)}
${n(`sampler2D`,`tHeight`)}${n(`sampler2D`,`tGround`)}${n(`vec4`,`uWorldRect`)}${n(`float`,`uGroundY`)}
${r}
float wx_ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

// 3-octave value fBm (weights .55/.28/.17): blobby, soft, no lattice artefacts -> painted clouds and cloud shadows.
float wx_fbm3v(vec2 p) {
  const mat2 R = mat2(0.8, -0.6, 0.6, 0.8);
  float s = 0.55 * wx_vnoise(p);
  p = R * p * 2.02 + 3.17; s += 0.28 * wx_vnoise(p);
  p = R * p * 2.03 + 7.71; s += 0.17 * wx_vnoise(p);
  return s;
}

// The real sun (drives the warm/cool split and the horizon afterglow even after sunset). Falls back to the key.
vec3 wx_sunTrue() { return dot(uSunDirTrue, uSunDirTrue) > 0.5 ? uSunDirTrue : uSunDir; }

// Directional fog colour: cool blue-grey away from the sun, amber toward it (half-width ~41 deg), lightning tint.
vec3 wx_fogBase(vec3 rd) {
  float s = max(dot(rd, wx_sunTrue()), 0.0);
  float warm = clamp(pow(s, 2.5) * 0.95 + 0.06, 0.0, 1.0);
  vec3 c = mix(uFogCool, uFogWarm, warm);
  c += vec3(0.5, 0.58, 0.8) * uFlash * (0.05 + 0.45 * pow(max(dot(rd, uFlashDir), 0.0), 4.0));
  return c;
}

// Forward-scatter lobes round the key light (30 / 13 / 4.5 deg, the wide one smeared along the horizon) plus the
// warm band hugging the whole horizon. Shared by sky AND fog so fogged geometry dissolves into the sky seamlessly.
vec3 wx_sunGlow(vec3 rd) {
  float clear = 1.0 - uStorm;
  float s = max(dot(rd, uSunDir), 0.0);
  float band = exp(-max(rd.y, 0.0) * 7.0);
  float s5 = s * s; s5 *= s5 * s;
  float s48 = pow(s, 48.0);
  // wide lobe: the long slant path along the horizon reddens it (orange smear); halo (~10 deg) + aureole (~4 deg):
  // whiter, yellow-gold. Kept tight so the sky 20+ deg above the sun stays clean blue, not greige.
  vec3 g = uSunCol * vec3(1.0, 0.52, 0.22) * s5 * (0.075 * band + 0.010)
         + uSunCol * vec3(1.0, 0.74, 0.48) * (s48 * 0.12 + s48 * pow(s, 172.0) * 0.55);
  g *= 0.25 + 0.75 * clear;
  float st = max(dot(rd, wx_sunTrue()), 0.0);
  g += uHorizonGlow * band * 0.10 * (0.3 + 0.7 * st * sqrt(st)) * clear;
  return g;
}

vec3 wx_skyFogColor(vec3 rd) { return wx_fogBase(rd) + wx_sunGlow(rd); }

// Cloud shadow: project along the sun ray to the deck, drift downwind. ~30% of the plain shadowed at x = 0.5.
float wx_cloudShadow(vec3 wp) {
  if (uCloudShadow.x <= 0.0) return 1.0;
  vec2 p = wp.xz + uSunDir.xz / max(uSunDir.y, 0.08) * (uCloudShadow.y - wp.y);
  p = (p - uWind.xy * uTime * uCloudShadow.w) * uCloudShadow.z;
  float n = wx_fbm3v(p) * 0.8 + wx_vnoise(p * 3.7) * 0.2;
  return 1.0 - uCloudShadow.x * smoothstep(0.52, 0.74, n);
}

// Ground height from the terrain bake (R32F, NEAREST) with manual bilinear. texel (i,j) <-> world
// x = rect.x + (i+.5)*rect.z/N, z = rect.y + (j+.5)*rect.z/N.
float wx_groundHeight(vec2 xz, float fallback) {
  ivec2 sz = textureSize(tHeight, 0);
  if (sz.x < 4) return fallback;
  vec2 uv = (xz - uWorldRect.xy) * uWorldRect.w;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return fallback;
  vec2 p = uv * vec2(sz) - 0.5;
  ivec2 i0 = ivec2(floor(p)), mx = sz - 1;
  vec2 f = p - floor(p);
  float a = texelFetch(tHeight, clamp(i0, ivec2(0), mx), 0).r;
  float b = texelFetch(tHeight, clamp(i0 + ivec2(1, 0), ivec2(0), mx), 0).r;
  float c = texelFetch(tHeight, clamp(i0 + ivec2(0, 1), ivec2(0), mx), 0).r;
  float d = texelFetch(tHeight, clamp(i0 + ivec2(1, 1), ivec2(0), mx), 0).r;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// R grass density, G height factor, B moisture, A cavity AO (1 on ridges, ~.5 in dips).
vec4 wx_groundInfo(vec2 xz) {
  if (textureSize(tGround, 0).x < 4) return vec4(0.6, 0.6, 0.3, 0.82);
  vec2 uv = (xz - uWorldRect.xy) * uWorldRect.w;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0, 0.5, 0.3, 1.0);
  return texture2D(tGround, uv);
}

// Low evening mist: lives in the lowest few metres above the ground, pools in hollows, breaks into drifting banks.
float wx_mistTau(vec3 wp, vec3 ro) {
  if (uMist <= 0.0) return 0.0;
  float hollow = 1.0 - wx_groundInfo(wp.xz).a;
  float hAbove = wp.y - wx_groundHeight(wp.xz, uGroundY);
  float my = clamp(1.0 - hAbove / (2.5 + 4.0 * hollow), 0.0, 1.0);
  float mn = wx_vnoise(wp.xz * 0.035 + uWind.xy * uTime * 0.12) * 1.3 - 0.35 + hollow * 0.6;
  return uMist * my * my * max(mn + uStorm * 0.25, 0.0) * min(length(wp - ro), 140.0) * 0.0042;
}

// Aerial perspective: exact integral of exponential height fog + linear haze + ground mist, coloured by the
// view-dependent sky in-scatter. Additive materials (#define WX_FOG_ADD) are only attenuated.
vec3 wx_applyAtmosphereT(vec3 col, vec3 wp, float mistTau) {
  vec3 ro = uCamPos;
  vec3 dv = wp - ro;
  float dist = length(dv);
  vec3 rd = dv / max(dist, 1e-3);
  float fall = uFogParams.y, k = fall * dv.y;
  float fh = uFogParams.x * exp(-fall * (ro.y - uFogParams.z)) * dist * (abs(k) > 1e-3 ? (1.0 - exp(-k)) / k : 1.0);
  float T = exp(-(fh + uFogParams.w * dist + mistTau));
#ifdef WX_FOG_ADD
  return col * T;
#else
  // In-scatter: the directional fog colour, plus the sun lobes weighted by (1-T)^2 — near air is lit by the
  // shadowed volumetric pass (post), far air converges to exactly the sky's horizon colour (seamless).
  vec3 fd = normalize(vec3(rd.x, max(rd.y, -0.05), rd.z));
  float F = 1.0 - T;
  vec3 fc = wx_fogBase(fd) * F + wx_sunGlow(fd) * F * F;
  fc += uSunCol * 0.04 * mistTau * pow(max(dot(rd, uSunDir), 0.0), 3.0) * F;   // mist glows where the sun rakes it
  return col * T + fc;
#endif
}
vec3 wx_applyAtmosphere(vec3 col, vec3 wp) { return wx_applyAtmosphereT(col, wp, wx_mistTau(wp, uCamPos)); }
#endif
`;function a(){return{uSunDir:t.uSunDir,uSunDirTrue:t.uSunDirTrue,uSunCol:t.uSunCol,uFogCool:t.uFogCool,uFogWarm:t.uFogWarm,uFogParams:t.uFogParams,uMist:t.uMist,uCamPos:t.uCamPos,uTime:t.uTime,uStorm:t.uStorm,uFlash:t.uFlash,uFlashDir:t.uFlashDir,uWind:t.uWind,uCloudShadow:t.uCloudShadow,uHorizonGlow:t.uHorizonGlow,tHeight:t.tHeight,tGround:t.tGround,uWorldRect:t.uWorldRect,uGroundY:t.uGroundY}}function o(e){for(let n in t)n in e||(e[n]=t[n]);return e}var s=e=>e.blending===2;function c(e,t,n){let r=e.userData;if(!r.wxHooks){r.wxHooks=[];let t=e.onBeforeCompile,n=e.customProgramCacheKey,i=Object.prototype.hasOwnProperty.call(e,`onBeforeCompile`)&&typeof t==`function`,a=Object.prototype.hasOwnProperty.call(e,`customProgramCacheKey`);e.onBeforeCompile=(n,a)=>{l.call(e,n,a),i&&t.call(e,n,a);for(let t of r.wxHooks)t.fn(n,e,a)},e.customProgramCacheKey=()=>(a?n.call(e):``)+`|`+r.wxHooks.map(e=>e.key).join(`|`)+(s(e)?`|add`:``)}return r.wxHooks.some(e=>e.key===t)||r.wxHooks.push({key:t,fn:n}),e.needsUpdate=!0,e}function l(e){this&&this.isShaderMaterial||(o(e.uniforms),this&&s(this)&&(e.defines=Object.assign({},e.defines,{WX_FOG_ADD:``})))}var u=`
{
  vec4 wxWp = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    wxWp = batchingMatrix * wxWp;
  #endif
  #ifdef USE_INSTANCING
    wxWp = instanceMatrix * wxWp;
  #endif
  vWxWorldPos = (modelMatrix * wxWp).xyz;
}
`;function d(e){return c(e,`wxWorldPos`,e=>{e.vertexShader.includes(`varying vec3 vWxWorldPos`)||(e.vertexShader=`varying vec3 vWxWorldPos;
`+e.vertexShader.replace(`#include <project_vertex>`,`#include <project_vertex>
`+u),e.fragmentShader=`varying vec3 vWxWorldPos;
`+e.fragmentShader)})}var f=()=>e.fog_fragment.includes(`wx_applyAtmosphere`);function p(e,t={},n){if(typeof t==`string`)return p(e,{}),n&&c(e,t,n),e;let{fog:r=!0,wetBias:a}=t,s=e.userData;return s.uWetBias??={value:0},a!==void 0&&(s.uWetBias.value=a),d(e),c(e,`wxG`,e=>{o(e.uniforms),e.uniforms.uWetBias=s.uWetBias}),e.fog!==r&&(e.fog=r,e.needsUpdate=!0),r&&c(e,`wxAtmos`,e=>{if(f()){e.defines=Object.assign({},e.defines,{WX_ATMOS_ON:``});return}e.fragmentShader=e.fragmentShader.replace(`void main() {`,i+`
void main() {`).replace(`#include <fog_fragment>`,`gl_FragColor.rgb = wx_applyAtmosphere(gl_FragColor.rgb, vWxWorldPos);`)}),s.wxPatched=!0,e}export{l as a,a as i,c as n,o,d as r,p as s,i as t};