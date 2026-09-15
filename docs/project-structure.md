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
