---
name: new-post
description: Add a new post to this blog in the right collection, with the right filename and front matter. Use when asked to write, draft, add or scaffold a post or article.
---

# Adding a post

**[docs/content-guide.md](../../../docs/content-guide.md)** is the source of
truth: which collection to use and where each one publishes, file naming,
front matter, images, and the house style for excerpts and alt text. Follow
it rather than inferring conventions from existing posts, some of which
predate the guide.

**[docs/contributing.md](../../../docs/contributing.md)** covers the branch
and PR workflow.

The procedure:

1. **Choose the collection** from the table in the content guide —
   `_tech/`, `_misc/` or `_education/`. Work in progress goes in `_drafts/`.
2. **Name the file** `YYYY-MM-DD-lowercase-hyphenated-title.md`. The slug
   becomes the URL and outlives the title, so keep it short; changing it
   later breaks inbound links.
3. **Write minimal front matter.** Per-collection defaults in `_config.yml`
   already supply layout, comments, sharing, TOC and read time. Setting them
   by hand is how a post drifts when the defaults change.
4. **Open with a paragraph that stands alone** — it becomes the excerpt in
   listings and search results.
5. **Preview it** with the `dev-server` skill. Check that the post renders,
   that the TOC has entries (it is built from `##` headings, so a post
   without them gets an empty box), and that images resolve.
6. **Branch and open a PR.** `main` is production and merging deploys
   immediately; `story/` is the prefix used for content.

Two things the guide is emphatic about, worth repeating because they are easy
to get wrong: write real alt text on every image, and never hand-edit
`assets/cv.pdf` — it is generated and pushed by automation from another
repository.
