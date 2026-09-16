/* ==========================================================================
   Effect runtime

   The rules every background effect on this site has to obey, in one place,
   because they are easy to get subtly wrong once per effect:

   - Never initialise during page load. Creating a GL context and compiling
     shaders competes with first paint; measured here it moved LCP from 2.4s
     to 5.0s. Wait for load, then for an idle callback.
   - Never run when nobody is looking: off-screen, or a hidden tab.
   - Never start at all under reduced motion, and react if the reader changes
     that preference while the page is open.
   - Follow the site's theme, which means the data-theme attribute as well as
     the OS setting, since there is a manual toggle.

   Consumers supply a `begin(canvas)` that returns a stop function, and use
   `watchRuntime` inside it to hook play/pause/theme.
   ========================================================================== */

export function prefersDark() {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit === 'dark') return true;
  if (explicit === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function whenIdle(fn) {
  const run = () => (window.requestIdleCallback
    ? window.requestIdleCallback(fn, { timeout: 2000 })
    : setTimeout(fn, 200));
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}

/**
 * Wire visibility, theme and context-loss handling for a running effect.
 * Returns a teardown function; call it from the effect's own stop().
 */
export function watchRuntime(canvas, { play, pause, onTheme }) {
  const observer = new IntersectionObserver(
    entries => (entries[0].isIntersecting && !document.hidden ? play() : pause()),
    { threshold: 0 },
  );
  observer.observe(canvas);

  const onVisibility = () => (document.hidden ? pause() : play());
  document.addEventListener('visibilitychange', onVisibility);

  const themeObserver = new MutationObserver(onTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-theme'],
  });
  const schemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  schemeQuery.addEventListener('change', onTheme);

  const onLost = event => {
    event.preventDefault();
    pause();
    canvas.classList.remove('is-live');
  };
  canvas.addEventListener('webglcontextlost', onLost);

  return function unwatch() {
    observer.disconnect();
    themeObserver.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    schemeQuery.removeEventListener('change', onTheme);
    canvas.removeEventListener('webglcontextlost', onLost);
  };
}

/**
 * Mount an effect on the first canvas matching `selector`, honouring reduced
 * motion and deferring past load. `begin(canvas)` returns a stop function, or
 * null when the effect cannot run (no WebGL, failed compile).
 * Returns silently when no such canvas exists, so a module can be loaded on a
 * page that does not use it.
 */
export function mountEffect(selector, begin) {
  const canvas = document.querySelector(selector);
  if (!canvas) return;

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let stop = null;

  const sync = () => {
    if (motionQuery.matches) {
      if (stop) { stop(); stop = null; }
    } else if (!stop) {
      stop = begin(canvas);
    }
  };

  motionQuery.addEventListener('change', sync);
  whenIdle(sync);
}
