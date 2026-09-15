# AGENTS.md

Guidance for AI coding agents working in this repository. Human contributors
want [`docs/`](docs/README.md) — this file points at the same documentation and
adds the constraints that are easy for an agent to violate.

## What this is

A Jekyll blog published at <https://virtualdump.net> via GitHub Pages. Content
is Markdown; there is no application code and no test suite.

## Read first

| Task | Guide |
| --- | --- |
| Build or serve the site | [docs/running-locally.md](docs/running-locally.md) |
| Add or edit a post | [docs/content-guide.md](docs/content-guide.md) |
| Find your way around | [docs/project-structure.md](docs/project-structure.md) |
| Branch, commit, open a PR | [docs/contributing.md](docs/contributing.md) |
| Understand publishing | [docs/deployment.md](docs/deployment.md) |

## Non-negotiable constraints

**`main` is production.** Merging deploys straight to the live site. Always
work on a branch and open a PR; never commit to `main` directly.

**This is someone's personal writing.** Do not rewrite, restructure, or
"improve" the prose of an existing post unless explicitly asked. Fixing a broken
link or malformed front matter is fine; editing someone's voice is not.

**Verify the build before you claim a change works.** Local Ruby matters here:

```bash
export PATH="/opt/homebrew/opt/ruby/bin:$PATH"   # macOS system Ruby is too old
bundle install
bundle exec jekyll build --config _config.yml,_config.dev.yml
```

A green build is the bar. A Liquid or front-matter error fails the whole build,
not just one page.

**Never edit generated output.** `_site/`, `.jekyll-cache/`, `vendor/` and
`node_modules/` are build artifacts and git-ignored. The one generated file that
*is* committed is `assets/js/main.min.js`; rebuild it with `npm run build:js`
whenever you touch `assets/js/_main.js` or `assets/js/plugins/`.

**`assets/cv.pdf` is machine-written** by a separate repository. Leave it alone.

## Traps specific to this repo

**Markdown you write for humans gets rendered by Jekyll.** Any `.md` at the repo
root or in a content directory is processed as Liquid, so `{% ... %}` and
`{{ ... }}` in prose will break the build. `docs/`, `AGENTS.md` and `README.md`
are listed under `exclude:` in `_config.yml` for exactly this reason — keep them
there, and add any new documentation directory to that list too.

**Front matter is what makes a page.** A Markdown file in a collection with no
`---` block is not an error: Jekyll copies it to the output as a raw `.md` file
that serves at a `.md` URL and appears nowhere in the site. It fails silently.
Every post needs at least a `title`.

**Plugins are allow-listed.** GitHub Pages builds in `--safe` mode and only runs
the plugins under `whitelist:` in `_config.yml`. Anything else works locally and
silently does nothing in production.

**Per-collection defaults already exist.** `_config.yml` sets `layout`,
`comments`, `share`, `read_time` and `related` for every collection. A new post's
front matter should normally be just a title — do not copy boilerplate into it.

**`repository:` in `_config.yml` must stay.** The `github-pages` gem needs it to
resolve the repo name; without it a local build fails outright when `origin` is
an SSH alias rather than a literal `github.com` URL.

## Conventions

- Filenames: `YYYY-MM-DD-lowercase-hyphenated-title.md`
- Commits: Conventional Commits, e.g. `docs: add contributor documentation`
- Formatting: `.editorconfig` governs — 2-space indent, LF, UTF-8
- Images: `images/`, referenced as `{{ base_path }}/images/<file>`, always with
  alt text

## Before you hand back

- [ ] `bundle exec jekyll build` exits clean
- [ ] You loaded the affected page locally and looked at it
- [ ] `git status` shows nothing generated staged
- [ ] Changes are on a branch, not `main`
