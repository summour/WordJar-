// WordJar top menu toggle
// Collapses the existing top nav into one header button, then opens the original buttons as a compact row.
(function () {
  if (window.__wordjarTopMenuToggleInstalled) return;
  window.__wordjarTopMenuToggleInstalled = true;

  function menuIcon() {
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M4 7h16"></path>
        <path d="M4 12h16"></path>
        <path d="M4 17h16"></path>
      </svg>
    `;
  }

  function moveSettingsToEnd(nav) {
    const settings = document.getElementById('tb-account');
    if (!nav || !settings) return;
    nav.appendChild(settings);
  }

  function initWordJarTopMenuToggle() {
    const header = document.getElementById('mainHeader');
    const nav = header?.querySelector('.top-nav');
    const brand = header?.querySelector('.brand');

    if (!header || !nav || !brand) return;

    moveSettingsToEnd(nav);

    let toggle = document.getElementById('wordjarHeaderMenuToggle');

    if (!toggle) {
      toggle = document.createElement('button');
      toggle.id = 'wordjarHeaderMenuToggle';
      toggle.className = 'wordjar-header-menu-toggle';
      toggle.type = 'button';
      toggle.setAttribute('aria-label', 'Open menu');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.innerHTML = menuIcon();
      brand.after(toggle);
    }

    function setOpen(isOpen) {
      header.classList.toggle('wordjar-menu-open', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    }

    header.classList.add('wordjar-top-menu-ready');

    toggle.addEventListener('click', function (event) {
      event.stopPropagation();
      setOpen(!header.classList.contains('wordjar-menu-open'));
    });

    nav.querySelectorAll('button').forEach(button => {
      button.addEventListener('click', function () {
        setOpen(false);
      });
    });

    document.addEventListener('click', function (event) {
      if (!header.contains(event.target)) setOpen(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setOpen(false);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWordJarTopMenuToggle, { once: true });
  } else {
    initWordJarTopMenuToggle();
  }
})();
