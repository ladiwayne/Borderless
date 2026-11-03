(() => {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = 'light';
  try {
    localStorage.removeItem('borderless-theme');
  } catch {}

  function prepareNavigation() {
    const headers = document.querySelectorAll('.hubx-main-nav');
    const controllers = [];

    headers.forEach((header, index) => {
      const navigation = header.querySelector('.hubx-nav-links');
      if (!navigation) return;
      const actions = header.querySelector('.hubx-nav-actions');
      if (actions && !actions.querySelector('a[href="account.html"]')) {
        const accountLink = document.createElement('a');
        accountLink.href = 'account.html';
        accountLink.className = 'hubx-link';
        accountLink.textContent = 'Account';
        const primaryAction = actions.querySelector('.hubx-cta');
        actions.insertBefore(accountLink, primaryAction || null);
      }
      let menu = header.querySelector('.hubx-mobile-menu, .phase-mobile-menu');
      if (!menu) {
        menu = document.createElement('div');
        menu.className = 'hubx-mobile-menu';
        header.append(menu);
      }

      menu.id ||= `mobile-navigation-${index + 1}`;
      if (menu.children.length === 0) {
        const seenLinks = new Set();
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        const linkSources = [navigation, actions].filter(Boolean);
        linkSources.forEach((source) => source.querySelectorAll('a[href]').forEach((sourceLink) => {
          const href = sourceLink.getAttribute('href');
          if (!href || href === '#' || seenLinks.has(href)) return;
          seenLinks.add(href);
          const link = sourceLink.cloneNode(true);
          if (link.classList.contains('hubx-cta')) {
            link.classList.add('mobile-cta-link');
          }
          const destination = new URL(link.href, window.location.href);
          if (destination.pathname.split('/').pop() === currentPage && !destination.hash) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
          }
          menu.append(link);
        }));
      }

      let toggle = header.querySelector('.hubx-mobile-toggle');
      if (!toggle) {
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'hubx-mobile-toggle';
        toggle.textContent = 'Menu';
        header.querySelector('.hubx-nav-inner')?.insertBefore(toggle, navigation);
      }
      toggle.dataset.mobileNavToggle = '';
      toggle.setAttribute('aria-controls', menu.id);
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation');
      menu.dataset.mobileNavMenu = '';
      menu.hidden = true;
      controllers.push({ toggle, menu });
    });

    const closeMenu = ({ toggle, menu }, returnFocus = false) => {
      menu.hidden = true;
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation');
      toggle.textContent = 'Menu';
      if (returnFocus) toggle.focus();
    };

    controllers.forEach((controller) => {
      controller.toggle.addEventListener('click', () => {
        const open = !controller.menu.hidden;
        controllers.forEach((item) => closeMenu(item));
        if (!open) {
          controller.menu.hidden = false;
          controller.menu.classList.add('open');
          controller.toggle.setAttribute('aria-expanded', 'true');
          controller.toggle.setAttribute('aria-label', 'Close navigation');
          controller.toggle.textContent = 'Close';
        }
      });
      controller.menu.addEventListener('click', (event) => {
        if (event.target instanceof Element && event.target.closest('a')) closeMenu(controller);
      });
    });

    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      controllers.forEach((controller) => {
        if (!controller.toggle.closest('.hubx-main-nav')?.contains(event.target)) closeMenu(controller);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const openController = controllers.find(({ menu }) => !menu.hidden);
      if (openController) closeMenu(openController, true);
    });

    window.matchMedia('(min-width: 801px)').addEventListener('change', () => {
      controllers.forEach((controller) => closeMenu(controller));
    });
  }

  function normalizePlaceholders() {
    const nodes = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = nodes.nextNode())) {
      if (!node.parentElement?.closest('script, style')) node.nodeValue = node.nodeValue.replaceAll('\u2014', '...');
    }
  }

  function initialize() {
    normalizePlaceholders();
    prepareNavigation();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
