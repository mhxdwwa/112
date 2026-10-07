import{n as e}from"./three.module-YNTH5p0u.js";import{$n as t,zt as n}from"./three.core-DtjtRha-.js";import"./globals-29H6lCK0.js";import{t as r}from"./glsl-BgzraZja.js";import{t as i}from"./noise-D9IUCAHK.js";import{a,t as o}from"./atmosphere-BNENFJca.js";import{n as s}from"./wind-BKJvbr9K.js";var c=`
// ---- wx prelude (core/prelude.js) ----
#if defined( USE_FOG ) || defined( WX_ATMOS_ON )
#define WX_FOG
#endif
${[[`float`,`uTime`],[`float`,`uRealTime`],[`float`,`uFrame`],[`vec3`,`uSunDir`],[`vec3`,`uSunDirTrue`],[`vec3`,`uSunCol`],[`float`,`uSunVis`],[`vec3`,`uMoonDir`],[`vec3`,`uSkyZen`],[`vec3`,`uSkyUp`],[`vec3`,`uCloudLit`],[`vec3`,`uCloudShade`],[`vec3`,`uHorizonGlow`],[`vec4`,`uCloudShadow`],[`vec3`,`uAmbK`],[`vec3`,`uFogCool`],[`vec3`,`uFogWarm`],[`vec4`,`uFogParams`],[`float`,`uMist`],[`float`,`uGroundY`],[`float`,`uNight`],[`float`,`uStorm`],[`float`,`uRain`],[`float`,`uWet`],[`float`,`uFlash`],[`vec3`,`uFlashDir`],[`vec4`,`uWind`],[`sampler2D`,`tWindNoise`],[`sampler2D`,`tHeight`],[`sampler2D`,`tGround`],[`sampler2D`,`tSplat`],[`vec4`,`uWorldRect`],[`sampler2D`,`tInteract`],[`vec4`,`uInteractRect`],[`vec4`,`uActors`,`[8]`],[`vec4`,`uShock`,`[4]`],[`vec4`,`uSlash`,`[4]`],[`vec4`,`uSlashB`,`[4]`],[`vec3`,`uCamGround`],[`vec4`,`uLamps`,`[8]`],[`vec3`,`uLampC`,`[8]`],[`int`,`uLampN`],[`float`,`uLampOn`],[`float`,`uWetBias`],[`vec3`,`uCamPos`],[`vec2`,`uResolution`]].map(([e,t,n])=>r(e,t,n)).join(``)}
${i}
${s}
${o}
// ---- end wx prelude ----
`,l=e,u=`
#ifdef WX_FOG
varying vec3 vFogWP;
varying vec2 vWxAtm;   // x: cloud-shadow sun visibility, y: ground-mist optical depth
#endif
`,d=`
#ifdef WX_FOG
vFogWP = ( mvPosition.xyz - viewMatrix[ 3 ].xyz ) * mat3( viewMatrix );   // inverse rigid view transform
vWxAtm = vec2( wx_cloudShadow( vFogWP ), wx_mistTau( vFogWP, cameraPosition ) );
#endif
`,f=u,p=`
#ifdef WX_FOG
gl_FragColor.rgb = wx_applyAtmosphereT( gl_FragColor.rgb, vFogWP, vWxAtm.y );
#endif
`,m=`
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )

	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		#if ( UNROLLED_LOOP_INDEX != 1 ) || ( NUM_DIR_LIGHT_SHADOWS < 2 )
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		#if ( UNROLLED_LOOP_INDEX == 0 )
			#if defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 1 )
			directLight.color *= receiveShadow ? getShadow( directionalShadowMap[ 1 ], directionalLightShadows[ 1 ].shadowMapSize, directionalLightShadows[ 1 ].shadowIntensity, directionalLightShadows[ 1 ].shadowBias, directionalLightShadows[ 1 ].shadowRadius, vDirectionalShadowCoord[ 1 ] ) : 1.0;
			#endif
			#ifdef WX_FOG
			directLight.color *= vWxAtm.x;
			#endif
			gSunColor = directLight.color; gSunDir = directLight.direction;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
		#endif
	}
	#pragma unroll_loop_end

#endif
`,h=`
#if defined( RE_Direct )
if ( uLampOn > 0.0 ) {
	IncidentLight wxLamp;
	wxLamp.visible = true;
	for ( int li = 0; li < 8; li ++ ) {
		if ( li >= uLampN ) break;
		vec4 lp = uLamps[ li ];
		vec3 lv = ( viewMatrix * vec4( lp.xyz, 1.0 ) ).xyz - geometryPosition;
		float d2 = dot( lv, lv );
		if ( d2 > 900.0 || lp.w <= 0.0 ) continue;
		wxLamp.direction = lv * inversesqrt( max( d2, 1e-6 ) );
		wxLamp.color = uLampC[ li ] * ( lp.w * uLampOn / ( d2 + 0.35 ) * ( 1.0 - smoothstep( 400.0, 900.0, d2 ) ) );
		RE_Direct( wxLamp, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
}
#endif
`,g=`
#ifdef WX_FOG
{
	float wxWet = clamp( uWet + uWetBias, 0.0, 1.0 );
	if ( wxWet > 0.001 ) {
		vec3 wxN = inverseTransformDirection( normal, viewMatrix );
		float wxPn = wx_vnoise( vFogWP.xz * 0.35 ) * 0.65 + wx_vnoise( vFogWP.xz * 1.3 + 7.0 ) * 0.35;
		float wxPool = smoothstep( 0.75, 0.97, wxN.y ) * smoothstep( 0.5, 0.66, wxPn ) * wxWet;
		diffuseColor.rgb *= 1.0 - wxWet * 0.5 * roughnessFactor - wxPool * 0.22;
		roughnessFactor = mix( roughnessFactor, mix( 0.16, 0.03, wxPool ), wxWet * 0.85 );
	}
}
#endif
`,_=`
diffuseColor.rgb *= 1.0 - clamp( uWet + uWetBias, 0.0, 1.0 ) * 0.32;
`;function v(e){let t=e.indexOf(`#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )`),n=e.indexOf(`#if ( NUM_RECT_AREA_LIGHTS > 0 )`,t);return t<0||n<0?(console.warn(`[chunks] lights_fragment_begin layout changed; dual-shadow patch skipped`),e):e.slice(0,t)+m+`
`+e.slice(n)}var y=!1;function b(e){if(e?.scene&&!e.scene.fog&&(e.scene.fog=new n(16777215,1,2)),y)return;y=!0,l.common=l.common+`
// wx-chunks
`+c,l.fog_pars_vertex=u,l.fog_vertex=d,l.fog_pars_fragment=f,l.fog_fragment=p,l.lights_pars_begin+=`
vec3 gSunColor = vec3( 0.0 );
vec3 gSunDir = vec3( 0.0, 1.0, 0.0 );
`,l.lights_fragment_begin=v(l.lights_fragment_begin),l.lights_fragment_end=h+`
`+l.lights_fragment_end,l.lights_physical_fragment=g+`
`+l.lights_physical_fragment,l.lights_lambert_fragment=_+`
`+l.lights_lambert_fragment;let r=t.prototype;r.onBeforeCompile=a,r.customProgramCacheKey=function(){return this.onBeforeCompile.toString()+(this.blending===2?`|add`:``)}}export{b as t};