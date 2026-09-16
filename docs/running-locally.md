# Running locally

## Prerequisites

**Ruby 3.2 or newer.** This matters more than it sounds: `Gemfile.lock` pins
activesupport 8.x, which requires Ruby >= 3.2, and macOS ships 2.6 at
`/usr/bin/ruby`. Homebrew's Ruby is keg-only, so it is installed but not on
`PATH` — put it there first, deriving the prefix rather than hardcoding it, as
it differs between Apple Silicon and Intel:

```bash
brew install ruby                              # if not already installed
export PATH="$(brew --prefix ruby)/bin:$PATH"
ruby -v                                        # expect 3.2+, not 2.6
```

Add that `export` to your `~/.zshrc` to avoid repeating it. A version manager
(`rbenv`, `asdf`, `mise`) works just as well.

An old Ruby does not fail with an honest version complaint. It gets as far as
`jekyll-github-metadata` and dies with a Faraday adapter error that suggests
nothing about versions.

**Do not run `bundle install` to try to clear that error under an old Ruby.**
Bundler will resolve the entire tree down to versions that satisfy the old
interpreter and rewrite `Gemfile.lock` in place — activesupport 8.x quietly
becomes 3.x. Recover with `git checkout -- Gemfile.lock`.

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

- **Browse `localhost`, never `127.0.0.1`.** `_config.dev.yml` sets
  `url: http://localhost:4000`, so absolute asset URLs carry that origin.
  Reaching the site through `127.0.0.1:4000` makes the browser treat them as
  cross-origin, and Font Awesome and `manifest.json` fail with CORS errors.
  Icons render as empty boxes and the console fills with red — all of it an
  artifact of the hostname, not a defect in the site.
- **Port 4000 is often already in use.** A second server prints a long
  `EADDRINUSE` stack trace. Check with
  `lsof -nP -iTCP:4000 -sTCP:LISTEN` and reuse whatever is already running;
  it regenerates on save like any other.
- **The server follows the working tree.** Switching branches changes what is
  served without any visible signal, so a change can appear broken purely
  because you moved to a branch without it.
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
npm run build        # everything below, in one go
npm run build:js     # concatenate + minify into assets/js/main.min.js
npm run build:bundles # esbuild assets/js/src/* into committed bundles
npm run watch:js     # rebuild main.min.js on every save
```

`package-lock.json` is committed, so `npm ci` reproduces exactly the versions
that produced the committed bundles. CI rebuilds them on every pull request
and fails if the result differs from what is in the tree, which is what stops
"edited the source, forgot to rebuild" from silently shipping nothing.

**The pipeline is ES5-only.** `uglify-js` 2.x cannot parse ES6 or later, so
arrow functions, `let`/`const`, template literals, spread and classes in
`_main.js` or the plugins will break the build. Anything needing modern syntax
belongs in its own file, loaded as a module from `_includes/scripts.html`
rather than routed through `npm run build:js`. The concatenation order is the
argument list of the `uglify` script in `package.json`: jQuery stays first,
`_main.js` stays last because it calls into the plugins ahead of it.

`assets/js/main.min.js` is committed, because GitHub Pages does not run Node.
Rebuild it and stage it in the same commit as the source change.

Note that `npm install` resolves `uglify-js` to a newer patch release than the
one that produced the committed bundle, so a rebuild shows a small diff even
with no source change. That is expected; only commit the regenerated bundle when
you actually changed the JavaScript.
