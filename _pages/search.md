---
permalink: /search/
title: "Search"
author_profile: false
excerpt: "Search every post on Virtual Dump."
---

{% include base_path %}

<div class="site-search">
  <label class="site-search__label" for="site-search-input">Search posts</label>
  <input type="search" id="site-search-input" class="site-search__input"
         placeholder="Try &ldquo;docker&rdquo;, &ldquo;quantum&rdquo; or &ldquo;AWS&rdquo;&hellip;"
         autocomplete="off" autocapitalize="off" spellcheck="false">
  <p class="site-search__status" id="site-search-status" role="status" aria-live="polite">Loading posts&hellip;</p>
</div>

<div id="site-search-results" class="list__item-wrap"></div>

<noscript>
  <p>Search needs JavaScript. You can still browse
     <a href="{{ base_path }}/year-archive/">by year</a>,
     <a href="{{ base_path }}/categories/">by category</a> or
     <a href="{{ base_path }}/tags/">by tag</a>.</p>
</noscript>

<script>
(function () {
  var input  = document.getElementById('site-search-input');
  var status = document.getElementById('site-search-status');
  var out    = document.getElementById('site-search-results');
  var posts  = [];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  // Every term must appear somewhere in the post; results rank title matches first.
  function score(post, terms) {
    var title = post.title.toLowerCase();
    var meta  = (post.tags + ' ' + post.categories).toLowerCase();
    var body  = post.body.toLowerCase();
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      if (title.indexOf(t) > -1)      total += 10;
      else if (meta.indexOf(t) > -1)  total += 5;
      else if (body.indexOf(t) > -1)  total += 1;
      else return 0;                  // a term missing entirely disqualifies the post
    }
    return total;
  }

  function render(query) {
    var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) {
      out.innerHTML = '';
      status.textContent = posts.length + ' posts indexed.';
      return;
    }
    var hits = posts
      .map(function (p) { return { post: p, s: score(p, terms) }; })
      .filter(function (h) { return h.s > 0; })
      .sort(function (a, b) { return b.s - a.s; });

    status.textContent = hits.length === 0
      ? 'No posts match “' + query + '”.'
      : hits.length + (hits.length === 1 ? ' post' : ' posts') + ' matching “' + query + '”.';

    out.innerHTML = hits.map(function (h) {
      var p = h.post;
      return '<article class="list__item">' +
               '<h2 class="archive__item-title"><a href="' + esc(p.url) + '">' + esc(p.title) + '</a></h2>' +
               '<p class="archive__item-excerpt"><small>' + esc(p.date) +
                 (p.tags ? ' &middot; ' + esc(p.tags) : '') + '</small></p>' +
               '<p class="archive__item-excerpt">' + esc(p.excerpt) + '</p>' +
             '</article>';
    }).join('');
  }

  fetch('{{ base_path }}/search.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      posts = data;
      status.textContent = posts.length + ' posts indexed.';
      input.disabled = false;
      // Support /search/?q=term and deep links from elsewhere on the site.
      var q = new URLSearchParams(window.location.search).get('q');
      if (q) { input.value = q; render(q); }
      input.focus();
    })
    .catch(function () {
      status.textContent = 'Could not load the search index.';
    });

  input.addEventListener('input', function () { render(input.value); });
})();
</script>
