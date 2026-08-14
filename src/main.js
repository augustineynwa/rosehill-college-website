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

/* The school shows the animated site to every visitor, but the pinned
   ScrollTrigger + Lenis engine breaks on touch/iOS Safari (overlapping, frozen
   sections). So motion is gated on a real pointer device, decided once in the
   head script (see head.hbs) and read back here so the JS and CSS agree. Touch
   devices take the static branch below + the html:not(.motion-ok) CSS fallback. */
const motionOK = document.documentElement.classList.contains('motion-ok');

initNav();

// Open external links and document downloads (PDFs, Google Docs, Office files)
// in a new tab, so visitors don't lose the site. Runs over every link including
// ones inside page copy, which templates can't annotate individually.
(() => {
  const docExt = /\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp)(\?|#|$)/i;
  const isDoc = (href) => docExt.test(href) || /(docs|drive)\.google\.com/i.test(href);
  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (!href || href.startsWith('#') || /^(mailto:|tel:)/i.test(href)) return;
    let external = false;
    try { external = new URL(a.href, location.href).host !== location.host; } catch (e) {}
    if (external || isDoc(href)) {
      a.target = '_blank';
      a.rel = `${a.rel ? a.rel + ' ' : ''}noopener noreferrer`.trim();
    }
  });
})();

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
      const fd = new FormData(form);
      const category = fd.get('enquiry_category');
      // Route each category straight to its own inbox via a per-category
      // Web3Forms key. Categories without a key yet fall back to the default
      // access_key already in the form. Subject is prefixed either way.
      const routeKey = {
        'General enquiry': form.dataset.keyGeneral,
        'Enrolment': form.dataset.keyEnrolment,
        'International Students': form.dataset.keyInternational,
      }[category];
      if (routeKey) fd.set('access_key', routeKey);
      if (category) fd.set('subject', `[${category}] ${fd.get('subject') || ''}`.trim());
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.fromEntries(fd)),
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

// tabbed Google Calendar (Term Dates): switch the iframe between the month and
// AGENDA (Key Dates) views. Tablet/mobile forces the agenda view; the tabs are
// hidden there by CSS. Auto-switch only fires when crossing the breakpoint, so
// an ordinary resize never resets a visitor's chosen tab.
document.querySelectorAll('[data-calendar]').forEach((cal) => {
  const frame = cal.querySelector('[data-calendar-frame]');
  const tabs = [...cal.querySelectorAll('.calendar__tab')];
  const urls = { full: cal.dataset.full, agenda: cal.dataset.agenda };
  const setView = (view) => {
    if (!urls[view] || !frame) return;
    frame.src = urls[view];
    tabs.forEach((t) => {
      const on = t.dataset.view === view;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
    });
  };
  tabs.forEach((t) => t.addEventListener('click', () => setView(t.dataset.view)));
  let narrow = null;
  const sync = () => {
    const isNarrow = window.innerWidth <= 991;
    if (isNarrow === narrow) return;
    narrow = isNarrow;
    setView(isNarrow ? 'agenda' : 'full');
  };
  sync();
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(sync, 200); }, { passive: true });
});

// "On this page" jump nav: smooth-scroll to a section (through Lenis, offset for
// the sticky header + this bar) and highlight the section currently in view.
(() => {
  const jump = document.querySelector('[data-page-jump]');
  if (!jump) return;
  const links = [...jump.querySelectorAll('.page-jump__link')];
  const map = new Map();
  links.forEach((l) => {
    const el = document.getElementById(l.getAttribute('href').slice(1));
    if (el) map.set(el, l);
  });
  if (!map.size) return;

  const header = document.querySelector('[data-header]');
  links.forEach((l) => {
    l.addEventListener('click', (e) => {
      const el = document.getElementById(l.getAttribute('href').slice(1));
      if (!el) return;
      e.preventDefault();
      const offset = -((header?.offsetHeight || 0) + jump.offsetHeight + 8);
      if (window.__lenis) {
        window.__lenis.scrollTo(el, { offset });
      } else {
        const y = el.getBoundingClientRect().top + window.scrollY + offset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
      history.replaceState(null, '', '#' + el.id);
    });
  });

  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((l) => l.classList.remove('is-active'));
      map.get(e.target)?.classList.add('is-active');
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  map.forEach((_, el) => obs.observe(el));
})();

// Lightbox: click any [data-lightbox] figure to view the image full-screen.
// Figures sharing a data-lightbox-group get prev/next; Esc and arrow keys work.
(() => {
  const triggers = [...document.querySelectorAll('[data-lightbox]')];
  if (!triggers.length) return;
  let overlay, imgEl, capEl, group = [], index = 0, opener = null;

  const build = () => {
    overlay = document.createElement('div');
    overlay.className = 'lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<button class="lightbox__close" type="button" aria-label="Close">×</button>' +
      '<button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="Previous image">‹</button>' +
      '<figure class="lightbox__figure"><img class="lightbox__img" alt=""><figcaption class="lightbox__cap caption"></figcaption></figure>' +
      '<button class="lightbox__nav lightbox__nav--next" type="button" aria-label="Next image">›</button>';
    document.body.appendChild(overlay);
    imgEl = overlay.querySelector('.lightbox__img');
    capEl = overlay.querySelector('.lightbox__cap');
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('.lightbox__close')) close();
    });
    overlay.querySelector('.lightbox__nav--prev').addEventListener('click', () => step(-1));
    overlay.querySelector('.lightbox__nav--next').addEventListener('click', () => step(1));
  };

  const render = () => {
    const t = group[index];
    const img = t.querySelector('img');
    imgEl.src = t.dataset.full || img?.currentSrc || img?.src || '';
    imgEl.alt = img?.alt || '';
    const cap = t.dataset.lightboxCaption || t.querySelector('figcaption')?.textContent || '';
    capEl.textContent = cap;
    capEl.hidden = !cap;
    const multi = group.length > 1;
    overlay.querySelectorAll('.lightbox__nav').forEach((n) => { n.hidden = !multi; });
  };

  const open = (t) => {
    if (!overlay) build();
    opener = t;
    const g = t.dataset.lightboxGroup;
    group = g ? triggers.filter((x) => x.dataset.lightboxGroup === g) : [t];
    index = Math.max(0, group.indexOf(t));
    render();
    overlay.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
    overlay.querySelector('.lightbox__close').focus();
  };
  const close = () => {
    overlay.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    opener?.focus();
  };
  const step = (d) => { index = (index + d + group.length) % group.length; render(); };

  triggers.forEach((t) => {
    t.addEventListener('click', () => open(t));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(t); }
    });
  });
  document.addEventListener('keydown', (e) => {
    if (!overlay || !overlay.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  });
})();

// Video modal: [data-hero-play] plays a film full-frame with sound + controls.
// The hero keeps its muted ambient loop; this is the "sit down and watch it" path.
(() => {
  const triggers = [...document.querySelectorAll('[data-hero-play]')];
  if (!triggers.length) return;
  let overlay, videoEl, opener = null;

  const build = () => {
    overlay = document.createElement('div');
    overlay.className = 'video-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<button class="video-modal__close" type="button" aria-label="Close video">×</button>' +
      '<div class="video-modal__frame"><video class="video-modal__video" controls playsinline preload="none"></video></div>';
    document.body.appendChild(overlay);
    videoEl = overlay.querySelector('.video-modal__video');
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('.video-modal__close')) close();
    });
  };

  const open = (t) => {
    if (!overlay) build();
    opener = t;
    const src = t.dataset.video;
    if (videoEl.getAttribute('src') !== src) videoEl.setAttribute('src', src);
    videoEl.setAttribute('aria-label', t.dataset.title || 'Video');
    overlay.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
    try { videoEl.currentTime = 0; } catch (_) {}
    const p = videoEl.play();
    if (p && p.catch) p.catch(() => {});
    overlay.querySelector('.video-modal__close').focus();
  };
  const close = () => {
    if (!overlay) return;
    videoEl.pause();
    overlay.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    opener?.focus();
  };

  triggers.forEach((t) => t.addEventListener('click', () => open(t)));
  document.addEventListener('keydown', (e) => {
    if (overlay && overlay.classList.contains('is-open') && e.key === 'Escape') close();
  });
})();

// smooth momentum scroll + shared entrance/parallax motion — only when allowed
if (motionOK) {
  Promise.all([
    import('lenis'),
    import('gsap'),
    import('gsap/ScrollTrigger'),
  ]).then(([{ default: Lenis }, { gsap }, { ScrollTrigger }]) => {
    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1 });
    window.__lenis = lenis; // let the "on this page" nav scroll through Lenis
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
  if (video) {
    // The poster and sources live in data attributes and are normally attached
    // by home.js, which never runs here. Without the poster the hero ambient
    // layer is simply blank, so reduced motion loses the imagery rather than
    // just the movement. Attach the poster; leave the video itself unloaded.
    if (video.dataset.poster) video.poster = video.dataset.poster;
    video.removeAttribute('autoplay');
    video.pause?.();
  }
}
