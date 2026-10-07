function e(e){let t=e>>>0;return function(){t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}var t=.5*(Math.sqrt(3)-1),n=(3-Math.sqrt(3))/6,r=1/3,i=1/6,a=new Float32Array([1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1]);function o(o=1337){let s=e(o),c=new Uint8Array(256);for(let e=0;e<256;e++)c[e]=e;for(let e=255;e>0;e--){let t=s()*(e+1)|0,n=c[e];c[e]=c[t],c[t]=n}let l=new Uint8Array(512),u=new Uint8Array(512);for(let e=0;e<512;e++)l[e]=c[e&255],u[e]=l[e]%12;function d(e,r){let i=0,o=0,s=0,c=(e+r)*t,d=Math.floor(e+c),f=Math.floor(r+c),p=(d+f)*n,m=e-(d-p),h=r-(f-p),g=+(m>h),_=m>h?0:1,v=m-g+n,y=h-_+n,b=m-1+2*n,x=h-1+2*n,S=d&255,C=f&255,w=.5-m*m-h*h;if(w>=0){let e=u[S+l[C]]*3;w*=w,i=w*w*(a[e]*m+a[e+1]*h)}let T=.5-v*v-y*y;if(T>=0){let e=u[S+g+l[C+_]]*3;T*=T,o=T*T*(a[e]*v+a[e+1]*y)}let E=.5-b*b-x*x;if(E>=0){let e=u[S+1+l[C+1]]*3;E*=E,s=E*E*(a[e]*b+a[e+1]*x)}return 70*(i+o+s)}function f(e,t,n){let o,s,c,d,f=(e+t+n)*r,p=Math.floor(e+f),m=Math.floor(t+f),h=Math.floor(n+f),g=(p+m+h)*i,_=e-(p-g),v=t-(m-g),y=n-(h-g),b,x,S,C,w,T;_>=v?v>=y?(b=1,x=0,S=0,C=1,w=1,T=0):_>=y?(b=1,x=0,S=0,C=1,w=0,T=1):(b=0,x=0,S=1,C=1,w=0,T=1):v<y?(b=0,x=0,S=1,C=0,w=1,T=1):_<y?(b=0,x=1,S=0,C=0,w=1,T=1):(b=0,x=1,S=0,C=1,w=1,T=0);let E=_-b+i,D=v-x+i,O=y-S+i,k=_-C+2*i,A=v-w+2*i,j=y-T+2*i,M=_-1+3*i,N=v-1+3*i,P=y-1+3*i,F=p&255,I=m&255,L=h&255,R=.6-_*_-v*v-y*y;if(R<0)o=0;else{let e=u[F+l[I+l[L]]]*3;R*=R,o=R*R*(a[e]*_+a[e+1]*v+a[e+2]*y)}let z=.6-E*E-D*D-O*O;if(z<0)s=0;else{let e=u[F+b+l[I+x+l[L+S]]]*3;z*=z,s=z*z*(a[e]*E+a[e+1]*D+a[e+2]*O)}let B=.6-k*k-A*A-j*j;if(B<0)c=0;else{let e=u[F+C+l[I+w+l[L+T]]]*3;B*=B,c=B*B*(a[e]*k+a[e+1]*A+a[e+2]*j)}let V=.6-M*M-N*N-P*P;if(V<0)d=0;else{let e=u[F+1+l[I+1+l[L+1]]]*3;V*=V,d=V*V*(a[e]*M+a[e+1]*N+a[e+2]*P)}return 32*(o+s+c+d)}function p(e,t,n=5,r=2,i=.5){let a=0,o=1,s=1,c=0;for(let l=0;l<n;l++)a+=o*d(e*s+l*17.13,t*s-l*9.71),c+=o,o*=i,s*=r;return a/c}function m(e,t,n=5,r=2.1,i=.5){let a=0,o=.5,s=1,c=1;for(let l=0;l<n;l++){let n=1-Math.abs(d(e*s+l*31.7,t*s+l*5.3));n*=n,a+=n*o*c,c=n,o*=i,s*=r}return a}return{simplex2:d,simplex3:f,fbm2:p,ridged2:m}}var s=o(1337),c=`
#ifndef WX_NOISE
#define WX_NOISE
float wx_hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 wx_hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float wx_hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float wx_vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = wx_hash12(i), b = wx_hash12(i + vec2(1, 0)), c = wx_hash12(i + vec2(0, 1)), d = wx_hash12(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// value noise with its analytic gradient in one evaluation: (value, d/dx, d/dy)
vec3 wx_vnoised(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
  float a = wx_hash12(i), b = wx_hash12(i + vec2(1, 0)), c = wx_hash12(i + vec2(0, 1)), d = wx_hash12(i + vec2(1, 1));
  float k = a - b - c + d;
  return vec3(a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y, du * vec2(b - a + k * u.y, c - a + k * u.x));
}
float wx_vnoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = wx_hash13(i), n100 = wx_hash13(i + vec3(1,0,0)), n010 = wx_hash13(i + vec3(0,1,0)), n110 = wx_hash13(i + vec3(1,1,0));
  float n001 = wx_hash13(i + vec3(0,0,1)), n101 = wx_hash13(i + vec3(1,0,1)), n011 = wx_hash13(i + vec3(0,1,1)), n111 = wx_hash13(i + vec3(1,1,1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float wx_fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) { s += a * wx_vnoise(p); p = r * p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
float wx_fbm3(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * wx_vnoise3(p); p = p * 2.02 + 11.7; a *= 0.5; }
  return s;
}
// 2D simplex (Ashima / Ian McEwan, MIT)
vec3 wx_mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 wx_mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 wx_permute(vec3 x) { return wx_mod289(((x * 34.0) + 10.0) * x); }
float wx_snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
  i = wx_mod289(i);
  vec3 p = wx_permute(wx_permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
#endif
`;export{s as i,o as n,e as r,c as t};