# Deployment

## How it works

GitHub Pages builds this site itself. There is no CI workflow in the repo — the
`pages-build-deployment` run you see in the Actions tab is GitHub's own.

| | |
| --- | --- |
| Repository | `Thulana/thulana.github.io` |
| Source branch | `master`, from the repository root |
| Build | GitHub Pages legacy Jekyll build |
| Custom domain | `virtualdump.net` |
| Live site | <https://virtualdump.net/> |

Merging to `master` is the deploy. A build takes roughly a minute; watch it with:

```bash
gh run list --limit 5
```

## What this constrains

Because GitHub Pages runs the build in `--safe` mode, **only allow-listed
plugins run**. `_config.yml` lists them under `whitelist:`:

`jekyll-paginate`, `jekyll-sitemap`, `jekyll-gist`, `jekyll-feed`, `jemoji`

A plugin outside that set will work locally and then silently do nothing in
production. If you need one, the site has to move to a custom Actions workflow
that builds Jekyll and publishes the artifact.

This is also why `assets/js/main.min.js` is committed rather than built at
deploy time — GitHub Pages does not run Node.

## Keeping local matched to production

The `github-pages` gem pins Jekyll and every plugin to the versions GitHub
actually runs, so a local build is a faithful preview. Refresh it periodically:

```bash
bundle update github-pages
```

## The CV

`assets/cv.pdf` is written by automation from a separate repository, which
commits straight to `master` with a message like
`Commit: <sha> - Pushing updated cv to the blog`. Do not hand-edit that file —
the next automated push will overwrite it. Change the CV at its source repo.

## If a deploy fails

1. `gh run list --limit 5` to find the failing run.
2. `gh run view <id> --log-failed` for the build error.
3. Reproduce locally with `bundle exec jekyll build` — most failures are Liquid
   syntax or malformed front matter, and surface identically.

A failed build leaves the previously published site up, so a broken commit takes
the site out of date rather than offline.
