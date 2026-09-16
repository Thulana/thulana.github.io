# Project structure

Jekyll treats every top-level directory starting with `_` as special. Here is
what each one is for in this repo.

## Content

| Path | Purpose |
| --- | --- |
| `_tech/` | Technical posts — the main collection |
| `_misc/` | Everything non-technical |
| `_education/` | Learning / career posts |
| `_pages/` | Standalone pages (About, Terms, archives, portfolio) |
| `_drafts/` | Unpublished work; only rendered with `--drafts` |
| `images/` | All post and site imagery |

`_tech`, `_misc` and `_education` are declared under `collections:` in
`_config.yml` with `output: true`, so each entry becomes a page at
`/<collection>/<filename>/`.

## Theme and templating

| Path | Purpose |
| --- | --- |
| `_layouts/` | Page shells (`single`, `archive`, …) referenced by `layout:` |
| `_includes/` | Reusable partials pulled in with `{% include %}` |
| `_sass/` | Sass partials |
| `assets/` | Compiled CSS, JavaScript, fonts |
| `_data/` | YAML the templates read — nav, authors, UI strings, comments |

`_data/navigation.yml` drives the main menu; `_data/ui-text.yml` holds the
translatable interface strings.

## Configuration

| Path | Purpose |
| --- | --- |
| `_config.yml` | Site settings, collections, per-collection defaults, plugins |
| `_config.dev.yml` | Local overrides layered on top for development |
| `Gemfile` | Ruby dependencies, via the `github-pages` gem |
| `package.json` | Node tooling for the JavaScript build only |
| `CNAME` | Custom domain for GitHub Pages |
| `AGENTS.md` | Instructions for AI coding agents |
| `docs/` | This documentation (excluded from the built site) |
| `.editorconfig` | 2-space indent, LF endings, UTF-8 |

## Generated — never edit, never commit

`_site/`, `.jekyll-cache/`, `vendor/`, `node_modules/` are all build output or
dependencies and are git-ignored.

`assets/js/main.min.js` is the one generated file that *is* committed, because
GitHub Pages does not run the Node build. See
[running locally](running-locally.md#rebuilding-the-javascript).

## The hero background

The homepage hero is three layers stacked in one box, which is worth knowing
before changing any of them:

1. **`banner-network.svg`**, set as the hero's CSS background from
   `header.overlay_image` in `_pages/home.md`. It is the poster frame and the
   permanent fallback.
2. **`<canvas class="hero-canvas">`**, painted by
   `assets/js/hero-shader.js` — a single fullscreen quad running a fragment
   shader. It is raw WebGL on purpose: the whole effect is one shader, and a
   3D library would cost more than the rest of the page put together. It is
   about 3.5 KB gzipped.
3. **The title and lead**, lifted above the canvas with `z-index`.

The canvas starts transparent and only fades in once it has a frame, via an
`is-live` class. Everything that can stop it — no WebGL, a lost context,
`prefers-reduced-motion: reduce` — simply leaves layer 1 showing, so there is
no path that renders an empty box. It stops drawing when scrolled out of view
or the tab is hidden, renders at 0.7× CSS pixels, and caps at 30fps.

It also waits for the `load` event and then an idle callback before touching
WebGL at all. That is not incidental: booting it during page load measured a
Lighthouse performance score of 73 against 96 for the same page without it,
with LCP at 5.0s against 2.4s. Deferring it returns the page to baseline
(98 / 2.1s) while looking identical, because the poster frame is on screen
throughout. Anything added here later should keep that ordering.

Its palette is interpolated from the same values as the SVG and follows the
`data-theme` attribute and the OS colour scheme, so the theme toggle repaints
it rather than leaving a mismatched background.

Because it is an ES module it never goes through the ES5-only `uglify`
pipeline described in [running locally](running-locally.md#rebuilding-the-javascript),
and it is loaded only on pages that actually have a hero.

## Module scripts must be root-relative

Every `<script type="module">` on this site uses a root-relative `src`
(`/assets/js/...`), never `{{ base_path }}`. This is load-bearing and is worth
understanding before anyone "tidies" it.

`base_path` is absolute, built from `site.url`. The site is served at the apex
domain, so referencing a module at the `www` host — or any host other than the
one the visitor typed — makes it a **cross-origin** request. ES modules are
fetched in CORS mode, unlike classic scripts, and GitHub Pages sends no
`Access-Control-Allow-Origin`. The browser then blocks every module silently:
all the animation dies while `main.min.js`, a classic script, carries on
working, so the site looks fine and merely has nothing moving on it.

This shipped to production once, and took a build with the production config
to spot, because everything works locally where the hostname happens to match.
A root-relative path is same-origin whichever hostname the visitor arrived at,
which is also why the effects now survive being loaded over `127.0.0.1`.

Related: `url` in `_config.yml` is the apex domain and `baseurl` is empty,
because the site is served at the root. `baseurl: "/"` was producing
`//double//slashes` in every emitted URL.

## The hero node graph

Above the hero's shader field sits a second, transparent canvas carrying a
graph of nodes and edges with packets travelling the links —
`assets/js/src/hero-nodes.js`, bundled to `assets/js/hero-nodes.js`.

This is the one effect on the site that uses a library. Everything else is
raw WebGL, because a fullscreen quad does not need a scene graph; a graph
with depth, per-object parallax and animated packets is where three.js
starts paying for itself. It costs about 136 KB gzipped after tree-shaking,
which is roughly three times the rest of the site's JavaScript put together,
so it is scoped tightly: only pages with a hero, and only after the page is
idle.

**Do not point a `<script type="module">` straight at that bundle.** A module
tag defers execution but not the fetch — the browser starts downloading it
during HTML parsing, where it competes with CSS and fonts. Measured here that
moved first contentful paint from 2.0s to 5.0s and the Lighthouse performance
score from 96 to 67, before any of it had run. `hero-nodes-loader.js` is the
few hundred bytes the page actually loads; it pulls the bundle in by dynamic
import once the page is idle, and readers who have asked for reduced motion
never download it at all. With the loader the score is back to 96.

## The author portrait

The photo on /about turns to look at the pointer, wherever it is on the page.
`assets/js/author-portrait.js` — one quad and a fragment shader, raw WebGL,
because a single quad has no use for a scene graph and /about has no other
reason to pull the 136 KB three.js bundle.

Two things make it read as a head rather than as a picture being dragged
around, and both matter:

**The plane is genuinely rotated in 3D.** For every fragment the shader casts
a ray, intersects it with a plane rotated by the current yaw and pitch, and
samples the photo at the intersection. That is a real perspective warp: the
far edge compresses and the near edge spreads. An earlier version displaced
UVs by a synthesised depth value instead, which slides pixels around and
reads as rubber — if this ever needs changing, do not go back to that.

**The eyes move separately.** A head that rotates without its gaze changing
still looks wrong, so each eye region gets a small extra shift toward the
pointer on top of the rotation. `EYE_LEFT` and `EYE_RIGHT` are measured off
`images/thulana.jpg` by eye, in texture coordinates, and are the one thing
here tied to that particular photo — replace the image and they need
re-checking or the gaze lands on a cheekbone.

`EYE_SHIFT` should stay a small fraction of `EYE_RADIUS`, around a fifth. Push
it higher and the eyelid smears instead of the iris moving.

The pointer is normalised against the viewport rather than the avatar, so the
head tracks across the whole page and only recentres when the pointer leaves
the window. `ZOOM` crops in slightly so that rotation reveals real pixels
rather than the clamped edge of the texture.

The `<img>` stays underneath, so no WebGL, a failed decode or reduced motion
all leave the ordinary photo in place. The script loads only where the sidebar
actually renders — which is not the same as where `author_profile` is true,
since `_config.yml` defaults that to true for every page while the splash
layout renders no sidebar at all.

## The site background

Every page also carries a fixed canvas behind its content, drawn by
`assets/js/site-background.js`: a parallax starfield, a two-source
interference pattern, and a comet on a 23-second cycle — the subjects this
blog actually writes about.

Body text sits directly on top of it, which is the constraint that decides
everything else. The amplitudes are a few percent of luminance and nothing
moves quickly, so it should register as texture rather than as animation. If
you raise them, check a long post in both themes before assuming it still
reads.

The layering is a small trick worth knowing before editing `_sass/_site-bg.scss`:
the surface colour moves off `<body>` and onto `<html>`, so the canvas at
`z-index: -1` has something to composite against. That is also why the
fallback is free — when the canvas never becomes visible, the `html` colour
is the page background exactly as before.

`assets/js/lib/effect-runtime.js` holds the rules every effect obeys: defer
past load, stop when off-screen or on a hidden tab, never start under reduced
motion, follow the theme including the manual toggle.
`assets/js/lib/shader-canvas.js` builds on it with what a fullscreen-quad
shader needs — context and program setup and the throttled loop. Adding
another effect should mean a fragment shader and a palette, not another copy
of those rules; the node graph uses the same runtime without the shader
plumbing.

Measured on the homepage with both canvases: performance 94–95 against 96
for the same page with neither, accessibility unchanged at 100, total
blocking time flat at 50ms and no layout shift. Those numbers come from
software WebGL in headless Chrome, where a fullscreen fragment shader
rasterises on the CPU; on a real GPU it is far cheaper.

## Defaults worth knowing

`_config.yml` sets per-collection defaults so individual posts stay clean. Every
entry in `_tech`, `_misc` and `_education` gets:

```yaml
layout: single
author_profile: false
read_time: true
comments: true
share: true
related: true
```

Which is why a post's own front matter is usually just a title. Override any of
these per-post only when you actually need something different.
