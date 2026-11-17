export const RECENT_COPIES_KEY = 'pa:recent-copies';
export const RECENT_COPIES_LIMIT = 8;

function validEntry(item) {
  return item && typeof item.slug === 'string' && item.slug.length > 0
    && typeof item.title === 'string' && item.title.length > 0
    && typeof item.href === 'string' && /^\/(?!\/)/.test(item.href)
    && !/[\\\s]/.test(item.href) && Number.isFinite(item.t);
}

function ordered(items) {
  const seen = new Set();
  return items.filter(validEntry).toSorted((a, b) => b.t - a.t).filter(item => {
    if (seen.has(item.slug)) return false;
    seen.add(item.slug);
    return true;
  }).slice(0, RECENT_COPIES_LIMIT).map(({ slug, title, href, t }) => ({ slug, title, href, t }));
}

export function parseRecentCopies(raw) {
  try {
    const items = JSON.parse(raw);
    return Array.isArray(items) && items.every(validEntry) ? ordered(items) : [];
  } catch { return []; }
}

export function addRecentCopy(items, entry) {
  return ordered([entry, ...items.filter(item => item.slug !== entry.slug)]);
}

// 调用方传入存储；默认 getter 也放在 try 内，覆盖浏览器禁用存储的情况。
export function readRecentCopies(storage) {
  try {
    const target = storage ?? window.localStorage;
    const raw = target.getItem(RECENT_COPIES_KEY);
    const items = parseRecentCopies(raw);
    if (raw !== null && items.length === 0) target.removeItem(RECENT_COPIES_KEY);
    return items;
  } catch { return null; }
}

export function recordRecentCopy(storage, entry) {
  try {
    const target = storage ?? window.localStorage;
    const items = readRecentCopies(target);
    if (items === null) return null;
    const next = addRecentCopy(items, entry);
    target.setItem(RECENT_COPIES_KEY, JSON.stringify(next));
    return next;
  } catch { return null; }
}

export function clearRecentCopies(storage) {
  try {
    (storage ?? window.localStorage).removeItem(RECENT_COPIES_KEY);
    return true;
  } catch { return false; }
}
