/* ==========================================================================
   Hero node network

   A drifting graph of nodes and edges over the hero, with packets travelling
   the links — the blog writes about backend and distributed systems, so the
   decoration may as well mean something. It layers above the shader field on
   its own transparent canvas, and keeps the vocabulary already established by
   banner-network.svg and the feature illustrations.

   Bundled, because it is the one effect here that uses a library. Everything
   else on the site is raw WebGL; a graph with depth, per-object parallax and
   animated packets is where a scene graph starts paying for itself.

   Lifecycle rules are shared with every other effect via effect-runtime.js.
   ========================================================================== */

import {
  Scene, OrthographicCamera, WebGLRenderer, Group,
  BufferGeometry, BufferAttribute, Points, LineSegments,
  ShaderMaterial, AdditiveBlending, Color,
} from 'three';

import { prefersDark, watchRuntime, mountEffect } from '../lib/effect-runtime.js';

const PALETTES = {
  dark:  { node: '#7cc3e0', edge: '#2f6f8f', packet: '#dff2fb' },
  light: { node: '#eaf6fc', edge: '#9fd0e4', packet: '#ffffff' },
};

const NODE_COUNT = 26;
const LINK_RADIUS = 0.62;      // in scene units; controls how dense the graph reads
const MAX_LINKS = 42;
const PACKET_COUNT = 7;
const FPS = 30;

/* Deterministic layout: the graph is the same on every visit, so it reads as
   a designed image rather than noise that happens to differ each reload. */
function mulberry32(seed) {
  return function random() {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildGraph() {
  const random = mulberry32(20200116);
  const nodes = [];

  for (let i = 0; i < NODE_COUNT; i++) {
    nodes.push({
      x: (random() * 2 - 1) * 1.55,
      y: (random() * 2 - 1) * 0.86,
      z: random() * 2 - 1,
      phase: random() * Math.PI * 2,
      drift: 0.10 + random() * 0.16,
      size: 2.4 + random() * 4.2,
    });
  }

  /* Nearest-neighbour style linking, capped so a dense corner cannot turn
     into a solid patch. */
  const links = [];
  for (let a = 0; a < nodes.length && links.length < MAX_LINKS; a++) {
    for (let b = a + 1; b < nodes.length && links.length < MAX_LINKS; b++) {
      const dx = nodes[a].x - nodes[b].x;
      const dy = nodes[a].y - nodes[b].y;
      if (Math.sqrt(dx * dx + dy * dy) < LINK_RADIUS) links.push([a, b]);
    }
  }

  return { nodes, links };
}

const NODE_VERT = `
attribute float a_size;
attribute float a_phase;
uniform float u_time;
uniform float u_scale;
varying float v_alpha;
void main() {
  vec3 p = position;
  p.x += sin(u_time * 0.20 + a_phase) * 0.045;
  p.y += cos(u_time * 0.16 + a_phase * 1.3) * 0.035;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = a_size * u_scale * (0.75 + 0.35 * (p.z * 0.5 + 0.5));
  v_alpha = 0.55 + 0.45 * (p.z * 0.5 + 0.5);
}
`;

const NODE_FRAG = `
precision mediump float;
uniform vec3 u_color;
varying float v_alpha;
void main() {
  /* Round points: discard outside the disc, soften the rim. */
  float d = length(gl_PointCoord - vec2(0.5));
  if (d > 0.5) discard;
  float edge = smoothstep(0.5, 0.18, d);
  gl_FragColor = vec4(u_color, edge * v_alpha);
}
`;

const LINE_VERT = `
attribute float a_phase;
uniform float u_time;
varying float v_alpha;
void main() {
  vec3 p = position;
  p.x += sin(u_time * 0.20 + a_phase) * 0.045;
  p.y += cos(u_time * 0.16 + a_phase * 1.3) * 0.035;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  v_alpha = 0.34 + 0.46 * (p.z * 0.5 + 0.5);
}
`;

const LINE_FRAG = `
precision mediump float;
uniform vec3 u_color;
varying float v_alpha;
void main() { gl_FragColor = vec4(u_color, v_alpha); }
`;

const PACKET_FRAG = `
precision mediump float;
uniform vec3 u_color;
void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  if (d > 0.5) discard;
  gl_FragColor = vec4(u_color, smoothstep(0.5, 0.0, d));
}
`;

const PACKET_VERT = `
attribute float a_size;
uniform float u_scale;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = a_size * u_scale;
}
`;

function begin(canvas) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    return null;
  }
  renderer.setClearAlpha(0);

  const { nodes, links } = buildGraph();
  const scene = new Scene();
  const camera = new OrthographicCamera(-1.6, 1.6, 1, -1, -10, 10);
  const group = new Group();
  scene.add(group);

  const palette = () => PALETTES[prefersDark() ? 'dark' : 'light'];
  const colours = palette();

  /* Nodes */
  const nodePos = new Float32Array(nodes.length * 3);
  const nodeSize = new Float32Array(nodes.length);
  const nodePhase = new Float32Array(nodes.length);
  nodes.forEach((n, i) => {
    nodePos[i * 3] = n.x; nodePos[i * 3 + 1] = n.y; nodePos[i * 3 + 2] = n.z;
    nodeSize[i] = n.size;
    nodePhase[i] = n.phase;
  });
  const nodeGeo = new BufferGeometry();
  nodeGeo.setAttribute('position', new BufferAttribute(nodePos, 3));
  nodeGeo.setAttribute('a_size', new BufferAttribute(nodeSize, 1));
  nodeGeo.setAttribute('a_phase', new BufferAttribute(nodePhase, 1));
  const nodeMat = new ShaderMaterial({
    vertexShader: NODE_VERT, fragmentShader: NODE_FRAG, transparent: true, depthWrite: false,
    uniforms: { u_time: { value: 0 }, u_scale: { value: 1 }, u_color: { value: new Color(colours.node) } },
  });
  group.add(new Points(nodeGeo, nodeMat));

  /* Edges */
  const linePos = new Float32Array(links.length * 6);
  const linePhase = new Float32Array(links.length * 2);
  links.forEach(([a, b], i) => {
    linePos.set([nodes[a].x, nodes[a].y, nodes[a].z, nodes[b].x, nodes[b].y, nodes[b].z], i * 6);
    linePhase[i * 2] = nodes[a].phase;
    linePhase[i * 2 + 1] = nodes[b].phase;
  });
  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute('position', new BufferAttribute(linePos, 3));
  lineGeo.setAttribute('a_phase', new BufferAttribute(linePhase, 1));
  const lineMat = new ShaderMaterial({
    vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, transparent: true, depthWrite: false,
    uniforms: { u_time: { value: 0 }, u_color: { value: new Color(colours.edge) } },
  });
  group.add(new LineSegments(lineGeo, lineMat));

  /* Packets riding the edges. Each picks a link, crosses it, then picks
     another — the point of the whole thing for a blog about backends. */
  const packetPos = new Float32Array(PACKET_COUNT * 3);
  const packetSize = new Float32Array(PACKET_COUNT);
  const packets = [];
  const random = mulberry32(981);
  for (let i = 0; i < PACKET_COUNT; i++) {
    packets.push({ link: Math.floor(random() * links.length), t: random(), speed: 0.10 + random() * 0.16 });
    packetSize[i] = 2.6 + random() * 1.8;
  }
  const packetGeo = new BufferGeometry();
  packetGeo.setAttribute('position', new BufferAttribute(packetPos, 3));
  packetGeo.setAttribute('a_size', new BufferAttribute(packetSize, 1));
  const packetMat = new ShaderMaterial({
    vertexShader: PACKET_VERT, fragmentShader: PACKET_FRAG, transparent: true,
    depthWrite: false, blending: AdditiveBlending,
    uniforms: { u_scale: { value: 1 }, u_color: { value: new Color(colours.packet) } },
  });
  group.add(new Points(packetGeo, packetMat));

  const onTheme = () => {
    const next = palette();
    nodeMat.uniforms.u_color.value.set(next.node);
    lineMat.uniforms.u_color.value.set(next.edge);
    packetMat.uniforms.u_color.value.set(next.packet);
  };

  /* Pointer parallax, eased so it never snaps. */
  let pointerX = 0, pointerY = 0, tiltX = 0, tiltY = 0;
  const onPointer = event => {
    const r = canvas.getBoundingClientRect();
    pointerX = ((event.clientX - r.left) / r.width) * 2 - 1;
    pointerY = ((event.clientY - r.top) / r.height) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.left = -aspect; camera.right = aspect;
    camera.top = 1; camera.bottom = -1;
    camera.updateProjectionMatrix();

    /* Nodes are laid out in a roughly square space so the graph reads well on
       its own; the hero is far wider than it is tall, so spread that layout
       across the full frame rather than leaving it clumped in the middle.
       Point sizes are unaffected by scale, so the nodes stay round. */
    group.scale.x = Math.max(1, aspect / 1.55);
    nodeMat.uniforms.u_scale.value = dpr;
    packetMat.uniforms.u_scale.value = dpr;
  }

  const startedAt = performance.now();
  let raf = 0, lastFrame = 0, running = false;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - lastFrame < 1000 / FPS) return;
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;

    resize();
    const t = (now - startedAt) / 1000;
    nodeMat.uniforms.u_time.value = t;
    lineMat.uniforms.u_time.value = t;

    tiltX += (pointerY * 0.10 - tiltX) * 0.04;
    tiltY += (pointerX * 0.16 - tiltY) * 0.04;
    group.rotation.x = tiltX;
    group.rotation.y = tiltY;

    packets.forEach((p, i) => {
      p.t += p.speed * dt;
      if (p.t >= 1) { p.t = 0; p.link = (p.link + 1 + Math.floor(Math.random() * 5)) % links.length; }
      const [a, b] = links[p.link];
      const na = nodes[a], nb = nodes[b];
      const wob = (n, k) => ({
        x: n.x + Math.sin(t * 0.20 + n.phase) * 0.045,
        y: n.y + Math.cos(t * 0.16 + n.phase * 1.3) * 0.035,
        z: n.z,
      });
      const A = wob(na), B = wob(nb);
      packetPos[i * 3] = A.x + (B.x - A.x) * p.t;
      packetPos[i * 3 + 1] = A.y + (B.y - A.y) * p.t;
      packetPos[i * 3 + 2] = A.z + (B.z - A.z) * p.t;
    });
    packetGeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  }

  const play = () => { if (running) return; running = true; lastFrame = performance.now(); raf = requestAnimationFrame(frame); };
  const pause = () => { running = false; cancelAnimationFrame(raf); };

  const unwatch = watchRuntime(canvas, { play, pause, onTheme });

  resize();
  canvas.classList.add('is-live');
  play();

  return function stop() {
    pause();
    unwatch();
    window.removeEventListener('pointermove', onPointer);
    nodeGeo.dispose(); lineGeo.dispose(); packetGeo.dispose();
    nodeMat.dispose(); lineMat.dispose(); packetMat.dispose();
    renderer.dispose();
    canvas.classList.remove('is-live');
  };
}

mountEffect('.hero-nodes', begin);
