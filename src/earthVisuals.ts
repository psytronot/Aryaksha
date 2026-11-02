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
