import { readRecentCopies, clearRecentCopies, RECENT_COPIES_KEY } from '../lib/recent-copies.mjs';

export function initRecentCopies() {
  document.querySelectorAll<HTMLElement>('[data-recent-copies]').forEach(strip => {
    const links = strip.querySelector<HTMLElement>('[data-recent-links]')!;
    function render() {
      const items = readRecentCopies();
      strip.hidden = !items?.length;
      links.replaceChildren(...(items ?? []).map(item => {
        const link = document.createElement('a');
        link.className = 'recent-link';
        link.href = item.href;
        link.title = item.title;
        link.textContent = item.title;
        return link;
      }));
    }
    strip.querySelector('[data-recent-clear]')?.addEventListener('click', () => {
      clearRecentCopies();
      strip.hidden = true;
      window.dispatchEvent(new Event('pa:recent-copies-changed'));
    });
    window.addEventListener('pa:recent-copies-changed', render);
    window.addEventListener('storage', event => {
      if (event.key === RECENT_COPIES_KEY || event.key === null) render();
    });
    window.addEventListener('pageshow', render);
    render();
  });
}
