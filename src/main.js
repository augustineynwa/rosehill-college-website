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

// contact form → Web3Forms. Progressive enhancement: without JS the form still
// posts natively to Web3Forms; with JS we submit in the background and show an
// inline success/error message so the visitor never leaves the page.
document.querySelectorAll('[data-web3form]').forEach((form) => {
  const status = form.querySelector('[data-form-status]');
  const btn = form.querySelector('button[type="submit"]');
  const say = (msg, ok) => {
    if (!status) return;
    // style first, text last: a live region must already be rendered when its
    // content changes, or the announcement is unreliable across screen readers
    status.classList.toggle('form-status--ok', !!ok);
    status.classList.toggle('form-status--err', !ok);
    status.textContent = '';
    requestAnimationFrame(() => { status.textContent = msg; });
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.botcheck?.checked) return; // honeypot tripped
    if (!form.access_key?.value) { // not configured yet (e.g. preview build)
      say('This form isn’t live yet — please email us at inquiries@rosehillcollege.school.nz.', false);
      return;
    }
    const label = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        form.reset();
        say('Thanks — your message has been sent. We’ll be in touch soon.', true);
      } else {
        say(data.message || 'Sorry, something went wrong. Please email us instead.', false);
      }
    } catch {
      say('Sorry, we couldn’t send that. Please check your connection or email us instead.', false);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = label; }
    }
  });
});

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
