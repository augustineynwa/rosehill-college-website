/** Shared motion language for every page.
 *  Slow reveals, parallax depth, mask wipes. No bounce.
 *  Only ever called when prefers-reduced-motion allows it. */
export function initAnimations(gsap, ScrollTrigger) {
  // entrances — one language everywhere. Elements already inside the first
  // viewport are never opacity-hidden (they may be the LCP element); they
  // get a subtle settle instead.
  const fold = window.innerHeight * 0.85;
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.top < fold) {
      gsap.from(el, { y: 18, duration: 0.9, ease: 'power3.out', clearProps: 'transform' });
      return;
    }
    gsap.fromTo(el,
      { opacity: 0, y: 36 },
      {
        opacity: 1,
        y: 0,
        duration: 1.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
  });

  // parallax depth inside media frames
  document.querySelectorAll('[data-parallax-img]').forEach((frame) => {
    const img = frame.querySelector('img');
    if (!img) return;
    gsap.fromTo(img,
      { yPercent: -8, scale: 1.12 },
      {
        yPercent: 8,
        scale: 1.12,
        ease: 'none',
        scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true },
      });
  });

  // page-hero media drift
  document.querySelectorAll('[data-parallax] img').forEach((img) => {
    gsap.fromTo(img,
      { yPercent: -10 },
      {
        yPercent: 4,
        ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      });
  });

  // stat counters
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const suffix = el.textContent.replace(/[\d,.]+/g, '');
    const obj = { v: 0 };
    gsap.to(obj, {
      v: target,
      duration: 1.6,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      onUpdate: () => { el.textContent = Math.round(obj.v).toLocaleString('en-NZ') + suffix; },
    });
  });
}
