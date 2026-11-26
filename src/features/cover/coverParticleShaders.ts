export const vertexShader = `
attribute float aSize;
attribute float aAlpha;
attribute float aDepth;
attribute float aBlur;
varying float vAlpha;
varying float vDepth;
varying float vBlur;
uniform float uPixelRatio;

void main() {
  vAlpha = aAlpha;
  vDepth = aDepth;
  vBlur = aBlur;
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  gl_Position = projectionMatrix * viewPosition;
  gl_PointSize = aSize * uPixelRatio;
}
`

export const fragmentShader = `
uniform vec3 uColor;
varying float vAlpha;
varying float vDepth;
varying float vBlur;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord) * 2.0;
  float coreRadius = mix(0.22, 0.06, vDepth);
  float haloRadius = mix(0.58, 0.96, vBlur);
  float core = smoothstep(coreRadius, 0.0, dist);
  float crispCore = smoothstep(coreRadius * 0.72, 0.0, dist);
  float halo = smoothstep(haloRadius, 0.06, dist);
  float blurHalo = mix(0.18, 0.7, vBlur) * halo;
  float sharpCenter = mix(1.0, 0.55, vBlur) * crispCore;
  float alpha = (sharpCenter + blurHalo) * vAlpha;
  vec3 finalColor = mix(uColor, vec3(1.0), core * 0.24);
  gl_FragColor = vec4(finalColor, alpha);
}
`
