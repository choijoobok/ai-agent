/* file://에서도 동작하는 단일 HTML 사이트 탐색기 */
(() => {
  const root = document.documentElement;
  const pages = [...document.querySelectorAll('[data-page]')];
  const links = [...document.querySelectorAll('[data-page-link]')];
  const filter = document.querySelector('[data-tree-filter]');

  function resolvedTheme() {
    return root.dataset.theme === 'light' ? 'light' : 'dark';
  }
  function syncThemeControls() {
    const dark = resolvedTheme() === 'dark';
    document.querySelectorAll('.theme-icon-dark').forEach((icon) => { icon.hidden = !dark; });
    document.querySelectorAll('.theme-icon-light').forEach((icon) => { icon.hidden = dark; });
    const toggle = document.querySelector('[data-theme-toggle]');
    toggle?.setAttribute('aria-label', dark ? '라이트 테마로 전환' : '다크 테마로 전환');
    document.querySelectorAll('[data-mockup-body]').forEach((host) => { host.dataset.theme = resolvedTheme(); });
  }
  function theme(value) {
    root.dataset.theme = value;
    try { localStorage.setItem('delivery-theme', value); } catch { /* file:// 저장소 제한 */ }
    syncThemeControls();
  }
  let saved = matchMedia('(prefers-color-scheme:light)').matches ? 'light' : 'dark';
  try {
    const stored = localStorage.getItem('delivery-theme');
    if (stored === 'light' || stored === 'dark') saved = stored;
  } catch { /* 무시 */ }
  theme(saved);
  document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
    theme(resolvedTheme() === 'dark' ? 'light' : 'dark');
  });

  function injectMockups() {
    const registry = window.DELIVERY_MOCKUPS || {};
    document.querySelectorAll('[data-mockup]').forEach((holder) => {
      const item = registry[holder.dataset.mockup];
      const body = holder.querySelector('[data-mockup-body]');
      if (!item || !body) return;
      body.dataset.theme = resolvedTheme();
      const shadow = body.attachShadow({ mode: 'open' });
      const isolatedStyle = (item.style || '')
        .replace(/:root/g, ':host')
        .replace(/(^|[}\s,])body(?=\s*[{,.#[:])/gm, '$1.mockup-root');
      shadow.innerHTML = `<style>:host{display:block;color-scheme:light dark}${isolatedStyle}</style><div class="mockup-root">${item.html}</div>`;
    });
    syncThemeControls();
  }

  function activateDocumentTab(button, focus = false) {
    const tabs = button.closest('[data-document-tabs]');
    if (!tabs) return;
    const key = button.dataset.documentTab;
    tabs.querySelectorAll('[data-document-tab]').forEach((item) => {
      const selected = item === button;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    tabs.querySelectorAll('[data-document-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.documentPanel !== key;
    });
    if (focus) button.focus();
  }

  document.querySelectorAll('[data-document-tab]').forEach((button) => {
    button.addEventListener('click', () => activateDocumentTab(button));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const buttons = [...button.closest('[role="tablist"]').querySelectorAll('[data-document-tab]')];
      const current = buttons.indexOf(button);
      const next = event.key === 'Home' ? 0
        : event.key === 'End' ? buttons.length - 1
          : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      event.preventDefault();
      activateDocumentTab(buttons[next], true);
    });
  });

  function show(id, updateHash = true) {
    if (!pages.some((page) => page.id === id)) return false;
    pages.forEach((page) => { page.hidden = page.id !== id; });
    links.forEach((link) => {
      const active = link.dataset.pageLink === id;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (updateHash) history.replaceState(null, '', `#${id}`);
    document.querySelector('.main-wrap')?.scrollTo(0, 0);
    return true;
  }

  function closeSidebar() {
    document.querySelector('#sidebar')?.classList.remove('open');
    document.querySelector('.sidebar-backdrop')?.classList.remove('open');
    const button = document.querySelector('[data-menu-toggle]');
    button?.setAttribute('aria-expanded', 'false');
    button?.setAttribute('aria-label', '목차 열기');
  }

  links.forEach((link) => link.addEventListener('click', () => {
    show(link.dataset.pageLink);
    closeSidebar();
  }));
  if (!(location.search.includes('print=all'))) {
    if (!show(location.hash.slice(1), false) && pages[0]) show(pages[0].id, false);
  } else {
    pages.forEach((page) => { page.hidden = false; });
  }
  addEventListener('hashchange', () => show(location.hash.slice(1), false));

  document.querySelectorAll('[data-tree-group]').forEach((button) => {
    button.addEventListener('click', () => {
      const collapsed = button.closest('li')?.classList.toggle('collapsed') ?? false;
      button.setAttribute('aria-expanded', String(!collapsed));
    });
  });
  document.querySelector('[data-menu-toggle]')?.addEventListener('click', () => {
    const open = document.querySelector('#sidebar')?.classList.toggle('open') ?? false;
    document.querySelector('.sidebar-backdrop')?.classList.toggle('open', open);
    const button = document.querySelector('[data-menu-toggle]');
    button?.setAttribute('aria-expanded', String(open));
    button?.setAttribute('aria-label', open ? '목차 닫기' : '목차 열기');
  });
  document.querySelector('.sidebar-backdrop')?.addEventListener('click', closeSidebar);

  filter?.addEventListener('input', () => {
    const query = filter.value.trim().toLocaleLowerCase();
    links.forEach((link) => {
      const page = document.getElementById(link.dataset.pageLink);
      const hit = !query || `${link.textContent} ${page?.textContent || ''}`.toLocaleLowerCase().includes(query);
      link.closest('li')?.classList.toggle('filtered', !hit);
    });
    document.querySelectorAll('.tree > ul > li').forEach((group) => {
      group.classList.toggle('filtered', ![...group.querySelectorAll('[data-page-link]')]
        .some((link) => !link.closest('li')?.classList.contains('filtered')));
    });
  });

  document.querySelector('[data-print-all]')?.addEventListener('click', () => window.print());
  injectMockups();
})();
