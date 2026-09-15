/* ==========================================================================
   Shared WebGL canvas

   Everything two fullscreen-quad shaders need and nothing they do not: a
   context, a program, one triangle covering the viewport, a throttled render
   loop, and the lifecycle rules that keep a decoration from costing anything
   it should not.

   Those rules are the point of this file, because they are easy to get wrong
   once per effect:

   - Never initialise during page load. Creating a context and compiling a
     shader competes with first paint; measured on this site it moved LCP from
     2.4s to 5.0s. Wait for load, then for an idle callback.
   - Never run when nobody is looking: off-screen, or a hidden tab.
   - Never run at all when the reader has asked for reduced motion, and react
     if they change that while the page is open.
   - Follow the site's theme, including the manual toggle, not just the OS.

   The caller supplies a fragment shader and a palette per scheme. Every
   palette key becomes a `vec3` uniform named after it, interpolated on a
   theme change so nothing snaps.
   ========================================================================== */

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader failed to compile: ${log}`);
  }
  return shader;
}

function prefersDark() {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit === 'dark') return true;
  if (explicit === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function whenIdle(fn) {
  const run = () => (window.requestIdleCallback
    ? window.requestIdleCallback(fn, { timeout: 2000 })
    : setTimeout(fn, 200));
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}

function begin(canvas, { fragment, palettes, renderScale, fps, fadeMs }) {
  let gl;
  try {
    gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false })
      || canvas.getContext('experimental-webgl');
  } catch { /* fall through to whatever is behind the canvas */ }
  if (!gl) return null;

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
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

  const keys = Object.keys(palettes.dark);
  const slots = keys.map(k => gl.getUniformLocation(program, `u_${k}`));

  const norm = rgb => rgb.map(c => c / 255);
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const paletteFor = () => palettes[prefersDark() ? 'dark' : 'light'];

  let current = paletteFor();
  let from = current;
  let to = current;
  let fadeStart = -1;

  const applyTheme = () => {
    const next = paletteFor();
    if (next === to) return;
    from = current;
    to = next;
    fadeStart = performance.now();
  };

  function resize() {
    const w = Math.max(1, Math.round(canvas.clientWidth * renderScale));
    const h = Math.max(1, Math.round(canvas.clientHeight * renderScale));
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
    if (now - lastFrame < 1000 / fps) return;
    lastFrame = now;

    resize();

    if (fadeStart >= 0) {
      const k = Math.min(1, (now - fadeStart) / fadeMs);
      const blended = {};
      keys.forEach(key => { blended[key] = lerp(from[key], to[key], k); });
      current = blended;
      if (k === 1) fadeStart = -1;
    }

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (now - startedAt) / 1000);
    keys.forEach((key, i) => gl.uniform3fv(slots[i], norm(current[key])));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const play = () => {
    if (running) return;
    running = true;
    lastFrame = 0;
    raf = requestAnimationFrame(frame);
  };

  const pause = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

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

  const onLost = event => {
    event.preventDefault();
    pause();
    canvas.classList.remove('is-live');
  };
  canvas.addEventListener('webglcontextlost', onLost);

  canvas.classList.add('is-live');
  play();

  return function stop() {
    pause();
    observer.disconnect();
    themeObserver.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    schemeQuery.removeEventListener('change', applyTheme);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.classList.remove('is-live');
  };
}

/**
 * Mount a fullscreen-quad shader on the first canvas matching `selector`.
 * Returns silently when there is no such canvas, so a module can be loaded
 * on a page that does not use it.
 */
export function mountShaderCanvas(selector, options) {
  const canvas = document.querySelector(selector);
  if (!canvas) return;

  const settings = {
    renderScale: 0.7,
    fps: 30,
    fadeMs: 400,
    ...options,
  };

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let stop = null;

  const sync = () => {
    if (motionQuery.matches) {
      if (stop) { stop(); stop = null; }
    } else if (!stop) {
      stop = begin(canvas, settings);
    }
  };

  motionQuery.addEventListener('change', sync);
  whenIdle(sync);
}
