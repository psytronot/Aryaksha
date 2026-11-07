import * as THREE from 'three';
import { NIGHT_LIGHT_TWILIGHT_END, NIGHT_LIGHT_TWILIGHT_START } from './earth3dMath';

export function makeFallbackNightLightsTexture() {
  // A black 1x1 texture is intentionally used when NASA Black Marble cannot
  // be fetched. We never fabricate city lights or imply a data source.
  const texture = new THREE.DataTexture(
    new Uint8Array([0, 0, 0, 255]),
    1,
    1,
    THREE.RGBAFormat
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}



export const EARTH_ATMOSPHERE_MODEL = 'sun-driven-rayleigh-limb-v1';
export const ATMOSPHERE_TWILIGHT_START = -0.18;
export const ATMOSPHERE_TWILIGHT_END = 0.12;

export type AtmosphereSolarResponse = {
  daylight: number;
  twilight: number;
  night: number;
};

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Solar response used by the atmosphere shader. The same incidence term is
 * applied at every latitude; polar illumination therefore follows the actual
 * seasonal Sun declination instead of an artificial latitude-only glow.
 */
export function atmosphereSolarResponse(normalDotSun: number): AtmosphereSolarResponse {
  const incidence = Number.isFinite(normalDotSun) ? THREE.MathUtils.clamp(normalDotSun, -1, 1) : -1;
  const daylight = smoothstep(ATMOSPHERE_TWILIGHT_START, ATMOSPHERE_TWILIGHT_END, incidence);
  const twilight = Math.exp(-Math.abs(incidence) * 8) * (1 - daylight);
  return { daylight, twilight, night: Math.max(0, 1 - daylight - twilight) };
}

/**
 * Creates a translucent atmospheric shell driven by the same world-space Sun
 * vector as the Earth terminator and directional key light.
 */
export function createSunDrivenAtmosphereMaterial(
  sunDirectionUniform: { value: THREE.Vector3 },
  intensity = 1,
  limbPower = 3.2
): THREE.ShaderMaterial {
  const safeIntensity = Number.isFinite(intensity) ? Math.max(0, intensity) : 1;
  const safeLimbPower = Number.isFinite(limbPower) ? THREE.MathUtils.clamp(limbPower, 0.5, 8) : 3.2;
  return new THREE.ShaderMaterial({
    uniforms: {
      uEarthSunDirection: sunDirectionUniform,
      uAtmosphereIntensity: { value: safeIntensity },
      uLimbPower: { value: safeLimbPower }
    },
    vertexShader: [
      '#include <common>',
      'varying vec3 vAtmosphereWorldNormal;',
      'varying vec3 vAtmosphereViewDirection;',
      'void main() {',
      '  vec4 worldPosition = modelMatrix * vec4(position, 1.0);',
      '  vAtmosphereWorldNormal = normalize(mat3(modelMatrix) * normal);',
      '  vAtmosphereViewDirection = normalize(cameraPosition - worldPosition.xyz);',
      '  gl_Position = projectionMatrix * viewMatrix * worldPosition;',
      '}'
    ].join('\n'),
    fragmentShader: [
      '#include <common>',
      '#include <tonemapping_pars_fragment>',
      '#include <colorspace_pars_fragment>',
      'uniform vec3 uEarthSunDirection;',
      'uniform float uAtmosphereIntensity;',
      'uniform float uLimbPower;',
      'varying vec3 vAtmosphereWorldNormal;',
      'varying vec3 vAtmosphereViewDirection;',
      'void main() {',
      '  vec3 worldNormal = normalize(vAtmosphereWorldNormal);',
      '  vec3 viewDirection = normalize(vAtmosphereViewDirection);',
      '  float viewCosine = max(dot(worldNormal, viewDirection), 0.0);',
      '  float limb = pow(clamp(1.0 - viewCosine, 0.0, 1.0), uLimbPower);',
      '  float solarIncidence = dot(worldNormal, normalize(uEarthSunDirection));',
      '  float daylight = smoothstep(' + ATMOSPHERE_TWILIGHT_START.toFixed(2) + ', ' + ATMOSPHERE_TWILIGHT_END.toFixed(2) + ', solarIncidence);',
      '  float twilight = exp(-abs(solarIncidence) * 8.0) * (1.0 - daylight);',
      '  vec3 nightScattering = vec3(0.012, 0.035, 0.10);',
      '  vec3 dayScattering = vec3(0.08, 0.38, 0.92);',
      '  vec3 twilightScattering = vec3(0.035, 0.18, 0.52);',
      '  vec3 scattering = mix(nightScattering, dayScattering, daylight);',
      '  scattering = mix(scattering, twilightScattering, twilight);',
      '  float opticalDepth = 0.025 + 0.22 * daylight + 0.12 * twilight;',
      '  float alpha = clamp(limb * opticalDepth * uAtmosphereIntensity, 0.0, 0.42);',
      '  gl_FragColor = vec4(scattering, alpha);',
      '  #include <tonemapping_fragment>',
      '  #include <colorspace_fragment>',
      '}'
    ].join('\n'),
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    toneMapped: true
  });
}

export function applyEarthNightLightMask(
  material: THREE.MeshPhongMaterial,
  sunDirectionUniform: { value: THREE.Vector3 }
) {
  const newline = String.fromCharCode(10);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uEarthSunDirection = sunDirectionUniform;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      ['#include <common>', 'varying vec3 vEarthWorldNormal;'].join(newline)
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      ['#include <beginnormal_vertex>', 'vEarthWorldNormal = normalize(mat3(modelMatrix) * objectNormal);'].join(newline)
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      ['#include <common>', 'uniform vec3 uEarthSunDirection;', 'varying vec3 vEarthWorldNormal;'].join(newline)
    );
    const maskedEmissive = [
      '#include <emissivemap_fragment>',
      'float earthDaylight = smoothstep(' + NIGHT_LIGHT_TWILIGHT_START.toFixed(2) + ', '
        + NIGHT_LIGHT_TWILIGHT_END.toFixed(2)
        + ', dot(normalize(vEarthWorldNormal), normalize(uEarthSunDirection)));',
      'float nightLightLuminance = dot(totalEmissiveRadiance, vec3(0.2126, 0.7152, 0.0722));',
      'float nightLightSignal = smoothstep(0.012, 0.08, nightLightLuminance);',
      'totalEmissiveRadiance *= nightLightSignal * (1.0 - earthDaylight);'
    ].join(newline);
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', maskedEmissive);
  };
  material.customProgramCacheKey = () => 'earth-night-lights-terminator-v3';
}
