# Virtual Dump — Documentation

Documentation for [virtualdump.net](https://www.virtualdump.net), a Jekyll blog
hosted on GitHub Pages.

| Guide | What it covers |
| --- | --- |
| [Running locally](running-locally.md) | Prerequisites, first-time setup, the dev server |
| [Content guide](content-guide.md) | Collections, front matter, images, adding a post |
| [Project structure](project-structure.md) | What each top-level directory does |
| [Contributing](contributing.md) | Branches, commits, pull requests |
| [Deployment](deployment.md) | How the site gets published |

## Quick reference

```bash
export PATH="$(brew --prefix ruby)/bin:$PATH"    # macOS system Ruby is too old
bundle config set --local path vendor/bundle     # first-time setup
bundle install
bundle exec jekyll serve --config _config.yml,_config.dev.yml
```

The site is then at <http://localhost:4000>.

Working on this repo with an AI agent? See [AGENTS.md](../AGENTS.md).
