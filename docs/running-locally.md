# Running locally

## Prerequisites

**Ruby 3.x.** This matters more than it sounds: the `github-pages` gem needs
Ruby >= 2.7, and macOS ships 2.6 at `/usr/bin/ruby`. Using the system Ruby fails
at `bundle install`. Homebrew's Ruby is keg-only, so it is not on `PATH` by
default — put it there first:

```bash
brew install ruby                                  # if not already installed
export PATH="/opt/homebrew/opt/ruby/bin:$PATH"
ruby -v                                            # expect 3.x, not 2.6
```

Add that `export` to your `~/.zshrc` to avoid repeating it. A version manager
(`rbenv`, `asdf`, `mise`) works just as well.

**Node.js** is only needed to rebuild the bundled JavaScript — not to write
posts.

## First-time setup

```bash
bundle config set --local path vendor/bundle
bundle install
```

Keeping gems in `vendor/bundle` avoids touching system-wide gems. Both
`vendor/` and the `.bundle/` config directory are git-ignored.

Verified versions at the time of writing: `github-pages` 232, Jekyll 3.10.0.

## Running the dev server

```bash
bundle exec jekyll serve --config _config.yml,_config.dev.yml
```

Serving at <http://localhost:4000>. Jekyll rebuilds on save. The second config
layers development overrides on top of the production one:

| Setting | Production (`_config.yml`) | Development (`_config.dev.yml`) |
| --- | --- | --- |
| `url` | `https://www.virtualdump.net` | `http://localhost:4000` |
| `analytics.provider` | `custom` | `false` |
| `sass.style` | `compressed` | `expanded` |

Without the dev config you get minified CSS and live analytics pointed at the
production property.

Useful variants:

```bash
bundle exec jekyll serve --drafts   # also render _drafts/
bundle exec jekyll build            # one-off build into _site/
```

## Expected build noise

A healthy build is not a silent one. These are harmless:

- **Sass deprecation warnings** about `call()` — from the vendored theme.
- **`To use retry middleware with Faraday v2.0+, install faraday-retry`**.
- **`GitHub Metadata: No GitHub API authentication could be found`** — only
  affects `site.github.*` metadata locally. Set `JEKYLL_GITHUB_TOKEN` if you
  need it populated.

A build that ends `done in N seconds` succeeded, warnings notwithstanding.

## Things that trip people up

- **`_config.yml` is not hot-reloaded.** Changing either config file needs the
  server restarted.
- **One bad file fails the whole build.** A Liquid or front-matter error is
  fatal, not page-local.
- **Documentation is excluded from the build on purpose.** `docs/`, `AGENTS.md`
  and `README.md` are in `exclude:` in `_config.yml` because Markdown written
  for humans often contains `{% ... %}` or `{{ ... }}` that Jekyll would try to
  execute. Add any new docs directory to that list.
- **`repository:` in `_config.yml` is load-bearing.** The `github-pages` gem
  resolves the repo name from it. Without it, a build fails with
  `No repo name found` whenever the `origin` remote is an SSH alias rather than
  a literal `github.com` URL.
- **`_site/` is build output**, git-ignored and safe to delete. If a build looks
  stale, `rm -rf _site` and rebuild.

## Rebuilding the JavaScript

Only relevant if you touch `assets/js/_main.js` or `assets/js/plugins/`:

```bash
npm install
npm run build:js     # concatenate + minify into assets/js/main.min.js
npm run watch:js     # same, on every save
```

`assets/js/main.min.js` is committed, because GitHub Pages does not run Node.
Rebuild it and stage it in the same commit as the source change.

Note that `npm install` resolves `uglify-js` to a newer patch release than the
one that produced the committed bundle, so a rebuild shows a small diff even
with no source change. That is expected; only commit the regenerated bundle when
you actually changed the JavaScript.
