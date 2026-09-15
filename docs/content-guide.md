# Content guide

## Choosing a collection

| Collection | Use it for | Published at |
| --- | --- | --- |
| `_tech/` | Technical writing — code, tooling, engineering | `/tech/<name>/` |
| `_misc/` | Anything non-technical | `/misc/<name>/` |
| `_education/` | Learning, career, freelancing | `/education/<name>/` |
| `_pages/` | Standing pages, not dated entries | per-page `permalink` |

Start a work in progress in `_drafts/` instead — it is excluded from normal
builds and only appears with `bundle exec jekyll serve --drafts`.

## File naming

```
YYYY-MM-DD-lowercase-hyphenated-title.md
```

For example `_tech/2020-01-25-resume-as-a-code.md`. The date prefix is the
convention used throughout this repo; the URL is built from the slug only, so
the date orders the file listing rather than appearing in the link.

## Front matter

The minimum, and what nearly every post here uses:

```yaml
---
title: "How to create your own blog with zero cost"
---
```

Layout, comments, sharing and read-time all come from the per-collection
defaults in `_config.yml`, so there is no need to repeat them. Add keys only to
override a default:

```yaml
---
title: "A quieter post"
comments: false
share: false
---
```

`excerpt_separator` is a blank line, so the first paragraph becomes the excerpt
shown in listings. Write it so it stands on its own.

## Images

Put the file in `images/` and reference it through `base_path`:

```markdown
<figure>
  <img src="{{ base_path }}/images/my-image.jpg" alt="describe the image">
</figure>
```

Always write real alt text. Plain Markdown image syntax works too, but the
`<figure>` form is what the existing posts use and it picks up the theme's
styling.

## Markdown

kramdown with GFM input, so fenced code blocks, tables and task lists all work.
Rouge handles syntax highlighting — name the language on the fence:

````markdown
```ruby
puts "hello"
```
````

Emoji shortcodes such as `:tada:` render via jemoji.

## Before you publish

- Preview locally — a post that reads fine in an editor can break in the layout.
- Check every link, especially ones to your own older posts.
- Confirm images load and have alt text.
- Re-read the first paragraph on its own; it is the excerpt.
