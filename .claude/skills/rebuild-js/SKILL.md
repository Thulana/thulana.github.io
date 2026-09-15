---
name: rebuild-js
description: Rebuild the site's committed JavaScript bundle after editing assets/js/_main.js or a plugin under assets/js/plugins. Use when JavaScript source changed, or when a JS change is not showing up on the page.
---

# Rebuilding the JS bundle

**[docs/running-locally.md](../../../docs/running-locally.md#rebuilding-the-javascript)**
is the source of truth — it covers the commands, why the bundle is committed,
the ES5-only constraint on the pipeline, and the concatenation order.

The essentials, because getting these wrong is silent:

```bash
npm install        # first time only
npm run build:js
```

- The page loads exactly one script, `assets/js/main.min.js`. **Editing
  `_main.js` alone changes nothing on the page** — a PR that ships the source
  without the regenerated bundle ships no behaviour.
- **The pipeline cannot parse ES6.** `uglify-js` 2.x breaks on arrow
  functions, `let`/`const`, template literals, spread and classes. Write ES5
  here; put modern syntax in its own file loaded as a module from
  `_includes/scripts.html`.
- `npm install` may resolve a newer `uglify-js` patch than produced the
  committed bundle, so a rebuild shows a small diff even with no source
  change. Only commit the bundle when the source actually changed.

Confirm the change reached the bundle, then load the page with the
`dev-server` skill and check the console is clean — a syntax error in the
bundle takes out every script on the page, including the theme toggle and
the navigation.

```bash
grep -c "some-distinctive-string" assets/js/main.min.js
```
