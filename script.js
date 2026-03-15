/* =============================================
   RESINA – Landing Page Script
   ============================================= */

(function () {
  'use strict';

  // ── Sticky Header ────────────────────────────────
  const header = document.getElementById('header');
  if (header) {
    const onScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── Mobile Navigation Toggle ─────────────────────
  const navToggle = document.getElementById('navToggle');
  const navList = document.getElementById('navList');

  if (navToggle && navList) {
    navToggle.addEventListener('click', () => {
      const isOpen = navList.classList.toggle('open');
      navToggle.classList.toggle('open', isOpen);
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Close on link click
    navList.querySelectorAll('.nav__link').forEach((link) => {
      link.addEventListener('click', () => {
        navList.classList.remove('open');
        navToggle.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (
        navList.classList.contains('open') &&
        !navList.contains(e.target) &&
        !navToggle.contains(e.target)
      ) {
        navList.classList.remove('open');
        navToggle.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ── Billing Toggle (Pricing) ─────────────────────
  const billingToggle = document.getElementById('billingToggle');
  const monthlyLabel = document.getElementById('monthlyLabel');
  const annualLabel = document.getElementById('annualLabel');

  if (billingToggle) {
    billingToggle.addEventListener('click', () => {
      const isAnnual = billingToggle.getAttribute('aria-checked') === 'true';
      const nextState = !isAnnual;
      billingToggle.setAttribute('aria-checked', String(nextState));

      if (monthlyLabel) {
        monthlyLabel.classList.toggle('pricing__toggle-label--active', !nextState);
      }
      if (annualLabel) {
        annualLabel.classList.toggle('pricing__toggle-label--active', nextState);
      }

      // Update prices
      document.querySelectorAll('.pricing-card__amount[data-monthly]').forEach((el) => {
        el.textContent = nextState
          ? el.getAttribute('data-annual')
          : el.getAttribute('data-monthly');
      });
    });
  }

  // ── Scroll-triggered Animations ──────────────────
  const observerConfig = {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px',
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fade-up');
        observer.unobserve(entry.target);
      }
    });
  }, observerConfig);

  // Elements to animate on scroll
  const animatables = document.querySelectorAll(
    '.feature-card, .platform-panel, .step, .pricing-card'
  );

  animatables.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.animationFillMode = 'both';
    // Stagger delay capped at 4 items per row
    const delay = (i % 4) * 0.1;
    el.style.animationDelay = `${delay}s`;
    observer.observe(el);
  });

  // ── Footer: Current Year ──────────────────────────
  const yearEl = document.getElementById('currentYear');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // ── CTA Email form (basic client-side validation) ─
  const ctaInput = document.querySelector('.cta__input');
  const ctaButton = document.querySelector('.cta .btn--primary');

  if (ctaInput && ctaButton) {
    ctaButton.addEventListener('click', () => {
      const email = ctaInput.value.trim();
      if (!email) {
        ctaInput.focus();
        shake(ctaInput);
        return;
      }
      if (!isValidEmail(email)) {
        shake(ctaInput);
        return;
      }
      // Success feedback
      ctaButton.textContent = '✓ You\'re on the list!';
      ctaButton.disabled = true;
      ctaInput.disabled = true;
      ctaInput.value = '';
    });

    ctaInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') ctaButton.click();
    });
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function shake(el) {
    el.classList.remove('shake');
    // Force reflow
    void el.offsetWidth;
    el.classList.add('shake');
    el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
  }
})();
