/** Shared motion language for every page.
 *  Slow reveals, parallax depth, mask wipes. No bounce.
 *  Only ever called when prefers-reduced-motion allows it. */
export function initAnimations(gsap, ScrollTrigger) {
  // entrances — one language everywhere
  document.querySelectorAll('[data-reveal]').forEach((el) => {
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
