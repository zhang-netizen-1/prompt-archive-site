import { recordRecentCopy } from '../lib/recent-copies.mjs';

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    let textarea: HTMLTextAreaElement | undefined;
    const focused = document.activeElement as HTMLElement | null;
    try {
      textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      return document.execCommand('copy');
    } catch { return false; }
    finally { textarea?.remove(); focused?.focus({ preventScroll: true }); }
  }
}

export function initCopyButtons() {
  document.querySelectorAll<HTMLButtonElement>('[data-copy-button]').forEach(button => {
    let timer: ReturnType<typeof setTimeout>;
    const label = button.querySelector<HTMLElement>('[data-copy-text]');
    const defaultText = label?.textContent ?? '复制';
    const feedback = button.closest('[data-copy-context]')?.querySelector<HTMLElement>('[data-copy-feedback]');
    button.addEventListener('click', async () => {
      button.disabled = true;
      clearTimeout(timer);
      let ok = false;
      try {
        const payload = document.getElementById(button.dataset.copySource!)!;
        const raw = JSON.parse(payload.textContent ?? 'null');
        if (typeof raw === 'string') ok = await copyText(raw);
      } catch { /* 无有效原文时不复制。 */ }
      button.disabled = false;
      if (label) label.textContent = ok ? '已复制' : defaultText;
      button.classList.toggle('copied', ok);
      if (feedback) {
        feedback.textContent = ok ? '已复制' : '复制失败，请手动选取';
        feedback.classList.toggle('error', !ok);
      }
      if (ok) {
        recordRecentCopy(undefined, {
          slug: button.dataset.copySlug, title: button.dataset.copyTitle,
          href: button.dataset.copyHref, t: Date.now(),
        });
        window.dispatchEvent(new Event('pa:recent-copies-changed'));
      }
      timer = setTimeout(() => {
        if (label) label.textContent = defaultText;
        button.classList.remove('copied');
        if (feedback) { feedback.textContent = ''; feedback.classList.remove('error'); }
      }, 2000);
    });
  });
}
