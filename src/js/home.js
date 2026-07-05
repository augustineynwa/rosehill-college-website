/**
 * Homepage scroll chapters. Scroll drives everything:
 * hero crest assembly → motto reveal → pinned life gallery →
 * Year 9–13 journey with corner marker → co-curricular montage.
 * Only loaded when motion is allowed; the CSS static version stands alone.
 */
export async function initHome(gsap, ScrollTrigger, lenis) {
  // dev-only hook for scroll verification (stripped from production builds)
  if (import.meta.env?.DEV) window.__rhc = { gsap, ScrollTrigger, lenis };
  // ------------------------------------------------ hero: crest (official SVG) + motto
  const heroSection = document.querySelector('[data-home-hero]');
  const crestEl = document.querySelector('[data-crest-fallback]');
  const headerCrest = document.querySelector('[data-header-crest]');
  const isDesktop = window.matchMedia('(min-width: 48rem)').matches;

  // crest: soft entrance, then a subtle pointer-driven tilt on desktop.
  // The flat crest sits on a perspective plane (set in CSS) so the tilt
  // reads as a gentle 3D lean without the weight of a WebGL model.
  if (crestEl) {
    gsap.fromTo(crestEl,
      { opacity: 0, scale: 0.9, y: 22 },
      { opacity: 1, scale: 1, y: 0, duration: 1.4, ease: 'power3.out', delay: 0.1 });
    if (isDesktop) {
      const rotY = gsap.quickTo(crestEl, 'rotationY', { duration: 0.7, ease: 'power2.out' });
      const rotX = gsap.quickTo(crestEl, 'rotationX', { duration: 0.7, ease: 'power2.out' });
      window.addEventListener('pointermove', (e) => {
        rotY((e.clientX / window.innerWidth - 0.5) * 12);
        rotX((e.clientY / window.innerHeight - 0.5) * -8);
      }, { passive: true });
    }
  }

  // motto reveal — te reo first, then the English vision beneath
  const reo = document.querySelector('[data-motto-reo]');
  const vision = document.querySelector('[data-motto-vision]');
  // word-by-word reveal is a desktop flourish; on mobile the motto is the
  // LCP element and must paint immediately
  if (reo && isDesktop) {
    const words = reo.textContent.trim().split(/\s+/);
    reo.innerHTML = words
      .map((w) => `<span class="word" aria-hidden="true">${w}</span>`)
      .join(' ');
    reo.setAttribute('aria-label', words.join(' '));
    gsap.fromTo(reo.querySelectorAll('.word'),
      { opacity: 0, y: 26 },
      { opacity: 1, y: 0, duration: 1.0, stagger: 0.08, ease: 'power3.out', delay: 0.5 });
    if (vision) {
      gsap.fromTo(vision, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'power2.out', delay: 1.4 });
    }
  }
  gsap.fromTo('[data-hero-cue]', { opacity: 0 }, { opacity: 1, duration: 1, delay: 1.8 });

  // scrolling out of the hero: crest drifts up + de-assembles slightly,
  // header crest mark settles in as the big one leaves
  const heroScrub = gsap.timeline({
    scrollTrigger: {
      trigger: heroSection,
      start: 'top top',
      end: 'bottom top',
      scrub: true,
      onUpdate: (self) => {
        headerCrest?.classList.toggle('is-visible', self.progress > 0.55);
      },
    },
  });
  heroScrub
    .to('[data-crest-stage]', { yPercent: -26, scale: 0.82, ease: 'none' }, 0)
    .to('.home-hero__text', { yPercent: -14, opacity: 0, ease: 'none' }, 0)
    .to('[data-hero-cue]', { opacity: 0, ease: 'none' }, 0);

  // outside the homepage hero the header crest is always visible
  ScrollTrigger.create({
    trigger: heroSection,
    start: 'bottom top',
    onEnter: () => headerCrest?.classList.add('is-visible'),
  });

  // ------------------------------------------------ life gallery: pinned horizontal
  const lifePin = document.querySelector('[data-life-pin]');
  const lifeTrack = document.querySelector('[data-life-track]');
  if (lifePin && lifeTrack) {
    const distance = () => lifeTrack.scrollWidth - window.innerWidth;
    gsap.to(lifeTrack, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: lifePin,
        start: 'top top',
        end: () => '+=' + distance(),
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });
    // parallax depth inside panels
    document.querySelectorAll('[data-life-panel] img').forEach((img) => {
      gsap.fromTo(img, { xPercent: -6 }, {
        xPercent: 6,
        ease: 'none',
        scrollTrigger: {
          trigger: lifePin,
          start: 'top top',
          end: () => '+=' + distance(),
          scrub: true,
        },
      });
    });
  }

  // ------------------------------------------------ journey: Year 9 → 13
  const journey = document.querySelector('[data-home-journey]');
  if (journey) {
    const steps = gsap.utils.toArray('[data-journey-step]');
    const media = gsap.utils.toArray('[data-journey-media]');
    const marker = document.querySelector('[data-journey-marker]');
    const markerValue = document.querySelector('[data-journey-marker-value]');
    const markerFill = document.querySelector('[data-journey-marker-fill]');

    steps.forEach((step, i) => {
      ScrollTrigger.create({
        trigger: step,
        start: 'top 55%',
        end: 'bottom 45%',
        onToggle: (self) => {
          if (!self.isActive) return;
          steps.forEach((s) => s.classList.remove('is-active'));
          step.classList.add('is-active');
          media.forEach((m, j) => gsap.to(m, { opacity: j === i ? 1 : 0.001, duration: 0.7, ease: 'power2.out' }));
          const year = step.querySelector('.journey-step__year')?.textContent.trim();
          const markerValue = document.querySelector('[data-journey-marker-value]');
          if (year && markerValue) markerValue.textContent = year;
        },
      });
    });

    // slim corner marker synced to journey scroll progress
    ScrollTrigger.create({
      trigger: journey,
      start: 'top 60%',
      end: 'bottom 40%',
      onUpdate: (self) => {
        if (markerFill) markerFill.style.width = (self.progress * 100).toFixed(1) + '%';
      },
      onToggle: (self) => marker?.classList.toggle('is-visible', self.isActive),
    });
  }

  // ------------------------------------------------ co-curricular montage rows
  document.querySelectorAll('[data-montage-row]').forEach((row) => {
    const dir = row.dataset.dir === 'right' ? 1 : -1;
    const shift = () => Math.max(0, row.scrollWidth - window.innerWidth) * 0.6;
    gsap.fromTo(row,
      { x: () => (dir === 1 ? -shift() : 0) },
      {
        x: () => (dir === 1 ? 0 : -shift()),
        ease: 'none',
        scrollTrigger: {
          trigger: row.closest('[data-montage]'),
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.2,
          invalidateOnRefresh: true,
        },
      });
  });

  // ambient hero video: desktop only, sources attached lazily so phones
  // never download it — the poster carries the atmosphere on mobile
  const video = document.querySelector('[data-ambient-video]');
  if (video && window.matchMedia('(min-width: 64rem)').matches) {
    video.poster = video.dataset.poster;
    const webm = document.createElement('source');
    webm.src = video.dataset.webm;
    webm.type = 'video/webm';
    const mp4 = document.createElement('source');
    mp4.src = video.dataset.mp4;
    mp4.type = 'video/mp4';
    video.append(webm, mp4);
    video.load();
    video.play?.().catch(() => {});
  }
}
