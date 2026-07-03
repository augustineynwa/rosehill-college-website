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
