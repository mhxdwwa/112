import{t as e}from"./bus-B6XsRwpa.js";var t=[{a:`light`,g:`斩`,k:`main`,rot:-18},{a:`dodge`,g:`闪`,k:`mid`,ang:182,ring:1,rot:40},{a:`block`,g:`格`,k:`mid`,ang:226,ring:1,rot:160},{a:`special`,g:`气`,k:`mid`,ang:270,ring:1,rot:0},{a:`lock`,g:`锁`,k:`small`,ang:204,ring:2,rot:250},{a:`draw`,g:`剑`,k:`small`,ang:248,ring:2,rot:100}],n={main:88,mid:60,small:46},r=[0,102,168],i=54,a=.14,o=1.12,s=.96,c=1.45,l=[[`LEFT DRAG`,`行`,`move · past the rim 疾 sprint`],[`RIGHT DRAG`,`顾`,`look`],[`HOLD 斩`,`劈`,`heavy`],[`TAP 格 AT IMPACT`,`破`,`parry`]],u=[[`LEFT DRAG`,`行`,`move`],[`PAST THE RIM`,`疾`,`sprint`],[`RIGHT DRAG`,`顾`,`look`],[`TAP 斩`,`斩`,`strike`],[`HOLD 斩`,`劈`,`heavy`],[`HOLD 格`,`格`,`block · parry at impact`],[`闪`,`闪`,`dodge`],[`锁`,`锁`,`lock on`],[`气`,`气`,`sword qi`],[`剑`,`剑`,`draw · sheathe`],[`‖`,`歇`,`pause`]],d=(e,t,n)=>e<t?t:e>n?n:e,f=()=>typeof matchMedia==`function`&&matchMedia(`(pointer: coarse)`).matches;function p(e){let t=e?.get?.(`touch`);return t===`0`?!1:t===`1`||f()}function m(m,{game:g,hud:_}={}){let v=g?.input,y=_?.el;if(!v?.touch||!y||!p(m.params??new URLSearchParams(location.search)))return null;h();let b=v.touch;b.enabled=!0,v.exitLock();let x=f(),S=document.createElement(`div`);S.className=`wxt`,S.innerHTML=`
    <div class="zone zl"></div><div class="zone zr"></div>
    <div class="stick"><div class="wash"></div><div class="ring"></div><div class="g">行</div><div class="fast">疾</div><div class="knob"><i></i></div></div>
    ${t.map(e=>`<div class="tb ${e.k}" data-a="${e.a}" style="--rot:${e.rot}deg"><i class="bg"></i>${e.a===`special`?`<i class="rt m"></i>`:``}<i class="gl"></i><i class="r m"></i><i class="bl m"></i><b>${e.g}</b></div>`).join(``)}
    <div class="tp"><i class="bg"></i><i class="r m"></i><i class="s m"></i><i class="s m"></i></div>
    <div class="probe"></div>`,y.insertBefore(S,y.querySelector(`.scr`));let C=document.createElement(`div`);C.className=`wxrot`,C.innerHTML=`<i class="ph"></i><b>横屏游玩更佳</b><em>best played sideways</em>`,y.appendChild(C),y.classList.add(`touch`),document.documentElement.classList.add(`wx-touch`);let w=e=>S.querySelector(e),T=w(`.zl`),E=w(`.zr`),D=w(`.stick`),ee=w(`.knob`),O=w(`.tp`),te=w(`.probe`),k=t.map(e=>({...e,el:S.querySelector(`.tb[data-a="${e.a}"]`),id:null,flip:!1})),A=Object.fromEntries(k.map(e=>[e.a,e])),ne=A.light.el.querySelector(`b`),j=e=>e.map(([e,t,n])=>`<kbd>${e}</kbd><span>${t}<i>${n}</i></span>`).join(``),M=(e,t)=>{let n=y.querySelector(e);n&&(n.innerHTML=t)};M(`.title .go .t i`,`tap to begin`),M(`.pause .ctl`,j(u)),M(`.hint`,j(l));let N={W:0,H:0,u:1,R:i,rest:{x:0,y:0},sa:{t:0,r:0,b:0,l:0},k:.006,id:null,bx:0,by:0,sprint:!1,look:null,lx:0,ly:0,state:``,portrait:!1,rotT:0},P=new Set,F=()=>{b.n=P.size};function I(){let e=getComputedStyle(te),t=N.sa={t:parseFloat(e.paddingTop)||0,r:parseFloat(e.paddingRight)||0,b:parseFloat(e.paddingBottom)||0,l:parseFloat(e.paddingLeft)||0},a=N.W=innerWidth,o=N.H=innerHeight,s=o>a;s!==N.portrait&&(N.portrait=s,N.rotT=0,y.classList.toggle(`portrait`,s),y.classList.remove(`rot-seen`));let c=N.u=d(Math.min(a,o)/400,.82,1.3)*(s?d(a/460,.8,1):1),l=18*c,u=a-t.r-l-n.main*c/2,f=o-t.b-l-n.main*c/2;for(let e of k){let t=n[e.k]*c,i=r[e.ring??0]*c,a=(e.ang??0)*Math.PI/180;L(e.el,u+Math.cos(a)*i,f+Math.sin(a)*i,t)}let p=42*c;L(O,a-t.r-14*c-p/2,t.t+12*c+p/2,p),N.R=i*c,N.rest.x=t.l+l+N.R+6*c,N.rest.y=o-t.b-l-N.R;let m=Math.round(a*(s?.5:.4));T.style.width=`${m}px`,E.style.left=`${m}px`,D.style.width=D.style.height=`${(2*N.R).toFixed(1)}px`,D.style.setProperty(`--d`,`${(2*N.R).toFixed(1)}px`),N.id===null&&R(N.rest.x,N.rest.y),N.k=d(5.4/a,.004,.009);let h=d(.62*c,.55,.8),g=84*h,_=s?a*.84:d(a*.36,220,480),v=s?a-t.l-t.r-40:(a-_)/2-16-t.l-12,b=y.style;b.setProperty(`--tvs`,h.toFixed(3)),b.setProperty(`--tvh`,`${g.toFixed(1)}px`),b.setProperty(`--thw`,`${d(v-g-10,120,300*c).toFixed(1)}px`),b.setProperty(`--tbw`,`${_.toFixed(1)}px`)}function L(e,t,n,r){let i=e.style;i.left=`${(t-r/2).toFixed(1)}px`,i.top=`${(n-r/2).toFixed(1)}px`,i.width=i.height=`${r.toFixed(1)}px`,i.setProperty(`--d`,`${r.toFixed(1)}px`)}function R(e,t){D.style.transform=`translate3d(${(e-N.R).toFixed(1)}px,${(t-N.R).toFixed(1)}px,0)`}function z(e,t){ee.style.transform=`translate3d(${e.toFixed(1)}px,${t.toFixed(1)}px,0)`}function B(e){e!==N.sprint&&(N.sprint=e,b.hold(`sprint`,e),D.classList.toggle(`fast`,e))}function V(e,t){let n=e-N.bx,r=t-N.by,i=Math.hypot(n,r),l=N.R,u=l*c;if(i>u){let a=(i-u)/i;N.bx+=n*a,N.by+=r*a,n=e-N.bx,r=t-N.by,i=u,R(N.bx,N.by)}let d=i>l?l/i:1;z(n*d,r*d);let f=i/l,p=f<a?0:Math.min(1,(f-a)/.78),m=i>.001?n/i:0,h=i>.001?r/i:0;b.setMove(m*p,-h*p),B(N.sprint?f>s:f>o)}function H(){N.id!==null&&(P.delete(N.id),F(),N.id=null,b.setMove(0,0),B(!1),D.classList.remove(`live`),z(0,0),R(N.rest.x,N.rest.y))}T.addEventListener(`pointerdown`,e=>{if(e.preventDefault(),N.id!==null)return;N.id=e.pointerId,P.add(e.pointerId),F();try{T.setPointerCapture(e.pointerId)}catch{}let t=N.R,n=N.sa;N.bx=d(e.clientX,n.l+t+6,N.W-t-6),N.by=d(e.clientY,n.t+t+6,N.H-n.b-t-6),D.classList.add(`live`),R(N.bx,N.by),V(e.clientX,e.clientY)}),T.addEventListener(`pointermove`,e=>{e.pointerId===N.id&&V(e.clientX,e.clientY)});function U(){N.look!==null&&(P.delete(N.look),F(),N.look=null)}E.addEventListener(`pointerdown`,e=>{if(e.preventDefault(),N.look===null){N.look=e.pointerId,P.add(e.pointerId),F(),N.lx=e.clientX,N.ly=e.clientY;try{E.setPointerCapture(e.pointerId)}catch{}}}),E.addEventListener(`pointermove`,e=>{if(e.pointerId!==N.look)return;let t=e.clientX-N.lx,n=e.clientY-N.ly;N.lx=e.clientX,N.ly=e.clientY,(t||n)&&b.look(t*N.k,n*N.k*.8)});let W=e=>{try{x&&navigator.vibrate?.(e)}catch{}};function G(e){e.id!==null&&(P.delete(e.id),F(),e.id=null,b.hold(e.a,!1),e.el.classList.remove(`on`))}for(let e of k)e.el.addEventListener(`pointerdown`,t=>{if(t.preventDefault(),e.id===null){e.id=t.pointerId,P.add(t.pointerId),F();try{e.el.setPointerCapture(t.pointerId)}catch{}b.hold(e.a,!0),e.flip=!e.flip,e.el.classList.remove(`p1`,`p2`),e.el.classList.add(`on`,e.flip?`p1`:`p2`),W(e.k===`main`?9:6)}});let K=!1;O.addEventListener(`pointerdown`,e=>{e.preventDefault(),b.hold(`pause`,!0),b.hold(`pause`,!1),K=!K,O.classList.remove(`p1`,`p2`),O.classList.add(K?`p1`:`p2`),W(6)});let re=[[T,H,()=>N.id],[E,U,()=>N.look],...k.map(e=>[e.el,()=>G(e),()=>e.id])];for(let[e,t,n]of re)for(let r of[`pointerup`,`pointercancel`,`lostpointercapture`])e.addEventListener(r,e=>{e.pointerId===n()&&t()});function q(){H(),U();for(let e of k)G(e);P.clear(),F(),b.clear(),N.sprint=!1,D.classList.remove(`fast`)}let J=e=>e.preventDefault();S.addEventListener(`contextmenu`,J),document.addEventListener(`touchmove`,J,{passive:!1}),document.addEventListener(`gesturestart`,J);let Y=()=>{document.hidden&&(y.dataset.state===`playing`&&g.setPaused?.(!0),q())};document.addEventListener(`visibilitychange`,Y);let X=!1,ie=()=>{X=N.state===`title`},ae=()=>{if(!X||!x)return;X=!1;let e=document,t=e.documentElement;if(e.fullscreenElement||e.webkitFullscreenElement)return;let n=t.requestFullscreen?.bind(t)??t.webkitRequestFullscreen?.bind(t);try{(n?.({navigationUI:`hide`}))?.then?.(()=>screen.orientation?.lock?.(`landscape`)?.catch?.(()=>{}))?.catch?.(()=>{})}catch{}};addEventListener(`pointerdown`,ie,!0),addEventListener(`pointerup`,ae,!0);let oe=100,se=e.on(`player:focus`,e=>{e?.max&&(oe=e.max)}),Z={charge:!1,guard:!1,sheathed:!1,lock:!1,full:!1,f:-1},Q=(e,t,n,r)=>{Z[e]!==t&&(Z[e]=t,n.classList.toggle(r,t))};function ce(e,t,n,r=e){let i=y.dataset.state;if(i!==N.state&&(q(),N.state=i),N.portrait&&(i===`playing`||i===`title`)&&!y.classList.contains(`rot-seen`)&&(N.rotT+=Math.min(r,.1),i===`playing`&&N.rotT>7&&y.classList.add(`rot-seen`)),i!==`playing`)return;let a=g.player;if(!a)return;let o=a.state===`charge`;o!==Z.charge&&(ne.textContent=o?`劈`:`斩`),Q(`charge`,o,A.light.el,`charge`),Q(`guard`,a.state===`block`||a.state===`parry`,A.block.el,`act`),Q(`sheathed`,!a.drawn,A.draw.el,`off`),Q(`lock`,!!a.lock?.alive,A.lock.el,`lit`);let s=d(a.focus/oe,0,1);Math.abs(s-Z.f)>.004&&(Z.f=s,A.special.el.style.setProperty(`--f`,s.toFixed(3))),Q(`full`,s>=.999,A.special.el,`full`)}I(),addEventListener(`resize`,I),addEventListener(`orientationchange`,I);let $={update:ce,el:S,layout:I,dispose(){q(),se?.(),removeEventListener(`resize`,I),removeEventListener(`orientationchange`,I),removeEventListener(`pointerdown`,ie,!0),removeEventListener(`pointerup`,ae,!0),document.removeEventListener(`touchmove`,J),document.removeEventListener(`gesturestart`,J),document.removeEventListener(`visibilitychange`,Y),m.remove($),S.remove(),C.remove(),y.classList.remove(`touch`,`portrait`,`rot-seen`),document.documentElement.classList.remove(`wx-touch`),b.enabled=!1}};return m.add($),$}function h(){if(document.getElementById(`wx-touch-css`))return;let e=document.createElement(`style`);e.id=`wx-touch-css`,e.textContent=g,document.head.appendChild(e)}var g=`
html.wx-touch, html.wx-touch body { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
  overscroll-behavior: none; touch-action: none; }
.wx .wxt { position: absolute; inset: 0; pointer-events: none; opacity: 0; visibility: hidden;
  transition: opacity .5s var(--ease-ink), visibility 0s linear .5s; }
.wx[data-state=playing] .wxt { opacity: 1; visibility: visible; transition: opacity .9s var(--ease-ink) .2s, visibility 0s; }
.wxt .zone { position: absolute; top: 0; bottom: 0; pointer-events: auto; touch-action: none; }
.wxt .zl { left: 0; width: 40%; }
.wxt .zr { left: 40%; right: 0; }
.wxt .probe { position: absolute; visibility: hidden; pointer-events: none;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }

/* ---------- stick: a brush ensō under the thumb (行 at rest), a smaller one for the knob ---------- */
.wxt .stick { position: absolute; left: 0; top: 0; pointer-events: none; opacity: .42; will-change: transform, opacity;
  transition: transform .38s var(--ease-ink), opacity .45s var(--ease-ink); }
.wxt .stick.live { opacity: .92; transition: opacity .12s; }
.wxt .stick > * { position: absolute; }
.wxt .stick .wash { inset: 4%; border-radius: 50%; background: radial-gradient(closest-side, rgba(10,8,6,.34), rgba(10,8,6,.2) 70%, rgba(10,8,6,0)); }
.wxt .stick .ring { inset: 0; background: var(--ink); opacity: .75; transform: rotate(-18deg);
  -webkit-mask: var(--t-enso2) center / 100% 100% no-repeat; mask: var(--t-enso2) center / 100% 100% no-repeat; }
.wxt .stick .g { inset: 0; display: grid; place-items: center; padding-bottom: 5%; font: calc(var(--d) * .3)/1 var(--f-brush); color: var(--ink);
  opacity: .8; text-shadow: 0 1px 3px rgba(0,0,0,.5); transition: opacity .2s; }
.wxt .stick.live .g { opacity: 0; }
.wxt .stick .knob { left: 27%; top: 27%; width: 46%; height: 46%; will-change: transform; opacity: 0; transition: transform .25s var(--ease-ink), opacity .2s; }
/* the knob: a small ensō round a dot of pale ink (the lock reticle's vocabulary) */
.wxt .stick .knob::before, .wxt .stick .knob::after { content: ''; position: absolute; border-radius: 50%; }
.wxt .stick .knob::before { inset: -16%; background: radial-gradient(closest-side, rgba(10,8,6,.45), rgba(10,8,6,.2) 60%, rgba(10,8,6,0)); }
.wxt .stick .knob::after { inset: 27%; background: radial-gradient(closest-side, rgba(243,228,196,.96) 62%, rgba(243,228,196,0)); }
.wxt .stick .knob i { position: absolute; inset: 0; background: var(--ink-hi); opacity: .9; transform: rotate(70deg);
  -webkit-mask: var(--t-enso) center / 100% 100% no-repeat; mask: var(--t-enso) center / 100% 100% no-repeat; }
.wxt .stick.live .knob { opacity: 1; transition: opacity .12s; }
/* sprint: the ring turns gold and 疾 takes the centre the knob has left */
.wxt .stick .fast { inset: 0; display: grid; place-items: center; padding-bottom: 5%; font: calc(var(--d) * .32)/1 var(--f-brush); color: var(--gold);
  text-shadow: 0 0 12px rgba(255,186,90,.8), 0 1px 2px rgba(0,0,0,.6); opacity: 0; transform: scale(1.4); transition: opacity .18s, transform .3s var(--ease-brush); }
.wxt .stick.fast .ring { background: var(--gold); opacity: 1; }
.wxt .stick.fast .fast { opacity: 1; transform: none; }

/* ---------- buttons: a calligraphic glyph in a brush ensō over a soft ink wash ---------- */
.wxt .tb, .wxt .tp { position: absolute; left: 0; top: 0; border-radius: 50%; pointer-events: auto; touch-action: none;
  transition: transform .14s var(--ease-ink); will-change: transform; }
.wxt .tb::after { content: ''; position: absolute; inset: -14%; border-radius: 50%; }   /* a thumb is wider than the ink */
.wxt .tb > *, .wxt .tp > * { position: absolute; pointer-events: none; }
.wxt .tb .bg, .wxt .tp .bg { inset: 4%; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(10,8,6,.44), rgba(10,8,6,.3) 62%, rgba(10,8,6,0)); }
.wxt .tb .r, .wxt .tb .rt { inset: 0; background: var(--ink); opacity: .6; -webkit-mask-image: var(--t-enso); mask-image: var(--t-enso); transform: rotate(var(--rot));
  transition: opacity .15s; }
.wxt .tb b { inset: 0; display: grid; place-items: center; padding-bottom: 6%; font: 400 calc(var(--d) * .5)/1 var(--f-brush); color: var(--ink-hi);
  text-shadow: 0 1px 3px rgba(0,0,0,.6), 0 0 14px rgba(0,0,0,.28); transition: color .15s, opacity .2s; }
.wxt .tb .bl { inset: -22%; background: var(--ink-hi); opacity: 0; -webkit-mask-image: var(--t-splat2); mask-image: var(--t-splat2); }
.wxt .tb .gl { inset: -12%; border-radius: 50%; opacity: 0; background: radial-gradient(closest-side, rgba(255,196,110,.45), rgba(255,186,90,.13) 60%, transparent); }
.wxt .tb.small b { font-size: calc(var(--d) * .46); }
.wxt .tb.small .r { opacity: .48; }
/* 斩: the big one, with a vermilion bloom */
.wxt .tb.main .r { opacity: .72; -webkit-mask-image: var(--t-enso2); mask-image: var(--t-enso2); }
.wxt .tb.main b { font-size: calc(var(--d) * .54); }
.wxt .tb.main .bl { background: var(--verm-hi); -webkit-mask-image: var(--t-splat); mask-image: var(--t-splat); }
/* 气: the ring fills with focus like the HUD's ensō */
.wxt .tb[data-a=special] .rt { opacity: .16; }
.wxt .tb[data-a=special] .r { opacity: .85;
  -webkit-mask-image: var(--t-enso), conic-gradient(from -36deg, #000 calc(var(--f) * 90%), transparent calc(var(--f) * 90% + 1.5%));
  mask-image: var(--t-enso), conic-gradient(from -36deg, #000 calc(var(--f) * 90%), transparent calc(var(--f) * 90% + 1.5%));
  -webkit-mask-composite: source-in; mask-composite: intersect; }
.wxt .tb[data-a=special] b { opacity: .5; }

/* states (after the kinds, so they win) */
.wxt .tb.on { transform: scale(.9); }
.wxt .tb.on .r { opacity: .95; }
.wxt .tb.on b { color: #fff6e2; }
.wxt .tb.p1 .bl { animation: wxt-bloom .5s var(--ease-ink) forwards; }
.wxt .tb.p2 .bl { animation: wxt-bloom2 .5s var(--ease-ink) forwards; }
.wxt .tb.main.charge .r { background: var(--gold); opacity: 1; }                      /* held: the heavy charge (劈) */
.wxt .tb.main.charge b { color: var(--gold); text-shadow: 0 0 16px rgba(255,186,90,.8), 0 1px 3px rgba(0,0,0,.5); }
.wxt .tb.main.charge .gl { animation: wxt-glow .45s ease-in-out infinite alternate; }
.wxt .tb.act .r { opacity: 1; background: var(--ink-hi); }                            /* 格: the guard is up */
.wxt .tb[data-a=special].full .r { background: var(--gold); }                         /* 气: ready */
.wxt .tb[data-a=special].full b { opacity: 1; color: var(--gold); text-shadow: 0 0 14px rgba(255,186,90,.75), 0 0 2px rgba(255,220,160,.9); }
.wxt .tb[data-a=special].full .gl { animation: wx-breathe 2.4s ease-in-out infinite; }
.wxt .tb.lit .r { background: var(--verm-hi); opacity: .95; }                         /* 锁: the reticle's vermilion */
.wxt .tb.lit b { color: #ffd9c8; }
.wxt .tb.off b { opacity: .55; }                                                      /* 剑: sheathed */

/* pause: two brush strokes in a faint ensō */
.wxt .tp .r { inset: 0; background: var(--ink); opacity: .4; -webkit-mask-image: var(--t-enso2); mask-image: var(--t-enso2); transform: rotate(130deg); }
.wxt .tp .s { left: 50%; top: 50%; width: calc(var(--d) * .46); height: calc(var(--d) * .13); margin: calc(var(--d) * -.065) 0 0 calc(var(--d) * -.23);
  background: var(--ink); opacity: .85; -webkit-mask-image: var(--t-thin); mask-image: var(--t-thin); transform: translateX(calc(var(--d) * -.11)) rotate(90deg); }
.wxt .tp .s + .s { transform: translateX(calc(var(--d) * .11)) rotate(-90deg); }
.wxt .tp.p1 { animation: wxt-tap .3s var(--ease-ink); }
.wxt .tp.p2 { animation: wxt-tap2 .3s var(--ease-ink); }

/* ---------- the HUD, rearranged for thumbs ---------- */
.wx.touch .vitals { left: calc(env(safe-area-inset-left) + 12px); top: calc(env(safe-area-inset-top) + 8px); bottom: auto; --s: var(--tvs, .6); }
.wx.touch .health { width: var(--thw, 220px); }
.wx.touch .boss.play { width: var(--tbw, 300px); top: calc(env(safe-area-inset-top) + clamp(10px, 3vh, 40px)); }   /* the bar (the boss-wave banner is .boss too) */
.wx.touch.portrait .boss.play { top: calc(env(safe-area-inset-top) + var(--tvh, 50px) + 34px); }
@media (max-height: 500px) { .wx.touch .banner.boss { top: 40%; } }   /* a short screen: the boss wave's title clears the boss bar */
.wx.touch .hint { left: calc(env(safe-area-inset-left) + 22px); right: auto; top: calc(env(safe-area-inset-top) + var(--tvh, 50px) + 30px); bottom: auto;
  gap: 4px 10px; font-size: 12px; }
.wx.touch .hint kbd { font-size: 11px; letter-spacing: .1em; }
.wx.touch .hint span, .wx.touch .hint span i { font-size: 12px; }
.wx.touch .combo { top: calc(env(safe-area-inset-top) + 64px); right: calc(env(safe-area-inset-right) + 24px); }
/* the calls to begin / go on, centred without the translateX their fade-in (wx-rise) overrides */
.wx.touch .title .go { left: 0; right: 0; justify-content: center; }
.wx.touch .end .go, .wx.touch .end .tr { left: 0; right: 0; margin-left: auto; margin-right: auto; }
@media (max-height: 500px) and (orientation: landscape) {
  /* a short landscape phone: 点击 · 启程 moves under the hero, clear of the LONG WIND lines under the column */
  .wx.touch .title .go { left: calc(env(safe-area-inset-left) + 13%); right: auto; bottom: 7vh; }
  .wx.touch .end .tr { display: none; }            /* no room under the poem columns: the English makes way */
}
/* pause menu: rows as wide as their words (a tapped row keeps its underline: touch has sticky hover); on a phone the
   招式 list takes the place of the sound / quality / chapter rows, in two columns */
.wx.touch .pause button { align-self: flex-start; }
.wx.touch.portrait .pause .pn { left: calc(env(safe-area-inset-left) + 26px); right: 14px; flex-direction: column; gap: 4px; }   /* upright: 歇 above */
.wx.touch.portrait .pause .hd { font-size: 64px; }
.wx.touch.portrait .pause .qual i { display: none; }
.wx.touch.portrait .pause .ctl { gap: 7px 12px; }
.wx.touch.portrait .pause .ctl span, .wx.touch.portrait .pause .ctl span i { font-size: 13px; }
@media (max-height: 600px) {
  .wx.touch .pause.show-ctl .mn > :is(.vol, .qual) { display: none; }
  .wx.touch .pause .ctl { grid-template-columns: repeat(4, auto); gap: 7px 14px; margin-top: 2px; padding-top: 6px; }
  .wx.touch .pause .ctl kbd { font-size: 11px; }
  .wx.touch .pause .ctl span, .wx.touch .pause .ctl span i { font-size: 12px; }
}

/* ---------- portrait: a note to turn the phone (it never blocks play) ---------- */
.wx .wxrot { position: absolute; left: 0; right: 0; top: calc(env(safe-area-inset-top) + 15%); display: none; text-align: center;
  pointer-events: none; white-space: nowrap; opacity: 0; transition: opacity 1.2s var(--ease-ink); }
.wx.touch.portrait .wxrot { display: block; }
.wx.touch.portrait[data-state=playing] .wxrot { top: 47%; }          /* in play: under the wave banner, over the hero */
.wx.touch.portrait:is([data-state=title], [data-state=playing]):not(.rot-seen) .wxrot { opacity: 1; }
.wx .wxrot::before { content: ''; position: absolute; left: 8%; right: 8%; top: -40%; bottom: -46%; z-index: -1; background: rgba(7,6,4,.4);
  -webkit-mask: var(--t-wash) center / 100% 100% no-repeat; mask: var(--t-wash) center / 100% 100% no-repeat; }
.wx .wxrot .ph { display: block; width: 20px; height: 34px; margin: 0 auto 12px; border: 2px solid var(--ink); border-radius: 4px; opacity: .85;
  box-shadow: inset 0 -3px 0 -1px rgba(232,211,173,.5); animation: wxt-turn 2.8s var(--ease-ink) infinite; }
.wx .wxrot b { display: block; font: 400 26px/1 var(--f-brush); letter-spacing: .3em; padding-left: .3em; color: var(--ink-hi); text-shadow: 0 1px 3px rgba(0,0,0,.5); }
.wx .wxrot em { display: block; margin-top: 8px; font: italic 400 12px/1 var(--f-latin); letter-spacing: .26em; padding-left: .26em; color: var(--ink-dim); text-transform: uppercase; }

@keyframes wxt-bloom { 0% { opacity: .5; transform: scale(.45) rotate(0deg); } 100% { opacity: 0; transform: scale(1.12) rotate(24deg); } }
@keyframes wxt-bloom2 { 0% { opacity: .5; transform: scale(.45) rotate(0deg); } 100% { opacity: 0; transform: scale(1.12) rotate(-24deg); } }
@keyframes wxt-glow { from { opacity: .35; } to { opacity: 1; } }
@keyframes wxt-tap { 0% { transform: scale(.84); } 100% { transform: none; } }
@keyframes wxt-tap2 { 0% { transform: scale(.84); } 100% { transform: none; } }
@keyframes wxt-turn { 0%, 30% { transform: rotate(0deg); } 55%, 85% { transform: rotate(-90deg); } 100% { transform: rotate(0deg); } }
@media (prefers-reduced-motion: reduce) { .wxt *, .wx .wxrot * { animation-duration: .01s !important; } }
`;export{m as createTouchControls,p as touchWanted};