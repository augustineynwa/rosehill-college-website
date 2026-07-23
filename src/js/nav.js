/** Header behaviour: solid-on-scroll, dropdowns, absence menu, mobile menu.
 *  Fully keyboard operable; Escape closes any open layer. */
export function initNav() {
  const header = document.querySelector('[data-header]');
  if (!header) return;

  // solid background once past the top
  const onScroll = () => header.classList.toggle('is-solid', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // desktop dropdowns (click + hover intent)
  const items = header.querySelectorAll('.site-nav__item.has-children');
  const closeAll = (except) => {
    items.forEach((item) => {
      if (item === except) return;
      item.classList.remove('is-open');
      item.querySelector('[data-nav-toggle]')?.setAttribute('aria-expanded', 'false');
    });
  };
  items.forEach((item) => {
    const toggle = item.querySelector('[data-nav-toggle]');
    let hoverTimer;
    toggle.addEventListener('click', () => {
      const open = item.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      closeAll(item);
    });
    item.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(hoverTimer);
      item.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      closeAll(item);
    });
    item.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      hoverTimer = setTimeout(() => {
        item.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }, 160);
    });
    // close when tabbing out of the whole item
    item.addEventListener('focusout', (e) => {
      if (!item.contains(e.relatedTarget)) {
        item.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // report-absences menu
  const absence = header.querySelector('[data-absence]');
  const absenceToggle = header.querySelector('[data-absence-toggle]');
  const absenceMenu = absence?.querySelector('.absence__menu');
  if (absenceToggle && absenceMenu) {
    absenceToggle.addEventListener('click', () => {
      const open = absenceMenu.hidden;
      absenceMenu.hidden = !open;
      absenceToggle.setAttribute('aria-expanded', String(open));
    });
    absence.addEventListener('focusout', (e) => {
      if (!absence.contains(e.relatedTarget)) {
        absenceMenu.hidden = true;
        absenceToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // mobile menu
  const burger = header.querySelector('[data-menu-toggle]');
  const mobileMenu = header.querySelector('[data-mobile-menu]');
  if (burger && mobileMenu) {
    // the overlay covers the page, but the page behind it stays focusable and
    // readable to assistive tech unless we explicitly take it out of the tree —
    // otherwise tabbing past the last menu link walks the hidden document.
    // NB: do NOT inert .site-header__inner — the burger that closes the menu
    // lives inside it, and `inert` cascades to descendants and can't be undone
    // on a child, so inerting the header made the close button dead (no way to
    // shut the menu on touch, where there's no Escape key). The header's other
    // controls are display:none at mobile widths, so nothing focusable leaks.
    const behind = () => [
      document.querySelector('main'),
      document.querySelector('footer'),
    ].filter(Boolean);

    burger.addEventListener('click', () => {
      const open = mobileMenu.hidden;
      mobileMenu.hidden = !open;
      burger.setAttribute('aria-expanded', String(open));
      header.classList.toggle('is-open', open);
      document.documentElement.style.overflow = open ? 'hidden' : '';
      behind().forEach((el) => { el.inert = open; });
      if (open) mobileMenu.querySelector('a, button')?.focus();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeAll();
    if (absenceMenu && !absenceMenu.hidden) {
      absenceMenu.hidden = true;
      absenceToggle.setAttribute('aria-expanded', 'false');
      absenceToggle.focus();
    }
    if (mobileMenu && !mobileMenu.hidden) {
      mobileMenu.hidden = true;
      burger.setAttribute('aria-expanded', 'false');
      header.classList.remove('is-open');
      document.documentElement.style.overflow = '';
      // must mirror the open handler — leaving these inert would make the
      // whole page unresponsive after closing with Escape
      [document.querySelector('main'), document.querySelector('footer')]
        .filter(Boolean).forEach((el) => { el.inert = false; });
      burger.focus();
    }
  });

  // outside click closes dropdowns
  document.addEventListener('pointerdown', (e) => {
    if (!header.contains(e.target)) {
      closeAll();
      if (absenceMenu && !absenceMenu.hidden) {
        absenceMenu.hidden = true;
        absenceToggle.setAttribute('aria-expanded', 'false');
      }
    }
  });
}
