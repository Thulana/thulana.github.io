/* ==========================================================================
   Hero background shader

   A drifting field behind the homepage hero, on one fullscreen quad. Raw
   WebGL rather than a 3D library: the whole effect is a fragment shader over
   two triangles, and an engine would cost more than the rest of the page.

   It layers over `banner-network.svg`, which stays as the hero's CSS
   background. Anything that stops this — no WebGL, a lost context, reduced
   motion — leaves that SVG visible, so no failure renders an empty box.

   Lifecycle, throttling and theme handling live in lib/shader-canvas.js.
   ========================================================================== */

import { mountShaderCanvas } from './lib/shader-canvas.js';

/* Matches banner-network.svg so the canvas and the fallback agree. */
const PALETTES = {
  dark: {
    deep: [0x0d, 0x12, 0x16], mid: [0x22, 0x35, 0x3f],
    accent: [0x00, 0x7c, 0xae], hi: [0x7c, 0xc3, 0xe0],
  },
  light: {
    deep: [0x1d, 0x2f, 0x3c], mid: [0x3d, 0x64, 0x7c],
    accent: [0x6f, 0xb7, 0xd6], hi: [0xd8, 0xf0, 0xfa],
  },
};

const FRAGMENT = `
precision mediump float;

uniform vec2  u_res;
uniform float u_time;
uniform vec3  u_deep;
uniform vec3  u_mid;
uniform vec3  u_accent;
uniform vec3  u_hi;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec2 p = vec2(uv.x * aspect, uv.y) * 1.7;

  float t = u_time * 0.028;

  /* Domain warp: fbm displaced by another fbm. Cheap, and it is what stops
     the field reading as ordinary noise. */
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(3.2, -t * 0.8)));
  float f = fbm(p + q * 1.45 + vec2(t * 0.35, 0.0));

  vec3 col = mix(u_deep, u_mid, smoothstep(0.16, 0.92, f));

  /* Ridged fold of the same field. Picking out where the noise crosses its
     midpoint turns smooth cloud into thin filaments, which is what keeps this
     from reading as an undifferentiated smear. */
  float ridge = 1.0 - abs(f - 0.5) * 2.0;
  ridge = pow(clamp(ridge, 0.0, 1.0), 5.0);
  col += u_hi * ridge * 0.14;

  /* Two drifting halos, echoing the radial gradients in the SVG. */
  vec2 fragA = vec2(uv.x * aspect, uv.y);
  vec2 c1 = vec2(0.30 * aspect + 0.04 * sin(t * 0.7), 0.60);
  vec2 c2 = vec2(0.78 * aspect + 0.05 * cos(t * 0.5), 0.34);
  float halo = smoothstep(0.62, 0.0, distance(fragA, c1))
             + smoothstep(0.50, 0.0, distance(fragA, c2)) * 0.7;
  col += u_accent * halo * 0.34 * (0.55 + 0.45 * f);

  float vignette = smoothstep(1.25, 0.25, length(uv - 0.5));
  col *= 0.82 + 0.18 * vignette;

  gl_FragColor = vec4(col, 1.0);
}
`;

mountShaderCanvas('.hero-canvas', { fragment: FRAGMENT, palettes: PALETTES });
