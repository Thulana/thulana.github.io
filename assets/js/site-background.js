/* ==========================================================================
   Site background

   A very quiet field behind every page, drawn from what this blog is
   actually about: a parallax starfield for the posts on space and life
   beyond earth, a slow two-source interference pattern for the quantum
   ones, and a comet that crosses every so often for the rockets.

   The constraint that shapes all of it is that body text sits directly on
   top. So the amplitudes here are deliberately tiny — a few percent of
   luminance — and nothing ever moves fast enough to pull the eye while
   someone is reading. It should register as texture, not as animation.

   Base colour matches --surface in _theme.scss, so the canvas is seamless
   with the page it replaces and there is no seam at the edges.

   Lifecycle, throttling and theme handling live in lib/shader-canvas.js.
   ========================================================================== */

import { mountShaderCanvas } from './lib/shader-canvas.js';

const PALETTES = {
  dark: {
    base: [0x14, 0x17, 0x1a],   // --surface, dark
    star: [0x9f, 0xd3, 0xe8],
    accent: [0x2f, 0x6f, 0x8f],
  },
  light: {
    base: [0xff, 0xff, 0xff],   // --surface, light
    star: [0x6f, 0x8f, 0xa3],   // darker than the base, so stars read as faint specks
    accent: [0x6f, 0xb7, 0xd6],
  },
};

const FRAGMENT = `
precision mediump float;

uniform vec2  u_res;
uniform float u_time;
uniform vec3  u_base;
uniform vec3  u_star;
uniform vec3  u_accent;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

/* One parallax layer of stars. Cells are sparse: most are rejected by the
   density test, and the survivors get a position jittered inside the cell so
   the result never reads as a grid. */
float starLayer(vec2 uv, float scale, float drift, float density, float t) {
  vec2 p = uv * scale + vec2(t * drift, t * drift * 0.35);
  vec2 cell = floor(p);
  vec2 f = fract(p);

  float present = step(density, hash(cell));
  vec2 at = vec2(hash(cell + 0.17), hash(cell + 0.71));
  float d = distance(f, at);

  float twinkle = 0.65 + 0.35 * sin(t * 2.2 + hash(cell + 0.33) * 6.2831);
  return smoothstep(0.075, 0.0, d) * present * twinkle;
}

/* Distance to a segment, used for the comet's tail. */
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec2 sp = vec2(uv.x * aspect, uv.y);

  float t = u_time;
  vec3 col = u_base;

  /* Three layers at different scales and speeds. The far layer barely moves,
     which is what sells the depth. */
  float stars = starLayer(sp, 26.0, 0.004, 0.955, t) * 0.55
              + starLayer(sp, 15.0, 0.009, 0.965, t) * 0.75
              + starLayer(sp,  8.0, 0.016, 0.975, t) * 1.00;
  col = mix(col, u_star, clamp(stars, 0.0, 1.0) * 0.20);

  /* Two circular waves multiplied together: the classic two-source
     interference figure, at an amplitude you notice only if you look. */
  vec2 s1 = vec2(0.18 * aspect, 0.82);
  vec2 s2 = vec2(0.86 * aspect, 0.14);
  float w1 = sin(distance(sp, s1) * 22.0 - t * 0.45);
  float w2 = sin(distance(sp, s2) * 19.0 + t * 0.38);
  float interference = w1 * w2;
  col = mix(col, u_accent, (interference * 0.5 + 0.5) * 0.030);

  /* A comet every 23 seconds, crossing over about three of them. */
  float cycle = 23.0;
  float k = fract(t / cycle);
  float window = smoothstep(0.0, 0.05, k) * (1.0 - smoothstep(0.10, 0.16, k));
  float travel = k / 0.16;
  vec2 head = mix(vec2(-0.15 * aspect, 1.05), vec2(1.15 * aspect, 0.30), travel);
  vec2 tail = head + normalize(vec2(-1.30 * aspect, 0.75)) * 0.22;
  float comet = smoothstep(0.012, 0.0, segDist(sp, head, tail)) * window;
  col = mix(col, u_star, comet * 0.35);

  gl_FragColor = vec4(col, 1.0);
}
`;

mountShaderCanvas('.site-bg', {
  fragment: FRAGMENT,
  palettes: PALETTES,
  renderScale: 0.6,   // a field this soft loses nothing, and it is on every page
  fps: 24,
});
