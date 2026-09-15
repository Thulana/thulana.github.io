# Contributing

This is a personal blog, so the process is deliberately light. The rules that
matter are the ones that keep `main` publishable, because
[merging to `main` publishes the site](deployment.md).

## Workflow

```bash
git checkout main && git pull
git checkout -b <type>/<short-description>
# ... work ...
bundle exec jekyll serve --config _config.yml,_config.dev.yml   # preview
git add <files> && git commit
git push -u origin HEAD
gh pr create --fill
```

Branch prefixes in use: `story/` for new content, `docs/` for documentation,
`feat/` and `fix/` for site changes.

Never commit directly to `main` — it deploys immediately, with no review step
between the push and the live site.

## Commits

Recent history uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(ai-blogger): add new image interstellar_comet_3iatlas_observation.png
```

Keep the subject imperative and under ~72 characters. One logical change per
commit; a new post and a layout fix belong in separate commits.

Commits matching `Commit: <sha> - Pushing updated cv to the blog` are machine
generated — see [deployment](deployment.md#the-cv).

## Pull requests

A PR against `main` is worth opening even working solo: it gives the Pages
build something to check before the change is live, and it leaves a record of
why a change was made. Say what changed and why; link the rendered page if the
change is visual.

## Before you push

- The site builds: `bundle exec jekyll build` exits clean.
- You previewed the change locally.
- Nothing generated is staged — `_site/`, `.jekyll-cache/`, `vendor/`,
  `node_modules/` are all git-ignored, so `git status` should be quiet.
- `assets/js/main.min.js` is rebuilt and staged if you touched `_main.js` or
  anything in `assets/js/plugins/`.

## House style

`.editorconfig` is authoritative and most editors apply it automatically:
2-space indent, LF line endings, UTF-8, trailing whitespace trimmed — except in
Markdown, where trailing spaces are meaningful.

For prose and front matter conventions, see the
[content guide](content-guide.md).

## Git identity

The repo lives on a personal GitHub account. If your global git config uses a
work email, set the right identity per-repo so commits are attributed correctly:

```bash
git config --local user.name  "Your Name"
git config --local user.email "you@personal.example"
```
