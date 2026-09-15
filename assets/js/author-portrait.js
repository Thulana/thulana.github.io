/* ==========================================================================
   Author portrait

   The photo on /about turns to look at the pointer, wherever it is on the
   page. Two things make that read as a head rather than as a picture being
   dragged around:

   1. The plane is genuinely rotated in 3D. For every fragment the shader
      casts a ray, intersects it with a plane rotated by the current yaw and
      pitch, and samples the photo at the intersection. That is a real
      perspective warp — the far edge compresses and the near edge spreads,
      which is what a turning head does. Displacing UVs by a depth value, as
      the previous version did, cannot produce that; it slides pixels around
      and reads as rubber.

   2. The eyes move separately. A head that rotates without its gaze changing
      still looks wrong, so the two eye regions get a small extra shift toward
      the pointer on top of the rotation.

   Raw WebGL rather than the bundled three.js: one quad, no scene graph, and
   /about has no other reason to pull 136 KB.

   EYE_LEFT and EYE_RIGHT are measured off images/thulana.jpg by eye, in
   texture coordinates. They are the one thing here tied to this particular
   photo — replace the image and they need re-checking, or the gaze lands on
   a cheekbone.

   The <img> stays underneath, so no WebGL, a failed decode or reduced motion
   all leave the ordinary photo in place.
   ========================================================================== */

import { watchRuntime, mountEffect } from './lib/effect-runtime.js';

const MAX_YAW = 0.30;      // radians, about 17 degrees at the edge of the viewport
const MAX_PITCH = 0.20;
const EASE = 0.085;        // how quickly the head follows
const EYE_LEFT = [0.343, 0.437];   // texture coords, measured off this photo
const EYE_RIGHT = [0.575, 0.437];
const EYE_RADIUS = 0.052;   // covers the eye; the shift stays a small fraction of it
const EYE_SHIFT = 0.010;    // ~20% of the radius: enough to read as gaze,
                            // gentle enough not to smear the eyelid

const VERT = `
attribute vec2 a_pos;
varying vec2 v_screen;
void main() {
  v_screen = a_pos;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;

uniform sampler2D u_photo;
uniform vec2  u_angles;   // yaw, pitch in radians
uniform vec2  u_gaze;     // direction to the pointer, -1..1, y down
uniform float u_time;

varying vec2 v_screen;

const float FOCAL = 2.6;   // larger is a longer lens: less perspective distortion
const float DIST  = 2.6;
const float ZOOM  = 1.16;  // crop in slightly so rotation reveals real pixels,
                           // not the clamped edge of the texture

mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }

/* Extra movement local to one eye, so the gaze shifts as well as the head. */
vec2 eyeShift(vec2 uv, vec2 eye, vec2 dir) {
  float w = smoothstep(${EYE_RADIUS}, 0.0, distance(uv, eye));
  return dir * ${EYE_SHIFT} * w;
}

void main() {
  /* Cast a ray per fragment and intersect the rotated plane. */
  vec3 dir = vec3(v_screen, -FOCAL);
  mat3 R = rotY(u_angles.x) * rotX(u_angles.y);
  vec3 normal = R * vec3(0.0, 0.0, 1.0);
  vec3 centre = vec3(0.0, 0.0, -DIST);

  float denom = dot(dir, normal);
  if (abs(denom) < 0.0001) discard;
  vec3 hit = dir * (dot(centre, normal) / denom);

  vec2 plane = vec2(dot(hit - centre, R * vec3(1.0, 0.0, 0.0)),
                    dot(hit - centre, R * vec3(0.0, 1.0, 0.0)));

  float scale = (0.5 * FOCAL / DIST) / ZOOM;
  vec2 uv = vec2(0.5 + plane.x * scale, 0.5 - plane.y * scale);

  /* Breathe a little so it is never completely inert. */
  uv.y += sin(u_time * 0.55) * 0.0016;

  uv -= eyeShift(uv, vec2(${EYE_LEFT[0]}, ${EYE_LEFT[1]}), u_gaze);
  uv -= eyeShift(uv, vec2(${EYE_RIGHT[0]}, ${EYE_RIGHT[1]}), u_gaze);

  vec4 photo = texture2D(u_photo, clamp(uv, 0.002, 0.998));

  /* The side turning away loses a little light, which helps it read as solid. */
  float shade = clamp(1.0 - u_angles.x * v_screen.x * 0.30 + u_angles.y * v_screen.y * 0.16, 0.86, 1.14);

  float mask = smoothstep(1.0, 0.972, length(v_screen));
  gl_FragColor = vec4(photo.rgb * shade, photo.a * mask);
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

  ready.then(photo => {
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

    const uAngles = gl.getUniformLocation(program, 'u_angles');
    const uGaze = gl.getUniformLocation(program, 'u_gaze');
    const uTime = gl.getUniformLocation(program, 'u_time');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let wantYaw = 0, wantPitch = 0, yaw = 0, pitch = 0;
    let wantGazeX = 0, wantGazeY = 0, gazeX = 0, gazeY = 0;

    const onMove = event => {
      const box = canvas.getBoundingClientRect();
      if (!box.width) return;
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;

      /* Normalise against the viewport, not the avatar, so the head tracks
         the pointer anywhere on the page and saturates near the edges rather
         than recentring the moment the pointer moves away. */
      const dx = Math.max(-1, Math.min(1, (event.clientX - cx) / (window.innerWidth * 0.5)));
      const dy = Math.max(-1, Math.min(1, (event.clientY - cy) / (window.innerHeight * 0.5)));

      wantYaw = dx * MAX_YAW;
      wantPitch = -dy * MAX_PITCH;
      wantGazeX = dx;
      wantGazeY = dy;
    };

    /* Only recentre when the pointer actually leaves the window. */
    const onLeave = () => { wantYaw = 0; wantPitch = 0; wantGazeX = 0; wantGazeY = 0; };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);

    const startedAt = performance.now();

    draw = function frame(now) {
      raf = requestAnimationFrame(frame);
      place();
      yaw += (wantYaw - yaw) * EASE;
      pitch += (wantPitch - pitch) * EASE;
      gazeX += (wantGazeX - gazeX) * EASE;
      gazeY += (wantGazeY - gazeY) * EASE;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uAngles, yaw, pitch);
      gl.uniform2f(uGaze, gazeX, gazeY);
      gl.uniform1f(uTime, (now - startedAt) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    canvas.classList.add('is-live');
    play();

    canvas._teardown = () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      gl.deleteBuffer(quad);
      gl.deleteTexture(photoTex);
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
