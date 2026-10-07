import{no as e}from"./three.core-DtjtRha-.js";import{t}from"./atmosphere-BNENFJca.js";import{l as n}from"./wind-BKJvbr9K.js";import{a as r,d as i,l as a,n as o,o as s,r as c,s as l,t as u,u as d}from"./common-tHchggSb.js";var f=`
${t}
${u}
attribute vec3 iPos; attribute vec4 iData; attribute vec4 iCol;   // iData: age01, size m, seed, kind | iCol: rgb albedo, alpha max
varying vec2 vQ; varying vec4 vData, vCol; varying float vViewZ, vCamD; varying vec3 vWp, vAtT, vAtS, vLight, vRd; varying vec2 vSunS;
void main() {
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float ang = iData.z * 6.2832 + iData.x * (iData.z - 0.5) * 1.6;      // slow roll as it grows
  float c = cos(ang), s = sin(ang);
  vec2 q = mat2(c, -s, s, c) * position.xy;
  vec3 wp = iPos + (right * q.x + up * q.y) * iData.y;
  vQ = position.xy; vData = iData; vCol = iCol; vWp = wp;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vViewZ = -mv.z;
  vCamD = length(iPos - cameraPosition);
  vRd = normalize(iPos - cameraPosition);
  // sun direction in the sprite's (rotated) frame, for the self-shadow gradient
  vec2 ls = vec2(dot(uSunDir, right), dot(uSunDir, up));
  vSunS = mat2(c, s, -s, c) * ls;
  float sh = wx_cloudShadow(iPos);
  vLight = uSunCol * uSunVis * sh;
  vAtS = wx_applyAtmosphere(vec3(0.0), iPos);
  vAtT = wx_applyAtmosphere(vec3(1.0), iPos) - vAtS;
  vLight += fx_lamps(iPos) * 1.5;
  gl_Position = projectionMatrix * mv;
}`,p=`
${t}
${u}
${o}
varying vec2 vQ; varying vec4 vData, vCol; varying float vViewZ, vCamD; varying vec3 vWp, vAtT, vAtS, vLight, vRd; varying vec2 vSunS;
float dens(vec2 p, float seed, float age, float kind) {
  float r = length(p);
  vec2 q = p * 1.6 + seed * 17.0;
  float n = wx_fbm(q + vec2(wx_vnoise(q * 1.7 + age * 1.3), wx_vnoise(q * 1.3 - age)) * 0.9 + age * 0.4);
  return clamp(1.0 - r * 1.05 + (n - 0.5) * 1.1, 0.0, 1.0);
}
void main() {
  float age = vData.x, seed = vData.z, kind = vData.w;
  vec2 p = vQ;
  float r = length(p);
  if (r > 1.0) discard;
  vec3 col; float a;
  if (kind < 0.5) {
    // ---- dust: billowy fbm puff, self-shadowed toward the sun, forward-scatters gold when backlit
    float d = dens(p, seed, age, kind);
    float d2 = dens(p + normalize(vSunS + 1e-4) * 0.22, seed, age, kind);
    float shadow = exp(-max(d2 - d * 0.5, 0.0) * 2.2);
    float mu = dot(vRd, uSunDir);
    float phase = 0.3 + 2.8 * pow(max(mu, 0.0), 8.0) + 0.6 * pow(max(mu, 0.0), 2.0);
    vec3 fogC = wx_skyFogColor(vRd);
    col = fogC * 0.5 + vCol.rgb * fx_amb() * 0.7 + vCol.rgb * vLight * 0.22 * phase * shadow;
    a = smoothstep(0.02, 0.6, d) * vCol.a * smoothstep(0.0, 0.08, age) * pow(1.0 - age, 1.3);
    a *= fx_soft(vViewZ, 0.5) * smoothstep(0.4, 1.4, vCamD);
  } else if (kind < 1.5) {
    // ---- blood mist: fine, short-lived, red glow when backlit
    float d = dens(p * 1.2, seed, age * 1.5, kind);
    float back = pow(max(dot(vRd, uSunDir), 0.0), 4.0);
    col = vCol.rgb * (fx_amb() + vLight * 0.25) + vec3(0.7, 0.03, 0.02) * vLight * 0.18 * back * (1.0 - vCol.a * 0.0);
    a = smoothstep(0.1, 0.7, d) * 0.3 * pow(1.0 - age, 2.0) * smoothstep(0.0, 0.05, age);
    a *= fx_soft(vViewZ, 0.15);
  } else {
    // ---- ink bloom: domain-warped tendrils, pigment pooling at the rim, dissolving through a noise threshold
    vec2 q = p * 1.35 + seed * 31.0;
    vec2 w = vec2(wx_fbm(q * 1.2 + age * 0.9), wx_fbm(q * 1.2 + 5.2 - age * 0.7));
    float n = wx_fbm(q + w * 1.6 + age * 0.35);
    float shape = n * 1.25 - r * 1.05 + 0.32;
    float thr = age * 0.62;
    float m = smoothstep(thr, thr + 0.16, shape);
    float rim = smoothstep(thr, thr + 0.05, shape) * (1.0 - smoothstep(thr + 0.06, thr + 0.3, shape));
    float fil = smoothstep(0.55, 0.8, wx_fbm(q * 4.0 + w * 3.0));
    a = (m * 0.5 + rim * 0.55 + fil * m * 0.25) * vCol.a * (1.0 - smoothstep(0.55, 1.0, age)) * smoothstep(0.0, 0.05, age);
    float back = pow(max(dot(vRd, uSunDir), 0.0), 3.0);
    col = vCol.rgb * (fx_amb() * 0.6 + vLight * 0.12) * (1.0 - rim * 0.5);
    col += vCol.rgb * vec3(3.0, 0.2, 0.15) * vLight * 0.05 * back * (1.0 - m * 0.5);   // thin ink glows red against the sun
    a *= fx_soft(vViewZ, 0.25);
  }
  if (a < 0.003) discard;
  col = col * vAtT + vAtS;
  gl_FragColor = vec4(col, a);
}`;function m(t,{heightAt:o,interaction:u,pipeline:m}){let h=o,g=new c(256,17),_=a(256,{iPos:3,iData:4,iCol:4},{centered:!0}),v=s({vs:f,fs:p});t.scene.add(l(_,v,{order:12,name:`fx.soft`}));let y=new e;function b(e,t,n,r,i,a,o,s,c,l,u,f,p=0){let m=g.spawn(),h=g.d;h[m]=e,h[m+1]=t,h[m+2]=n,h[m+3]=r,h[m+4]=i,h[m+5]=a,h[m+6]=0,h[m+7]=o,h[m+8]=s,h[m+9]=c,h[m+10]=d(),h[m+11]=l,h[m+12]=u[0],h[m+13]=u[1],h[m+14]=u[2],h[m+15]=f,h[m+16]=p}let x=[.42,.33,.21];return{puff:b,dust(e,t=1){let n=Math.round(3+6*Math.min(t,1.5));for(let r=0;r<n;r++){let n=d()*Math.PI*2,r=i(.4,1.6)*t,a=i(.8,1.3)*(.7+.5*t);b(e.x+Math.cos(n)*.15,e.y+i(.05,.25),e.z+Math.sin(n)*.15,Math.cos(n)*r,i(.2,.7),Math.sin(n)*r,i(1,1.6),.3*a,1.6*a,0,x,i(.14,.24),i(.05,.2))}u?.dust?.(e.x,e.z,.6+.5*t,Math.min(t,1)),m?.fx?.dust?.(Math.min(.25*t,.6))},ring(e,t,n,r=1){let a=Math.round(12+8*r);for(let o=0;o<a;o++){let s=o/a*Math.PI*2+i(-.15,.15),c=i(5,8)*r;b(e+Math.cos(s)*.6,t+i(.1,.35),n+Math.sin(s)*.6,Math.cos(s)*c,i(.3,1),Math.sin(s)*c,i(1.1,1.7),.5,i(1.6,2.4),0,x,i(.12,.2),.1)}m?.fx?.dust?.(.5*r)},mist(e,t,n,r){let a=r?[.012,.011,.013]:[.16,.008,.007];for(let r=0;r<2+Math.round(n);r++){let r=i(.4,1.2);b(e.x,e.y,e.z,t.x*r+i(-.2,.2),t.y*r+i(0,.3),t.z*r+i(-.2,.2),i(.35,.6),.08,i(.35,.6)*(.8+.3*n),1,a,1)}},bloom(e,t,n=1,r=!1){let a=r?[.012,.011,.014]:[.1,.005,.006],o=.9+.3*n;b(e.x,e.y,e.z,t.x*.5,t.y*.5+.1,t.z*.5,i(.75,1),.3*o,1.25*o,2,a,.45),n>1.2&&b(e.x+t.x*.35,e.y+.1,e.z+t.z*.35,t.x*.9,.2,t.z*.9,i(.8,1.1),.2*o,.9*o,2,a,.35)},update(e,t){if(e<=0)return;let r=g.d;for(let i=g.n-1;i>=0;i--){let a=i*g.S;if(r[a+6]+=e,r[a+6]>=r[a+7]){g.kill(a);continue}let o=r[a+11],s=Math.exp(-(o<.5?3.2:o<1.5?3.5:2.5)*e);n(r[a],r[a+2],t,y);let c=(o<.5?.45:.25)*(1-s);r[a+3]=r[a+3]*s+y.x*c,r[a+5]=r[a+5]*s+y.y*c,r[a+4]=r[a+4]*s+r[a+16]*(1-s),r[a]+=r[a+3]*e,r[a+1]+=r[a+4]*e,r[a+2]+=r[a+5]*e;let l=h(r[a],r[a+2])+.05;r[a+1]<l&&(r[a+1]=l)}},lateUpdate(){let e=_.attributes.iPos.array,t=_.attributes.iData.array,n=_.attributes.iCol.array,i=g.d;for(let r=0;r<g.n;r++){let a=r*g.S,o=i[a+6]/i[a+7],s=1-(1-o)**2.2;e[r*3]=i[a],e[r*3+1]=i[a+1],e[r*3+2]=i[a+2],t[r*4]=o,t[r*4+1]=i[a+8]+(i[a+9]-i[a+8])*s,t[r*4+2]=i[a+10],t[r*4+3]=i[a+11],n[r*4]=i[a+12],n[r*4+1]=i[a+13],n[r*4+2]=i[a+14],n[r*4+3]=i[a+15]}r(_,g.n,[`iPos`,`iData`,`iCol`])}}}export{m as t};