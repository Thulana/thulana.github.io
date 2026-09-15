/* ==========================================================================
   Hero background shader

   Paints a slow, drifting field behind the homepage hero on a single
   fullscreen quad. This is deliberately raw WebGL rather than a library: the
   whole effect is one fragment shader, and pulling in a 3D engine to draw two
   triangles would cost more than everything else on the page combined.

   It is an enhancement layered over `banner-network.svg`, which stays as the
   hero's CSS background. Anything that stops this script - no WebGL, a lost
   context, reduced motion - leaves that SVG visible rather than a blank box,
   so there is no failure mode that shows nothing.
   ========================================================================== */

const canvas = document.querySelector('.hero-canvas');

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

const RENDER_SCALE = 0.7;   // of CSS pixels; the field is soft enough to hide it
const TARGET_FPS = 30;      // a drift this slow gains nothing from 60
const THEME_FADE_MS = 400;

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
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

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`hero shader failed to compile: ${log}`);
  }
  return shader;
}

function prefersDark() {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit === 'dark') return true;
  if (explicit === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function start() {
  let gl;
  try {
    gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false })
      || canvas.getContext('experimental-webgl');
  } catch { /* fall through to the SVG */ }
  if (!gl) return null;

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }
  } catch (err) {
    console.warn(err);
    return null;
  }

  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, 'u_res');
  const uTime = gl.getUniformLocation(program, 'u_time');
  const uDeep = gl.getUniformLocation(program, 'u_deep');
  const uMid = gl.getUniformLocation(program, 'u_mid');
  const uAccent = gl.getUniformLocation(program, 'u_accent');
  const uHi = gl.getUniformLocation(program, 'u_hi');

  /* Palette is interpolated rather than snapped, so the theme toggle does not
     flash a hard cut behind the title. */
  const norm = rgb => rgb.map(c => c / 255);
  let current = { ...PALETTES[prefersDark() ? 'dark' : 'light'] };
  let from = current;
  let to = current;
  let fadeStart = -1;

  const applyTheme = () => {
    const next = PALETTES[prefersDark() ? 'dark' : 'light'];
    if (next === to) return;
    from = current;
    to = next;
    fadeStart = performance.now();
  };

  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

  function resize() {
    const w = Math.max(1, Math.round(canvas.clientWidth * RENDER_SCALE));
    const h = Math.max(1, Math.round(canvas.clientHeight * RENDER_SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  const startedAt = performance.now();
  let raf = 0;
  let lastFrame = 0;
  let running = false;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - lastFrame < 1000 / TARGET_FPS) return;
    lastFrame = now;

    resize();

    if (fadeStart >= 0) {
      const k = Math.min(1, (now - fadeStart) / THEME_FADE_MS);
      current = {
        deep: lerp(from.deep, to.deep, k),
        mid: lerp(from.mid, to.mid, k),
        accent: lerp(from.accent, to.accent, k),
        hi: lerp(from.hi, to.hi, k),
      };
      if (k === 1) fadeStart = -1;
    }

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (now - startedAt) / 1000);
    gl.uniform3fv(uDeep, norm(current.deep));
    gl.uniform3fv(uMid, norm(current.mid));
    gl.uniform3fv(uAccent, norm(current.accent));
    gl.uniform3fv(uHi, norm(current.hi));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function play() {
    if (running) return;
    running = true;
    lastFrame = 0;
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    running = false;
    cancelAnimationFrame(raf);
  }

  /* Nothing should burn GPU while scrolled past or on a hidden tab. */
  const observer = new IntersectionObserver(
    entries => (entries[0].isIntersecting && !document.hidden ? play() : pause()),
    { threshold: 0 },
  );
  observer.observe(canvas);

  const onVisibility = () => (document.hidden ? pause() : play());
  document.addEventListener('visibilitychange', onVisibility);

  const themeObserver = new MutationObserver(applyTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-theme'],
  });
  const schemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  schemeQuery.addEventListener('change', applyTheme);

  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    pause();
    canvas.classList.remove('is-live');
  });

  canvas.classList.add('is-live');
  play();

  return function stop() {
    pause();
    observer.disconnect();
    themeObserver.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    schemeQuery.removeEventListener('change', applyTheme);
    canvas.classList.remove('is-live');
  };
}

/*
   Booting WebGL costs main-thread time: module parse, context creation and a
   shader compile. Measured against the same page without it, doing that during
   load pushed JS bootup from 0.4s to 0.7s and dragged LCP with it, for an
   effect nobody can see yet because the poster frame is already on screen.

   So wait until the page has finished loading and the main thread is idle.
   Nothing is lost visually — the SVG is showing the whole time — and first
   paint stops competing with a decoration.
*/
function whenIdle(fn) {
  const run = () => (window.requestIdleCallback
    ? window.requestIdleCallback(fn, { timeout: 2000 })
    : setTimeout(fn, 200));
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}

if (canvas) {
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let stop = null;

  const sync = () => {
    if (motionQuery.matches) {
      if (stop) { stop(); stop = null; }
    } else if (!stop) {
      stop = start();
    }
  };

  motionQuery.addEventListener('change', sync);
  whenIdle(sync);
}
