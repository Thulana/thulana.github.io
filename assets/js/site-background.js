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

/* Dial the whole effect from here. Everything below is expressed as a
   fraction of the distance between the base colour and the star colour, so
   these read as "how visible", not "how bright", and they behave the same in
   both themes. Raise them and check a long post before keeping it. */
const float STAR_STRENGTH   = 0.20;
const float WAVE_STRENGTH   = 0.030;
const float COMET_STRENGTH  = 0.35;
const float RING_STRENGTH   = 0.16;
const float FIGURE_STRENGTH = 0.11;

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

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

/* A body crossing the frame on its own clock. \`span\` is the fraction of the
   cycle it is visible for, so a long cycle with a small span is a rare event
   and the phase offsets keep the three of them from arriving together. */
float streak(vec2 sp, float t, float cycle, float offset, vec2 from, vec2 to,
             float span, float tailLen, float thick) {
  float k = fract((t + offset) / cycle);
  float window = smoothstep(0.0, span * 0.25, k)
               * (1.0 - smoothstep(span * 0.7, span, k));
  float travel = clamp(k / span, 0.0, 1.0);
  vec2 head = mix(from, to, travel);
  vec2 tail = head + normalize(from - to) * tailLen;
  return smoothstep(thick, 0.0, segDist(sp, head, tail)) * window;
}

/* An expanding shell that thins and fades as it grows — a pulsar ping. */
float pulse(vec2 sp, vec2 centre, float t, float cycle, float offset, float reach) {
  float k = fract((t + offset) / cycle);
  float radius = k * reach;
  float d = abs(distance(sp, centre) - radius);
  return smoothstep(0.0035, 0.0, d) * (1.0 - k) * (1.0 - k);
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
  col = mix(col, u_star, clamp(stars, 0.0, 1.0) * STAR_STRENGTH);

  /* Two circular waves multiplied together: the classic two-source
     interference figure, at an amplitude you notice only if you look. */
  vec2 s1 = vec2(0.18 * aspect, 0.82);
  vec2 s2 = vec2(0.86 * aspect, 0.14);
  float w1 = sin(distance(sp, s1) * 22.0 - t * 0.45);
  float w2 = sin(distance(sp, s2) * 19.0 + t * 0.38);
  col = mix(col, u_accent, (w1 * w2 * 0.5 + 0.5) * WAVE_STRENGTH);

  /* A slow constellation, breathing in and out over about a minute. Same
     node-and-edge vocabulary as banner-network.svg and the feature cards, so
     the background belongs to the same family as the rest of the site. */
  vec2 f0 = vec2(0.16 * aspect, 0.72);
  vec2 f1 = vec2(0.31 * aspect, 0.55);
  vec2 f2 = vec2(0.24 * aspect, 0.34);
  vec2 f3 = vec2(0.44 * aspect, 0.41);
  float edges = smoothstep(0.0016, 0.0, segDist(sp, f0, f1))
              + smoothstep(0.0016, 0.0, segDist(sp, f1, f2))
              + smoothstep(0.0016, 0.0, segDist(sp, f1, f3));
  float nodes = smoothstep(0.008, 0.0, distance(sp, f0))
              + smoothstep(0.010, 0.0, distance(sp, f1))
              + smoothstep(0.007, 0.0, distance(sp, f2))
              + smoothstep(0.007, 0.0, distance(sp, f3));
  float breathe = 0.35 + 0.65 * (0.5 + 0.5 * sin(t * 0.10));
  col = mix(col, u_star, clamp(edges * 0.55 + nodes, 0.0, 1.0) * FIGURE_STRENGTH * breathe);

  /* Two pulsar pings on long, mutually prime cycles. */
  float rings = pulse(sp, vec2(0.72 * aspect, 0.66), t, 17.0, 0.0,  0.42)
              + pulse(sp, vec2(0.12 * aspect, 0.22), t, 23.0, 9.0,  0.34);
  col = mix(col, u_accent, clamp(rings, 0.0, 1.0) * RING_STRENGTH);

  /* Three comets and a satellite. Different cycles and offsets mean
     something is usually in flight without them ever arriving in step. */
  float comets =
      streak(sp, t, 12.0,  0.0, vec2(-0.15 * aspect, 1.05), vec2(1.15 * aspect, 0.30), 0.17, 0.22, 0.0110)
    + streak(sp, t, 16.0,  5.5, vec2(1.15 * aspect, 0.92), vec2(-0.15 * aspect, 0.18), 0.14, 0.17, 0.0085)
    + streak(sp, t, 19.0, 12.0, vec2(0.30 * aspect, 1.08), vec2(0.95 * aspect, -0.08), 0.12, 0.13, 0.0070);
  col = mix(col, u_star, clamp(comets, 0.0, 1.0) * COMET_STRENGTH);

  /* A satellite: no tail, and slow enough to read as a steady transit. */
  float sat = streak(sp, t, 29.0, 3.0, vec2(-0.1 * aspect, 0.44), vec2(1.1 * aspect, 0.62), 0.55, 0.012, 0.0045);
  col = mix(col, u_star, sat * COMET_STRENGTH * 0.8);

  gl_FragColor = vec4(col, 1.0);
}
`;

mountShaderCanvas('.site-bg', {
  fragment: FRAGMENT,
  palettes: PALETTES,
  renderScale: 0.6,   // a field this soft loses nothing, and it is on every page
  fps: 24,
});
