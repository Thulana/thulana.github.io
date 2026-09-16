/* ==========================================================================
   Shader canvas

   Everything a fullscreen-quad shader needs and nothing more: a context, a
   program, one triangle covering the viewport, and a throttled render loop.

   Lifecycle — defer past load, stop when unseen, never start under reduced
   motion, follow the theme — lives in effect-runtime.js and is shared with
   every other effect on the site.

   The caller supplies a fragment shader and a palette per scheme. Every
   palette key becomes a `vec3` uniform named after it, interpolated on a
   theme change so nothing snaps.
   ========================================================================== */

import { prefersDark, watchRuntime, mountEffect } from './effect-runtime.js';

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

  const onTheme = () => {
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

  const unwatch = watchRuntime(canvas, { play, pause, onTheme });

  canvas.classList.add('is-live');
  play();

  return function stop() {
    pause();
    unwatch();
    canvas.classList.remove('is-live');
  };
}

export function mountShaderCanvas(selector, options) {
  const settings = { renderScale: 0.7, fps: 30, fadeMs: 400, ...options };
  mountEffect(selector, canvas => begin(canvas, settings));
}
