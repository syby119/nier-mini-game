export const vertexShader = `
varying vec2 vUv;

void main() {
    vUv = uv;

    // 旋转角度
    float angle = -3.14159 / -2.0;

    // 绕 X 轴的旋转矩阵
    mat4 rotationMatrix = mat4(1.0);
    rotationMatrix[1][1] = cos(angle);   // Y轴
    rotationMatrix[1][2] = -sin(angle);  // Y轴向 Z 轴的分量
    rotationMatrix[2][1] = sin(angle);   // Z轴向 Y 轴的分量
    rotationMatrix[2][2] = cos(angle);   // Z轴

    // 使用 instanceMatrix 和旋转矩阵
    gl_Position = projectionMatrix * viewMatrix * instanceMatrix * rotationMatrix * vec4(position, 1.0);
}
`

const normalFragmentShader = `
varying vec2 vUv;
uniform vec3 uInnerColor;  // 圆心颜色
uniform vec3 uOuterColor;  // 中间颜色
uniform vec3 uGlowColor;    // 自定义自发光颜色
uniform vec3 uOutlineColor;  // 外轮廓颜色
uniform float uAlpha;      // 最大透明度
uniform float uGlowStrength; // 自发光强度

void main() {
    // 计算当前片段到圆心的距离
    float dist = distance(vUv, vec2(0.5));

    if (dist > 0.5) discard;

    // 调整距离值以实现更加柔和的边缘（平方函数）
    float smoothDist = smoothstep(0.25, 0.5, dist);

    // 计算颜色渐变：从圆心的 uInnerColor 到边缘的 uOuterColor
    vec3 gradientColor = mix(uInnerColor, uOuterColor, pow(smoothDist, 5.0));

    // 计算发光强度：距离越小，发光越强
    float glow = (1.0 - dist) * uGlowStrength;

    // 叠加自发光效果，使用自定义的发光颜色
    vec3 glowingColor = gradientColor + glow * uGlowColor;

    // 透明度从圆心到边缘逐渐减弱（使用平方函数柔化边缘透明度）
    float gradientAlpha = uAlpha * (1.0 - smoothDist * smoothDist);

    // 设置圆形颜色和透明度
    gl_FragColor = vec4(glowingColor, gradientAlpha);
}
`

const unbrokenFragmentShader = `
uniform vec3 centerColor;
uniform vec3 edgeColor;
uniform vec3 outlineColor;
varying vec2 vUv;

void main() {
  float dist = length(vUv - vec2(0.5)); // 计算到中心的距离
  //在最外圈增加一层白色
  if(dist > 0.38 && dist < 0.5) {
    float alpha = smoothstep(0.42, 0.5, dist);
    vec3 color = mix(centerColor, outlineColor, alpha);
    gl_FragColor = vec4(color, 0.5);
    return;
  }
  float alpha = smoothstep(0.4, 0.5, dist); // 计算模糊效果
  vec3 color = mix(centerColor, edgeColor, alpha);
  gl_FragColor = vec4(color, 1.0 - alpha); // 最外层为白色
}
`

export const enemyProjectileMaterials = {
  normal: {
    fragmentShader: normalFragmentShader, uniforms: {
      uInnerColor: { value: [0.45, 0.23, 0] },
      uOuterColor: { value: [0.35, 0.13, 0.04] },
      uGlowColor: { value: [1, 0, 0] },
      uOutlineColor: { value: [1, 0.3, 0] },
      uAlpha: { value: 1 }, // 最大透明度
      uGlowStrength: { value: 3.5 }, // 自发光强度
    }
  },
  unbroken: {
    fragmentShader: unbrokenFragmentShader, uniforms: {
      centerColor: { value: [0.74, 0.01, 0.18] }, // 粉红色
      edgeColor: { value: [0.24, 0, 0.06] }, // 白色
      outlineColor: { value: [0.76, 0.38, 0.56] }, // 白色
    }
  },
}
