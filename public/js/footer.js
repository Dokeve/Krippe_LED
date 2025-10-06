// public/js/footer.js
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = '.global-footer{margin:48px auto 16px;max-width:1200px;padding:12px 18px;text-align:center;color:#c6dbff;background:rgba(16,39,71,0.65);border:1px solid #1b3b6b;border-radius:10px;} .global-footer small{font-size:0.85rem;letter-spacing:0.01em;}';
    document.head.appendChild(style);

    const raw = document.lastModified;
    let label = raw;
    const parsed = raw ? new Date(raw) : null;
    if (parsed && !Number.isNaN(parsed.getTime())) {
      label = parsed.toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short' });
    }

    const applyFooter = (footer) => {
      if (!footer) return;
      footer.classList.add('global-footer');
      let small = footer.querySelector('small');
      if (!small) {
        small = document.createElement('small');
        footer.innerHTML = '';
        footer.appendChild(small);
      }
      small.textContent = 'Letzte \u00C4nderung: ' + label;
    };

    const existing = document.querySelectorAll('footer');
    if (existing.length > 0) {
      existing.forEach(applyFooter);
      return;
    }

    const footer = document.createElement('footer');
    applyFooter(footer);
    document.body.appendChild(footer);
  });
})();
