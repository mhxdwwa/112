var e=[`零`,`一`,`二`,`三`,`四`,`五`,`六`,`七`,`八`,`九`,`十`],t=t=>t<=10?e[t]:t<20?`十`+e[t-10]:String(t),n=[{tt:`出山`,en:`Leaving the Mountain`},{tt:`伏击`,en:`The Ambush`},{tt:`夜雨`,en:`Night Rain`},{tt:`问剑`,en:`Asking the Sword`},{tt:`侠名`,en:`Name of the Hero`}],r={no:`终回`,tt:`问剑`,en:`Asking the Sword`},i={出山:`Leaving the Mountain`,伏击:`The Ambush`,夜雨:`Night Rain`,问剑:`Asking the Sword`,侠名:`Name of the Hero`,风定:`The sword rests`},a={swordmaster:{name:`独孤剑`,sub:`The Lone Swordsman`},boss:{name:`独孤剑`,sub:`The Lone Swordsman`},bandit_heavy:{name:`铁横江`,sub:`Iron Tide`},assassin:{name:`天狼`,sub:`The Sky Wolf`}},o=[[`W A S D`,`行`,`move`],[`Mouse`,`顾`,`look`],[`LMB`,`斩`,`strike`],[`Hold LMB`,`劈`,`heavy`],[`RMB`,`格`,`block · parry on impact`],[`Space`,`闪`,`dodge`],[`Shift`,`疾`,`sprint`],[`Q · Tab`,`锁`,`lock on`],[`E`,`气`,`sword qi`],[`F`,`剑`,`draw · sheathe`],[`Esc`,`歇`,`pause`]],s=[0,2,4,5,7,8],c={lines:[`天地英雄气`,`千秋尚凛然`,`长剑倚天外`,`一笑泯恩仇`],en:`The spirit of heroes fills heaven and earth,<br>its power still awesome after a thousand autumns.<br>The long sword rests against the sky,<br>one smile, and all enmity is forgotten.`,src:`古风 · 侠客行`,go:[`再战`,`ride on`]},l={lines:[`剑道多险阻`,`侠路几沧桑`,`败亦何足惧`,`来日更自强`],en:`The way of the sword is fraught with peril;<br>the path of the hero, weathered by time.<br>What fear in defeat?<br>Tomorrow, I shall rise stronger.`,src:`青崖剑谱 · 悟道`,go:[`再起`,`rise again`]},u=e=>String(e).replace(/[&<>"]/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`})[e]),d=`
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
  <div class="col"><div class="tt">青崖问剑</div><div class="tg">剑起青崖 · 侠行天下</div><img class="seal" alt=""></div>
  <div class="en"><b>QINGYA SWORD</b><i>the blade asks the wind, the wind asks the sword</i></div>
  <div class="go"><div class="ln m"></div><div class="t"><b>点击 · 入江湖</b><i>click to enter the jianghu</i></div><div class="ln r m"></div></div>
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
  <div class="ft">the sword hums · the hero walks on</div>
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