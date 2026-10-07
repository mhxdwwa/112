import{A as e,Dt as t,fa as n,j as r,ro as i}from"./three.core-DtjtRha-.js";import{t as a}from"./atmosphere-BNENFJca.js";import{n as o,o as s,s as c,t as l}from"./common-tHchggSb.js";var u=10,d=40,f=40,p=82,m=.1,h=1.07,g=1/h,_=`
${a}
${l}
attribute vec4 aData;     // x along (0 newest .. 1 oldest), y across (0 hilt .. 1 outer), z abs time, w alpha*intensity
varying vec4 vData; varying vec3 vWp; varying float vViewZ; varying vec3 vT;
void main() {
  vData = aData;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vec4 mv = viewMatrix * wp;
  vViewZ = -mv.z;
  vT = wx_applyAtmosphereT(vec3(1.0), wp.xyz, 0.0);      // WX_FOG_ADD: transmittance only
  gl_Position = projectionMatrix * mv;
}`,v=`
#define WX_FOG_ADD
${a}
${l}
${o}
varying vec4 vData; varying vec3 vWp; varying float vViewZ; varying vec3 vT;
void main() {
  float x = vData.x, y = vData.y, k = vData.w;
  if (k <= 0.001) discard;
  const float yt = ${g.toFixed(4)};
  float dy = y - yt;
  // crisp outside the tip path, softer toward the hilt; a second faint echo line inside
  float edge = exp(-dy * dy / (dy > 0.0 ? 0.00045 : 0.0022));
  float echo = exp(-pow(y - yt + 0.07, 2.0) / 0.0012) * 0.25;
  float body = smoothstep(0.0, 0.85, y) * (1.0 - smoothstep(yt - 0.01, 1.0, y));
  float along = pow(1.0 - x, 2.4);
  float head = smoothstep(0.0, 0.02, x);                   // tiny fade at the very head (no hard cap)
  // air-cut streaks: fixed in swept space (abs time along, blade position across) → thin lines parallel to the motion
  float n1 = wx_vnoise(vec2(vData.z * 7.0, y * 34.0));
  float n2 = wx_vnoise(vec2(vData.z * 19.0 + 3.1, y * 81.0));
  float streak = smoothstep(0.35, 0.95, n1 * 0.65 + n2 * 0.45);
  float wisp = body * (0.12 + 0.55 * streak) * pow(1.0 - x, 1.4);
  // break the edge up toward the tail (the arc frays into air)
  edge *= mix(1.0, 0.35 + 0.9 * n2, smoothstep(0.25, 0.9, x));
  vec3 hot = fx_hotCore();
  vec3 sun = uSunCol * 0.16 + fx_amb() * 0.4;
  vec3 c = hot * 6.0 * (edge + echo) * along + mix(sun, hot * 1.4, 0.35) * wisp;
  c *= k * head;
  c *= fx_soft(vViewZ, 0.12);
  c *= vT;
  gl_FragColor = vec4(c, 1.0);
}`,y=`
${a}
${l}
${o}
varying vec4 vData; varying vec3 vWp; varying float vViewZ; varying vec3 vT;
void main() {
  float x = vData.x, y = vData.y, k = min(vData.w, 1.0);
  const float yt = ${g.toFixed(4)};
  float body = smoothstep(0.05, 0.8, y) * (1.0 - smoothstep(yt - 0.02, 1.0, y));
  float along = pow(1.0 - x, 2.0);
  float a = 0.7 * along * body * k;
  if (a < 0.004) discard;
  vec2 uv = fx_screenUv();
  vec2 g = vec2(dFdx(y), dFdy(y));
  vec2 dir = g / max(length(g), 1e-6);
  float n = wx_vnoise(vec2(vData.z * 11.0, y * 40.0));
  float amt = 0.010 * along * (0.55 + 0.9 * n) * smoothstep(0.0, 0.5, y);
  vec3 c;
  c.r = texture2D(tSceneCopy, uv + dir * amt * 1.12).r;
  c.g = texture2D(tSceneCopy, uv + dir * amt).g;
  c.b = texture2D(tSceneCopy, uv + dir * amt * 0.88).b;
  // the displaced sheet of air picks up a breath of light
  c = c * 1.04 + uSunCol * 0.004 * along;
  float soft = fx_soft(vViewZ, 0.2);
  gl_FragColor = vec4(c, a * soft);
}`;function b(e,t,n,r,i){let a=i*i,o=a*i;return .5*(2*t+(-e+n)*i+(2*e-5*t+4*n-r)*a+(-e+3*t-3*n+r)*o)}var x=class{constructor(){this.s=new Float32Array(280),this.n=0,this.head=-1,this.active=!1,this.ending=!1,this.endAt=0,this.k=1,this.win=.14,this.tOff=0,this.born=0}reset(e){this.n=0,this.head=-1,this.active=!0,this.ending=!1,this.born=e}at(e){return((this.head-(this.n-1)+e)%f+f)%f*7}push(e,t,n){if(this.n>0){let r=this.head*7;if(n-this.s[r+6]<1e-4){this.s.set([e.x,e.y,e.z,t.x,t.y,t.z,n],r);return}n<this.s[r+6]&&(this.n=0)}this.head=(this.head+1)%f,this.s.set([e.x,e.y,e.z,t.x,t.y,t.z,n],this.head*7),this.n=Math.min(this.n+1,f)}eval(e,t){let n=this.n,r=this.s,i=n-2;for(;i>0&&r[this.at(i)+6]>e;)i--;let a=this.at(i),o=this.at(Math.min(i+1,n-1)),s=this.at(Math.max(i-1,0)),c=this.at(Math.min(i+2,n-1)),l=r[a+6],u=r[o+6],d=Math.min(Math.max((e-l)/Math.max(u-l,1e-5),0),1);for(let e=0;e<6;e++)t[e]=b(r[s+e],r[a+e],r[o+e],r[c+e],d);return t}};function S(a){let o=new r,l=new Float32Array(2460),f=new Float32Array(3280),g=[];for(let e=0;e<u;e++)for(let t=0;t<d;t++){let n=e*p+t*2;g.push(n,n+1,n+3,n,n+3,n+2)}o.setIndex(g);let b=new e(l,3).setUsage(t),S=new e(f,4).setUsage(t);o.setAttribute(`position`,b),o.setAttribute(`aData`,S),o.boundingSphere=new n(new i,1e6);let C=s({vs:_,fs:y}),w=s({vs:_,fs:v,additive:!0}),T=c(o,C,{order:10,name:`trail.refract`}),E=c(o,w,{order:11,name:`trail.light`});a.scene.add(T,E);let D=Array.from({length:u},()=>new x),O=0,k=new Float32Array(6);function A(){let e=null;for(let e of D)if(!e.active)return e;for(let t of D)t.ending&&(!e||t.endAt<e.endAt)&&(e=t);return e||D[0]}function j(e,t){let n=t*p,r=e.n,i=e.active&&r>=2,a=O+e.tOff,o=e.s,s=r?o[e.at(r-1)+6]:0,c=r?o[e.at(0)+6]:0,u=1;e.ending&&(u=1-(O-e.endAt)/.16,u<=0&&(e.active=!1,i=!1));let g=e.ending?s:Math.min(a,s),_=Math.max(c,(e.ending?a:g)-e.win);if(!i||g-_<1e-4){f.fill(0,n*4,(n+p)*4),!i&&e.ending&&u<=0&&(e.active=!1);return}let v=e.k*Math.max(u,0)**1.5;for(let t=0;t<=d;t++){let r=g-(g-_)*(t/d);e.eval(r,k);let i=k[0],o=k[1],s=k[2],c=k[3],u=k[4],p=k[5],y=i+(c-i)*m,b=o+(u-o)*m,x=s+(p-s)*m,S=i+(c-i)*h,C=o+(u-o)*h,w=s+(p-s)*h,T=(n+t*2)*3;l[T]=y,l[T+1]=b,l[T+2]=x,l[T+3]=S,l[T+4]=C,l[T+5]=w;let E=Math.min((a-r)/e.win,1),D=(n+t*2)*4;f[D]=E,f[D+1]=0,f[D+2]=r,f[D+3]=v,f[D+4]=E,f[D+5]=1,f[D+6]=r,f[D+7]=v}}return{trail(e){let t=null,n={id:e,k:1,push(e,r,i){(!t||t.ending||!t.active)&&(t=A(),t.reset(O),t.k=n.k,t.win=n.k>1.1?.2:.14);let a=typeof i==`number`&&isFinite(i)?i:O;t.tOff=a-O,t.push(e,r,a)},end(){t&&!t.ending&&(t.ending=!0,t.endAt=O),t=null},setIntensity(e){n.k=e,t&&(t.k=e,t.win=e>1.1?.2:.14)},get active(){return!!t}};return n},update(e){O+=e;for(let e=0;e<u;e++)j(D[e],e);b.needsUpdate=!0,S.needsUpdate=!0},meshes:[T,E]}}export{S as n,g as t};