/* ==========================================================================
   Author portrait

   The photo on /about, given depth: nearer parts of the face shift further
   than the edges as the pointer moves, so the portrait appears to turn and
   look toward it. One textured quad and a fragment shader — cheap enough
   that it runs at full frame rate on a 110px avatar.

   Raw WebGL rather than the bundled three.js: this is a single quad with no
   scene graph, and /about has no other reason to pull 136 KB.

   About the depth. There is no depth map asset here, so the shader
   synthesises one: a hemisphere profile centred slightly above the middle of
   the frame, which is where the face sits in a head-and-shoulders crop. It
   is an approximation, not a measurement, and it works because the subject is
   roughly dome-shaped and the displacement is small. If a real depth map is
   ever generated — Depth Anything, MiDaS, or by hand — drop it next to the
   photo and point the canvas at it with `data-depth="/images/thulana-depth.jpg"`;
   the shader will use it instead, no code change needed.

   The <img> stays underneath and the canvas only fades in once it has drawn,
   so no WebGL, a failed decode or reduced motion all leave the ordinary photo.
   ========================================================================== */

import { watchRuntime, mountEffect } from './lib/effect-runtime.js';

const MAX_SHIFT = 0.075;   // in UV units, at the nearest point of the dome
const EASE = 0.09;         // how quickly it follows the pointer
const RETURN_RADIUS = 2.6; // pointer distance, in avatar widths, before it recentres

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;

uniform sampler2D u_photo;
uniform sampler2D u_depthMap;
uniform float u_useDepthMap;
uniform vec2  u_offset;
uniform float u_time;

varying vec2 v_uv;

/* Hemisphere centred a little above the middle: in a head-and-shoulders crop
   that is roughly where the face is, and the sqrt gives a rounded falloff
   rather than a cone. */
float domeDepth(vec2 uv) {
  vec2 d = (uv - vec2(0.5, 0.44)) / vec2(0.46, 0.52);
  return sqrt(clamp(1.0 - dot(d, d), 0.0, 1.0));
}

void main() {
  float depth = mix(domeDepth(v_uv), texture2D(u_depthMap, v_uv).r, u_useDepthMap);

  /* Breathe very slightly, so it is not completely inert before the pointer
     has been anywhere near it. */
  float idle = sin(u_time * 0.6) * 0.0025;

  vec2 uv = v_uv - (u_offset + vec2(idle, idle * 0.4)) * depth;
  uv = clamp(uv, 0.001, 0.999);

  vec4 photo = texture2D(u_photo, uv);

  /* A touch of shading that follows the same direction as the parallax, which
     is what stops it reading as a flat picture sliding around. */
  float lift = 1.0 + dot(normalize(u_offset + vec2(0.0001)), (v_uv - 0.5)) * length(u_offset) * 6.0;

  float mask = smoothstep(0.5, 0.487, distance(v_uv, vec2(0.5)));
  gl_FragColor = vec4(photo.rgb * clamp(lift, 0.88, 1.12), photo.a * mask);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`portrait shader failed: ${log}`);
  }
  return sh;
}

function makeTexture(gl, image) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  /* The photo is not power-of-two, so clamp and no mipmaps. */
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  return tex;
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function begin(canvas) {
  const avatar = canvas.parentElement;
  const image = avatar && avatar.querySelector('img');
  if (!image) return null;

  let gl;
  try {
    gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: false });
  } catch { /* leave the photo alone */ }
  if (!gl) return null;

  let raf = 0;
  let running = false;
  let disposed = false;
  let draw = null;

  const play = () => {
    if (running || !draw) return;
    running = true;
    raf = requestAnimationFrame(draw);
  };
  const pause = () => { running = false; cancelAnimationFrame(raf); };
  const unwatch = watchRuntime(canvas, { play, pause, onTheme: () => {} });

  /* Match the canvas to the photo's rendered box, which carries padding and a
     border at the large breakpoint. */
  function place() {
    const box = image.getBoundingClientRect();
    const host = avatar.getBoundingClientRect();
    canvas.style.left = `${box.left - host.left}px`;
    canvas.style.top = `${box.top - host.top}px`;
    canvas.style.width = `${box.width}px`;
    canvas.style.height = `${box.height}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(box.width * dpr));
    const h = Math.max(1, Math.round(box.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  const ready = image.complete && image.naturalWidth
    ? Promise.resolve(image)
    : new Promise((res, rej) => {
        image.addEventListener('load', () => res(image), { once: true });
        image.addEventListener('error', rej, { once: true });
      });

  ready.then(async photo => {
    if (disposed) return;

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn(gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const photoTex = makeTexture(gl, photo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, photoTex);
    gl.uniform1i(gl.getUniformLocation(program, 'u_photo'), 0);

    /* Optional real depth map, if one is ever produced. */
    let depthTex = photoTex;
    let useDepthMap = 0;
    const depthSrc = canvas.dataset.depth;
    if (depthSrc) {
      try {
        depthTex = makeTexture(gl, await loadImage(depthSrc));
        useDepthMap = 1;
      } catch { /* fall back to the synthesised dome */ }
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, depthTex);
    gl.uniform1i(gl.getUniformLocation(program, 'u_depthMap'), 1);
    gl.uniform1f(gl.getUniformLocation(program, 'u_useDepthMap'), useDepthMap);

    const uOffset = gl.getUniformLocation(program, 'u_offset');
    const uTime = gl.getUniformLocation(program, 'u_time');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let wantX = 0, wantY = 0, curX = 0, curY = 0;

    const onMove = event => {
      const box = canvas.getBoundingClientRect();
      if (!box.width) return;
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      /* Distance in avatar-widths, so the portrait tracks the pointer across
         the surrounding area and recentres once it is far away. */
      const dx = (event.clientX - cx) / box.width;
      const dy = (event.clientY - cy) / box.height;
      const falloff = 1 - Math.min(1, Math.hypot(dx, dy) / RETURN_RADIUS);
      const scale = MAX_SHIFT * falloff;
      wantX = Math.max(-1, Math.min(1, dx)) * scale;
      wantY = Math.max(-1, Math.min(1, dy)) * scale;
    };
    const onLeave = () => { wantX = 0; wantY = 0; };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);

    const startedAt = performance.now();

    draw = function frame(now) {
      raf = requestAnimationFrame(frame);
      place();
      curX += (wantX - curX) * EASE;
      curY += (wantY - curY) * EASE;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uOffset, curX, curY);
      gl.uniform1f(uTime, (now - startedAt) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    canvas.classList.add('is-live');
    play();

    canvas._teardown = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      gl.deleteBuffer(quad);
      gl.deleteTexture(photoTex);
      if (useDepthMap) gl.deleteTexture(depthTex);
      gl.deleteProgram(program);
    };
  }).catch(() => { /* the photo stays exactly as it was */ });

  return function stop() {
    disposed = true;
    pause();
    unwatch();
    if (canvas._teardown) canvas._teardown();
    canvas.classList.remove('is-live');
  };
}

mountEffect('.author-portrait', begin);
