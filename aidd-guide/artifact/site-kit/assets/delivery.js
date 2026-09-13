/* file://에서도 동작하는 단일 HTML 사이트 탐색기 */
(() => {
  const root = document.documentElement;
  const pages = [...document.querySelectorAll('[data-page]')];
  const links = [...document.querySelectorAll('[data-page-link]')];
  const filter = document.querySelector('[data-tree-filter]');

  function theme(value) {
    if (value === 'system') delete root.dataset.theme;
    else root.dataset.theme = value;
    try { localStorage.setItem('delivery-theme', value); } catch { /* file:// 저장소 제한 */ }
  }
  let saved = 'system';
  try { saved = localStorage.getItem('delivery-theme') || 'system'; } catch { /* 무시 */ }
  theme(saved);
  document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
    const dark = root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme:dark)').matches);
    theme(dark ? 'light' : 'dark');
  });

  function injectMockups() {
    const registry = window.DELIVERY_MOCKUPS || {};
    const styles = new Set();
    document.querySelectorAll('[data-mockup]').forEach((holder) => {
      const item = registry[holder.dataset.mockup];
      const body = holder.querySelector('[data-mockup-body]');
      if (!item || !body) return;
      body.innerHTML = item.html;
      if (item.style) styles.add(item.style);
    });
    if (styles.size) {
      const style = document.createElement('style');
      style.dataset.deliveryMockups = '';
      style.textContent = [...styles].join('\n');
      document.head.appendChild(style);
    }
  }

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
