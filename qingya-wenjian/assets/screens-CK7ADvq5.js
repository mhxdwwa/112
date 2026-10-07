var e=[`零`,`一`,`二`,`三`,`四`,`五`,`六`,`七`,`八`,`九`,`十`],t=t=>t<=10?e[t]:t<20?`十`+e[t-10]:String(t),n=[{tt:`风起`,en:`The wind rises`},{tt:`草动`,en:`The grass stirs`},{tt:`剑鸣`,en:`The sword sings`},{tt:`云散`,en:`The clouds part`},{tt:`雁回`,en:`The geese return`}],r={no:`终回`,tt:`长风`,en:`The long wind`},i={风起:`The wind rises`,草动:`The grass stirs`,剑鸣:`The sword sings`,云散:`The clouds part`,长风:`The long wind`,雁回:`The geese return`,风定:`The field falls still`},a={swordmaster:{name:`寒山客`,sub:`Swordmaster of Cold Mountain`},boss:{name:`寒山客`,sub:`Swordmaster of Cold Mountain`},bandit_heavy:{name:`断岳`,sub:`The Mountain-Breaker`},assassin:{name:`夜枭`,sub:`The Night Owl`}},o=[[`W A S D`,`行`,`move`],[`Mouse`,`顾`,`look`],[`LMB`,`斩`,`strike`],[`Hold LMB`,`劈`,`heavy`],[`RMB`,`格`,`block · parry on impact`],[`Space`,`闪`,`dodge`],[`Shift`,`疾`,`sprint`],[`Q · Tab`,`锁`,`lock on`],[`E`,`气`,`sword qi`],[`F`,`剑`,`draw · sheathe`],[`Esc`,`歇`,`pause`]],s=[0,2,4,5,7,8],c={lines:[`十步杀一人`,`千里不留行`,`事了拂衣去`,`深藏身与名`],en:`Ten paces, and a man falls; a thousand li, and no trace remains.<br>The deed done, he shakes out his robe and goes, keeping his name and self unknown.`,src:`Li Bai · The Wandering Swordsman`,go:[`再战`,`ride on`]},l={lines:[`风萧萧兮易水寒`,`壮士一去兮不复还`],en:`The wind sighs, and the waters of the Yi run cold;<br>the warrior sets out, and does not return.`,src:`Song of the Yi River`,go:[`再起`,`rise again`]},u=e=>String(e).replace(/[&<>"]/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`})[e]),d=`
<svg class="defs" aria-hidden="true" focusable="false"><defs>
  <filter id="wx-ink" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="4" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="wx-ink-live" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="3" seed="7" result="n">
      <animate attributeName="baseFrequency" dur="18s" values="0.026;0.034;0.026" repeatCount="indefinite"/>
    </feTurbulence>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="0.35"/>
  </filter>
</defs></svg>`,f=`
${d}
<div class="lyr marks"></div>
<div class="lyr fxl"></div>
<div class="edge"></div>
<div class="qi"></div>
<div class="play vitals">
  <div class="focus"><div class="wash"></div><div class="rt m"></div><div class="r m"></div><div class="pulse m"></div><div class="g">气</div></div>
  <div class="health"><div class="tr m"></div><div class="gh m"></div><div class="fl m"></div></div>
</div>
<div class="play boss"><div class="nm"></div><div class="sb"></div>
  <div class="bar"><div class="tr m"></div><div class="gh m"></div><div class="fl m"></div></div>
  <div class="po"><div class="a m"></div><div class="b m"></div></div>
</div>
<div class="ret"><div class="e m"></div><div class="d"></div></div>
<div class="banner"><div class="wash"></div><div class="no"></div><div class="tt"></div><div class="ru m"></div><div class="en"></div><img class="seal" alt=""></div>
<div class="hint">${s.map(e=>`<kbd>${o[e][0]}</kbd><span>${o[e][1]}<i>${o[e][2]}</i></span>`).join(``)}</div>

<div class="scr title">
  <div class="shade"></div>
  <div class="col"><div class="tt">长风</div><div class="tg">天苍苍 · 野茫茫</div><img class="seal" alt=""></div>
  <div class="en"><b>LONG WIND</b><i>the wind arrives before the blade</i></div>
  <div class="go"><div class="ln m"></div><div class="t"><b>点击 · 启程</b><i>click to begin</i></div><div class="ln r m"></div></div>
</div>

<div class="scr pause">
  <div class="shade"></div>
  <div class="pn">
    <div class="hd">歇<small>PAUSED</small></div>
    <div class="mn">
      <button data-act="resume"><b>继续</b><i>resume</i></button>
      <button data-act="restart"><b>重来</b><i>restart</i></button>
      <button data-act="controls"><b>招式</b><i>controls</i></button>
      <div class="vol"><b>声</b><div class="sl"><div class="tr m"></div><div class="fl m"></div></div><i>volume</i></div>
      <div class="qual"><b>画</b><span class="qo" data-q="low">流畅</span><span class="qo" data-q="med">均衡</span><span class="qo" data-q="high">极致</span><i>quality</i></div>
      <div class="ctl">${o.map(([e,t,n])=>`<kbd>${e}</kbd><span>${t}<i>${n}</i></span>`).join(``)}</div>
    </div>
  </div>
  <div class="ft">the grass waits · the wind does not</div>
</div>

<div class="scr end victory">
  <div class="shade"></div>
  <div class="st"></div>
  <div class="body"></div>
  <div class="tr"></div>
  <div class="go" data-act="restart"></div>
</div>
<div class="scr end defeat">
  <div class="shade"></div>
  <div class="body"></div>
  <div class="tr"></div>
  <div class="go" data-act="restart"></div>
</div>`;function p(e,t,n){let r=e.querySelector(`.body`);r.innerHTML=t.lines.map((e,t)=>`<div class="ln${t>=2?` sm`:``}" style="--i:${t}">${u(e)}</div>`).join(``)+(n?`<img class="seal" src="${n}" alt="">`:``),e.querySelector(`.tr`).innerHTML=`${t.en}<small>${u(t.src)}</small>`,e.querySelector(`.go`).innerHTML=`<b>${u(t.go[0])}</b><i>${u(t.go[1])}</i>`}export{d as a,e as c,i as d,u as f,l as i,c as l,t as m,r as n,s as o,p,o as r,f as s,a as t,n as u};