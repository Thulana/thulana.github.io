/* ==========================================================================
   Hero node graph loader

   The graph itself bundles three.js and weighs about 136 KB gzipped. A
   <script type="module"> pointing straight at it defers *execution* but not
   the *fetch*: the browser starts downloading during HTML parsing, where it
   competes with CSS and fonts. Measured on this page that pushed first
   contentful paint from 2.3s to 5.0s and the Lighthouse performance score
   from 95 to 67, before a single line of it had run.

   So this file — a few hundred bytes — is what the page loads, and the real
   bundle arrives through a dynamic import once the page is loaded and the
   main thread is idle. Readers who have asked for reduced motion never
   download it at all.
   ========================================================================== */

import { whenIdle } from './lib/effect-runtime.js';

const canvas = document.querySelector('.hero-nodes');

if (canvas && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  whenIdle(() => {
    import('./hero-nodes.js').catch(err => console.warn('hero node graph failed to load', err));
  });
}
