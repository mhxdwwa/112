import{A as e,ar as t,io as n,j as r,ta as i}from"./three.core-DtjtRha-.js";import{a,r as o,t as s}from"./globals-29H6lCK0.js";import{t as c}from"./glsl-BgzraZja.js";import{n as l}from"./noise-D9IUCAHK.js";import{i as u,t as d}from"./atmosphere-BNENFJca.js";var f=[{radius:1800,H:170,base:-70,depth:300,haze:.3,rho:4.2,snow:0,peaks:.25},{radius:2400,H:330,base:-80,depth:400,haze:.5,rho:3.6,snow:0,peaks:.45},{radius:3200,H:540,base:-40,depth:520,haze:.64,rho:3.1,snow:1,peaks:.7},{radius:4200,H:800,base:-60,depth:560,haze:.76,rho:2.6,snow:.45,peaks:1}],p=2880,m=16,h=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)};function g(e,t,n,r,i){let a=0,o=.5,s=1,c=1,l=0;for(let u=0;u<i;u++){let i=1-Math.abs(e.simplex3(t*s+u*17.3,n*s-u*9.1,r*s+u*3.7));i*=i,i*=c,c=Math.min(1,i*1.7),a+=i*o,l+=o,o*=.5,s*=2.05}return a/l}function _(e,t,n,r,i){let a=0,o=.5,s=1,c=0;for(let l=0;l<i;l++)a+=o*e.simplex3(t*s+l*5.1,n*s+l*1.7,r*s-l*2.9),c+=o,o*=.5,s*=2;return a/c}function v(t){let n=l(t),i=Math.atan2(o.x,o.z),a=i+Math.PI,s=f.length*2881*17,c=new Float32Array(s*3),u=new Float32Array(s*4),d=[],v=new Float32Array(17),y=0,b=new Float32Array(s*3);f.forEach((e,t)=>{let r=y,o=new Float32Array(48977);for(let r=0;r<=p;r++){let s=-Math.PI+r/p*Math.PI*2,l=Math.cos(s),d=Math.sin(s),f=s-i;f=Math.atan2(Math.sin(f),Math.cos(f));let b=s-a;b=Math.atan2(Math.sin(b),Math.cos(b));let x=1-.55*Math.exp(-(f/.2)*(f/.2)),S=.65+.35*h(.3,1.2,Math.abs(f)),C=Math.exp(-(b/.8)*(b/.8)),w=1+.4*e.snow*C,T=h(-.45,.55,_(n,l*e.rho*.45+t*7.7,d*e.rho*.45,t*3.3,3)),E=_(n,l*2.1+11,d*2.1,t,2)*.35,D=_(n,l*2.1-5,d*2.1,t+9,2)*.35,O=0,k=(e,t,n)=>n*Math.exp(-(e/t)*(e/t));t===3&&(O+=k(f-.42,.09,.55)+k(f+.5,.12,.42)+k(b+.9,.2,.25)),t===2&&(O+=(k(b-.2,.1,.55)+k(b+.33,.08,.4)+k(b-.62,.12,.26))*e.snow),t===1&&(O+=k(f-.95,.1,.3));let A=-1/0;for(let r=0;r<=m;r++){let i=r/m,a=g(n,(l+E)*e.rho+t*11.1,(d+D)*e.rho-t*5.3,i*1.4+t*2.7,5),o=a**1.25,s=O*(.7+.3*a),c=(.12+.66*T+.26*o*(.45+.55*T)+s)*x*S*w,u=Math.sin(Math.min(1,i*2+.04)*Math.PI/2),f=1-.6*(Math.max(0,i-.65)/.35)**2;v[r]=e.H*c*u*f,A=Math.max(A,v[r])}for(let n=0;n<=m;n++){let i=n/m,a=e.radius+i*e.depth,s=e.base+v[n];o[r*17+n]=s,c[y*3]=d*a,c[y*3+1]=s,c[y*3+2]=l*a,u[y*4]=v[n]/Math.max(A,1),u[y*4+1]=t,u[y*4+2]=C*e.snow,u[y*4+3]=v[n]/(e.H*w),y++}}let s=new Float32Array(o.length);for(let e=0;e<=p;e++)for(let t=0;t<=m;t++){let n=0,r=0;for(let i=-4;i<=4;i++){let a=(e+i+p)%p;for(let e=-1;e<=1;e++){let i=Math.min(m,Math.max(0,t+e));n+=o[a*17+i],r++}}s[e*17+t]=n/r}for(let e=0;e<=p;e++)for(let t=0;t<=m;t++){let n=r+e*17+t,i=(e-1+p)%p,a=(e+1)%p,o=Math.max(0,t-1),l=Math.min(m,t+1),u=r+i*17+t,d=r+a*17+t,f=r+e*17+o,h=r+e*17+l,g=c[d*3]-c[u*3],_=s[a*17+t]-s[i*17+t],v=c[d*3+2]-c[u*3+2],y=c[h*3]-c[f*3],x=s[e*17+l]-s[e*17+o],S=c[h*3+2]-c[f*3+2],C=x*v-S*_,w=S*g-y*v,T=y*_-x*g;w<0&&(C=-C,w=-w,T=-T);let E=1/Math.hypot(C,w,T);b[n*3]=C*E,b[n*3+1]=w*E,b[n*3+2]=T*E}for(let e=0;e<p;e++)for(let t=0;t<m;t++){let n=r+e*17+t,i=n+m+1;d.push(n,n+1,i,i,n+1,i+1)}});let x=new r;return x.setAttribute(`position`,new e(c,3)),x.setAttribute(`aMtn`,new e(u,4)),x.setAttribute(`normal`,new e(b,3)),x.setIndex(d),x.computeBoundingSphere(),x}var y=`
attribute vec4 aMtn;
varying vec3 vWp; varying vec3 vN; varying vec4 vMtn;
void main() {
  vMtn = aMtn;
  vN = normal;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`,b=`
${d}
${c(`vec3`,`uAmbK`)}${c(`float`,`uNight`)}
uniform float uHaze[4];
uniform vec4 uInk;       // ridge ink, valley mist, snow amount, alpenglow gain
varying vec3 vWp; varying vec3 vN; varying vec4 vMtn;
void main() {
  vec3 N = normalize(vN);
  float rel = clamp(vMtn.x, 0.0, 1.0);      // 0 at the foot … 1 on the local ridge line
  float relG = clamp(vMtn.w, 0.0, 1.0);     // height within the whole range
  int li = int(vMtn.y + 0.5);
  float haze0 = uHaze[li];
  vec3 rd = normalize(vWp - cameraPosition);
  // world-anchored, anisotropic 3D noise: gullies (皴) run down the slopes, never along screen columns
  vec3 wq = vWp * vec3(1.0, 0.6, 1.0);
  float gully = wx_vnoise3(wq * 0.004 + float(li) * 7.0) * 0.6 + wx_vnoise3(wq * 0.013) * 0.4;
  float rockT = smoothstep(0.45, 0.9, relG + (gully - 0.5) * 0.35);
  vec3 alb = mix(vec3(0.035, 0.05, 0.045), vec3(0.09, 0.084, 0.078), rockT);
  alb *= 0.9 + 0.2 * gully;
  // snow on the anti-solar range: caps on the summits, rock ribs showing through along the gullies
  float sn = wx_vnoise3(vWp * vec3(0.006, 0.0025, 0.006) + 3.0) * 0.65 + wx_vnoise3(vWp * vec3(0.02, 0.008, 0.02)) * 0.35;
  float snow = vMtn.z * uInk.z * smoothstep(0.7, 0.76, relG + (sn - 0.5) * 0.3 + (gully - 0.5) * 0.3) * smoothstep(0.4, 0.65, N.y + (sn - 0.5) * 0.3);
  alb = mix(alb, vec3(0.74, 0.76, 0.8), snow);
  float ndl = max(dot(N, uSunDir), 0.0);
  vec3 amb = vec3(0.30, 0.38, 0.46) * uAmbK * (0.55 + 0.45 * N.y);
  vec3 col = alb * (amb + uSunCol * ndl * 0.9);
  col += snow * uSunCol * vec3(1.0, 0.7, 0.76) * ndl * 0.12 * uInk.w;    // alpenglow on the snow
  // ink wash: toward the sun the crest is the densest ink; away from it the lit crests stay clear
  float toSun = pow(max(dot(rd, uSunDir), 0.0), 2.0);
  col *= 1.0 - uInk.x * smoothstep(0.55, 1.0, rel) * (1.0 - snow * 0.8) * (0.3 + 0.7 * toSun);
  float mistEdge = 0.42 + 0.22 * wx_vnoise(vWp.xz * 0.0011 + float(li) * 3.1) + 0.1 * wx_vnoise(vWp.xz * 0.006 + 1.5);
  float valley = (1.0 - smoothstep(mistEdge - 0.3, mistEdge + 0.12, rel)) * uInk.y;
  float haze0v = haze0 * mix(0.78, 1.08, toSun);                        // clearer air looking away from the sun
  float haze = haze0v + (1.0 - haze0v) * max(valley, (1.0 - smoothstep(0.0, 0.5, relG)) * 0.35);
  haze = min(haze + (1.0 - relG) * 0.05, 0.985);
  haze *= 1.0 - snow * 0.25;                                             // bright snow punches through the haze
  vec3 fc = wx_skyFogColor(normalize(vec3(rd.x, max(rd.y, -0.05), rd.z)));
  col = mix(col, fc, haze);
  gl_FragColor = vec4(col, 1.0);
}
`;function x(e,{seed:r=a.seed+404}={}){let o=v(r),c=new i({name:`mountains`,uniforms:{...u(),uAmbK:s.uAmbK,uNight:s.uNight,uHaze:{value:f.map(e=>e.haze)},uInk:{value:new n(.28,.85,1,1)}},vertexShader:y,fragmentShader:b,fog:!1}),l=new t(o,c);return l.name=`mountains`,l.renderOrder=5,l.frustumCulled=!1,l.matrixAutoUpdate=!1,l.updateMatrix(),e.scene.add(l),{mesh:l,material:c,layers:f}}export{f as MOUNTAIN_LAYERS,x as createMountains};