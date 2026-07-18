/**
 * Site entry. Shared behaviour for every page; homepage chapters are
 * lazy-loaded only on the homepage so sub-pages stay light.
 */
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/home.css';

import { initNav } from './js/nav.js';
import { initAnimations } from './js/animations.js';

const motionOK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

initNav();

// urgent notice banner: dismiss (per-message) + keep --notice-h in sync on resize.
// The initial height/expiry/dismiss check happens in an inline script in the
// partial so there's no flash or layout shift before this module loads.
(() => {
  const notice = document.querySelector('[data-site-notice]');
  if (!notice) return;
  const root = document.documentElement;
  const setH = () => {
    if (notice.style.display !== 'none') root.style.setProperty('--notice-h', notice.offsetHeight + 'px');
  };
  notice.querySelector('[data-notice-close]')?.addEventListener('click', () => {
    try { localStorage.setItem('rhc-notice-dismissed', notice.dataset.noticeId); } catch (e) {}
    notice.style.display = 'none';
    root.style.setProperty('--notice-h', '0px');
  });
  window.addEventListener('resize', setH, { passive: true });
})();

if (document.querySelector('[data-search-input]')) {
  import('./js/search.js').then(({ initSearch }) => initSearch());
}

// click-to-load facade for heavy third-party embeds (e.g. Google Calendar)
document.querySelectorAll('[data-embed-facade]').forEach((facade) => {
  const btn = facade.querySelector('.embed-facade__button');
  btn?.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = facade.dataset.src;
    iframe.title = facade.dataset.title || 'Embedded content';
    iframe.loading = 'lazy';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    facade.replaceChildren(iframe);
    facade.classList.remove('embed-facade');
    iframe.focus();
  });
});

// smooth momentum scroll + shared entrance/parallax motion — only when allowed
if (motionOK) {
  Promise.all([
    import('lenis'),
    import('gsap'),
    import('gsap/ScrollTrigger'),
  ]).then(([{ default: Lenis }, { gsap }, { ScrollTrigger }]) => {
    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    initAnimations(gsap, ScrollTrigger);

    if (document.body.dataset.page === 'home') {
      import('./js/home.js').then(({ initHome }) => initHome(gsap, ScrollTrigger, lenis));
    }
  });
} else if (document.body.dataset.page === 'home') {
  // calm static hero: show the crest image, no canvas
  const fallback = document.querySelector('[data-crest-fallback]');
  if (fallback) fallback.style.display = '';
  const video = document.querySelector('[data-ambient-video]');
  if (video) { video.removeAttribute('autoplay'); video.pause?.(); }
}
