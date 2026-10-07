const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./anim-UgjXFqKg.js","./three.core-DtjtRha-.js","./preload-helper-uBIymjUX.js","./skeleton-B2Q5YfGE.js","./animator-Cp7Is3Da.js","./ik-KwGB6ksa.js","./bamboo-B5ZqRHzX.js","./character-CAlUpFUg.js","./three.module-YNTH5p0u.js","./globals-29H6lCK0.js","./citizens-DyZ4SMWt.js","./combat-UY6ALXWu.js","./game-DWyztQhQ.js","./bus-B6XsRwpa.js","./character-BcgKLawc.js","./atmosphere-BNENFJca.js","./glsl-BgzraZja.js","./noise-D9IUCAHK.js","./wind-BKJvbr9K.js","./assets-Ch6kO2eH.js","./GLTFLoader-ClMm1rNm.js","./BufferGeometryUtils-WOx_-h3q.js","./cloth-i16SIwZW.js","./humanoidSdf-CVfbWunR.js","./modelSkin-0Rz51PBu.js","./mixamoAnims-DGxQzgU3.js","./util-Bi7azLZb.js","./ai-CHKSbudI.js","./actor-BVGtKIYq.js","./moves-BwPWZe9W.js","./autopilot-p2nq0cPl.js","./camera-a5Ls2HGc.js","./combat-C3ULhzig.js","./lamps-BoRlsdIe.js","./director-BZDPfcH2.js","./levels-BiJcK8X0.js","./steppe-B-XUAVRl.js","./bamboo-D4bMiQa3.js","./town-DbPZJVkl.js","./enemy-DabFM8G8.js","./sword-CEicSq7D.js","./input-CDPKC7ee.js","./player-B2BMu27J.js","./full-BkPorXmZ.js","./grass-CEIs4Btv.js","./post-uF51WE9V.js","./rain-BP4WaLaf.js","./rawclip-zkXxlcaf.js","./sandbox-CSLxFk0r.js","./environment-h6XP-N4h.js","./chunks-6pQwEQwq.js","./sky-DGmABWnU.js","./shadows-DcYWz8Qz.js","./terrain-jQ0nTNJ3.js","./layout-BRcTijZA.js","./ground-glsl-B_t_Z4yP.js","./terrain-field-BBDhBkq_.js","./terrain-bake-CJ8_z630.js","./rocks-plan-B0oaB8qM.js","./texbake-Cr7xfIjn.js","./terrain-material-B_DrazZj.js","./terrain-pool-D9gXuX94.js","./terrain-shadow-MyfuVaHC.js","./sky-CSdGlw_0.js","./terrain-BoAkOw_4.js","./town-CUdqnlX7.js","./ui-B6WxTumQ.js","./hud-BUPr1obI.js","./style-DOFPLf1u.js","./screens-CK7ADvq5.js","./textures-DNLG2dLD.js","./brush-CPxKnWqV.js"])))=>i.map(i=>d[i]);
import{i as e}from"./three.module-YNTH5p0u.js";import{$r as t,Ar as n,Dr as r,Ii as i,Ja as a,Lt as o,Ni as s,Q as c,Qi as l,Qn as u,Rn as d,Rt as f,U as p,Wr as m,Yt as h,ar as g,bt as _,do as v,ea as ee,io as y,ir as b,j as te,ka as x,kr as ne,ma as S,no as C,ro as w,rr as re,ta as ie,tr as T,zi as ae}from"./three.core-DtjtRha-.js";import{t as E}from"./globals-29H6lCK0.js";import{t as D}from"./glsl-BgzraZja.js";import{i as oe,t as O}from"./atmosphere-BNENFJca.js";import{a as se}from"./wind-BKJvbr9K.js";import{t as ce}from"./chunks-6pQwEQwq.js";import{t as le}from"./lamps-BoRlsdIe.js";import{n as ue,r as de}from"./quality-CtuRFTEn.js";import{a as fe}from"./assets-Ch6kO2eH.js";import{t as k}from"./preload-helper-uBIymjUX.js";(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var pe=(e,t,n)=>{let r=t.lastIndexOf(`?`),i=e[r===-1||r<t.lastIndexOf(`/`)?t:t.slice(0,r)];return i?typeof i==`function`?i():Promise.resolve(i):new Promise((e,r)=>{(typeof queueMicrotask==`function`?queueMicrotask:setTimeout)(r.bind(null,Error(`Unknown variable dynamic import: `+t+(t.split(`/`).length===n?``:`. Note that variables only represent file names one level deep.`))))})};function me(e){let t=e.prototype;Object.getOwnPropertyDescriptor(t,`elements`)||Object.defineProperty(t,"elements",{configurable:!0,get(){return this._el},set(e){this._el=e instanceof Float64Array?e:Float64Array.from(e)}})}(typeof location>`u`||!new URLSearchParams(location.search).has(`nomxfix`))&&(me(b),me(re));var A={type:`change`},j={type:`start`},M={type:`end`},N=new i,P=new n,he=Math.cos(70*T.DEG2RAD),F=new w,I=2*Math.PI,L={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},R=1e-6,ge=class extends c{constructor(e,t=null){super(e,t),this.state=L.NONE,this.target=new w,this.cursor=new w,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:`ArrowLeft`,UP:`ArrowUp`,RIGHT:`ArrowRight`,BOTTOM:`ArrowDown`},this.mouseButtons={LEFT:u.ROTATE,MIDDLE:u.DOLLY,RIGHT:u.PAN},this.touches={ONE:x.ROTATE,TWO:x.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle=`auto`,this._domElementKeyEvents=null,this._lastPosition=new w,this._lastQuaternion=new m,this._lastTargetPosition=new w,this._quat=new m().setFromUnitVectors(e.up,new w(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new S,this._sphericalDelta=new S,this._scale=1,this._panOffset=new w,this._rotateStart=new C,this._rotateEnd=new C,this._rotateDelta=new C,this._panStart=new C,this._panEnd=new C,this._panDelta=new C,this._dollyStart=new C,this._dollyEnd=new C,this._dollyDelta=new C,this._dollyDirection=new w,this._mouse=new C,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=ve.bind(this),this._onPointerDown=_e.bind(this),this._onPointerUp=ye.bind(this),this._onContextMenu=Ee.bind(this),this._onMouseWheel=Se.bind(this),this._onKeyDown=Ce.bind(this),this._onTouchStart=we.bind(this),this._onTouchMove=Te.bind(this),this._onMouseDown=be.bind(this),this._onMouseMove=xe.bind(this),this._interceptControlDown=De.bind(this),this._interceptControlUp=Oe.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}set cursorStyle(e){this._cursorStyle=e,e===`grab`?this.domElement.style.cursor=`grab`:this.domElement.style.cursor=`auto`}get cursorStyle(){return this._cursorStyle}connect(e){super.connect(e),this.domElement.addEventListener(`pointerdown`,this._onPointerDown),this.domElement.addEventListener(`pointercancel`,this._onPointerUp),this.domElement.addEventListener(`contextmenu`,this._onContextMenu),this.domElement.addEventListener(`wheel`,this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener(`keydown`,this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction=`none`}disconnect(){this.state=L.NONE,this.domElement.removeEventListener(`pointerdown`,this._onPointerDown),this.domElement.ownerDocument.removeEventListener(`pointermove`,this._onPointerMove),this.domElement.ownerDocument.removeEventListener(`pointerup`,this._onPointerUp),this.domElement.removeEventListener(`pointercancel`,this._onPointerUp),this.domElement.removeEventListener(`wheel`,this._onMouseWheel),this.domElement.removeEventListener(`contextmenu`,this._onContextMenu),this.stopListenToKeyEvents();let e=this.domElement.getRootNode();e.removeEventListener(`keydown`,this._interceptControlDown,{capture:!0}),e.removeEventListener(`keyup`,this._interceptControlUp,{capture:!0}),this._controlActive=!1,this._pointers.length=0,this._pointerPositions={},this.domElement.style.touchAction=``,this.domElement.style.cursor=`auto`}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener(`keydown`,this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener(`keydown`,this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(A),this.update(),this.state=L.NONE}pan(e,t){this._pan(e,t),this.update()}dollyIn(e){this._dollyIn(e),this.update()}dollyOut(e){this._dollyOut(e),this.update()}rotateLeft(e){this._rotateLeft(e),this.update()}rotateUp(e){this._rotateUp(e),this.update()}update(e=null){let t=this.object.position;F.copy(t).sub(this.target),F.applyQuaternion(this._quat),this._spherical.setFromVector3(F),this.autoRotate&&this.state===L.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let n=this.minAzimuthAngle,r=this.maxAzimuthAngle;isFinite(n)&&isFinite(r)&&(n<-Math.PI?n+=I:n>Math.PI&&(n-=I),r<-Math.PI?r+=I:r>Math.PI&&(r-=I),n<=r?this._spherical.theta=Math.max(n,Math.min(r,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(n+r)/2?Math.max(n,this._spherical.theta):Math.min(r,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let i=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let e=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),i=e!=this._spherical.radius}if(F.setFromSpherical(this._spherical),F.applyQuaternion(this._quatInverse),t.copy(this.target).add(F),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let e=null;if(this.object.isPerspectiveCamera){let t=F.length();e=this._clampDistance(t*this._scale);let n=t-e;this.object.position.addScaledVector(this._dollyDirection,n),this.object.updateMatrixWorld(),i=!!n}else if(this.object.isOrthographicCamera){let t=new w(this._mouse.x,this._mouse.y,0);t.unproject(this.object);let n=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),i=n!==this.object.zoom;let r=new w(this._mouse.x,this._mouse.y,0);r.unproject(this.object),this.object.position.sub(r).add(t),this.object.updateMatrixWorld(),e=F.length()}else console.warn(`WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled.`),this.zoomToCursor=!1;e!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(e).add(this.object.position):(N.origin.copy(this.object.position),N.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(N.direction))<he?this.object.lookAt(this.target):(P.setFromNormalAndCoplanarPoint(this.object.up,this.target),N.intersectPlane(P,this.target))))}else if(this.object.isOrthographicCamera){let e=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),e!==this.object.zoom&&(this.object.updateProjectionMatrix(),i=!0)}return this._scale=1,this._performCursorZoom=!1,i||this._lastPosition.distanceToSquared(this.object.position)>R||8*(1-this._lastQuaternion.dot(this.object.quaternion))>R||this._lastTargetPosition.distanceToSquared(this.target)>R?(this.dispatchEvent(A),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e===null?I/60/60*this.autoRotateSpeed:I/60*this.autoRotateSpeed*e}_getZoomScale(e){let t=Math.abs(e*.01);return .95**(this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){F.setFromMatrixColumn(t,0),F.multiplyScalar(-e),this._panOffset.add(F)}_panUp(e,t){this.screenSpacePanning===!0?F.setFromMatrixColumn(t,1):(F.setFromMatrixColumn(t,0),F.crossVectors(this.object.up,F)),F.multiplyScalar(e),this._panOffset.add(F)}_pan(e,t){let n=this.domElement;if(this.object.isPerspectiveCamera){let r=this.object.position;F.copy(r).sub(this.target);let i=F.length();i*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*i/n.clientHeight,this.object.matrix),this._panUp(2*t*i/n.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/n.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/n.clientHeight,this.object.matrix)):(console.warn(`WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.`),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn(`WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.`),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn(`WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.`),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let n=this.domElement.getBoundingClientRect(),r=e-n.left,i=t-n.top,a=n.width,o=n.height;this._mouse.x=r/a*2-1,this._mouse.y=-(i/o)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(I*this._rotateDelta.x/t.clientHeight),this._rotateUp(I*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(I*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-I*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(I*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-I*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._rotateStart.set(n,r)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panStart.set(n,r)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,r=e.pageY-t.y,i=Math.sqrt(n*n+r*r);this._dollyStart.set(0,i)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._rotateEnd.set(n,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(I*this._rotateDelta.x/t.clientHeight),this._rotateUp(I*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panEnd.set(n,r)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,r=e.pageY-t.y,i=Math.sqrt(n*n+r*r);this._dollyEnd.set(0,i),this._dollyDelta.set(0,(this._dollyEnd.y/this._dollyStart.y)**+this.zoomSpeed),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let a=(e.pageX+t.x)*.5,o=(e.pageY+t.y)*.5;this._updateZoomParameters(a,o)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new C,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,n={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:n.deltaY*=16;break;case 2:n.deltaY*=100}return e.ctrlKey&&!this._controlActive&&(n.deltaY*=10),n}};function _e(e){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(e.pointerId),this.domElement.ownerDocument.addEventListener(`pointermove`,this._onPointerMove),this.domElement.ownerDocument.addEventListener(`pointerup`,this._onPointerUp)),!this._isTrackingPointer(e)&&(this._addPointer(e),e.pointerType===`touch`?this._onTouchStart(e):this._onMouseDown(e),this._cursorStyle===`grab`&&(this.domElement.style.cursor=`grabbing`)))}function ve(e){this.enabled!==!1&&(e.pointerType===`touch`?this._onTouchMove(e):this._onMouseMove(e))}function ye(e){switch(this._removePointer(e),this._pointers.length){case 0:this.domElement.releasePointerCapture(e.pointerId),this.domElement.ownerDocument.removeEventListener(`pointermove`,this._onPointerMove),this.domElement.ownerDocument.removeEventListener(`pointerup`,this._onPointerUp),this.dispatchEvent(M),this.state=L.NONE,this._cursorStyle===`grab`&&(this.domElement.style.cursor=`grab`);break;case 1:let t=this._pointers[0],n=this._pointerPositions[t];this._onTouchStart({pointerId:t,pageX:n.x,pageY:n.y})}}function be(e){let t;switch(e.button){case 0:t=this.mouseButtons.LEFT;break;case 1:t=this.mouseButtons.MIDDLE;break;case 2:t=this.mouseButtons.RIGHT;break;default:t=-1}switch(t){case u.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(e),this.state=L.DOLLY;break;case u.ROTATE:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(e),this.state=L.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(e),this.state=L.ROTATE}break;case u.PAN:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(e),this.state=L.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(e),this.state=L.PAN}break;default:this.state=L.NONE}this.state!==L.NONE&&this.dispatchEvent(j)}function xe(e){switch(this.state){case L.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(e);break;case L.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(e);break;case L.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(e)}}function Se(e){this.enabled!==!1&&this.enableZoom!==!1&&this.state===L.NONE&&(e.preventDefault(),this.dispatchEvent(j),this._handleMouseWheel(this._customWheelEvent(e)),this.dispatchEvent(M))}function Ce(e){this.enabled!==!1&&this._handleKeyDown(e)}function we(e){switch(this._trackPointer(e),this._pointers.length){case 1:switch(this.touches.ONE){case x.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(e),this.state=L.TOUCH_ROTATE;break;case x.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(e),this.state=L.TOUCH_PAN;break;default:this.state=L.NONE}break;case 2:switch(this.touches.TWO){case x.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(e),this.state=L.TOUCH_DOLLY_PAN;break;case x.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(e),this.state=L.TOUCH_DOLLY_ROTATE;break;default:this.state=L.NONE}break;default:this.state=L.NONE}this.state!==L.NONE&&this.dispatchEvent(j)}function Te(e){switch(this._trackPointer(e),this.state){case L.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(e),this.update();break;case L.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(e),this.update();break;case L.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(e),this.update();break;case L.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(e),this.update();break;default:this.state=L.NONE}}function Ee(e){this.enabled!==!1&&e.preventDefault()}function De(e){e.key===`Control`&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener(`keyup`,this._interceptControlUp,{passive:!0,capture:!0}))}function Oe(e){e.key===`Control`&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener(`keyup`,this._interceptControlUp,{passive:!0,capture:!0}))}var z=new te;z.setAttribute(`position`,new o([-1,-1,0,3,-1,0,-1,3,0],3)),z.setAttribute(`uv`,new o([0,0,2,0,0,2],2));var ke=new r(-1,1,1,-1,0,1),B=new g(z);B.frustumCulled=!1,B.matrixAutoUpdate=!1;var Ae=`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;function V(e,t,n){B.material=t,e.setRenderTarget(n),e.render(B,ke)}function H({uniforms:e={},fragmentShader:t,defines:n={},vertexShader:r=Ae,name:i=`post`}){return new ie({name:i,uniforms:e,defines:n,vertexShader:r,fragmentShader:t,depthTest:!1,depthWrite:!1,blending:0,toneMapped:!1})}function U(e,n,{type:r=h,format:i=t,filter:a=d,name:o=``,...s}={}){let c=new v(Math.max(1,e),Math.max(1,n),{type:r,format:i,minFilter:a,magFilter:a,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1,...s});return c.texture.name=o,c}function W(e,t){let n=1,r=0;for(;e>0;)n/=t,r+=e%t*n,e=Math.floor(e/t);return r}var G=`
#ifndef WXP_COMMON
#define WXP_COMMON
const vec3 WXP_LUMA709 = vec3(0.2126, 0.7152, 0.0722);
const vec3 WXP_LUMA601 = vec3(0.299, 0.587, 0.114);
// Interleaved gradient noise (Jimenez 2014)
float wxp_ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float wxp_hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float wxp_vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  float a = wxp_hash12(i), b = wxp_hash12(i + vec2(1.0, 0.0)), c = wxp_hash12(i + vec2(0.0, 1.0)), d = wxp_hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float wxp_fbm3(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * wxp_vnoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.31; a *= 0.5; }
  return s / 0.875;
}
// perspective depth-buffer value (0..1) → linear view depth (m)
float wxp_linearDepth(float z, vec2 nf) { float zn = z * 2.0 - 1.0; return 2.0 * nf.x * nf.y / (nf.y + nf.x - zn * (nf.y - nf.x)); }
// ACES fitted (Stephen Hill / BakingLab), no /0.6 pre-scale (bible §2.4.5-6)
vec3 wxp_rrtOdt(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 wxp_aces(vec3 c) {
  const mat3 m1 = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 m2 = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  return clamp(m2 * wxp_rrtOdt(m1 * c), 0.0, 1.0);
}
vec3 wxp_toSRGB(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 wxp_toYCoCg(vec3 c) { return vec3(dot(c, vec3(0.25, 0.5, 0.25)), dot(c, vec3(0.5, 0.0, -0.5)), dot(c, vec3(-0.25, 0.5, -0.25))); }
vec3 wxp_fromYCoCg(vec3 c) { return vec3(c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z); }
#endif
`,je=`
${D(`vec3`,`uSunDir`)}${D(`vec4`,`uCloudShadow`)}${D(`vec4`,`uWind`)}${D(`float`,`uTime`)}
float wxp_cloudShadow(vec3 wp) {
  vec2 p = wp.xz + uSunDir.xz / max(uSunDir.y, 0.08) * (uCloudShadow.y - wp.y);
  p = (p - uWind.xy * uTime * uCloudShadow.w) * uCloudShadow.z;
  float n = wxp_fbm3(p) * 0.8 + wxp_vnoise(p * 3.7) * 0.2;
  return 1.0 - uCloudShadow.x * smoothstep(0.52, 0.74, n);
}
#define WXP_CLOUD(p) wxp_cloudShadow(p)
#define WXP_GROUND(xz, fb) (fb)
`,K=/\bwx_cloudShadow\s*\(/.test(O)&&/\bwx_groundHeight\s*\(/.test(O),Me=`${O}
#define WXP_CLOUD(p) wx_cloudShadow(p)
// haze base height: one nearest texel of the baked terrain height (0.5 m texels are plenty for a density falloff)
float wxp_ground(vec2 xz, float fb) {
  ivec2 sz = textureSize(tHeight, 0);
  vec2 uv = (xz - uWorldRect.xy) * uWorldRect.w;
  if (sz.x < 4 || uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return fb;
  return texelFetch(tHeight, ivec2(uv * vec2(sz)), 0).r;
}
#define WXP_GROUND(xz, fb) wxp_ground(xz, fb)
`;function Ne(e){return`
${G}
${e?Me:je}
${D(`vec3`,`uSunCol`)}${D(`sampler2D`,`tWindNoise`)}
uniform sampler2D tCopy;
#if NUM_SHADOWS > 0
uniform sampler2DShadow tShadowFar; uniform mat4 uShadowMatFar; uniform float uBiasFar;
#endif
#if NUM_SHADOWS > 1
uniform sampler2DShadow tShadowNear; uniform mat4 uShadowMatNear; uniform float uBiasNear;
#endif
uniform mat4 uInvProj, uCamWorld;
${D(`vec3`,`uCamPos`)}
uniform float uFrame, uVolGroundY, uDustAmt, uMaxDist, uDensity, uCloudK, uExt, uScale, uBroad, uOccPow;
varying vec2 vUv;

// Shadow lookup with a soft fade at the frustum border (no seam where a map ends).
float wxp_shadow(sampler2DShadow m, vec3 s, float bias) {
  if (s.z >= 1.0 || s.z <= 0.0) return 1.0;
  vec2 e = min(s.xy, 1.0 - s.xy);
  float edge = smoothstep(0.0, 0.04, min(e.x, e.y));
  if (edge <= 0.0) return 1.0;
  return mix(1.0, texture(m, vec3(s.xy, s.z - bias)), edge);
}
float wxp_hg(float mu, float g) { float g2 = g * g; return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * mu, 1.5)); }

void main() {
  float lin = texture(tCopy, vUv).a;
  vec4 vd = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 vdir = normalize(vd.xyz / vd.w);
  vec3 rd = normalize(mat3(uCamWorld) * vdir);
  float tMax = min(lin / max(-vdir.z, 1e-3), uMaxDist);
  float j = wxp_ign(gl_FragCoord.xy + mod(uFrame, 64.0) * 5.588238);
#if NUM_SHADOWS > 0
  // the shadow matrices are affine, so the shadow coordinate is linear in t
  vec3 sF0 = (uShadowMatFar * vec4(uCamPos, 1.0)).xyz, sFd = (uShadowMatFar * vec4(rd, 0.0)).xyz;
#endif
#if NUM_SHADOWS > 1
  vec3 sN0 = (uShadowMatNear * vec4(uCamPos, 1.0)).xyz, sNd = (uShadowMatNear * vec4(rd, 0.0)).xyz;
#endif
  // Cloud shadow varies over hundreds of metres: evaluated at both ends of the ray, linear in between.
  float c0 = mix(1.0, WXP_CLOUD(uCamPos), uCloudK), c1 = mix(1.0, WXP_CLOUD(uCamPos + rd * tMax), uCloudK);
  // Quadratic step spacing t = tMax·x²: centimetre steps around the fighters (their blade and hat carve crisp
  // shafts), ~17 m steps at the far end where only the tree, pillars and hills still matter.
  float acc = 0.0, accGeo = 0.0, accAll = 0.0, trans = 1.0, gy = uVolGroundY;
  vec2 drift = uWind.xy * (uTime * 1.2);                   // mist banks drift downwind
  const float INV_N = 1.0 / float(STEPS);
  for (int i = 0; i < STEPS; i++) {
    float x = (float(i) + j) * INV_N;
    float t = tMax * x * x, dt = tMax * 2.0 * x * INV_N;
    vec3 p = uCamPos + rd * t;
    float geo = 1.0;
#if NUM_SHADOWS > 0
    geo = wxp_shadow(tShadowFar, sF0 + sFd * t, uBiasFar);
#endif
#if NUM_SHADOWS > 1
    geo *= wxp_shadow(tShadowNear, sN0 + sNd * t, uBiasNear);
#endif
    if ((i & 3) == 0) gy = WXP_GROUND(p.xz, uVolGroundY);   // terrain swells are big: every 4th step is plenty
    float lit = geo * mix(c0, c1, x * x);
    float y = max(p.y - gy, 0.0);
    float mist = smoothstep(0.38, 0.82, texture(tWindNoise, (p.xz + drift) * (1.0 / 267.0)).g);   // drifting pollen/mist banks
    float e = exp(-y * 0.05);
    float dens = 0.32 * e + 0.75 * mist * e * e * e;         // haze + pollen banks (e³ ≈ exp(-0.15y))
    if (uDustAmt > 0.0) dens += 0.25 * uDustAmt * exp(-y * 0.5);   // combat dust (uniform branch)
    dens *= uDensity;
    float w = dens * trans * dt;
    acc += lit * w; accGeo += geo * w; accAll += w;
    trans *= exp(-dens * dt * uExt);
  }
  // two-lobe phase: a tight forward lobe (the blaze around the sun) + a broad one so shafts still read 30–60° off-sun
  float mu = dot(rd, uSunDir);
  float ph = mix(wxp_hg(mu, 0.8), wxp_hg(mu, 0.3), uBroad) * 0.8 + 0.035;
  // alpha: shaft OCCLUSION of what lies behind (1 = open air). The fraction of the near air that the sun reaches,
  // weighted toward the sun direction, lets the composite carve the occluders' shadow volumes into the sky glow
  // and sun haze as well (the classic light-shaft occlusion term) instead of only adding light where it is lit.
  // Only what lies well behind the air gets carved (the sky glow, far haze): a near wall has no air in front of it.
  float litFrac = accAll > 1e-5 ? accGeo / accAll : 1.0;
  float toward = pow(max(mu, 0.0), 10.0) * smoothstep(15.0, 120.0, tMax);
  gl_FragColor = vec4(uSunCol * acc * ph * uScale, 1.0 - toward * (1.0 - pow(litFrac, uOccPow)));
}
`}var Pe=`
uniform sampler2D tSrc, tCopy;
uniform vec2 uStep;
varying vec2 vUv;
void main() {
  float d0 = texture(tCopy, vUv).a;
  vec4 acc = vec4(0.0); float ws = 0.0;
  for (int i = -4; i <= 4; i++) {
    vec2 uv = vUv + uStep * float(i);
    float d = texture(tCopy, uv).a;
    float w = exp(-float(i * i) * 0.12) / (1.0 + abs(d - d0) / max(d0, 1.0) * 8.0);
    acc += texture(tSrc, uv) * w; ws += w;
  }
  gl_FragColor = acc / ws;
}
`,Fe=`
uniform sampler2D tSrc, tCopy;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  float d0 = texture(tCopy, vUv).a;
  vec4 acc = vec4(0.0); float ws = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 uv = vUv + vec2(x, y) * uTexel * 1.6;
    float d = texture(tCopy, uv).a;
    float w = exp(-float(x * x + y * y) * 0.5) / (1.0 + abs(d - d0) / max(d0, 1.0) * 8.0);
    acc += texture(tSrc, uv) * w; ws += w;
  }
  gl_FragColor = acc / ws;
}
`,Ie=`
uniform sampler2D tCur, tHist, tCopy;
uniform mat4 uInvProj, uCamWorld, uPrevViewProj;
uniform vec3 uCamPos;
uniform vec2 uTexel;
uniform float uValid, uBlend;
varying vec2 vUv;
void main() {
  vec4 cur = texture(tCur, vUv);
  vec4 mn = cur, mx = cur;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    if (x == 0 && y == 0) continue;
    vec4 c = texture(tCur, vUv + vec2(x, y) * uTexel);
    mn = min(mn, c); mx = max(mx, c);
  }
  float lin = texture(tCopy, vUv).a;
  vec4 vd = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 vdir = normalize(vd.xyz / vd.w);
  vec3 wp = uCamPos + normalize(mat3(uCamWorld) * vdir) * (lin / max(-vdir.z, 1e-3));
  vec4 pc = uPrevViewProj * vec4(wp, 1.0);
  vec2 puv = pc.xy / pc.w * 0.5 + 0.5;
  // the current frame is raw, IGN-noisy march output, so its 3×3 box is already generous
  vec4 ext = (mx - mn) * 0.1;
  vec4 h = clamp(texture(tHist, puv), mn - ext, mx + ext);
  bool off = pc.w <= 0.0 || any(lessThan(puv, vec2(0.0))) || any(greaterThan(puv, vec2(1.0)));
  float k = (off || uValid < 0.5) ? 1.0 : uBlend;
  gl_FragColor = mix(h, cur, k);
}
`,Le=class{constructor(){this.steps=26,this.maxDist=220,this.far=null,this.near=null,this.rtVol=U(1,1,{name:`vol`}),this.rtVol2=U(1,1,{name:`vol2`}),this.rtHist=[U(1,1,{name:`volHistA`}),U(1,1,{name:`volHistB`})],this.cur=0,this.histValid=!1,this._numShadows=-1,this._steps=-1,this._dust=0,this.marchUniforms={...K?oe():ze([`uSunDir`,`uCloudShadow`,`uWind`,`uTime`]),uSunCol:E.uSunCol,tCopy:{value:null},tShadowFar:{value:null},uShadowMatFar:{value:new b},uBiasFar:{value:.001},tShadowNear:{value:null},uShadowMatNear:{value:new b},uBiasNear:{value:6e-4},uInvProj:{value:new b},uCamWorld:{value:new b},uCamPos:{value:new w},uFrame:{value:0},uVolGroundY:{value:0},uDustAmt:{value:0},uMaxDist:{value:220},uDensity:{value:1},uCloudK:{value:1},uExt:{value:.004},uScale:{value:.0054},uBroad:{value:.3},uOccPow:{value:3},tWindNoise:E.tWindNoise},this.march=null,this.blur=H({name:`volBlur`,fragmentShader:Fe,uniforms:{tSrc:{value:null},tCopy:{value:null},uTexel:{value:new C}}}),this.temporal=H({name:`volTemporal`,fragmentShader:Ie,uniforms:{tCur:{value:null},tHist:{value:null},tCopy:{value:null},uInvProj:{value:new b},uCamWorld:{value:new b},uPrevViewProj:{value:new b},uCamPos:{value:new w},uTexel:{value:new C},uValid:{value:0},uBlend:{value:.22}}})}get texture(){return this.rtVol2.texture}setShadowSources(e,t){this.far=e||null,this.near=t||null,this.histValid=!1}setSize(e,t){for(let n of[this.rtVol,this.rtVol2,...this.rtHist])n.setSize(e,t);this.w=e,this.h=t,this.histValid=!1}_ensureMarch(e){this.march&&e===this._numShadows&&this.steps===this._steps||(this.march?.dispose(),this._numShadows=e,this._steps=this.steps,this.march=H({name:`volMarch`,fragmentShader:Ne(K),uniforms:this.marchUniforms,defines:{STEPS:this.steps|0,NUM_SHADOWS:e}}))}render(e,t,n,r){let i=q(this.far),a=q(this.near),o=i?a?2:1:0;this._ensureMarch(o);let s=this.marchUniforms;i&&(s.tShadowFar.value=i,s.uShadowMatFar.value.copy(this.far.shadow.matrix),s.uBiasFar.value=Be(this.far,.6)),a&&(s.tShadowNear.value=a,s.uShadowMatNear.value.copy(this.near.shadow.matrix),s.uBiasNear.value=Be(this.near,.06)),s.tCopy.value=n,s.uInvProj.value.copy(t.invProj),s.uCamWorld.value.copy(t.camWorld),s.uCamPos.value.copy(t.camPos),s.uFrame.value=t.index,s.uVolGroundY.value=t.groundY,s.uMaxDist.value=this.maxDist,s.uDensity.value=r.volDensity??1,s.uCloudK.value=r.volClouds??1,s.uExt.value=r.volExtinction??.004,s.uScale.value=r.volScale??.0054,s.uBroad.value=r.volBroad??.3,s.uOccPow.value=r.volOccPow??3,s.uDustAmt.value=this._dust,V(e,this.march,this.rtVol);let c=this.cur;this.cur^=1;let l=this.temporal.uniforms;l.tCur.value=this.rtVol.texture,l.tHist.value=this.rtHist[c].texture,l.tCopy.value=n,l.uInvProj.value.copy(t.invProj),l.uCamWorld.value.copy(t.camWorld),l.uCamPos.value.copy(t.camPos),l.uPrevViewProj.value.copy(t.prevViewProj),l.uTexel.value.set(1/this.w,1/this.h),l.uValid.value=this.histValid&&t.historyOk?1:0,l.uBlend.value=r.volBlend??.22,V(e,this.temporal,this.rtHist[this.cur]);let u=this.blur.uniforms;u.tCopy.value=n,u.tSrc.value=this.rtHist[this.cur].texture,u.uTexel.value.set(1/this.w,1/this.h),V(e,this.blur,this.rtVol2),this.histValid=!0}clear(e){let t=e.getClearColor(Re),n=e.getClearAlpha();e.setClearColor(0,1);for(let t of[...this.rtHist,this.rtVol2])e.setRenderTarget(t),e.clear(!0,!1,!1);e.setClearColor(t,n),this.histValid=!1}addDust(e){this._dust=Math.min(1,this._dust+e)}tick(e){this._dust=Math.max(0,this._dust-e/1.5)}dispose(){for(let e of[this.rtVol,this.rtVol2,...this.rtHist])e.dispose();this.march?.dispose(),this.blur.dispose(),this.temporal.dispose()}},Re=new p;function ze(e){let t={};for(let n of e)t[n]=E[n];return t}function q(e){let t=e?.shadow?.map?.depthTexture;return e&&e.castShadow&&t&&t.compareFunction?t:null}function Be(e,t){let n=e.shadow.camera;return t/Math.max(.001,n.far-n.near)}var Ve=`
${G}
uniform sampler2D tCopy;
uniform mat4 uProj, uInvProj;
uniform vec2 uTexel;
uniform float uFrame;
varying vec2 vUv;

vec3 viewPos(vec2 uv, float lin) {
  vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  vec3 dir = v.xyz / v.w;
  return dir * (lin / max(-dir.z, 1e-4));
}
vec3 viewPosAt(vec2 uv) { return viewPos(uv, texture(tCopy, uv).a); }

void main() {
  float lin = texture(tCopy, vUv).a;
  if (lin > 160.0) { gl_FragColor = vec4(1.0); return; }
  vec3 P = viewPos(vUv, lin);
  // depth-derived normal: per axis use the neighbour whose depth is closer (no silhouette smearing)
  vec3 pl = viewPosAt(vUv - vec2(uTexel.x, 0.0)), pr = viewPosAt(vUv + vec2(uTexel.x, 0.0));
  vec3 pd = viewPosAt(vUv - vec2(0.0, uTexel.y)), pu = viewPosAt(vUv + vec2(0.0, uTexel.y));
  vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl;
  vec3 dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;
  vec3 N = normalize(cross(dx, dy));
  if (dot(N, P) > 0.0) N = -N;
  float dist = length(P);
  float R = clamp(0.5 + 0.02 * dist, 0.5, 1.6);
  float bias = 0.03 + 0.002 * dist;
  // tangent frame
  vec3 T = normalize(abs(N.y) < 0.99 ? cross(N, vec3(0.0, 1.0, 0.0)) : cross(N, vec3(1.0, 0.0, 0.0)));
  vec3 B = cross(N, T);
  float rot = wxp_ign(gl_FragCoord.xy) * 6.2831853;
  float occ = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    float fi = float(i);
    float a = fi * 2.39996 + rot;
    float r = sqrt((fi + 0.5) / float(SAMPLES));
    float h = 0.25 + 0.75 * fract(fi * 0.618 + rot * 0.159);
    float s = (0.35 + 0.65 * fract(fi * 0.37 + 0.13)) * R;
    vec3 sp = P + (T * (cos(a) * r) + B * (sin(a) * r) + N * h) * s;
    vec4 clip = uProj * vec4(sp, 1.0);
    vec2 suv = clip.xy / clip.w * 0.5 + 0.5;
    if (any(lessThan(suv, vec2(0.0))) || any(greaterThan(suv, vec2(1.0)))) continue;
    float sceneD = texture(tCopy, suv).a;
    float diff = -sp.z - sceneD;                 // > 0: the scene surface is in front of the sample point
    occ += step(bias, diff) * smoothstep(1.0, 0.0, (diff - R) / R);
  }
  float ao = 1.0 - occ / float(SAMPLES);
  gl_FragColor = vec4(ao, 1.0, 1.0, 1.0);
}
`,He=class{constructor(){this.samples=8,this.rtA=U(1,1,{name:`ao`,format:s}),this.rtB=U(1,1,{name:`ao2`,format:s}),this._samples=-1,this.uniforms={tCopy:{value:null},uProj:{value:new b},uInvProj:{value:new b},uTexel:{value:new C},uFrame:{value:0}},this.mat=null,this.blur=H({name:`aoBlur`,fragmentShader:Pe,uniforms:{tSrc:{value:null},tCopy:{value:null},uStep:{value:new C}}})}get texture(){return this.rtA.texture}setSize(e,t){this.rtA.setSize(e,t),this.rtB.setSize(e,t),this.w=e,this.h=t}render(e,t,n){this._samples!==this.samples&&(this.mat?.dispose(),this._samples=this.samples,this.mat=H({name:`ssao`,fragmentShader:Ve,uniforms:this.uniforms,defines:{SAMPLES:this.samples|0}}));let r=this.uniforms;r.tCopy.value=n,r.uProj.value.copy(t.proj),r.uInvProj.value.copy(t.invProj),r.uTexel.value.set(1/this.w,1/this.h),r.uFrame.value=t.index,V(e,this.mat,this.rtA);let i=this.blur.uniforms;i.tCopy.value=n,i.tSrc.value=this.rtA.texture,i.uStep.value.set(1.2/this.w,0),V(e,this.blur,this.rtB),i.tSrc.value=this.rtB.texture,i.uStep.value.set(0,1.2/this.h),V(e,this.blur,this.rtA)}clear(e){e.setRenderTarget(this.rtA);let t=e.getClearColor(Ue),n=e.getClearAlpha();e.setClearColor(16777215,1),e.clear(!0,!1,!1),e.setClearColor(t,n)}dispose(){this.rtA.dispose(),this.rtB.dispose(),this.mat?.dispose(),this.blur.dispose()}},Ue=new p,We=`
${G}
uniform sampler2D tScene, tVol;
uniform vec2 uTexel;          // full-res texel
uniform float uVolAmt, uVolOcc, uThreshold, uKnee;
varying vec2 vUv;
vec3 tap(vec2 o) { return min(texture(tScene, vUv + o * uTexel).rgb, vec3(60.0)); }
void main() {
  // 4 bilinear taps = a 4×4 full-res footprint. Karis (1/(1+luma)) weights stop sub-pixel glints on grass
  // tips and the blade from flickering the whole halo.
  vec3 a = tap(vec2(-1.0, -1.0)), b = tap(vec2(1.0, -1.0)), c = tap(vec2(-1.0, 1.0)), d = tap(vec2(1.0, 1.0));
  float wa = 1.0 / (1.0 + dot(a, WXP_LUMA709)), wb = 1.0 / (1.0 + dot(b, WXP_LUMA709));
  float wc = 1.0 / (1.0 + dot(c, WXP_LUMA709)), wd = 1.0 / (1.0 + dot(d, WXP_LUMA709));
  vec3 col = (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);
  vec4 vol = texture(tVol, vUv);
  col = col * mix(1.0, clamp(vol.a, 0.0, 1.0), uVolOcc * min(uVolAmt, 1.0)) + vol.rgb * uVolAmt;   // same shaft terms as the composite
  col = min(col, vec3(60.0));
  float l = dot(col, WXP_LUMA709);
  float k = max(l - uThreshold, 0.0); k = k * k / (k + uKnee);
  gl_FragColor = vec4(col * (k / max(l, 1e-4)), 1.0);
}
`,Ge=`
uniform sampler2D tSrc;
uniform vec2 uTexel;          // source texel
varying vec2 vUv;
void main() {
  vec3 c = texture(tSrc, vUv).rgb * 4.0;
  c += texture(tSrc, vUv + vec2(-1.0, -1.0) * uTexel).rgb;
  c += texture(tSrc, vUv + vec2(1.0, -1.0) * uTexel).rgb;
  c += texture(tSrc, vUv + vec2(-1.0, 1.0) * uTexel).rgb;
  c += texture(tSrc, vUv + vec2(1.0, 1.0) * uTexel).rgb;
  gl_FragColor = vec4(c * 0.125, 1.0);
}
`,Ke=`
uniform sampler2D tCoarse, tFine;
uniform vec2 uTexel;          // coarse texel
uniform float uWeight;
varying vec2 vUv;
void main() {
  vec3 c = (texture(tCoarse, vUv + vec2(-1.0, 0.0) * uTexel).rgb + texture(tCoarse, vUv + vec2(1.0, 0.0) * uTexel).rgb
          + texture(tCoarse, vUv + vec2(0.0, -1.0) * uTexel).rgb + texture(tCoarse, vUv + vec2(0.0, 1.0) * uTexel).rgb) * 2.0;
  c += texture(tCoarse, vUv + vec2(-1.0, -1.0) * uTexel).rgb + texture(tCoarse, vUv + vec2(1.0, -1.0) * uTexel).rgb
     + texture(tCoarse, vUv + vec2(-1.0, 1.0) * uTexel).rgb + texture(tCoarse, vUv + vec2(1.0, 1.0) * uTexel).rgb;
  gl_FragColor = vec4(texture(tFine, vUv).rgb + c / 12.0 * uWeight, 1.0);
}
`,qe=class{constructor(e=6){this.levels=e,this.mips=[],this.ups=[];for(let e=0;e<7;e++)this.mips.push(U(1,1,{name:`bloomMip${e}`})),this.ups.push(U(1,1,{name:`bloomUp${e}`}));this.bright=H({name:`bloomBright`,fragmentShader:We,uniforms:{tScene:{value:null},tVol:{value:null},uTexel:{value:new C},uVolAmt:{value:.85},uVolOcc:{value:.6},uThreshold:{value:.9},uKnee:{value:1.2}}}),this.down=H({name:`bloomDown`,fragmentShader:Ge,uniforms:{tSrc:{value:null},uTexel:{value:new C}}}),this.up=H({name:`bloomUp`,fragmentShader:Ke,uniforms:{tCoarse:{value:null},tFine:{value:null},uTexel:{value:new C},uWeight:{value:.85}}}),this.output=this.ups[0]}get texture(){return this.output.texture}setSize(e,t){let n=e,r=t;for(let e=0;e<this.mips.length;e++)this.mips[e].setSize(n,r),this.ups[e].setSize(n,r),n=Math.max(2,Math.round(n/2)),r=Math.max(2,Math.round(r/2))}render(e,t,n,r,i,a){let o=Math.max(2,Math.min(this.levels,this.mips.length)),s=this.bright.uniforms;s.tScene.value=t,s.tVol.value=n,s.uTexel.value.set(1/r,1/i),s.uVolAmt.value=a.vol,s.uVolOcc.value=a.volOcclusion??.6,s.uThreshold.value=a.bloomThreshold,s.uKnee.value=a.bloomKnee,V(e,this.bright,this.mips[0]);let c=this.down.uniforms;for(let t=1;t<o;t++){let n=this.mips[t-1];c.tSrc.value=n.texture,c.uTexel.value.set(1/n.width,1/n.height),V(e,this.down,this.mips[t])}let l=this.up.uniforms;l.uWeight.value=a.bloomSpread??.85;let u=this.mips[o-1];for(let t=o-2;t>=0;t--)l.tCoarse.value=u.texture,l.tFine.value=this.mips[t].texture,l.uTexel.value.set(1/u.width,1/u.height),V(e,this.up,this.ups[t]),u=this.ups[t];this.output=this.ups[0]}dispose(){for(let e of[...this.mips,...this.ups])e.dispose();this.bright.dispose(),this.down.dispose(),this.up.dispose()}},Je=`
${G}
uniform sampler2D tCur, tHist, tDepth;
uniform mat4 uInvViewProj, uPrevViewProj;
uniform vec2 uTexel, uSize;     // history (output) texel / size
uniform vec2 uCurTexel, uJit;   // current (scene) texel; this frame's jitter in UV (unjitters the scene sample)
uniform float uValid, uBlend, uGamma;
varying vec2 vUv;

vec3 tm(vec3 c) { return c / (1.0 + max(c.r, max(c.g, c.b))); }
vec3 itm(vec3 c) { return c / max(1.0 - max(c.r, max(c.g, c.b)), 1e-3); }

vec3 historyCatmullRom(vec2 uv) {
  vec2 sp = uv * uSize;
  vec2 t1 = floor(sp - 0.5) + 0.5;
  vec2 f = sp - t1;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 t0 = (t1 - 1.0) * uTexel, t3 = (t1 + 2.0) * uTexel, t12 = (t1 + w2 / w12) * uTexel;
  vec3 r = texture(tHist, vec2(t12.x, t0.y)).rgb * (w12.x * w0.y)
         + texture(tHist, vec2(t0.x, t12.y)).rgb * (w0.x * w12.y)
         + texture(tHist, vec2(t12.x, t12.y)).rgb * (w12.x * w12.y)
         + texture(tHist, vec2(t3.x, t12.y)).rgb * (w3.x * w12.y)
         + texture(tHist, vec2(t12.x, t3.y)).rgb * (w12.x * w3.y);
  float ws = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
  return max(r / ws, vec3(0.0));
}

void main() {
  // upsampling (scene rendered below output size): the scene is sampled unjittered at this output pixel, so the
  // Halton offsets land on different sub-pixels each frame and the history integrates the missing detail
  vec2 cuv = vUv + uJit;
  vec3 cur = texture(tCur, cuv).rgb;
  vec3 cy = wxp_toYCoCg(tm(cur));
  vec3 m1 = cy, m2 = cy * cy;
  float zMin = texture(tDepth, cuv).x; vec2 zOff = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    if (x == 0 && y == 0) continue;
    vec2 o = vec2(float(x), float(y));
    vec3 c = wxp_toYCoCg(tm(texture(tCur, cuv + o * uCurTexel).rgb));
    m1 += c; m2 += c * c;
    float z = texture(tDepth, cuv + o * uCurTexel).x;
    if (z < zMin) { zMin = z; zOff = o; }
  }
  vec3 mean = m1 / 9.0;
  vec3 sigma = sqrt(abs(m2 / 9.0 - mean * mean));
  vec3 ext = uGamma * sigma + vec3(1e-4);

  // reproject using the closest depth of the 3×3 (keeps foreground silhouettes from trailing)
  vec2 uvz = vUv + zOff * uCurTexel;
  vec4 wp = uInvViewProj * vec4(uvz * 2.0 - 1.0, zMin * 2.0 - 1.0, 1.0);
  wp /= wp.w;
  vec4 pc = uPrevViewProj * wp;
  vec2 puv = pc.xy / pc.w * 0.5 + 0.5;
  vec2 hUv = vUv + (puv - uvz);
  bool off = pc.w <= 0.0 || any(lessThan(hUv, vec2(0.0))) || any(greaterThan(hUv, vec2(1.0)));

  vec3 hy = wxp_toYCoCg(tm(historyCatmullRom(hUv)));
  // variance clip toward the mean (Salvi / Playdead)
  vec3 v = hy - mean; vec3 a = abs(v / ext);
  float mm = max(a.x, max(a.y, a.z));
  if (mm > 1.0) hy = mean + v / mm;

  // luminance-difference feedback: accept more of the current frame where history had to be clipped hard
  float k = uBlend * (1.0 + clamp(mm - 1.0, 0.0, 1.0));
  if (off || uValid < 0.5) k = 1.0;
  vec3 res = mix(hy, cy, k);
  gl_FragColor = vec4(itm(max(wxp_fromYCoCg(res), vec3(0.0))), 1.0);
}
`,Ye=class{constructor(){this.rt=[U(1,1,{name:`taaA`}),U(1,1,{name:`taaB`})],this.cur=0,this.valid=!1,this.index=0,this.offset=new C,this._saved=new b,this._savedInv=new b,this._cam=null,this.mat=H({name:`taa`,fragmentShader:Je,uniforms:{tCur:{value:null},tHist:{value:null},tDepth:{value:null},uInvViewProj:{value:new b},uPrevViewProj:{value:new b},uTexel:{value:new C},uSize:{value:new C},uCurTexel:{value:new C},uJit:{value:new C},uValid:{value:0},uBlend:{value:.1},uGamma:{value:1}}})}get texture(){return this.rt[this.cur].texture}setSize(e,t,n=e,r=t){for(let n of this.rt)n.setSize(e,t);this.w=e,this.h=t,this.sw=n,this.sh=r,this.valid=!1}jitter(e,t,n,r=1){this.index=(this.index+1)%8,this.offset.set((W(this.index+1,2)-.5)*r,(W(this.index+1,3)-.5)*r),this._cam=e,this._saved.copy(e.projectionMatrix),this._savedInv.copy(e.projectionMatrixInverse);let i=e.projectionMatrix.elements;i[8]+=2*this.offset.x/t,i[9]+=2*this.offset.y/n,e.projectionMatrixInverse.copy(e.projectionMatrix).invert()}restore(){this._cam&&=(this._cam.projectionMatrix.copy(this._saved),this._cam.projectionMatrixInverse.copy(this._savedInv),null)}render(e,t,n,r,i){let a=this.cur;this.cur^=1;let o=this.mat.uniforms;o.tCur.value=t,o.tDepth.value=n,o.tHist.value=this.rt[a].texture,o.uInvViewProj.value.copy(r.viewProj).invert(),o.uPrevViewProj.value.copy(r.prevViewProj),o.uTexel.value.set(1/this.w,1/this.h),o.uSize.value.set(this.w,this.h);let s=this.sw??this.w,c=this.sh??this.h;o.uCurTexel.value.set(1/s,1/c),o.uJit.value.set(this.offset.x/s,this.offset.y/c),o.uValid.value=this.valid&&r.historyOk?1:0,o.uBlend.value=i.taaBlend??.1,o.uGamma.value=i.taaGamma??1,V(e,this.mat,this.rt[this.cur]),this.valid=!0}dispose(){for(let e of this.rt)e.dispose();this.mat.dispose()}},Xe={none:0,ao:1,vol:2,bloom:3,depth:4,copy:5},Ze=`
${G}
${D(`vec3`,`uSunCol`)}${D(`float`,`uSunVis`)}${D(`float`,`uStorm`)}${D(`float`,`uNight`)}
uniform sampler2D tScene, tDepth, tCopy, tAO, tVol, tBloom;
uniform vec2 uNearFar, uHalfSize, uTexel;
uniform float uAspect;
uniform float uCA, uAO, uVolAmt, uVolOcc, uHueKeep, uBloom, uExposure, uWarm, uSat, uVigFloor, uLowHealth, uPulse, uSlowmo, uLetterbox;
uniform vec3 uRadial;          // xy centre (uv), z strength
uniform vec3 uSunScreen;       // xy uv, z > 0 when the sun is in front
uniform vec4 uFlash;           // rgb * intensity
uniform int uDebug;
varying vec2 vUv;

vec3 grade(vec3 m) {
  float l = dot(m, WXP_LUMA601);
  m += vec3(0.006, 0.020, 0.026) * (1.0 - smoothstep(0.0, 0.4, l));            // teal shadow lift
  m  = mix(m, m * vec3(1.05, 0.99, 0.88), smoothstep(0.4, 1.0, l));           // amber highlights
  float lime = smoothstep(0.0, 0.06, m.g - max(m.r * 0.95, m.b)) * smoothstep(0.3, 0.8, l);
  m  = mix(m, m * vec3(1.07, 0.97, 0.80), lime * 0.6);                        // lime → gold in bright greens
  m  = mix(vec3(l), m, uSat);
  m  = clamp(m, 0.0, 1.0);
  m  = mix(m, m * m * (3.0 - 2.0 * m), 0.38);                                 // S-curve
  return m;
}

void main() {
  vec2 uv = vUv;
  vec2 cc = uv - 0.5;
  float r2 = dot(cc, cc);

  // 1 chromatic aberration (radial², plus the hit kick folded into uCA)
  vec2 ca = cc * r2 * uCA;
  vec3 col = vec3(texture(tScene, uv - ca).r, texture(tScene, uv).g, texture(tScene, uv + ca).b);
  // 1b radial hit blur toward the impact point
  if (uRadial.z > 0.0005) {
    vec2 dir = uRadial.xy - uv;
    vec3 acc = col;
    for (int i = 1; i < 8; i++) acc += texture(tScene, uv + dir * (float(i) / 7.0) * uRadial.z).rgb;
    col = acc * 0.125;
  }

  // joint-bilateral upsample weights for the half-res AO + shafts
  float zf = wxp_linearDepth(texture(tDepth, uv).x, uNearFar);
  vec2 hp = uv * uHalfSize - 0.5;
  vec2 f = fract(hp);
  ivec2 i0 = ivec2(floor(hp)), hmax = ivec2(uHalfSize) - 1;
  ivec2 p00 = clamp(i0, ivec2(0), hmax), p10 = clamp(i0 + ivec2(1, 0), ivec2(0), hmax);
  ivec2 p01 = clamp(i0 + ivec2(0, 1), ivec2(0), hmax), p11 = clamp(i0 + ivec2(1, 1), ivec2(0), hmax);
  vec4 dz = vec4(texelFetch(tCopy, p00, 0).a, texelFetch(tCopy, p10, 0).a, texelFetch(tCopy, p01, 0).a, texelFetch(tCopy, p11, 0).a);
  dz = abs(dz - zf) / max(zf, 0.3);
  vec4 w = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y) / (4e-4 + dz * dz);
  w /= dot(w, vec4(1.0));
  float ao = texelFetch(tAO, p00, 0).r * w.x + texelFetch(tAO, p10, 0).r * w.y + texelFetch(tAO, p01, 0).r * w.z + texelFetch(tAO, p11, 0).r * w.w;
  vec4 volS = texelFetch(tVol, p00, 0) * w.x + texelFetch(tVol, p10, 0) * w.y + texelFetch(tVol, p01, 0) * w.z + texelFetch(tVol, p11, 0) * w.w;
  vec3 vol = volS.rgb;
  vec3 bloom = texture(tBloom, uv).rgb;

  // 2 AO (distance-faded: never muddies the far slopes)
  col *= mix(1.0, pow(clamp(ao, 0.0, 1.0), 1.4), uAO * (1.0 - smoothstep(60.0, 150.0, zf)));
  // 3 shafts (occlusion carves the shadow volumes into the glow behind, then in-scatter) + bloom + sun veil
  col *= mix(1.0, clamp(volS.a, 0.0, 1.0), uVolOcc * min(uVolAmt, 1.0));
  col += vol * uVolAmt;
  col += bloom * uBloom;
  if (uSunScreen.z > 0.0) {
    float sunOpen = mix(1.0, texture(tVol, uSunScreen.xy).a, uVolOcc);     // the veil dims when the sun is behind the tree
    col += uSunCol * 0.012 * exp(-length((uv - uSunScreen.xy) * vec2(uAspect, 1.0)) * 3.2) * uSunVis * (1.0 - uStorm) * uSunScreen.z * sunOpen;
  }
  // 4 exposure (keyframe + kicks) and flash
  col *= uExposure;
  col += uFlash.rgb * uFlash.a;
  // 5 white balance in HDR
  float lum = dot(col, WXP_LUMA709);
  col = mix(col, col * vec3(1.06, 1.0, 0.90), smoothstep(0.05, 0.8, lum) * uWarm);
  col = mix(col, col * vec3(0.90, 1.0, 1.07), 1.0 - smoothstep(0.0, 0.12, lum));
  col = mix(col, vec3(lum) * vec3(0.72, 0.88, 1.22), uNight * 0.55 * (1.0 - smoothstep(0.02, 0.35, lum)));
  col = mix(col, vec3(lum) * vec3(0.95, 1.0, 1.06), uStorm * 0.3);
  // 6 ACES fitted, with part of the highlight hue kept: per-channel ACES bleaches the golden haze, grass tips and sun
  // glow toward cream; tone-mapping the max channel and scaling rgb keeps them gold (palette: horizon #ffc495,
  // bleached tips #e5d4a2). Fades out toward the sun disc, which should still burn white.
  col = max(col, vec3(0.0));
  vec3 m = wxp_aces(col);
  float cmx = max(col.r, max(col.g, col.b));
  if (uHueKeep > 0.0 && cmx > 1e-4) {
    vec3 hp = col * (wxp_aces(vec3(cmx)).g / cmx);
    float k = uHueKeep * smoothstep(0.15, 0.6, cmx) * (1.0 - smoothstep(3.0, 14.0, cmx));
    m = mix(m, hp, k);
  }
  // 7 painterly grade
  m = grade(m);
  // 7b slow-mo "focus": drained colour, deeper blacks, a breath of cold in the shadows
  if (uSlowmo > 0.0) {
    float l = dot(m, WXP_LUMA601);
    vec3 d = mix(vec3(l), m, 0.55) * mix(vec3(0.94, 0.98, 1.06), vec3(1.03, 1.0, 0.95), smoothstep(0.2, 0.7, l));
    d = mix(d, d * d * (3.0 - 2.0 * d), 0.35);
    m = mix(m, d, uSlowmo);
  }
  // 8 vignette (floor 0.68; low health 0.50 + 35% desaturation + a slow crimson heartbeat at the edges)
  float vig = 1.0 - smoothstep(0.35, 1.05, length(cc * vec2(1.05, 1.25)));
  float floorV = mix(uVigFloor, 0.50, uLowHealth) - 0.10 * uSlowmo;
  m *= mix(floorV, 1.0, vig);
  float lm = dot(m, WXP_LUMA601);
  m = mix(m, vec3(lm), uLowHealth * 0.35 * (1.0 - vig * 0.5));
  m = mix(m, m * vec3(0.55, 0.12, 0.10), uLowHealth * (0.35 + 0.25 * uPulse) * smoothstep(0.55, 0.0, vig));
  // 9 letterbox (2.39:1)
  if (uLetterbox > 0.0) {
    float bar = max(0.0, 0.5 - 0.5 * uAspect / 2.39) * uLetterbox;
    float e = uTexel.y * 1.5;
    m *= smoothstep(bar - e, bar + e, uv.y) * smoothstep(bar - e, bar + e, 1.0 - uv.y);
  }

  // debug views (params.debugView)
  if (uDebug == 1) m = vec3(ao);
  else if (uDebug == 2) m = wxp_aces(vol * uVolAmt * uExposure * 1.5) * mix(0.35, 1.0, volS.a);
  else if (uDebug == 3) m = wxp_aces(bloom * uBloom * uExposure * 6.0);
  else if (uDebug == 4) m = vec3(1.0 - log2(1.0 + zf) / log2(1.0 + uNearFar.y));
  else if (uDebug == 5) m = wxp_aces(texture(tCopy, uv).rgb * uExposure);

  vec3 s = wxp_toSRGB(m);
  gl_FragColor = vec4(s, dot(s, WXP_LUMA601));
}
`;function Qe(){return H({name:`composite`,fragmentShader:Ze,uniforms:{uSunCol:E.uSunCol,uSunVis:E.uSunVis,uStorm:E.uStorm,uNight:E.uNight,tScene:{value:null},tDepth:{value:null},tCopy:{value:null},tAO:{value:null},tVol:{value:null},tBloom:{value:null},uNearFar:{value:new C(.3,7e3)},uHalfSize:{value:new C(1,1)},uTexel:{value:new C(1,1)},uAspect:{value:16/9},uCA:{value:.0065},uAO:{value:.55},uVolAmt:{value:.85},uVolOcc:{value:.6},uHueKeep:{value:.45},uBloom:{value:.055},uExposure:{value:1.05},uWarm:{value:1},uSat:{value:1.1},uVigFloor:{value:.68},uLowHealth:{value:0},uPulse:{value:0},uSlowmo:{value:0},uLetterbox:{value:0},uRadial:{value:new w(.5,.5,0)},uSunScreen:{value:new w},uFlash:{value:new y},uDebug:{value:0}}})}var $e=`
${G}
uniform sampler2D tLDR;
uniform vec2 uTexel;
uniform float uSharpen, uGrain, uFrame, uFade;
uniform vec3 uFadeColor;        // display-referred (sRGB) colour
varying vec2 vUv;

#define L(o) textureLodOffset(tLDR, uv, 0.0, o).a
float lumaAt(vec2 p) { return textureLod(tLDR, p, 0.0).a; }

void main() {
  vec2 uv = vUv;
  vec4 M = textureLod(tLDR, uv, 0.0);
  float lumaM = M.a;
  float lumaS = L(ivec2(0, 1)), lumaE = L(ivec2(1, 0)), lumaN = L(ivec2(0, -1)), lumaW = L(ivec2(-1, 0));
  float rangeMax = max(max(lumaN, lumaW), max(lumaE, max(lumaS, lumaM)));
  float rangeMin = min(min(lumaN, lumaW), min(lumaE, min(lumaS, lumaM)));
  float range = rangeMax - rangeMin;
  vec3 rgb;
#if FXAA
  if (range < max(0.0312, rangeMax * 0.125)) {
#else
  if (true) {
#endif
    // not an edge (or TAA mode): unsharp mask against the 4-neighbour average
    vec3 avg = (textureLodOffset(tLDR, uv, 0.0, ivec2(0, 1)).rgb + textureLodOffset(tLDR, uv, 0.0, ivec2(1, 0)).rgb
              + textureLodOffset(tLDR, uv, 0.0, ivec2(0, -1)).rgb + textureLodOffset(tLDR, uv, 0.0, ivec2(-1, 0)).rgb) * 0.25;
    rgb = M.rgb + (M.rgb - avg) * uSharpen;
  } else {
    float lumaNW = L(ivec2(-1, -1)), lumaSE = L(ivec2(1, 1)), lumaNE = L(ivec2(1, -1)), lumaSW = L(ivec2(-1, 1));
    float lumaNS = lumaN + lumaS, lumaWE = lumaW + lumaE;
    float subpixRcpRange = 1.0 / range;
    float subpixNSWE = lumaNS + lumaWE;
    float edgeHorz1 = -2.0 * lumaM + lumaNS, edgeVert1 = -2.0 * lumaM + lumaWE;
    float lumaNESE = lumaNE + lumaSE, lumaNWNE = lumaNW + lumaNE;
    float edgeHorz2 = -2.0 * lumaE + lumaNESE, edgeVert2 = -2.0 * lumaN + lumaNWNE;
    float lumaNWSW = lumaNW + lumaSW, lumaSWSE = lumaSW + lumaSE;
    float edgeHorz4 = abs(edgeHorz1) * 2.0 + abs(edgeHorz2), edgeVert4 = abs(edgeVert1) * 2.0 + abs(edgeVert2);
    float edgeHorz3 = -2.0 * lumaW + lumaNWSW, edgeVert3 = -2.0 * lumaS + lumaSWSE;
    float edgeHorz = abs(edgeHorz3) + edgeHorz4, edgeVert = abs(edgeVert3) + edgeVert4;
    float subpixNWSWNESE = lumaNWSW + lumaNESE;
    float lengthSign = uTexel.x;
    bool horzSpan = edgeHorz >= edgeVert;
    float subpixA = subpixNSWE * 2.0 + subpixNWSWNESE;
    if (!horzSpan) { lumaN = lumaW; lumaS = lumaE; } else lengthSign = uTexel.y;
    float subpixB = subpixA * (1.0 / 12.0) - lumaM;
    float gradientN = lumaN - lumaM, gradientS = lumaS - lumaM;
    float lumaNN = lumaN + lumaM, lumaSS = lumaS + lumaM;
    bool pairN = abs(gradientN) >= abs(gradientS);
    float gradient = max(abs(gradientN), abs(gradientS));
    if (pairN) lengthSign = -lengthSign;
    float subpixC = clamp(abs(subpixB) * subpixRcpRange, 0.0, 1.0);
    vec2 posB = uv;
    vec2 offNP = horzSpan ? vec2(uTexel.x, 0.0) : vec2(0.0, uTexel.y);
    if (!horzSpan) posB.x += lengthSign * 0.5; else posB.y += lengthSign * 0.5;
    vec2 posN = posB - offNP, posP = posB + offNP;
    float subpixD = -2.0 * subpixC + 3.0;
    float lumaEndN = lumaAt(posN), lumaEndP = lumaAt(posP);
    float subpixE = subpixC * subpixC;
    if (!pairN) lumaNN = lumaSS;
    float gradientScaled = gradient * 0.25;
    float lumaMM = lumaM - lumaNN * 0.5;
    float subpixF = subpixD * subpixE;
    bool lumaMLTZero = lumaMM < 0.0;
    lumaEndN -= lumaNN * 0.5; lumaEndP -= lumaNN * 0.5;
    bool doneN = abs(lumaEndN) >= gradientScaled, doneP = abs(lumaEndP) >= gradientScaled;
    if (!doneN) posN -= offNP;
    if (!doneP) posP += offNP;
    const float STEPS[8] = float[8](1.0, 1.5, 1.5, 1.5, 2.0, 2.0, 4.0, 4.0);   // after the two 1.0 steps above
    for (int i = 0; i < 8; i++) {
      if (doneN && doneP) break;
      if (!doneN) lumaEndN = lumaAt(posN) - lumaNN * 0.5;
      if (!doneP) lumaEndP = lumaAt(posP) - lumaNN * 0.5;
      doneN = abs(lumaEndN) >= gradientScaled; doneP = abs(lumaEndP) >= gradientScaled;
      if (!doneN) posN -= offNP * STEPS[i];
      if (!doneP) posP += offNP * STEPS[i];
    }
    float dstN = horzSpan ? uv.x - posN.x : uv.y - posN.y;
    float dstP = horzSpan ? posP.x - uv.x : posP.y - uv.y;
    bool goodSpanN = (lumaEndN < 0.0) != lumaMLTZero, goodSpanP = (lumaEndP < 0.0) != lumaMLTZero;
    float spanLengthRcp = 1.0 / (dstP + dstN);
    bool directionN = dstN < dstP;
    float dst = min(dstN, dstP);
    bool goodSpan = directionN ? goodSpanN : goodSpanP;
    float subpixG = subpixF * subpixF;
    float pixelOffset = dst * -spanLengthRcp + 0.5;
    float subpixH = subpixG * 0.75;
    float pixelOffsetSubpix = max(goodSpan ? pixelOffset : 0.0, subpixH);
    vec2 posM = uv;
    if (!horzSpan) posM.x += pixelOffsetSubpix * lengthSign; else posM.y += pixelOffsetSubpix * lengthSign;
    rgb = textureLod(tLDR, posM, 0.0).rgb;
  }

  // film grain (heavier in the shadows) + dither, after AA
  vec2 fc = gl_FragCoord.xy;
  float fr = mod(uFrame, 1024.0);
  float l = dot(rgb, WXP_LUMA601);
  rgb += (wxp_hash12(fc + fract(fr * 0.618034) * 311.0) - 0.5) * uGrain * (1.0 - 0.6 * clamp(l, 0.0, 1.0));
  rgb += (wxp_hash12(fc.yx * 1.3 + fr * 0.713) - 0.5) / 255.0;
  rgb = mix(rgb, uFadeColor, uFade);
  gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
}
`;function J(e=!0){return H({name:`final`,fragmentShader:$e,defines:{FXAA:+!!e},uniforms:{tLDR:{value:null},uTexel:{value:new C},uSharpen:{value:.35},uGrain:{value:.028},uFrame:{value:0},uFade:{value:0},uFadeColor:{value:new w}}})}var et=class{constructor(e){this.gl=e.getContext(),this.ext=this.gl.getExtension?.(`EXT_disjoint_timer_query_webgl2`)??null,this.mode=`off`,this.ms={},this.samples={},this.total=0,this._pool=[],this._pending=[],this._active=null,this._t0=0}begin(e){if(this.mode===`off`)return;if(this._active&&this.end(),this.mode===`sync`){this.gl.finish(),this._t0=performance.now(),this._active={name:e};return}if(!this.ext)return;let t=this._pool.pop()||this.gl.createQuery();this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT,t),this._active={name:e,q:t}}end(){let e=this._active;if(e){if(this._active=null,this.mode===`sync`||!e.q){this.gl.finish(),this._record(e.name,performance.now()-this._t0);return}this.gl.endQuery(this.ext.TIME_ELAPSED_EXT),this._pending.push(e)}}frame(){if(this._active&&this.end(),this.ext&&this._pending.length){let e=this.gl,t=e.getParameter(this.ext.GPU_DISJOINT_EXT),n=0;for(;n<this._pending.length;n++){let r=this._pending[n];if(!e.getQueryParameter(r.q,e.QUERY_RESULT_AVAILABLE))break;t||this._record(r.name,e.getQueryParameter(r.q,e.QUERY_RESULT)/1e6),this._pool.push(r.q)}if(n&&this._pending.splice(0,n),this._pending.length>256){for(let e of this._pending)this._pool.push(e.q);this._pending.length=0}}let e=0;for(let t in this.ms)e+=this.ms[t];this.total=e}_record(e,t){this.ms[e]=this.ms[e]===void 0?t:this.ms[e]*.9+t*.1;let n=this.samples[e]??=[];n.push(t),n.length>120&&n.shift()}snapshot(){let e={};for(let t in this.ms)e[t]=+this.ms[t].toFixed(3);return e}medians(){let e={},t=0;for(let n in this.samples){let r=[...this.samples[n]].sort((e,t)=>e-t);e[n]=+r[r.length>>1].toFixed(3),t+=e[n]}return e.total=+t.toFixed(3),e}reset(){this.ms={},this.samples={}}},Y=141,tt=2,X=[.906,.871,.808],nt={exposure:1.05,bloom:.055,vol:.85,warm:1,ao:.55,sat:1.1,hueKeep:.4,ca:.0065,vigFloor:.68,grain:.028,sharpen:.35,taaSharpen:.25,fade:0,fadeMist:0,letterbox:0,lowHealth:0,bloomThreshold:.9,bloomKnee:1.2,bloomSpread:.85,bloomLevels:6,volSteps:14,volMaxDist:220,volDensity:1,volClouds:1,volBlend:.22,volExtinction:.03,volScale:.014,volBroad:.3,volOcclusion:.6,volOccPow:3,aoSamples:8,aa:`fxaa`,msaaSamples:4,taaBlend:.1,taaGamma:1,debugView:`none`,profile:!1},rt=`
${G}
uniform sampler2D tColor, tDepth;
uniform vec2 uNearFar;
varying vec2 vUv;
void main() { gl_FragColor = vec4(texture(tColor, vUv).rgb, wxp_linearDepth(texture(tDepth, vUv).x, uNearFar)); }
`,Z=new y,Q=new p,$=class{constructor(){this.peak=0,this.age=0,this.dur=1}hit(e,t){e>=this.value&&(this.peak=e,this.age=0,this.dur=Math.max(.001,t))}get value(){let e=Math.max(0,1-this.age/this.dur);return this.peak*e*e}tick(e){this.age+=e}},it=class{constructor(e){this.renderer=e;let n=new URLSearchParams(typeof location<`u`?location.search:``);this.params=at(n),this.harness=n.has(`harness`),this.heightAt=null,this.W=1,this.H=1,this.hw=1,this.hh=1,this.pr=1,this.SW=1,this.SH=1,this.renderScale=1,this._css=[1,1,1],this._msaa=-1,this._taaOn=!1,this._fxaaOn=!0,this.rtScene=new v(1,1,{type:h,format:t,minFilter:d,magFilter:d,depthBuffer:!0,stencilBuffer:!1,generateMipmaps:!1,depthTexture:new _(1,1,f)}),this.rtScene.texture.name=`hdrScene`,this.rtScene.depthTexture.name=`hdrSceneDepth`,this.rtDepth=new v(1,1,{type:a,format:ae,depthBuffer:!0,stencilBuffer:!1,depthTexture:new _(1,1,f)}),this.rtDepth.depthTexture.name=`sceneDepthCopy`,this.rtCopy=U(1,1,{name:`copy`}),this.rtLDR=U(1,1,{name:`ldr`,type:a}),this.vol=new Le,this.ao=new He,this.bloomPass=new qe(6),this.taa=new Ye,this.copyMat=H({name:`copy`,fragmentShader:rt,uniforms:{tColor:{value:null},tDepth:{value:null},uNearFar:{value:new C}}}),this.composite=Qe(),this.final=J(!0),this.profiler=new et(e),this.frame={index:0,proj:new b,invProj:new b,view:new b,viewProj:new b,prevViewProj:new b,jitViewProj:new b,camWorld:new b,camPos:new w,prevPos:new w,fwd:new w,prevFwd:new w(0,0,-1),groundY:0,historyOk:!1,near:.3,far:7e3},this._shadowExplicit=!1,this._scanFrame=-1,this._scanChildren=-1,this._fx={flash:new $,flashCol:new p(1,1,1),exp:new $,ca:new $,radial:new $,radialUV:new C(.5,.5),fade:{v:0,from:0,to:0,t:0,dur:0,col:new w(0,0,0)},lb:{v:0,from:0,to:0,t:0,dur:0},slowmo:0,slowmoT:0,damage:0,damageT:0,beat:0,intro:this.harness?2:0},this.harness||(this._fx.fade.v=1),this.fx=this._makeFx(),E.tSceneCopy={value:this.rtCopy.texture},E.tSceneDepth={value:this.rtScene.depthTexture},E.uCamNearFar={value:new C(.3,7e3)},E.uCopyTexel={value:new C(1,1)},this.perf={gpu:{},aa:``,W:1,H:1,hw:1,hh:1,calls:0},n.has(`perf`)&&(this.params.profile=n.get(`perf`)===`sync`?`sync`:`query`),typeof window<`u`&&(window.__perf=this.perf),this._wrapCompile(),this._applyAA(!0)}get depthTexture(){return this._msaa>0?this.rtScene.depthTexture:this.rtDepth.depthTexture}get sceneTexture(){return this._taaOn?this.taa.texture:this.rtScene.texture}get copyTexture(){return this.rtCopy.texture}setShadowSources({far:e=null,near:t=null}={}){this._shadowExplicit=!!(e||t),this.vol.setShadowSources(e||t,e?t:null);for(let n of[e,t])n&&n.layers.enableAll()}setRenderScale(e){e=Math.min(1,Math.max(.4,e)),!(Math.abs(e-this.renderScale)<.001)&&(this.renderScale=e,this.setSize(...this._css),this._applyAA(!1))}setSize(e,t,n=1){this._css=[e,t,n];let r=Math.max(1,Math.round(e*n)),i=Math.max(1,Math.round(t*n)),a=this.renderScale,o=Math.max(1,Math.round(r*a)),s=Math.max(1,Math.round(i*a)),c=Math.min(n,1.3)*.5,l=Math.max(1,Math.round(e*c)),u=Math.max(1,Math.round(t*c));this.pr=n,(r!==this.W||i!==this.H||o!==this.SW||s!==this.SH||l!==this.hw||u!==this.hh)&&(this.W=r,this.H=i,this.SW=o,this.SH=s,this.hw=l,this.hh=u,this.rtScene.setSize(o,s),this.rtDepth.setSize(o,s),this.rtLDR.setSize(r,i),this.taa.setSize(r,i,o,s),this.rtCopy.setSize(l,u),this.vol.setSize(l,u),this.ao.setSize(l,u),this.bloomPass.setSize(l,u),E.uResolution.value.set(r,i),E.uCopyTexel.value.set(1/l,1/u),Object.assign(this.perf,{W:r,H:i,hw:l,hh:u}))}stats(){return{...this.perf,gpu:this.profiler.snapshot()}}async precompile(e,t){await this.renderer.compileAsync(e,t)}render(e,t,n=1/60){let r=this.renderer,i=this.params,a=this.profiler;a.mode=i.profile===`sync`?`sync`:i.profile?`query`:`off`,this._tickFx(n),this._applyAA(!1),this._scanScene(e),this._updateFrame(t);let o=r.autoClear;this._scenePasses(e,t),this._postPasses(t),a.end(),a.frame(),r.autoClear=o,this._endFrame(),a.mode!==`off`&&(this.perf.gpu=a.snapshot(),this.perf.gpuTotal=+a.total.toFixed(3))}_scenePasses(e,t){let n=this.renderer,r=this.profiler,i=this.frame,a=this._msaa>0,o=this._taaOn,s=t.layers.mask;o?(this.taa.jitter(t,this.SW,this.SH),i.jitViewProj.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse)):i.jitViewProj.copy(i.viewProj),r.begin(`opaque`),t.layers.mask=Y,n.autoClear=!0,n.setRenderTarget(this.rtScene),n.render(e,t),r.begin(`copy`),a||(n.initRenderTarget(this.rtDepth),n.copyTextureToTexture(this.rtScene.depthTexture,this.rtDepth.depthTexture));let c=this.copyMat.uniforms;c.tColor.value=this.rtScene.texture,c.tDepth.value=this.rtScene.depthTexture,c.uNearFar.value.set(i.near,i.far),V(n,this.copyMat,this.rtCopy),r.begin(`transparent`);let l=n.shadowMap,u=l.autoUpdate,d=l.needsUpdate,f=e.matrixWorldAutoUpdate;l.autoUpdate=!1,l.needsUpdate=!1,e.matrixWorldAutoUpdate=!1,t.layers.mask=tt,n.autoClear=!1,a&&(this.rtScene.resolveDepthBuffer=!1),n.setRenderTarget(this.rtScene),n.render(e,t),this.rtScene.resolveDepthBuffer=!0,l.autoUpdate=u,l.needsUpdate=d,e.matrixWorldAutoUpdate=f,t.layers.mask=s,n.autoClear=!0,o&&this.taa.restore(),this._sceneTex=this.rtScene.texture,o&&(r.begin(`taa`),this.taa.render(n,this.rtScene.texture,this.rtScene.depthTexture,i,this.params),this._sceneTex=this.taa.texture)}_postPasses(e){let t=this.renderer,n=this.params,r=this.profiler,i=this.frame,a=this._sceneTex;r.begin(`vol`),this.vol.steps=Math.max(4,n.volSteps|0),this.vol.maxDist=n.volMaxDist,n.vol>0?this.vol.render(t,i,this.rtCopy.texture,n):this._volCleared||this.vol.clear(t),this._volCleared=n.vol<=0,r.begin(`ao`),this.ao.samples=Math.max(4,n.aoSamples|0),n.ao>0?this.ao.render(t,i,this.rtCopy.texture):this._aoCleared||this.ao.clear(t),this._aoCleared=n.ao<=0,r.begin(`bloom`),this.bloomPass.levels=n.bloomLevels|0,this.bloomPass.render(t,a,this.vol.texture,this.W,this.H,n),r.begin(`composite`),this._updateComposite(a,e),V(t,this.composite,this.rtLDR),r.begin(`final`);let o=this.final.uniforms,s=this._fx;o.tLDR.value=this.rtLDR.texture,o.uTexel.value.set(1/this.W,1/this.H),o.uSharpen.value=this._taaOn?n.taaSharpen+(1-this.renderScale)*.8:n.sharpen,o.uGrain.value=n.grain,o.uFrame.value=i.index;let c=Math.max(s.fade.v,n.fade);o.uFade.value=c,n.fade>s.fade.v?o.uFadeColor.value.set(X[0]*n.fadeMist,X[1]*n.fadeMist,X[2]*n.fadeMist):o.uFadeColor.value.copy(s.fade.col),V(t,this.final,null)}_endFrame(){let e=this.frame;e.prevViewProj.copy(e.viewProj),e.prevPos.copy(e.camPos),e.prevFwd.copy(e.fwd),e.index++}benchmark(e,t,n=30,r=null){let i=this.renderer,a=i.getContext(),o=this.params,s=this.frame,c=new Uint8Array(4),l=new Float32Array(4),u=e=>{i.setRenderTarget(e),e&&e.texture.type!==1009?a.readPixels(0,0,1,1,a.RGBA,a.FLOAT,l):a.readPixels(0,0,1,1,a.RGBA,a.UNSIGNED_BYTE,c)},d=(e,t)=>{e(),u(t);let r=1/0;for(let i=0;i<3;i++){let i=performance.now();for(let t=0;t<n;t++)e();u(t),r=Math.min(r,(performance.now()-i)/n)}return+r.toFixed(3)},f=()=>V(i,this.copyMat,this.rtCopy);this._updateFrame(t);let p={},m=e=>!r||r.includes(e),h=(e,t,n)=>{m(e)&&(p[e]=d(t,n))};return h(`empty`,()=>{},null),h(`frame`,()=>{this._updateFrame(t),this._scenePasses(e,t),this._postPasses(t),this._endFrame()},null),h(`scene`,()=>{this._updateFrame(t),this._scenePasses(e,t),f(),this._endFrame()},this.rtCopy),h(`post`,()=>this._postPasses(t),null),h(`vol`,()=>this.vol.render(i,s,this.rtCopy.texture,o),this.vol.rtVol2),h(`volMarch`,()=>{this.vol._ensureMarch(this.vol._numShadows),V(i,this.vol.march,this.vol.rtVol)},this.vol.rtVol),h(`ao`,()=>this.ao.render(i,s,this.rtCopy.texture),this.ao.rtA),h(`bloom`,()=>this.bloomPass.render(i,this._sceneTex,this.vol.texture,this.W,this.H,o),this.bloomPass.ups[0]),h(`composite`,()=>V(i,this.composite,this.rtLDR),this.rtLDR),h(`final`,()=>V(i,this.final,null),null),p.aa=this.perf.aa,p.W=this.W,p.H=this.H,p.hw=this.hw,p.hh=this.hh,p}_updateFrame(e){let t=this.frame;t.near=e.near,t.far=e.far,t.proj.copy(e.projectionMatrix),t.invProj.copy(e.projectionMatrixInverse),t.view.copy(e.matrixWorldInverse),t.viewProj.multiplyMatrices(t.proj,t.view),t.camWorld.copy(e.matrixWorld),t.camPos.setFromMatrixPosition(e.matrixWorld),t.fwd.set(0,0,-1).transformDirection(e.matrixWorld),t.historyOk=!(t.index===0||t.camPos.distanceToSquared(t.prevPos)>16||t.fwd.dot(t.prevFwd)<.9);let n=this.heightAt||(typeof window<`u`?window.__app?.world?.heightAt:null);t.groundY=n?n(t.camPos.x,t.camPos.z):E.uFogParams.value.z,E.uCamNearFar.value.set(t.near,t.far),E.tSceneDepth.value=this.depthTexture}_scanScene(e){let t=this.frame;if(e.children.length===this._scanChildren&&t.index-this._scanFrame<120)return;this._scanChildren=e.children.length,this._scanFrame=t.index;let n=[];if(e.traverse(e=>{e.isLight&&(((e.layers.mask&tt)===0||(e.layers.mask&Y)!==Y)&&e.layers.enableAll(),e.isDirectionalLight&&e.castShadow&&n.push(e))}),!this._shadowExplicit){let e=n[0]||null,t=n[1]||null;(e!==this.vol.far||t!==this.vol.near)&&this.vol.setShadowSources(e,t)}}_applyAA(e){let t=String(this.params.aa||`msaa`).toLowerCase(),n=t.includes(`msaa`)?Math.max(0,this.params.msaaSamples|0):0,r=t.includes(`taa`)||this.renderScale<.999,i=!r&&t!==`none`;(e||n!==this._msaa||r!==this._taaOn||i!==this._fxaaOn)&&(n!==this._msaa&&(this.rtScene.samples=n,this.rtScene.dispose(),this._msaa=n),r!==this._taaOn&&(this.taa.valid=!1,this._taaOn=r),(i!==this._fxaaOn||e)&&(this.final.dispose(),this.final=J(i),this._fxaaOn=i),this.perf.aa=t)}_updateComposite(e,t){let n=this.composite.uniforms,r=this.params,i=this._fx,a=this.frame;n.tScene.value=e,n.tDepth.value=this.rtScene.depthTexture,n.tCopy.value=this.rtCopy.texture,n.tAO.value=this.ao.texture,n.tVol.value=this.vol.texture,n.tBloom.value=this.bloomPass.texture,n.uNearFar.value.set(a.near,a.far),n.uHalfSize.value.set(this.hw,this.hh),n.uTexel.value.set(1/this.W,1/this.H),n.uAspect.value=this.W/this.H,n.uCA.value=r.ca+i.ca.value,n.uAO.value=r.ao,n.uVolAmt.value=r.vol,n.uVolOcc.value=r.volOcclusion,n.uBloom.value=r.bloom,n.uExposure.value=r.exposure*(1+i.exp.value),n.uWarm.value=r.warm,n.uSat.value=r.sat,n.uHueKeep.value=r.hueKeep,n.uVigFloor.value=r.vigFloor,n.uLowHealth.value=Math.max(r.lowHealth,i.damage),n.uPulse.value=i.beat,n.uSlowmo.value=i.slowmo,n.uLetterbox.value=Math.max(r.letterbox,i.lb.v),n.uRadial.value.set(i.radialUV.x,i.radialUV.y,i.radial.value);let o=i.flash.value;n.uFlash.value.set(i.flashCol.r,i.flashCol.g,i.flashCol.b,o);let s=E.uSunDir.value;Z.set(a.camPos.x+s.x*1e3,a.camPos.y+s.y*1e3,a.camPos.z+s.z*1e3,1).applyMatrix4(a.viewProj);let c=a.fwd.dot(s);Z.w>0?n.uSunScreen.value.set(Z.x/Z.w*.5+.5,Z.y/Z.w*.5+.5,T.smoothstep(c,0,.25)):n.uSunScreen.value.set(.5,.5,0),n.uDebug.value=Xe[r.debugView]??0}_tickFx(e){let t=this._fx;e=Math.min(Math.max(e,0),.1),t.flash.tick(e),t.exp.tick(e),t.ca.tick(e),t.radial.tick(e),this.vol.tick(e);let n=t.fade;if(t.intro===0&&typeof window<`u`&&window.__ready&&(t.intro=1,this.fx.fade(0,2.2,`black`)),n.dur>0){n.t=Math.min(n.t+e,n.dur);let t=n.t/n.dur;n.v=n.from+(n.to-n.from)*t*t*(3-2*t),n.t>=n.dur&&(n.dur=0)}let r=t.lb;if(r.dur>0){r.t=Math.min(r.t+e,r.dur);let t=r.t/r.dur;r.v=r.from+(r.to-r.from)*t*t*(3-2*t),r.t>=r.dur&&(r.dur=0)}t.slowmo+=(t.slowmoT-t.slowmo)*Math.min(1,e*6),t.damage+=(t.damageT-t.damage)*Math.min(1,e*3);let i=performance.now()/1e3*1.1%1;t.beat=Math.exp(-(((i-.08)*14)**2))+.6*Math.exp(-(((i-.3)*14)**2))}_makeFx(){let e=this._fx,t=this,n=(n,r,i)=>{n?(Z.set(n.x,n.y,n.z,1).applyMatrix4(t.frame.viewProj),Z.w>0?e.radialUV.set(T.clamp(Z.x/Z.w*.5+.5,0,1),T.clamp(Z.y/Z.w*.5+.5,0,1)):e.radialUV.set(.5,.5)):e.radialUV.set(r??.5,i??.5)};return{flash(t=1,n){n==null?Q.setRGB(1,.92,.8):Array.isArray(n)?Q.setRGB(...n):Q.set(n),t*.6>=e.flash.value&&e.flashCol.copy(Q),e.flash.hit(t*.6,.22),e.exp.hit(.2*t,.12)},impact(t=1,r=null){let i=Math.max(0,t);n(r),e.radial.hit(Math.min(.035,.03*i),.14),e.ca.hit(.016*i,.16),e.exp.hit(.12*i,.09)},kick({exposure:t=0,ca:r=0,radial:i=null,flash:a=0,ms:o=90}={}){let s=o/1e3;t&&e.exp.hit(t,s),r&&e.ca.hit(r,s*1.4),i&&(n(i.pos,i.x,i.y),e.radial.hit(Math.min(.035,i.strength??.02),Math.max(s,.12))),a&&this.flash(a)},setSlowmo(t){e.slowmoT=T.clamp(t,0,1)},setDamage(t){e.damageT=T.clamp(t,0,1)},fade(t,n=1,r=`black`){let i=e.fade;r===`mist`?i.col.set(...X):r===`black`||r==null?i.col.set(0,0,0):Array.isArray(r)?i.col.set(r[0],r[1],r[2]):(Q.set(r),i.col.set(Q.r,Q.g,Q.b)),e.intro=2,Object.assign(i,{from:i.v,to:T.clamp(t,0,1),t:0,dur:Math.max(n,.001)})},letterbox(t=!0,n=.6){Object.assign(e.lb,{from:e.lb.v,to:+!!t,t:0,dur:Math.max(n,.001)})},dust(e=.5){t.vol.addDust(e)}}}_wrapCompile(){let e=this.renderer,t=this;if(e.__wxCompileWrapped)return;e.__wxCompileWrapped=!0;let n=n=>function(r,i,a){let o=e.getRenderTarget(),s=o===null,c=i?.layers?.mask;s&&e.setRenderTarget(t.rtScene),i?.layers&&i.layers.enableAll();try{return n.call(e,r,i,a)}finally{s&&e.setRenderTarget(o),i?.layers&&c!==void 0&&(i.layers.mask=c)}};e.compile=n(e.compile),e.compileAsync=n(e.compileAsync)}dispose(){for(let e of[this.rtScene,this.rtDepth,this.rtCopy,this.rtLDR])e.dispose();this.vol.dispose(),this.ao.dispose(),this.bloomPass.dispose(),this.taa.dispose(),this.copyMat.dispose(),this.composite.dispose(),this.final.dispose()}};function at(e){let t={...nt};Object.defineProperty(t,"saturation",{get(){return t.sat},set(e){t.sat=e},enumerable:!1}),Object.defineProperty(t,"vignette",{get(){return 1-t.vigFloor},set(e){t.vigFloor=1-e},enumerable:!1}),e.has(`aa`)&&(t.aa=e.get(`aa`));let n=e.get(`debug`);return n&&n in Xe&&(t.debugView=n),t}async function ot({canvas:t}){let n=new URLSearchParams(location.search),r=new e({canvas:t,antialias:!1,powerPreference:`high-performance`,stencil:!1,depth:!0,alpha:!1,preserveDrawingBuffer:n.has(`harness`)});r.outputColorSpace=l,r.toneMapping=0,r.shadowMap.enabled=!0,r.shadowMap.type=1,r.info.autoReset=!1;let i=new ee;i.background=new p(9085112);let a=new ne(48,16/9,.3,7e3);a.layers.enableAll(),a.position.set(0,2.2,8),a.lookAt(0,1.2,0),ce({renderer:r,scene:i,camera:a,params:n});let o=new it(r),s=[],c={t:0,real:0,scale:1,userScale:1,_targetScale:1,_scaleLerp:0,_hitstop:0,frozen:n.has(`freeze`),hitstop(e){this._hitstop=Math.max(this._hitstop,e)},setScale(e,t=0){this._targetScale=e,this._scaleLerp=t,t<=0&&(this.scale=e)}},u={renderer:r,scene:i,camera:a,pipeline:o,world:{heightAt:()=>0,normalAt:(e,t,n=new w)=>n.set(0,1,0),colliders:[]},time:c,G:E,params:n,add(e){return s.push(e),e},remove(e){let t=s.indexOf(e);t>=0&&s.splice(t,1)},progress(e,t){window.__load?.(e,t)},controls:null,debugControls(){return this.controls?this.controls:(this.controls=new ge(a,t),this.controls.target.set(0,1.2,0),this.controls.enableDamping=!0,this.controls.update(),this.controls)},setView({pos:e,target:t,fov:n}){e&&a.position.set(...e),n&&(a.fov=n,a.updateProjectionMatrix()),t&&(a.lookAt(...t),this.controls&&(this.controls.target.set(...t),this.controls.update())),a.updateMatrixWorld()},freeze(e=!0){c.frozen=e},stats(){let e=r.info;return{fps:+_.toFixed(1),ms:+(1e3/Math.max(_,.001)).toFixed(2),calls:e.render.calls,tris:e.render.triangles,programs:e.programs?.length??0,W:o.W,H:o.H,t:+c.t.toFixed(2)}},async ready(){r.compileAsync(i,a).catch(e=>console.warn(`compileAsync failed`,e)),v=2;let e=document.getElementById(`load`);e&&(e.classList.add(`done`),setTimeout(()=>e.remove(),1400))}},d=Math.min(window.devicePixelRatio||1,n.has(`harness`)?1:1.25),f={scale:1,acc:0,n:0,cool:0,locked:n.has(`harness`)||n.has(`lockres`)};u.perf=f;function m(){let e=Math.max(1,window.innerWidth),t=Math.max(1,window.innerHeight),n=Math.max(.5,d);r.setPixelRatio(n),r.setSize(e,t,!0),a.aspect=e/t,a.updateProjectionMatrix(),o.setSize(e,t,n)}m(),window.addEventListener(`resize`,m),(!n.has(`harness`)||n.has(`q`))&&ue(u,de());let h=()=>o.setRenderScale((u.quality?.scale??1)*f.scale),g=performance.now(),_=60,v=-1;function y(e){r.info.reset();let t=Math.min(Math.max((e-g)/1e3,0),.1);g=e,_=_*.95+1/Math.max(t,1e-4)*.05,c._scaleLerp>0&&(c.scale+=(c._targetScale-c.scale)*Math.min(1,t/c._scaleLerp*3));let n=Math.min(t,1/20)*c.scale*c.userScale;c._hitstop>0&&(c._hitstop-=t,n*=.02),c.frozen&&(n=0),c.t+=n,c.real+=t,E.uTime.value=c.t,E.uRealTime.value=c.real,E.uFrame.value++,se(n);for(let e of s)e.update?.(n,c.t,u,t);u.controls&&u.controls.update();for(let e of s)e.lateUpdate?.(n,c.t,u,t);if(a.updateMatrixWorld(),E.uCamPos.value.copy(a.position),le.update(n,a.position),o.render(i,a,t),v>0&&--v===0&&(window.__ready=!0),!f.locked&&v===0&&!document.hidden&&(f.acc+=t,f.n++,f.n>=90)){let t=f.acc/f.n;f.acc=0,f.n=0;let n=f.scale,r=(u.quality?.minScale??.6)/(u.quality?.scale??1);t>1/50&&f.scale>r?(f.scale=Math.max(r,f.scale*(t>1/30?.88:.95)),f.cool=e+6e3):t<1/58&&f.scale<1&&e>f.cool&&(f.scale=Math.min(1,f.scale+.04),f.cool=e+2500),n!==f.scale&&h()}}return r.setAnimationLoop(y),window.__app=u,u}var st=(new URLSearchParams(location.search).get(`scene`)||`full`).replace(/[^a-z0-9_-]/gi,``);async function ct(){let e=await ot({canvas:document.getElementById(`c`)});fe(e.renderer),e.progress(.02,``),await(await pe(Object.assign({"./scenes/anim.js":()=>k(()=>import(`./anim-UgjXFqKg.js`),__vite__mapDeps([0,1,2,3,4,5]),import.meta.url),"./scenes/bamboo.js":()=>k(()=>import(`./bamboo-B5ZqRHzX.js`),__vite__mapDeps([6,1,2]),import.meta.url),"./scenes/character.js":()=>k(()=>import(`./character-CAlUpFUg.js`),__vite__mapDeps([7,8,1,9,2]),import.meta.url),"./scenes/citizens.js":()=>k(()=>import(`./citizens-DyZ4SMWt.js`),__vite__mapDeps([10,8,1,2]),import.meta.url),"./scenes/combat.js":()=>k(()=>import(`./combat-UY6ALXWu.js`),__vite__mapDeps([11,2,12,1,9,13,14,8,15,16,17,18,19,20,21,3,22,23,24,5,25,26,27,28,4,29,30,31,32,33,34,35,36,37,38,39,40,41,42]),import.meta.url),"./scenes/full.js":()=>k(()=>import(`./full-BkPorXmZ.js`),__vite__mapDeps([43,1,2]),import.meta.url),"./scenes/grass.js":()=>k(()=>import(`./grass-CEIs4Btv.js`),__vite__mapDeps([44,1,9,2]),import.meta.url),"./scenes/post.js":()=>k(()=>import(`./post-uF51WE9V.js`),__vite__mapDeps([45,1,9,17,15,8,16,2,3]),import.meta.url),"./scenes/rain.js":()=>k(()=>import(`./rain-BP4WaLaf.js`),__vite__mapDeps([46,1,9,2]),import.meta.url),"./scenes/rawclip.js":()=>k(()=>import(`./rawclip-zkXxlcaf.js`),__vite__mapDeps([47,1,9,20,21,2]),import.meta.url),"./scenes/sandbox.js":()=>k(()=>import(`./sandbox-CSLxFk0r.js`),__vite__mapDeps([48,14,8,1,9,15,16,17,18,19,20,21,2,3,22,23,24,5,25,4,49,50,13,51,52,53,54,35,36,37,38,55,56,57,58,59,60,61,62]),import.meta.url),"./scenes/sky.js":()=>k(()=>import(`./sky-CSdGlw_0.js`),__vite__mapDeps([63,1,9,2,49,8,15,16,17,18,50,13,51,52]),import.meta.url),"./scenes/terrain.js":()=>k(()=>import(`./terrain-BoAkOw_4.js`),__vite__mapDeps([64,1,2,54,35,36,37,38]),import.meta.url),"./scenes/town.js":()=>k(()=>import(`./town-CUdqnlX7.js`),__vite__mapDeps([65,1,9,2]),import.meta.url),"./scenes/ui.js":()=>k(()=>import(`./ui-B6WxTumQ.js`),__vite__mapDeps([66,1,13,2,67,68,69,70,17,71]),import.meta.url)}),`./scenes/${st}.js`,3)).default(e)}ct().catch(e=>{console.error(e);let t=document.getElementById(`loadLabel`);t&&(t.textContent=`ERROR: `+(e?.message??e))});