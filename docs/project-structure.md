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
