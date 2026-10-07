import{Lt as e,Z as t,ar as n,ct as r,j as i,jr as a,mr as o,no as s,ro as c}from"./three.core-DtjtRha-.js";import{t as l}from"./atmosphere-BNENFJca.js";import{l as u}from"./wind-BKJvbr9K.js";import{t as d}from"./lamps-BoRlsdIe.js";import{t as f}from"./BufferGeometryUtils-WOx_-h3q.js";import{a as p,d as m,i as h,l as g,n as _,o as v,r as y,s as b,t as x,u as S}from"./common-tHchggSb.js";import{t as C}from"./particles-BCUThc7i.js";import{t as w}from"./soft-C8zbifuU.js";import{n as T}from"./trail-3mQTUeeM.js";var E=`
${l}
${x}
attribute vec3 iPos; attribute vec4 iRot; attribute vec4 iCol;   // iRot: axis xyz, angle · iCol: rgb, age01
attribute vec2 iSize;
varying vec3 vWp, vN, vCol; varying vec2 vUv; varying float vAge;
vec3 rotAA(vec3 v, vec3 a, float t) { float c = cos(t), s = sin(t); return v * c + cross(a, v) * s + a * dot(a, v) * (1.0 - c); }
void main() {
  vec3 ax = normalize(iRot.xyz + vec3(1e-4));
  vec3 p = vec3(position.x * iSize.x, (position.y - 0.5) * iSize.y, 0.0);
  p.z += position.x * position.x * iSize.x * 0.35;          // slight cupping
  vec3 wp = iPos + rotAA(p, ax, iRot.w);
  vN = rotAA(vec3(0.0, 0.0, 1.0), ax, iRot.w);
  vWp = wp; vCol = iCol.rgb; vAge = iCol.a; vUv = vec2(position.x * 0.5 + 0.5, position.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`,D=`
${l}
${x}
varying vec3 vWp, vN, vCol; varying vec2 vUv; varying float vAge;
void main() {
  // leaf/blade silhouette: pointed ellipse
  float w = 1.0 - pow(abs(vUv.y * 2.0 - 1.0), 1.6);
  if (abs(vUv.x * 2.0 - 1.0) > w) discard;
  vec3 V = normalize(cameraPosition - vWp);
  vec3 N = normalize(vN); if (dot(N, V) < 0.0) N = -N;
  float ndl = max(dot(N, uSunDir), 0.0);
  float back = pow(max(dot(-V, uSunDir), 0.0), 4.0);
  vec3 col = vCol * (uSunCol * (ndl * 0.32 + back * 0.9) + fx_amb() * 0.9) + vCol * fx_lamps(vWp);
  col = wx_applyAtmosphere(col, vWp);
  float a = 1.0 - smoothstep(0.75, 1.0, vAge);
  gl_FragColor = vec4(col, a);
}`,O=`
${l}
varying vec2 vUv; varying vec3 vWp;
void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWp = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,k=`
${l}
${x}
${_}
uniform float uAge, uLife, uTimeQ;
varying vec2 vUv; varying vec3 vWp;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
  // u: along the arc (0..1), v: across (0 inner .. 1 outer edge)
  float along = sin(vUv.x * 3.14159);                         // tapered ends
  float edge = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
  float streak = n2(vec2(vUv.x * 14.0 - uTimeQ * 9.0, vUv.y * 3.0)) * 0.6 + 0.4;
  float core = exp(-pow((vUv.y - 0.62) * 7.0, 2.0));
  float k = along * (edge * streak * 0.8 + core * 1.4);
  float life = 1.0 - smoothstep(0.55, 1.0, uAge / uLife);
  float born = smoothstep(0.0, 0.06, uAge);
  vec3 col = fx_hotCore() * (2.2 + 5.0 * core) * k * life * born;
  // ink-wash fringe: a darker, cooler rim on the trailing side
  col = mix(col, col * vec3(0.6, 0.75, 1.0), 1.0 - vUv.y);
  gl_FragColor = vec4(col, 1.0);
}`;function A(t=1.7,n=.55,r=2.1,a=36){let o=[],s=[],c=[];for(let e=0;e<=a;e++){let i=e/a,l=(i-.5)*r,u=Math.cos(l);for(let e=0;e<=1;e++){let r=t-n*(1-e)*(.3+.7*Math.sin(i*Math.PI));o.push(Math.sin(l)*r,0,u*r-t*.72),s.push(i,e)}if(e<a){let t=e*2;c.push(t,t+1,t+3,t,t+3,t+2)}}let l=new i;return l.setAttribute(`position`,new e(o,3)),l.setAttribute(`uv`,new e(s,2)),l.setIndex(c),l}function j(e,{interaction:i}={}){let l=(t,n)=>e.world.heightAt(t,n),_=T(e),x=C(e,{interaction:i,lamps:d,heightAt:l}),j=w(e,{heightAt:l,interaction:i,pipeline:e.pipeline}),M=new y(700,16),N=new Float32Array(1400),P=g(700,{iPos:3,iRot:4,iCol:4,iSize:2}),F=v({vs:E,fs:D,depthWrite:!0,transparent:!0});e.scene.add(b(P,F,{order:12,name:`fx.debris`}));let I=new c,L=new s,R=new c(0,1,0);function z(e,t,n,r,i,a,o){let s=M.spawn(),c=M.d,l=s/M.S;c[s]=e.x,c[s+1]=e.y,c[s+2]=e.z,c[s+3]=t.x,c[s+4]=t.y,c[s+5]=t.z,c[s+6]=0,c[s+7]=n,h(R,Math.PI,I),c[s+8]=I.x,c[s+9]=I.y,c[s+10]=I.z,c[s+11]=S()*6.28,c[s+12]=o,c[s+13]=r[0],c[s+14]=r[1],c[s+15]=r[2],N[l*2]=i,N[l*2+1]=a}let B=[[.62,.46,.16],[.35,.27,.1],[.78,.66,.36],[.3,.34,.09]],V=[[.62,.4,.06],[.9,.66,.16],[.75,.52,.1]],H=A(),U=()=>v({vs:O,fs:k,additive:!0,uniforms:{uAge:{value:0},uLife:{value:.8},uTimeQ:{value:0}}}),W=new n(H,U());W.name=`fx.qi.keep`,W.layers.set(1),W.frustumCulled=!1,W.scale.setScalar(1e-4),W.material.uniforms.uAge.value=10,W.position.set(0,-1e3,0),e.scene.add(W);let G=[],K=(()=>{let e=new r(.0045,.0045,.78,6,1,!0);e.rotateX(Math.PI/2);let n=new t(.011,.07,6);n.rotateX(Math.PI/2),n.translate(0,0,.42);let i=[];for(let e=0;e<3;e++){let t=new a(.028,.11);t.translate(.016,0,-.32),t.rotateZ(e*Math.PI*2/3),i.push(t)}let o=e=>(e.deleteAttribute(`uv`),e.index?e.toNonIndexed():e);return f([e,n,...i].map(o))})(),q=new o({color:5916210,roughness:.7,metalness:.1,side:2}),J=new c(0,0,1),Y=new c,X=new n(K,q);X.name=`fx.arrow.keep`,X.layers.set(2),X.frustumCulled=!1,X.position.set(0,-1e3,0),e.scene.add(X);let Z={arrow(t,r,i=1){let a=new n(K,q);i!==1&&a.scale.setScalar(i),a.layers.set(2),a.frustumCulled=!1,a.name=`fx.arrow`,e.scene.add(a);let o={update(e,t){a.position.copy(e),t.lengthSq()>1e-6&&a.quaternion.setFromUnitVectors(J,Y.copy(t).normalize())},dispose(){a.removeFromParent()}};return o.update(t,r),o},trail:e=>_.trail(e),sparks:(e,t,n)=>x.sparks(e,t,n),hitGlow:(e,t,n)=>x.hitGlow(e,t,n),dust:(e,t=1)=>j.dust(e,t),blood(e,t,n=1,r=!1){I.copy(t??R),I.lengthSq()<1e-6&&I.set(1,0,0),I.normalize(),x.droplets(e,I,Math.round((r?10:18)*n),r),j.mist(e,I,Math.min(n,1.4)*.7,r),r&&j.bloom(e,I,Math.min(n,1.2)*.6,r),i?.stain?.(e.x+I.x*.8,e.z+I.z*.8,.5+.35*n,Math.min(1,.5*n))},clippings(e=[],t){I.copy(t??R),I.y=0,I.lengthSq()<1e-6&&I.set(1,0,0),I.normalize();for(let t of e)for(let e=0;e<6;e++)z(t,new c(I.x*m(1,4)+m(-.8,.8),m(1.2,3.2),I.z*m(1,4)+m(-.8,.8)),m(1.4,2.4),B[S()*B.length|0],m(.006,.012),m(.07,.16),m(6,16))},leafBurst(e,t=30){for(let n=0;n<t;n++){h(R,1.2,I);let t=I.clone().multiplyScalar(m(1.5,4.5));t.y*=.8,z(e,t,m(2.5,4.5),V[S()*V.length|0],m(.02,.035),m(.04,.07),m(2,7))}},shockwave(e,t,n=1){let r=l(e,t);j.ring(e,r,t,n),i?.shock?.(e,t,n),d.flash(new c(e,r+.5,t),[1,.7,.4],2+2*n,.15)},qiWave(t,r){let a=U(),o=new n(H,a);o.layers.set(1),o.frustumCulled=!1,o.renderOrder=25;let s=new c(r.x,0,r.z).normalize();o.position.copy(t),o.quaternion.setFromUnitVectors(new c(0,0,1),s),o.rotateZ(-.35),e.scene.add(o);let u=d.add({pos:t.clone(),color:[.9,.85,.7],weight:6}),f={mesh:o,mat:a,light:u,age:0,life:.8,speed:24,dir:s,pos:o.position,dead:!1,last:t.clone(),update(e){if(f.dead)return;f.age+=e,f.last.copy(o.position),o.position.addScaledVector(s,f.speed*e),a.uniforms.uAge.value=f.age,a.uniforms.uTimeQ.value+=e,u.pos.copy(o.position),u.weight=6*(1-f.age/f.life);let t=o.position,n=new c(-s.z,0,s.x).multiplyScalar(1.4);i?.cut?.(t.x-n.x,t.z-n.z,t.x+n.x,t.z+n.z,.8),(f.age*20|0)%2==0&&i?.slash?.(f.last.x-n.x,f.last.z-n.z,t.x+n.x,t.z+n.z,1.2,1),S()<.5&&Z.clippings([t.clone().setY(l(t.x,t.z)+.4)],s),f.age>=f.life&&f.dispose()},dispose(){if(f.dead)return;f.dead=!0,o.removeFromParent(),a.dispose(),u.remove();let e=G.indexOf(f);e>=0&&G.splice(e,1)}};return G.push(f),f},update(e,t){if(_.update(e),x.update(e),j.update(e,t),e>0){let n=M.d;for(let r=M.n-1;r>=0;r--){let i=r*M.S;if(n[i+6]+=e,n[i+6]>=n[i+7]){let e=M.n-1;N[i/M.S*2]=N[e*2],N[i/M.S*2+1]=N[e*2+1],M.kill(i);continue}u(n[i],n[i+2],t,L);let a=Math.exp(-2.2*e);n[i+3]=n[i+3]*a+L.x*1.2*(1-a),n[i+5]=n[i+5]*a+L.y*1.2*(1-a),n[i+4]=n[i+4]*a-3.2*e,n[i]+=n[i+3]*e,n[i+1]+=n[i+4]*e,n[i+2]+=n[i+5]*e,n[i+11]+=n[i+12]*e;let o=l(n[i],n[i+2])+.03;n[i+1]<o&&(n[i+1]=o,n[i+3]*=.3,n[i+5]*=.3,n[i+4]=0,n[i+12]*=.2)}}for(let t of[...G])t.update(e)},lateUpdate(){x.lateUpdate?.(),j.lateUpdate?.();let e=P.attributes.iPos.array,t=P.attributes.iRot.array,n=P.attributes.iCol.array,r=P.attributes.iSize.array,i=M.d;for(let a=0;a<M.n;a++){let o=a*M.S;e[a*3]=i[o],e[a*3+1]=i[o+1],e[a*3+2]=i[o+2],t[a*4]=i[o+8],t[a*4+1]=i[o+9],t[a*4+2]=i[o+10],t[a*4+3]=i[o+11],n[a*4]=i[o+13],n[a*4+1]=i[o+14],n[a*4+2]=i[o+15],n[a*4+3]=i[o+6]/i[o+7],r[a*2]=N[a*2],r[a*2+1]=N[a*2+1]}p(P,M.n,[`iPos`,`iRot`,`iCol`,`iSize`])}};return e.add(Z),window.__vfx=Z,Z}export{j as createVFX};